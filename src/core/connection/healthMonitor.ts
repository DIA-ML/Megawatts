import {
  ConnectionHealthLevel,
  ConnectionMetrics,
  HealthCheckConfig,
  HealthCheck,
  HealthCheckResult,
  ConnectionEvent,
  ConnectionEventType,
  ConnectionEventListener,
  ConnectionStatus,
  ConnectionDiagnostics
} from './types';
import { Logger } from '../../utils/logger';
import { BotError } from '../../utils/errors';

/**
 * Advanced connection health monitor with comprehensive metrics
 */
export class ConnectionHealthMonitor {
  private logger: Logger;
  private config: HealthCheckConfig;
  private metrics: ConnectionMetrics;
  private currentHealth: ConnectionHealthLevel = ConnectionHealthLevel.UNKNOWN;
  private healthCheckInterval: ReturnType<typeof setInterval> | null = null;
  private listeners: Map<ConnectionEventType, Set<ConnectionEventListener>> = new Map();
  private healthCheckResults: Map<string, HealthCheckResult[]> = new Map();
  private isMonitoring = false;
  private lastHealthCheck?: Date;

  constructor(config: HealthCheckConfig, logger: Logger) {
    this.config = config;
    this.logger = new Logger('ConnectionHealthMonitor');
    this.metrics = this.initializeMetrics();
    this.setupDefaultHealthChecks();
  }

  /**
   * Initialize connection metrics
   */
  private initializeMetrics(): ConnectionMetrics {
    return {
      totalConnections: 0,
      totalDisconnections: 0,
      totalReconnections: 0,
      currentUptime: 0,
      averageUptime: 0,
      latency: 0,
      averageLatency: 0,
      lastLatencyCheck: new Date(),
      totalErrors: 0,
      consecutiveErrors: 0,
      errorRate: 0,
      healthScore: 0,
      stabilityScore: 0,
      reliabilityScore: 0,
      lastHealthCheck: new Date(),
      gatewayResumes: 0,
      gatewayHeartbeats: 0,
      missedHeartbeats: 0,
      sessionId: this.generateSessionId(),
      sessionDuration: 0
    };
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Setup default health checks
   */
  private setupDefaultHealthChecks(): void {
    if (this.config.checks.length === 0) {
      this.config.checks = [
        {
          name: 'latency_check',
          type: 'latency',
          enabled: true,
          threshold: 1000,
          critical: false,
          executor: this.executeLatencyCheck.bind(this)
        },
        {
          name: 'gateway_check',
          type: 'gateway',
          enabled: true,
          threshold: 30000,
          critical: true,
          executor: this.executeGatewayCheck.bind(this)
        },
        {
          name: 'error_rate_check',
          type: 'api',
          enabled: true,
          threshold: 0.1,
          critical: false,
          executor: this.executeErrorRateCheck.bind(this)
        }
      ];
    }
  }

  /**
   * Start health monitoring
   */
  public startMonitoring(): void {
    if (this.isMonitoring) {
      this.logger.warn('Health monitoring already started');
      return;
    }

    this.isMonitoring = true;
    this.logger.info('Starting connection health monitoring');

    if (this.config.enabled && this.config.interval > 0) {
      this.healthCheckInterval = setInterval(async () => {
        await this.performHealthCheck();
      }, this.config.interval);

      // Perform initial health check
      this.performHealthCheck();
    }
  }

  /**
   * Stop health monitoring
   */
  public stopMonitoring(): void {
    if (!this.isMonitoring) {
      return;
    }

    this.isMonitoring = false;
    this.logger.info('Stopping connection health monitoring');

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  /**
   * Perform comprehensive health check
   */
  public async performHealthCheck(): Promise<{
    overall: boolean;
    health: ConnectionHealthLevel;
    results: HealthCheckResult[];
    score: number;
  }> {
    const results: HealthCheckResult[] = [];
    let overallPassed = true;
    let criticalFailures = 0;

    this.lastHealthCheck = new Date();

    // Execute all enabled health checks
    for (const check of this.config.checks) {
      if (!check.enabled) {
        continue;
      }

      try {
        const result = await this.executeHealthCheck(check);
        results.push(result);

        if (!result.passed) {
          overallPassed = false;
          if (check.critical) {
            criticalFailures++;
          }
        }

        // Store result history
        this.storeHealthCheckResult(check.name, result);
      } catch (error) {
        this.logger.error(`Health check '${check.name}' failed:`, error as Error);
        results.push({
          name: check.name,
          passed: false,
          threshold: check.threshold,
          message: `Check execution failed: ${(error as Error).message}`,
          duration: 0,
          timestamp: new Date()
        });
        overallPassed = false;
        if (check.critical) {
          criticalFailures++;
        }
      }
    }

    // Calculate overall health
    const healthScore = this.calculateHealthScore(results);
    const newHealth = this.determineHealthLevel(overallPassed, criticalFailures, healthScore);

    // Update health status if changed
    if (newHealth !== this.currentHealth) {
      const previousHealth = this.currentHealth;
      this.currentHealth = newHealth;
      this.metrics.healthScore = healthScore;

      await this.emitEvent({
        type: ConnectionEventType.HEALTH_CHANGED,
        timestamp: new Date(),
        data: {
          previousHealth,
          currentHealth: newHealth,
          metadata: {
            score: healthScore,
            results,
            criticalFailures
          }
        }
      });
    }

    // Update metrics
    this.updateHealthMetrics(results);

    return {
      overall: overallPassed,
      health: newHealth,
      results,
      score: healthScore
    };
  }

  /**
   * Execute individual health check
   */
  private async executeHealthCheck(check: HealthCheck): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      const result = await Promise.race([
        check.executor(),
        new Promise<HealthCheckResult>((_, reject) => 
          setTimeout(() => reject(new Error('Health check timeout')), this.config.timeout)
        )
      ]);

      return {
        ...result,
        duration: Date.now() - startTime
      };
    } catch (error) {
      return {
        name: check.name,
        passed: false,
        threshold: check.threshold,
        message: (error as Error).message,
        duration: Date.now() - startTime,
        timestamp: new Date()
      };
    }
  }

  /**
   * Execute latency check
   */
  private async executeLatencyCheck(): Promise<HealthCheckResult> {
    const latency = this.metrics.latency;
    const threshold = this.config.checks.find(c => c.name === 'latency_check')?.threshold || 1000;

    return {
      name: 'latency_check',
      passed: latency <= threshold,
      value: latency,
      threshold,
      message: latency <= threshold ? `Latency acceptable: ${latency}ms` : `High latency: ${latency}ms`,
      duration: 0,
      timestamp: new Date()
    };
  }

  /**
   * Execute gateway check
   */
  private async executeGatewayCheck(): Promise<HealthCheckResult> {
    const uptime = this.metrics.currentUptime;
    const missedHeartbeats = this.metrics.missedHeartbeats;
    const threshold = this.config.checks.find(c => c.name === 'gateway_check')?.threshold || 30000;

    // Check if gateway is responsive
    const gatewayHealthy = uptime > 0 && missedHeartbeats < 3;

    return {
      name: 'gateway_check',
      passed: gatewayHealthy,
      value: missedHeartbeats,
      threshold: 3,
      message: gatewayHealthy ? 
        `Gateway healthy (uptime: ${uptime}ms)` : 
        `Gateway issues detected (missed heartbeats: ${missedHeartbeats})`,
      duration: 0,
      timestamp: new Date()
    };
  }

  /**
   * Execute error rate check
   */
  private async executeErrorRateCheck(): Promise<HealthCheckResult> {
    const errorRate = this.metrics.errorRate;
    const threshold = this.config.checks.find(c => c.name === 'error_rate_check')?.threshold || 0.1;

    return {
      name: 'error_rate_check',
      passed: errorRate <= threshold,
      value: errorRate,
      threshold,
      message: errorRate <= threshold ? 
        `Error rate acceptable: ${(errorRate * 100).toFixed(2)}%` : 
        `High error rate: ${(errorRate * 100).toFixed(2)}%`,
      duration: 0,
      timestamp: new Date()
    };
  }

  /**
   * Store health check result history
   */
  private storeHealthCheckResult(checkName: string, result: HealthCheckResult): void {
    if (!this.healthCheckResults.has(checkName)) {
      this.healthCheckResults.set(checkName, []);
    }

    const history = this.healthCheckResults.get(checkName)!;
    history.push(result);

    // Keep only last 100 results per check
    if (history.length > 100) {
      history.shift();
    }
  }

  /**
   * Calculate health score based on check results
   */
  private calculateHealthScore(results: HealthCheckResult[]): number {
    if (results.length === 0) {
      return 0;
    }

    let totalScore = 0;
    let criticalWeight = 0;

    for (const result of results) {
      const check = this.config.checks.find(c => c.name === result.name);
      const weight = check?.critical ? 2 : 1;
      
      if (check?.critical) {
        criticalWeight += weight;
      }

      if (result.passed) {
        totalScore += weight * 100;
      } else {
        // Partial score based on how close to threshold
        if (result.value !== undefined && result.threshold > 0) {
          const ratio = Math.min(result.value / result.threshold, 2);
          const partialScore = Math.max(0, 100 - (ratio - 1) * 50);
          totalScore += weight * partialScore;
        }
      }
    }

    const totalWeight = results.reduce((sum, result) => {
      const check = this.config.checks.find(c => c.name === result.name);
      return sum + (check?.critical ? 2 : 1);
    }, 0);

    // Penalize heavily for critical failures
    if (criticalWeight > 0) {
      const criticalFailures = results.filter(r => {
        const check = this.config.checks.find(c => c.name === r.name);
        return check?.critical && !r.passed;
      }).length;
      
      if (criticalFailures > 0) {
        totalScore *= (1 - (criticalFailures / criticalWeight) * 0.8);
      }
    }

    return Math.max(0, Math.min(100, totalScore / totalWeight));
  }

  /**
   * Determine health level based on check results
   */
  private determineHealthLevel(
    overallPassed: boolean, 
    criticalFailures: number, 
    score: number
  ): ConnectionHealthLevel {
    if (criticalFailures > 0) {
      return ConnectionHealthLevel.CRITICAL;
    }

    if (!overallPassed) {
      return ConnectionHealthLevel.WARNING;
    }

    if (score >= 90) {
      return ConnectionHealthLevel.HEALTHY;
    } else if (score >= 70) {
      return ConnectionHealthLevel.WARNING;
    } else {
      return ConnectionHealthLevel.CRITICAL;
    }
  }

  /**
   * Update metrics based on health check results
   */
  private updateHealthMetrics(results: HealthCheckResult[]): void {
    this.metrics.lastHealthCheck = new Date();

    // Update stability score based on recent health history
    const recentResults = results.filter(r => 
      Date.now() - r.timestamp.getTime() < 300000 // Last 5 minutes
    );

    if (recentResults.length > 0) {
      const passedCount = recentResults.filter(r => r.passed).length;
      this.metrics.stabilityScore = (passedCount / recentResults.length) * 100;
    }

    // Update reliability score based on longer term history
    const allRecentResults = Array.from(this.healthCheckResults.values())
      .flat()
      .filter(r => Date.now() - r.timestamp.getTime() < 3600000); // Last hour

    if (allRecentResults.length > 0) {
      const passedCount = allRecentResults.filter(r => r.passed).length;
      this.metrics.reliabilityScore = (passedCount / allRecentResults.length) * 100;
    }
  }

  /**
   * Update connection metrics
   */
  public updateConnectionMetrics(updates: Partial<ConnectionMetrics>): void {
    Object.assign(this.metrics, updates);

    // Calculate derived metrics
    if (updates.totalConnections || updates.totalDisconnections) {
      const total = this.metrics.totalConnections + this.metrics.totalDisconnections;
      if (total > 0) {
        this.metrics.errorRate = this.metrics.totalErrors / total;
      }
    }

    // Update session duration
    if (this.metrics.sessionStartTime) {
      this.metrics.sessionDuration = Date.now() - this.metrics.sessionStartTime.getTime();
    }

    // Update average latency
    if (updates.latency !== undefined) {
      const alpha = 0.1; // Exponential moving average factor
      this.metrics.averageLatency = this.metrics.averageLatency * (1 - alpha) + updates.latency * alpha;
      this.metrics.lastLatencyCheck = new Date();
    }
  }

  /**
   * Record error
   */
  public recordError(error: Error | BotError): void {
    this.metrics.totalErrors++;
    this.metrics.consecutiveErrors++;
    this.metrics.lastError = new Date();

    // Update error rate
    const total = this.metrics.totalConnections + this.metrics.totalDisconnections;
    if (total > 0) {
      this.metrics.errorRate = this.metrics.totalErrors / total;
    }

    this.logger.error('Connection error recorded:', error);

    this.emitEvent({
      type: ConnectionEventType.ERROR_OCCURRED,
      timestamp: new Date(),
      data: {
        error,
        metadata: {
          consecutiveErrors: this.metrics.consecutiveErrors,
          totalErrors: this.metrics.totalErrors,
          errorRate: this.metrics.errorRate
        }
      }
    });
  }

  /**
   * Reset consecutive errors
   */
  public resetConsecutiveErrors(): void {
    this.metrics.consecutiveErrors = 0;
  }

  /**
   * Get current health status
   */
  public getHealthStatus(): {
    health: ConnectionHealthLevel;
    score: number;
    metrics: ConnectionMetrics;
    lastCheck?: Date;
  } {
    return {
      health: this.currentHealth,
      score: this.metrics.healthScore,
      metrics: { ...this.metrics },
      ...(this.lastHealthCheck && { lastCheck: this.lastHealthCheck })
    };
  }

  /**
   * Get connection status
   */
  public getConnectionStatus(): ConnectionStatus {
    return {
      state: this.metrics.currentUptime > 0 ? 
        (this.metrics.consecutiveErrors > 5 ? 'degraded' as any : 'connected' as any) : 
        'disconnected' as any,
      health: this.currentHealth,
      uptime: this.metrics.currentUptime,
      latency: this.metrics.latency,
      errorRate: this.metrics.errorRate,
      ...(this.metrics.lastError && { lastError: this.metrics.lastError.toISOString() }),
      ...(this.metrics.lastConnected && { lastConnected: this.metrics.lastConnected }),
      sessionId: this.metrics.sessionId
    };
  }

  /**
   * Get diagnostics
   */
  public getDiagnostics(): ConnectionDiagnostics {
    return {
      timestamp: new Date(),
      state: this.metrics.currentUptime > 0 ? 
        (this.metrics.consecutiveErrors > 5 ? 'degraded' as any : 'connected' as any) : 
        'disconnected' as any,
      health: this.currentHealth,
      metrics: { ...this.metrics },
      circuitBreaker: {
        state: 'closed' as any,
        failureCount: 0,
        successCount: 0,
        totalCalls: 0,
        rejectedCalls: 0
      },
      degradation: {
        currentLevel: 'none' as any,
        activeActions: [],
        totalActivations: 0,
        activationHistory: []
      },
      recentErrors: [],
      recentEvents: [],
      systemInfo: {
        nodeVersion: 'unknown',
        platform: 'unknown',
        arch: 'unknown',
        memory: {
          used: 0,
          total: 0,
          percentage: 0
        },
        cpu: {
          usage: 0, // Would need additional monitoring
          loadAverage: [0, 0, 0]
        }
      }
    };
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

    // Note: EventEmitter functionality removed to avoid dependency issues
  }

  /**
   * Get health check history
   */
  public getHealthCheckHistory(checkName?: string): Map<string, HealthCheckResult[]> {
    if (checkName) {
      const history = this.healthCheckResults.get(checkName);
      return history ? new Map([[checkName, history]]) : new Map();
    }
    return new Map(this.healthCheckResults);
  }

  /**
   * Reset metrics
   */
  public resetMetrics(): void {
    this.metrics = this.initializeMetrics();
    this.healthCheckResults.clear();
    this.currentHealth = ConnectionHealthLevel.UNKNOWN;
    this.logger.info('Connection health metrics reset');
  }

  /**
   * Cleanup resources
   */
  public cleanup(): void {
    this.stopMonitoring();
    this.listeners.clear();
    this.healthCheckResults.clear();
    this.logger.debug('Connection health monitor cleaned up');
  }
}