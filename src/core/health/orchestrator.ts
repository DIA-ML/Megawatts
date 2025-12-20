import {
  HealthCheck,
  HealthCheckResult,
  HealthStatus,
  CheckType,
  SystemHealth,
  HealthMetrics,
  HealthAlert,
  HealthMonitorConfig
} from './types.js';
import { HealthCheckService } from './service.js';
import { defaultHealthConfig } from './config.js';
import { Logger } from '../../utils/logger.js';

declare const process: {
  env: Record<string, string | undefined>;
};

declare const setInterval: (callback: () => void, ms: number) => any;
declare const clearInterval: (id: any) => void;

export class HealthOrchestrator {
  private service: HealthCheckService;
  private checks: Map<string, HealthCheck> = new Map();
  private metrics: HealthMetrics[] = [];
  private alerts: HealthAlert[] = [];
  private config: HealthMonitorConfig;
  private intervalId?: any;
  private logger: Logger;

  constructor(config: Partial<HealthMonitorConfig> = {}) {
    this.config = { ...defaultHealthConfig, ...config };
    this.service = new HealthCheckService();
    this.logger = new Logger('HealthOrchestrator');
    this.initializeDefaultChecks();
  }

  /**
   * Initialize default health checks
   */
  private initializeDefaultChecks(): void {
    // Discord API check
    this.addCheck({
      name: 'discord_api',
      type: CheckType.DISCORD_API,
      check: () => this.service.checkDiscordApi(),
      options: {
        timeout: 5000,
        critical: true
      }
    });

    // Database check
    this.addCheck({
      name: 'database',
      type: CheckType.DATABASE,
      check: () => this.service.checkDatabase(),
      options: {
        timeout: 5000,
        critical: true
      }
    });

    // Memory check
    this.addCheck({
      name: 'memory',
      type: CheckType.MEMORY,
      check: () => this.service.checkMemory(),
      options: {
        timeout: 2000,
        critical: false
      }
    });

    // CPU check
    this.addCheck({
      name: 'cpu',
      type: CheckType.CPU,
      check: () => this.service.checkCpu(),
      options: {
        timeout: 2000,
        critical: false
      }
    });

    // Disk check
    this.addCheck({
      name: 'disk',
      type: CheckType.DISK,
      check: () => this.service.checkDisk(),
      options: {
        timeout: 3000,
        critical: false
      }
    });

    // External API check
    this.addCheck({
      name: 'external_api',
      type: CheckType.EXTERNAL_API,
      check: () => this.service.checkExternalApi(),
      options: {
        timeout: 10000,
        critical: false
      }
    });
  }

  /**
   * Add a custom health check
   */
  addCheck(check: HealthCheck): void {
    this.checks.set(check.name, check);
    this.logger.info(`Added health check: ${check.name}`);
  }

  /**
   * Remove a health check
   */
  removeCheck(name: string): boolean {
    const removed = this.checks.delete(name);
    if (removed) {
      this.logger.info(`Removed health check: ${name}`);
    }
    return removed;
  }

  /**
   * Get all registered checks
   */
  getChecks(): HealthCheck[] {
    return Array.from(this.checks.values());
  }

  /**
   * Run a specific health check
   */
  async runCheck(name: string): Promise<HealthCheckResult | null> {
    const check = this.checks.get(name);
    if (!check) {
      this.logger.warn(`Health check not found: ${name}`);
      return null;
    }

    try {
      const result = await this.service.runCustomCheck(check);
      this.logger.debug(`Health check ${name} completed with status: ${result.status}`);
      return result;
    } catch (error) {
      this.logger.error(`Health check ${name} failed`, error as Error);
      return null;
    }
  }

  /**
   * Run all health checks
   */
  async runAllChecks(): Promise<SystemHealth> {
    const startTime = Date.now();
    const checkPromises = Array.from(this.checks.values()).map(check => 
      this.service.runCustomCheck(check)
    );

    try {
      const results = await Promise.allSettled(checkPromises);
      const checkResults: HealthCheckResult[] = [];

      results.forEach((result, index) => {
        const check = Array.from(this.checks.values())[index];
        if (result.status === 'fulfilled') {
          checkResults.push(result.value);
        } else {
          checkResults.push({
            status: HealthStatus.UNHEALTHY,
            checkType: check?.type || CheckType.CUSTOM,
            name: check?.name || 'unknown',
            message: 'Check failed to execute',
            timestamp: new Date(),
            error: result.reason as Error
          });
        }
      });

      const systemHealth = this.calculateSystemHealth(checkResults, Date.now() - startTime);
      
      // Store metrics
      this.storeMetrics(systemHealth);
      
      // Check for alerts
      this.checkForAlerts(checkResults);

      return systemHealth;
    } catch (error) {
      this.logger.error('Failed to run health checks', error as Error);
      return this.createUnhealthySystemHealth('Failed to run health checks');
    }
  }

  /**
   * Calculate overall system health from individual check results
   */
  private calculateSystemHealth(results: HealthCheckResult[], responseTime: number): SystemHealth {
    const summary = {
      total: results.length,
      healthy: results.filter(r => r.status === HealthStatus.HEALTHY).length,
      degraded: results.filter(r => r.status === HealthStatus.DEGRADED).length,
      unhealthy: results.filter(r => r.status === HealthStatus.UNHEALTHY).length,
      critical: results.filter(r => {
        const check = this.checks.get(r.name);
        return check?.options?.critical && r.status !== HealthStatus.HEALTHY;
      }).length
    };

    let overallStatus: HealthStatus;
    if (summary.critical > 0) {
      overallStatus = HealthStatus.UNHEALTHY;
    } else if (summary.unhealthy > 0) {
      overallStatus = HealthStatus.DEGRADED;
    } else if (summary.degraded > 0) {
      overallStatus = HealthStatus.DEGRADED;
    } else {
      overallStatus = HealthStatus.HEALTHY;
    }

    return {
      status: overallStatus,
      timestamp: new Date(),
      uptime: this.service.getUptime(),
      version: process.env.npm_package_version || '1.0.0',
      checks: results,
      summary
    };
  }

  /**
   * Create unhealthy system health for error cases
   */
  private createUnhealthySystemHealth(message: string): SystemHealth {
    return {
      status: HealthStatus.UNHEALTHY,
      timestamp: new Date(),
      uptime: this.service.getUptime(),
      version: process.env.npm_package_version || '1.0.0',
      checks: [],
      summary: {
        total: 0,
        healthy: 0,
        degraded: 0,
        unhealthy: 0,
        critical: 0
      }
    };
  }

  /**
   * Store health metrics
   */
  private storeMetrics(systemHealth: SystemHealth): void {
    const metrics: HealthMetrics = {
      timestamp: new Date(),
      systemHealth,
      performance: {
        responseTime: Date.now(),
        memoryUsage: this.service.getMemoryUsage(),
        cpuUsage: this.service.getCpuUsage()
      },
      discord: {
        connected: systemHealth.checks.find(c => c.name === 'discord_api')?.status === HealthStatus.HEALTHY,
        guilds: 0, // Would be populated from actual Discord client
        users: 0, // Would be populated from actual Discord client
        ping: systemHealth.checks.find(c => c.name === 'discord_api')?.details?.ping || 0
      }
    };

    this.metrics.push(metrics);

    // Clean old metrics based on retention policy
    const cutoffTime = Date.now() - this.config.metricsRetention;
    this.metrics = this.metrics.filter(m => m.timestamp.getTime() > cutoffTime);
  }

  /**
   * Check for alerts based on health check results
   */
  private checkForAlerts(results: HealthCheckResult[]): void {
    results.forEach(result => {
      if (result.status === HealthStatus.UNHEALTHY || result.status === HealthStatus.DEGRADED) {
        const existingAlert = this.alerts.find(a => 
          a.checkName === result.name && !a.resolved
        );

        if (!existingAlert) {
          const alert: HealthAlert = {
            id: `${result.name}-${Date.now()}`,
            timestamp: new Date(),
            severity: result.status === HealthStatus.UNHEALTHY ? 'critical' : 'warning',
            checkName: result.name,
            message: result.message || `Health check ${result.name} is ${result.status}`,
            resolved: false
          };

          this.alerts.push(alert);
          this.logger.warn(`Health alert created: ${alert.message}`, { alert });
        }
      } else {
        // Resolve existing alerts for this check
        const existingAlerts = this.alerts.filter(a => 
          a.checkName === result.name && !a.resolved
        );

        existingAlerts.forEach(alert => {
          alert.resolved = true;
          alert.resolvedAt = new Date();
          this.logger.info(`Health alert resolved: ${alert.message}`, { alert });
        });
      }
    });
  }

  /**
   * Get recent health metrics
   */
  getMetrics(limit: number = 100): HealthMetrics[] {
    return this.metrics.slice(-limit);
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): HealthAlert[] {
    return this.alerts.filter(a => !a.resolved);
  }

  /**
   * Get all alerts
   */
  getAllAlerts(): HealthAlert[] {
    return this.alerts;
  }

  /**
   * Start continuous health monitoring
   */
  startMonitoring(): void {
    if (this.intervalId) {
      this.logger.warn('Health monitoring already started');
      return;
    }

    this.intervalId = setInterval(async () => {
      try {
        await this.runAllChecks();
      } catch (error) {
        this.logger.error('Health monitoring cycle failed', error as Error);
      }
    }, this.config.checkInterval);

    this.logger.info(`Health monitoring started with interval: ${this.config.checkInterval}ms`);
  }

  /**
   * Stop continuous health monitoring
   */
  stopMonitoring(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
      this.logger.info('Health monitoring stopped');
    }
  }

  /**
   * Get current monitoring status
   */
  isMonitoring(): boolean {
    return this.intervalId !== undefined;
  }

  /**
   * Get system readiness status
   */
  async getReadiness(): Promise<{ ready: boolean; checks: HealthCheckResult[] }> {
    const results = await this.runAllChecks();
    const criticalChecks = results.checks.filter(check => {
      const checkConfig = this.checks.get(check.name);
      return checkConfig?.options?.critical;
    });

    const ready = criticalChecks.every(check => check.status === HealthStatus.HEALTHY);
    
    return {
      ready,
      checks: criticalChecks
    };
  }

  /**
   * Get system liveness status
   */
  async getLiveness(): Promise<{ alive: boolean; uptime: number }> {
    const uptime = this.service.getUptime();
    const alive = uptime > 0; // Simple liveness check - process is running
    
    return {
      alive,
      uptime
    };
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.stopMonitoring();
    this.checks.clear();
    this.metrics = [];
    this.alerts = [];
    this.logger.info('Health orchestrator destroyed');
  }
}