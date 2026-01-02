/**
 * Health Check Module
 *
 * Provides comprehensive health monitoring and status checking capabilities
 * for the Discord bot including system diagnostics, API monitoring,
 * and health check endpoints.
 */

export { HealthStatus, CheckType } from './types';
export type {
  HealthCheckResult,
  HealthCheck,
  HealthCheckOptions,
  SystemHealth,
  HealthEndpointConfig,
  HealthMonitorConfig,
  HealthMetrics,
  HealthAlert,
  MemoryUsage,
  CpuUsage
} from './types';

export { HealthCheckService } from './service';
export { HealthOrchestrator } from './orchestrator';
export { HealthEndpoints } from './endpoints';
export { HealthMiddleware, Request, Response } from './middleware';
export { defaultHealthConfig, healthCheckThresholds, healthCheckTimeouts } from './config';

import { HealthOrchestrator } from './orchestrator';
import { HealthEndpoints } from './endpoints';
import { HealthMiddleware } from './middleware';
import { HealthMonitorConfig } from './types';
import { defaultHealthConfig } from './config';
import { Logger } from '../../utils/logger';

/**
 * Health Manager - Main entry point for health monitoring
 */
export class HealthManager {
  private orchestrator: HealthOrchestrator;
  private endpoints: HealthEndpoints;
  private middleware: HealthMiddleware;
  private logger: Logger;
  private config: HealthMonitorConfig;

  constructor(config: Partial<HealthMonitorConfig> = {}) {
    this.config = { ...defaultHealthConfig, ...config };
    this.orchestrator = new HealthOrchestrator(this.config);
    this.endpoints = new HealthEndpoints(this.orchestrator);
    this.middleware = new HealthMiddleware(this.orchestrator);
    this.logger = new Logger('HealthManager');
  }

  /**
   * Initialize health monitoring
   */
  async initialize(): Promise<void> {
    try {
      // Add middleware metrics as a health check
      const metricsCheck = this.middleware.createMetricsHealthCheck();
      this.orchestrator.addCheck(metricsCheck as any);

      // Start monitoring if enabled
      if (this.config.enabled) {
        this.orchestrator.startMonitoring();
        this.logger.info('Health monitoring started');
      }

      this.logger.info('Health manager initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize health manager', error as Error);
      throw error;
    }
  }

  /**
   * Setup health endpoints on an Express app
   */
  setupEndpoints(app: any): void {
    try {
      this.endpoints.setupEndpoints(app, this.config.endpoints);
      this.logger.info('Health endpoints setup completed');
    } catch (error) {
      this.logger.error('Failed to setup health endpoints', error as Error);
      throw error;
    }
  }

  /**
   * Get middleware instances
   */
  getMiddleware() {
    return {
      requestLogger: () => this.middleware.requestLogger(),
      healthCheck: () => this.middleware.healthCheck(),
      rateLimit: (options: any) => this.middleware.rateLimit(options),
      errorTracker: () => this.middleware.errorTracker(),
      performanceMonitor: () => this.middleware.performanceMonitor()
    };
  }

  /**
   * Get orchestrator instance
   */
  getOrchestrator(): HealthOrchestrator {
    return this.orchestrator;
  }

  /**
   * Get endpoints instance
   */
  getEndpoints(): HealthEndpoints {
    return this.endpoints;
  }

  /**
   * Get middleware instance
   */
  getMiddlewareInstance(): HealthMiddleware {
    return this.middleware;
  }

  /**
   * Run all health checks
   */
  async runHealthChecks() {
    return this.orchestrator.runAllChecks();
  }

  /**
   * Get system readiness
   */
  async getReadiness() {
    return this.orchestrator.getReadiness();
  }

  /**
   * Get system liveness
   */
  async getLiveness() {
    return this.orchestrator.getLiveness();
  }

  /**
   * Get health metrics
   */
  getMetrics(limit?: number) {
    return this.orchestrator.getMetrics(limit);
  }

  /**
   * Get active alerts
   */
  getActiveAlerts() {
    return this.orchestrator.getActiveAlerts();
  }

  /**
   * Add custom health check
   */
  addHealthCheck(check: any) {
    return this.orchestrator.addCheck(check);
  }

  /**
   * Remove health check
   */
  removeHealthCheck(name: string) {
    return this.orchestrator.removeCheck(name);
  }

  /**
   * Start monitoring
   */
  startMonitoring() {
    return this.orchestrator.startMonitoring();
  }

  /**
   * Stop monitoring
   */
  stopMonitoring() {
    return this.orchestrator.stopMonitoring();
  }

  /**
   * Check if monitoring is active
   */
  isMonitoring() {
    return this.orchestrator.isMonitoring();
  }

  /**
   * Cleanup resources
   */
  destroy() {
    this.orchestrator.destroy();
    this.logger.info('Health manager destroyed');
  }
}

/**
 * Create and initialize a health manager with default configuration
 */
export async function createHealthManager(config?: Partial<HealthMonitorConfig>): Promise<HealthManager> {
  const manager = new HealthManager(config);
  await manager.initialize();
  return manager;
}

/**
 * Quick setup function for Express applications
 */
export async function setupHealthMonitoring(app: any, config?: Partial<HealthMonitorConfig>): Promise<HealthManager> {
  const manager = await createHealthManager(config);
  manager.setupEndpoints(app);
  return manager;
}