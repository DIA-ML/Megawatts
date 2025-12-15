import {
  DegradationLevel,
  DegradationConfig,
  DegradationMetrics,
  ConnectionAction,
  ConnectionEvent,
  ConnectionEventType,
  ConnectionEventListener,
  ConnectionMetrics
} from './types';
import { Logger } from '../../utils/logger';
import { BotError } from '../../utils/errors';

/**
 * Graceful degradation handler for connection issues
 */
export class DegradationHandler {
  private config: DegradationConfig;
  private logger: Logger;
  private metrics: DegradationMetrics;
  private listeners: Map<ConnectionEventType, Set<ConnectionEventListener>> = new Map();
  private activeActions: Set<ConnectionAction> = new Set();
  private recoveryTimeout: ReturnType<typeof setTimeout> | null = null;
  private isDegraded = false;

  constructor(config: DegradationConfig, logger: Logger) {
    this.config = config;
    this.logger = new Logger('DegradationHandler');
    this.metrics = this.initializeMetrics();
  }

  /**
   * Initialize degradation metrics
   */
  private initializeMetrics(): DegradationMetrics {
    return {
      currentLevel: DegradationLevel.NONE,
      activeActions: [],
      totalActivations: 0,
      activationHistory: []
    };
  }

  /**
   * Evaluate if degradation should be activated
   */
  public evaluateDegradation(connectionMetrics: ConnectionMetrics): {
    shouldDegrade: boolean;
    level: DegradationLevel;
    actions: ConnectionAction[];
    reason: string;
  } {
    if (!this.config.enabled) {
      return {
        shouldDegrade: false,
        level: DegradationLevel.NONE,
        actions: [],
        reason: 'Degradation disabled'
      };
    }

    // Check various degradation triggers
    const triggers = this.evaluateTriggers(connectionMetrics);
    
    if (triggers.length === 0) {
      return {
        shouldDegrade: false,
        level: DegradationLevel.NONE,
        actions: [],
        reason: 'No degradation triggers met'
      };
    }

    // Determine highest severity level
    const level = this.getHighestSeverityLevel(triggers);
    const actions = this.config.actions[level] || [];
    const reason = `Triggers: ${triggers.map(t => t.reason).join(', ')}`;

    return {
      shouldDegrade: true,
      level,
      actions,
      reason
    };
  }

  /**
   * Evaluate degradation triggers
   */
  private evaluateTriggers(metrics: ConnectionMetrics): Array<{
    level: DegradationLevel;
    reason: string;
  }> {
    const triggers: Array<{ level: DegradationLevel; reason: string }> = [];

    // Check latency threshold
    if (metrics.latency > this.config.thresholds.latency) {
      const level = this.getLatencyDegradationLevel(metrics.latency);
      triggers.push({
        level,
        reason: `High latency: ${metrics.latency}ms (threshold: ${this.config.thresholds.latency}ms)`
      });
    }

    // Check error rate threshold
    if (metrics.errorRate > this.config.thresholds.errorRate) {
      const level = this.getErrorRateDegradationLevel(metrics.errorRate);
      triggers.push({
        level,
        reason: `High error rate: ${(metrics.errorRate * 100).toFixed(2)}% (threshold: ${(this.config.thresholds.errorRate * 100).toFixed(2)}%)`
      });
    }

    // Check consecutive errors threshold
    if (metrics.consecutiveErrors > this.config.thresholds.consecutiveErrors) {
      const level = this.getConsecutiveErrorsDegradationLevel(metrics.consecutiveErrors);
      triggers.push({
        level,
        reason: `High consecutive errors: ${metrics.consecutiveErrors} (threshold: ${this.config.thresholds.consecutiveErrors})`
      });
    }

    // Check health score
    if (metrics.healthScore < 50) {
      triggers.push({
        level: DegradationLevel.SEVERE,
        reason: `Low health score: ${metrics.healthScore}`
      });
    } else if (metrics.healthScore < 70) {
      triggers.push({
        level: DegradationLevel.MODERATE,
        reason: `Degraded health score: ${metrics.healthScore}`
      });
    }

    return triggers;
  }

  /**
   * Get degradation level based on latency
   */
  private getLatencyDegradationLevel(latency: number): DegradationLevel {
    if (latency > 5000) {
      return DegradationLevel.CRITICAL;
    } else if (latency > 2000) {
      return DegradationLevel.SEVERE;
    } else if (latency > 1000) {
      return DegradationLevel.MODERATE;
    } else {
      return DegradationLevel.MINIMAL;
    }
  }

  /**
   * Get degradation level based on error rate
   */
  private getErrorRateDegradationLevel(errorRate: number): DegradationLevel {
    if (errorRate > 0.5) {
      return DegradationLevel.CRITICAL;
    } else if (errorRate > 0.3) {
      return DegradationLevel.SEVERE;
    } else if (errorRate > 0.1) {
      return DegradationLevel.MODERATE;
    } else {
      return DegradationLevel.MINIMAL;
    }
  }

  /**
   * Get degradation level based on consecutive errors
   */
  private getConsecutiveErrorsDegradationLevel(consecutiveErrors: number): DegradationLevel {
    if (consecutiveErrors > 20) {
      return DegradationLevel.CRITICAL;
    } else if (consecutiveErrors > 10) {
      return DegradationLevel.SEVERE;
    } else if (consecutiveErrors > 5) {
      return DegradationLevel.MODERATE;
    } else {
      return DegradationLevel.MINIMAL;
    }
  }

  /**
   * Get highest severity level from triggers
   */
  private getHighestSeverityLevel(
    triggers: Array<{ level: DegradationLevel; reason: string }>
  ): DegradationLevel {
    const severityOrder = [
      DegradationLevel.CRITICAL,
      DegradationLevel.SEVERE,
      DegradationLevel.MODERATE,
      DegradationLevel.MINIMAL
    ];

    for (const severity of severityOrder) {
      if (triggers.some(t => t.level === severity)) {
        return severity;
      }
    }

    return DegradationLevel.MINIMAL;
  }

  /**
   * Activate degradation
   */
  public async activateDegradation(
    level: DegradationLevel,
    actions: ConnectionAction[],
    reason: string
  ): Promise<void> {
    if (level === DegradationLevel.NONE) {
      return;
    }

    const previousLevel = this.metrics.currentLevel;
    this.metrics.currentLevel = level;
    this.metrics.lastActivated = new Date();
    this.metrics.totalActivations++;

    // Execute degradation actions
    const executedActions: ConnectionAction[] = [];
    for (const action of actions) {
      try {
        await this.executeAction(action);
        executedActions.push(action);
        this.activeActions.add(action);
      } catch (error) {
        this.logger.error(`Failed to execute degradation action ${action}:`, error as Error);
      }
    }

    this.metrics.activeActions = Array.from(this.activeActions);

    // Add to activation history
    this.metrics.activationHistory.push({
      level,
      timestamp: new Date(),
      duration: 0, // Will be updated when deactivated
      trigger: reason
    });

    // Keep only last 50 activations in history
    if (this.metrics.activationHistory.length > 50) {
      this.metrics.activationHistory.shift();
    }

    this.isDegraded = true;

    this.logger.warn(`Degradation ACTIVATED`, {
      level,
      previousLevel,
      actions: executedActions,
      reason,
      totalActivations: this.metrics.totalActivations
    });

    await this.emitEvent({
      type: ConnectionEventType.DEGRADATION_ACTIVATED,
      timestamp: new Date(),
      data: {
        degradationLevel: level,
        metadata: {
          previousLevel,
          actions: executedActions,
          reason,
          totalActivations: this.metrics.totalActivations
        }
      }
    });

    // Schedule recovery check
    this.scheduleRecoveryCheck();
  }

  /**
   * Execute degradation action
   */
  private async executeAction(action: ConnectionAction): Promise<void> {
    this.logger.debug(`Executing degradation action: ${action}`);

    switch (action) {
      case 'disable_non_critical_features':
        await this.disableNonCriticalFeatures();
        break;
      case 'increase_timeouts':
        await this.increaseTimeouts();
        break;
      case 'reduce_concurrent_requests':
        await this.reduceConcurrentRequests();
        break;
      case 'enable_aggressive_caching':
        await this.enableAggressiveCaching();
        break;
      case 'disable_analytics':
        await this.disableAnalytics();
        break;
      case 'reduce_logging_level':
        await this.reduceLoggingLevel();
        break;
      case 'enable_read_only_mode':
        await this.enableReadOnlyMode();
        break;
      case 'shutdown_non_essential_services':
        await this.shutdownNonEssentialServices();
        break;
      default:
        this.logger.warn(`Unknown degradation action: ${action}`);
    }
  }

  /**
   * Disable non-critical features
   */
  private async disableNonCriticalFeatures(): Promise<void> {
    // Implementation would depend on bot features
    this.logger.info('Disabling non-critical features');
    // Example: Disable music, games, etc.
  }

  /**
   * Increase timeouts
   */
  private async increaseTimeouts(): Promise<void> {
    this.logger.info('Increasing operation timeouts');
    // Example: Double all timeout values
  }

  /**
   * Reduce concurrent requests
   */
  private async reduceConcurrentRequests(): Promise<void> {
    this.logger.info('Reducing concurrent requests');
    // Example: Halve the concurrent request limit
  }

  /**
   * Enable aggressive caching
   */
  private async enableAggressiveCaching(): Promise<void> {
    this.logger.info('Enabling aggressive caching');
    // Example: Cache all responses for longer periods
  }

  /**
   * Disable analytics
   */
  private async disableAnalytics(): Promise<void> {
    this.logger.info('Disabling analytics collection');
    // Example: Stop collecting usage metrics
  }

  /**
   * Reduce logging level
   */
  private async reduceLoggingLevel(): Promise<void> {
    this.logger.info('Reducing logging level');
    // Example: Only log errors and warnings
  }

  /**
   * Enable read-only mode
   */
  private async enableReadOnlyMode(): Promise<void> {
    this.logger.info('Enabling read-only mode');
    // Example: Only respond to read operations
  }

  /**
   * Shutdown non-essential services
   */
  private async shutdownNonEssentialServices(): Promise<void> {
    this.logger.info('Shutting down non-essential services');
    // Example: Stop background tasks, cleanup services
  }

  /**
   * Deactivate degradation
   */
  public async deactivateDegradation(reason: string): Promise<void> {
    if (this.metrics.currentLevel === DegradationLevel.NONE) {
      return;
    }

    const previousLevel = this.metrics.currentLevel;
    this.metrics.currentLevel = DegradationLevel.NONE;
    this.metrics.lastDeactivated = new Date();

    // Update activation history duration
    const lastActivation = this.metrics.activationHistory[this.metrics.activationHistory.length - 1];
    if (lastActivation) {
      lastActivation.duration = Date.now() - lastActivation.timestamp.getTime();
    }

    // Rollback degradation actions
    const rolledBackActions: ConnectionAction[] = [];
    for (const action of Array.from(this.activeActions).reverse()) {
      try {
        await this.rollbackAction(action);
        rolledBackActions.push(action);
        this.activeActions.delete(action);
      } catch (error) {
        this.logger.error(`Failed to rollback degradation action ${action}:`, error as Error);
      }
    }

    this.metrics.activeActions = [];
    this.isDegraded = false;

    // Clear recovery timeout
    if (this.recoveryTimeout) {
      clearTimeout(this.recoveryTimeout);
      this.recoveryTimeout = null;
    }

    this.logger.info(`Degradation DEACTIVATED`, {
      previousLevel,
      rolledBackActions,
      reason,
      duration: lastActivation?.duration || 0
    });

    await this.emitEvent({
      type: ConnectionEventType.DEGRADATION_DEACTIVATED,
      timestamp: new Date(),
      data: {
        degradationLevel: DegradationLevel.NONE,
        metadata: {
          previousLevel,
          rolledBackActions,
          reason,
          duration: lastActivation?.duration || 0
        }
      }
    });
  }

  /**
   * Rollback degradation action
   */
  private async rollbackAction(action: ConnectionAction): Promise<void> {
    this.logger.debug(`Rolling back degradation action: ${action}`);

    switch (action) {
      case 'disable_non_critical_features':
        await this.enableNonCriticalFeatures();
        break;
      case 'increase_timeouts':
        await this.restoreTimeouts();
        break;
      case 'reduce_concurrent_requests':
        await this.restoreConcurrentRequests();
        break;
      case 'enable_aggressive_caching':
        await this.disableAggressiveCaching();
        break;
      case 'disable_analytics':
        await this.enableAnalytics();
        break;
      case 'reduce_logging_level':
        await this.restoreLoggingLevel();
        break;
      case 'enable_read_only_mode':
        await this.disableReadOnlyMode();
        break;
      case 'shutdown_non_essential_services':
        await this.startNonEssentialServices();
        break;
      default:
        this.logger.warn(`Unknown degradation action to rollback: ${action}`);
    }
  }

  /**
   * Enable non-critical features
   */
  private async enableNonCriticalFeatures(): Promise<void> {
    this.logger.info('Re-enabling non-critical features');
  }

  /**
   * Restore timeouts
   */
  private async restoreTimeouts(): Promise<void> {
    this.logger.info('Restoring normal timeouts');
  }

  /**
   * Restore concurrent requests
   */
  private async restoreConcurrentRequests(): Promise<void> {
    this.logger.info('Restoring normal concurrent request limits');
  }

  /**
   * Disable aggressive caching
   */
  private async disableAggressiveCaching(): Promise<void> {
    this.logger.info('Disabling aggressive caching');
  }

  /**
   * Enable analytics
   */
  private async enableAnalytics(): Promise<void> {
    this.logger.info('Re-enabling analytics collection');
  }

  /**
   * Restore logging level
   */
  private async restoreLoggingLevel(): Promise<void> {
    this.logger.info('Restoring normal logging level');
  }

  /**
   * Disable read-only mode
   */
  private async disableReadOnlyMode(): Promise<void> {
    this.logger.info('Disabling read-only mode');
  }

  /**
   * Start non-essential services
   */
  private async startNonEssentialServices(): Promise<void> {
    this.logger.info('Starting non-essential services');
  }

  /**
   * Schedule recovery check
   */
  private scheduleRecoveryCheck(): void {
    if (this.recoveryTimeout) {
      clearTimeout(this.recoveryTimeout);
    }

    this.recoveryTimeout = setTimeout(async () => {
      await this.checkRecovery();
    }, this.config.recoveryDelay);
  }

  /**
   * Check if recovery is possible
   */
  private async checkRecovery(): Promise<void> {
    // This would need to be implemented with actual health checking
    // For now, just log that recovery check was performed
    this.logger.debug('Performing recovery check');
    
    // Schedule next check
    this.scheduleRecoveryCheck();
  }

  /**
   * Check if currently degraded
   */
  public isCurrentlyDegraded(): boolean {
    return this.isDegraded;
  }

  /**
   * Get current degradation level
   */
  public getCurrentLevel(): DegradationLevel {
    return this.metrics.currentLevel;
  }

  /**
   * Get active actions
   */
  public getActiveActions(): ConnectionAction[] {
    return Array.from(this.activeActions);
  }

  /**
   * Get metrics
   */
  public getMetrics(): DegradationMetrics {
    return { ...this.metrics };
  }

  /**
   * Get degradation status
   */
  public getStatus(): {
    isDegraded: boolean;
    level: DegradationLevel;
    activeActions: ConnectionAction[];
    metrics: DegradationMetrics;
    timeInCurrentState: number;
  } {
    const lastActivation = this.metrics.activationHistory[this.metrics.activationHistory.length - 1];
    const timeInCurrentState = lastActivation ? 
      Date.now() - lastActivation.timestamp.getTime() : 0;

    return {
      isDegraded: this.isDegraded,
      level: this.metrics.currentLevel,
      activeActions: this.getActiveActions(),
      metrics: this.getMetrics(),
      timeInCurrentState
    };
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<DegradationConfig>): void {
    this.config = { ...this.config, ...config };
    this.logger.debug('Degradation configuration updated', config);
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
   * Get degradation history
   */
  public getActivationHistory(limit: number = 10): Array<{
    level: DegradationLevel;
    timestamp: Date;
    duration: number;
    trigger: string;
  }> {
    return this.metrics.activationHistory.slice(-limit);
  }

  /**
   * Reset metrics
   */
  public resetMetrics(): void {
    this.metrics = this.initializeMetrics();
    this.activeActions.clear();
    this.isDegraded = false;
    
    if (this.recoveryTimeout) {
      clearTimeout(this.recoveryTimeout);
      this.recoveryTimeout = undefined;
    }

    this.logger.info('Degradation metrics reset');
  }

  /**
   * Cleanup resources
   */
  public cleanup(): void {
    if (this.recoveryTimeout) {
      clearTimeout(this.recoveryTimeout);
      this.recoveryTimeout = undefined;
    }

    this.listeners.clear();
    this.activeActions.clear();
    this.logger.debug('Degradation handler cleaned up');
  }
}