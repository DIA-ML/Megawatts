import {
  CircuitBreakerState,
  CircuitBreakerConfig,
  CircuitBreakerMetrics,
  ConnectionEvent,
  ConnectionEventType,
  ConnectionEventListener
} from './types';
import { Logger } from '../../utils/logger';
import { BotError } from '../../utils/errors';

/**
 * Circuit breaker pattern implementation for connection protection
 */
export class CircuitBreaker {
  private config: CircuitBreakerConfig;
  private logger: Logger;
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private metrics: CircuitBreakerMetrics;
  private listeners: Map<ConnectionEventType, Set<ConnectionEventListener>> = new Map();
  private stateChangeTime: number = Date.now();
  private halfOpenCalls: number = 0;
  private resetTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(config: CircuitBreakerConfig, logger: Logger) {
    this.config = config;
    this.logger = new Logger('CircuitBreaker');
    this.metrics = this.initializeMetrics();
  }

  /**
   * Initialize circuit breaker metrics
   */
  private initializeMetrics(): CircuitBreakerMetrics {
    return {
      state: CircuitBreakerState.CLOSED,
      failureCount: 0,
      successCount: 0,
      totalCalls: 0,
      rejectedCalls: 0
    };
  }

  /**
   * Execute operation with circuit breaker protection
   */
  public async execute<T>(
    operation: () => Promise<T>,
    operationName: string = 'unknown'
  ): Promise<T> {
    if (!this.config.enabled) {
      return await operation();
    }

    this.metrics.totalCalls++;

    // Check if circuit is open
    if (this.state === CircuitBreakerState.OPEN) {
      this.metrics.rejectedCalls++;
      
      this.logger.warn(`Circuit breaker OPEN - rejecting call to ${operationName}`);

      await this.emitEvent({
        type: ConnectionEventType.CIRCUIT_BREAKER_TRIGGERED,
        timestamp: new Date(),
        data: {
          circuitBreakerState: this.state,
          metadata: {
            operationName,
            rejectedCalls: this.metrics.rejectedCalls,
            totalCalls: this.metrics.totalCalls
          }
        }
      });

      throw new BotError(
        `Circuit breaker is open - operation ${operationName} rejected`,
        'medium',
        {
          state: this.state,
          failureCount: this.metrics.failureCount,
          nextAttempt: this.metrics.nextAttempt
        }
      );
    }

    // Check if we should attempt to reset
    if (this.state === CircuitBreakerState.OPEN && this.shouldAttemptReset()) {
      this.transitionToHalfOpen();
    }

    try {
      const result = await operation();
      this.onSuccess(operationName);
      return result;
    } catch (error) {
      this.onFailure(operationName, error as Error);
      throw error;
    }
  }

  /**
   * Handle successful operation
   */
  private onSuccess(operationName: string): void {
    this.metrics.successCount++;
    
    // Reset failure count on success
    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.metrics.failureCount = 0;
      this.transitionToClosed();
    }

    this.logger.debug(`Operation ${operationName} succeeded`, {
      state: this.state,
      successCount: this.metrics.successCount,
      failureCount: this.metrics.failureCount
    });
  }

  /**
   * Handle failed operation
   */
  private onFailure(operationName: string, error: Error): void {
    this.metrics.failureCount++;
    this.metrics.lastFailureTime = new Date();

    this.logger.warn(`Operation ${operationName} failed`, {
      state: this.state,
      error: error.message,
      failureCount: this.metrics.failureCount,
      threshold: this.config.failureThreshold
    });

    // Check if we should open the circuit
    if (this.shouldOpenCircuit()) {
      this.transitionToOpen();
    }

    // Handle half-open state failures
    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.halfOpenCalls++;
      if (this.halfOpenCalls >= this.config.halfOpenMaxCalls) {
        this.transitionToOpen();
      }
    }
  }

  /**
   * Check if circuit should be opened
   */
  private shouldOpenCircuit(): boolean {
    if (this.state === CircuitBreakerState.OPEN) {
      return false;
    }

    // Check failure threshold
    if (this.metrics.failureCount >= this.config.failureThreshold) {
      return true;
    }

    // Check failure rate within monitoring period
    const now = Date.now();
    const monitoringStart = now - this.config.monitoringPeriod;
    
    // This would require tracking failures over time - simplified for now
    return false;
  }

  /**
   * Check if we should attempt to reset
   */
  private shouldAttemptReset(): boolean {
    if (!this.metrics.nextAttempt) {
      return false;
    }

    return Date.now() >= this.metrics.nextAttempt.getTime();
  }

  /**
   * Transition to OPEN state
   */
  private transitionToOpen(): void {
    const previousState = this.state;
    this.state = CircuitBreakerState.OPEN;
    this.stateChangeTime = Date.now();
    
    // Schedule reset
    this.metrics.nextAttempt = new Date(Date.now() + this.config.resetTimeout);
    
    this.logger.warn(`Circuit breaker OPENED`, {
      previousState,
      failureCount: this.metrics.failureCount,
      threshold: this.config.failureThreshold,
      nextAttempt: this.metrics.nextAttempt
    });

    this.emitStateChangeEvent(previousState);

    // Set timeout for half-open transition
    this.resetTimeout = setTimeout(() => {
      this.transitionToHalfOpen();
    }, this.config.timeout);
  }

  /**
   * Transition to CLOSED state
   */
  private transitionToClosed(): void {
    const previousState = this.state;
    this.state = CircuitBreakerState.CLOSED;
    this.stateChangeTime = Date.now();
    this.halfOpenCalls = 0;
    
    // Clear any pending timeout
    if (this.resetTimeout) {
      clearTimeout(this.resetTimeout);
      this.resetTimeout = null;
    }

    this.logger.info(`Circuit breaker CLOSED`, {
      previousState,
      successCount: this.metrics.successCount,
      failureCount: this.metrics.failureCount
    });

    this.emitStateChangeEvent(previousState);
  }

  /**
   * Transition to HALF_OPEN state
   */
  private transitionToHalfOpen(): void {
    const previousState = this.state;
    this.state = CircuitBreakerState.HALF_OPEN;
    this.stateChangeTime = Date.now();
    this.halfOpenCalls = 0;
    
    // Clear any pending timeout
    if (this.resetTimeout) {
      clearTimeout(this.resetTimeout);
      this.resetTimeout = null;
    }

    this.logger.info(`Circuit breaker HALF_OPEN`, {
      previousState,
      failureCount: this.metrics.failureCount,
      maxCalls: this.config.halfOpenMaxCalls
    });

    this.emitStateChangeEvent(previousState);
  }

  /**
   * Emit state change event
   */
  private async emitStateChangeEvent(previousState: CircuitBreakerState): Promise<void> {
    this.metrics.state = this.state;

    await this.emitEvent({
      type: ConnectionEventType.CIRCUIT_BREAKER_TRIGGERED,
      timestamp: new Date(),
      data: {
        circuitBreakerState: this.state,
        metadata: {
          previousState,
          failureCount: this.metrics.failureCount,
          successCount: this.metrics.successCount,
          stateChangeTime: this.stateChangeTime
        }
      }
    });
  }

  /**
   * Force circuit breaker state
   */
  public forceState(state: CircuitBreakerState, reason?: string): void {
    const previousState = this.state;
    this.state = state;
    this.stateChangeTime = Date.now();

    this.logger.info(`Circuit breaker state forced to ${state}`, {
      previousState,
      reason
    });

    this.emitStateChangeEvent(previousState);
  }

  /**
   * Reset circuit breaker
   */
  public reset(): void {
    const previousState = this.state;
    this.state = CircuitBreakerState.CLOSED;
    this.stateChangeTime = Date.now();
    this.metrics = this.initializeMetrics();
    this.halfOpenCalls = 0;

    // Clear any pending timeout
    if (this.resetTimeout) {
      clearTimeout(this.resetTimeout);
      this.resetTimeout = undefined;
    }

    this.logger.info(`Circuit breaker RESET`, {
      previousState
    });

    this.emitStateChangeEvent(previousState);
  }

  /**
   * Get current state
   */
  public getState(): CircuitBreakerState {
    return this.state;
  }

  /**
   * Get metrics
   */
  public getMetrics(): CircuitBreakerMetrics {
    return { ...this.metrics };
  }

  /**
   * Get detailed status
   */
  public getStatus(): {
    state: CircuitBreakerState;
    metrics: CircuitBreakerMetrics;
    config: CircuitBreakerConfig;
    timeInState: number;
    canExecute: boolean;
    nextAttempt?: Date;
  } {
    return {
      state: this.state,
      metrics: this.getMetrics(),
      config: { ...this.config },
      timeInState: Date.now() - this.stateChangeTime,
      canExecute: this.state !== CircuitBreakerState.OPEN,
      nextAttempt: this.metrics.nextAttempt
    };
  }

  /**
   * Check if operation can be executed
   */
  public canExecute(): boolean {
    if (!this.config.enabled) {
      return true;
    }

    return this.state !== CircuitBreakerState.OPEN || this.shouldAttemptReset();
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<CircuitBreakerConfig>): void {
    this.config = { ...this.config, ...config };
    this.logger.debug('Circuit breaker configuration updated', config);
  }

  /**
   * Add event listener
   */
  public addEventListener(eventType: ConnectionEventType, listener: ConnectionEventListener): void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(listener);
  }

  /**
   * Remove event listener
   */
  public removeEventListener(eventType: ConnectionEventType, listener: ConnectionEventListener): void {
    this.listeners.get(eventType)?.delete(listener);
  }

  /**
   * Emit connection event
   */
  private async emitEvent(event: ConnectionEvent): Promise<void> {
    const listeners = this.listeners.get(event.type);
    if (listeners) {
      await Promise.all(Array.from(listeners).map(listener =>
        Promise.resolve(listener(event)).catch(error =>
          this.logger.error('Event listener error:', error)
        )
      ));
    }
  }

  /**
   * Get failure rate
   */
  public getFailureRate(): number {
    if (this.metrics.totalCalls === 0) {
      return 0;
    }

    return this.metrics.failureCount / this.metrics.totalCalls;
  }

  /**
   * Get success rate
   */
  public getSuccessRate(): number {
    if (this.metrics.totalCalls === 0) {
      return 0;
    }

    return this.metrics.successCount / this.metrics.totalCalls;
  }

  /**
   * Check if circuit is degraded
   */
  public isDegraded(): boolean {
    return this.state !== CircuitBreakerState.CLOSED;
  }

  /**
   * Get time until next attempt
   */
  public getTimeUntilNextAttempt(): number {
    if (!this.metrics.nextAttempt || this.state !== CircuitBreakerState.OPEN) {
      return 0;
    }

    return Math.max(0, this.metrics.nextAttempt.getTime() - Date.now());
  }

  /**
   * Get health score
   */
  public getHealthScore(): number {
    const successRate = this.getSuccessRate();
    const failureRate = this.getFailureRate();
    
    // Base score on success/failure rates
    let score = successRate * 100;
    
    // Penalize for being open
    if (this.state === CircuitBreakerState.OPEN) {
      score *= 0.1;
    } else if (this.state === CircuitBreakerState.HALF_OPEN) {
      score *= 0.5;
    }

    // Penalize for high failure rate
    if (failureRate > 0.1) {
      score *= (1 - failureRate);
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Cleanup resources
   */
  public cleanup(): void {
    if (this.resetTimeout) {
      clearTimeout(this.resetTimeout);
      this.resetTimeout = undefined;
    }

    this.listeners.clear();
    this.logger.debug('Circuit breaker cleaned up');
  }
}