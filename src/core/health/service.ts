import {
  HealthCheck,
  HealthCheckResult,
  HealthStatus,
  CheckType,
  MemoryUsage,
  CpuUsage
} from './types';
import { healthCheckTimeouts, healthCheckThresholds } from './config';
import { Logger } from '../../utils/logger';

declare const process: {
  memoryUsage(): MemoryUsage;
  cpuUsage(): CpuUsage;
  env: Record<string, string | undefined>;
};

const logger = new Logger('HealthCheck');

export class HealthCheckService {
  private startTime: number = Date.now();
  private lastCpuUsage: CpuUsage = { user: 0, system: 0 };

  /**
   * Check Discord API connectivity
   */
  async checkDiscordApi(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      // This would be implemented with actual Discord client
      // For now, we'll simulate the check
      const isConnected = true; // Replace with actual Discord client status
      const ping = Math.random() * 100; // Replace with actual ping

      const responseTime = Date.now() - startTime;
      const status = isConnected && ping < healthCheckThresholds.discord.pingCritical 
        ? HealthStatus.HEALTHY 
        : HealthStatus.UNHEALTHY;

      return {
        status,
        checkType: CheckType.DISCORD_API,
        name: 'discord_api',
        message: isConnected ? `Discord API connected, ping: ${ping.toFixed(2)}ms` : 'Discord API disconnected',
        responseTime,
        timestamp: new Date(),
        details: {
          connected: isConnected,
          ping,
          guilds: 0, // Replace with actual guild count
          users: 0 // Replace with actual user count
        }
      };
    } catch (error) {
      return {
        status: HealthStatus.UNHEALTHY,
        checkType: CheckType.DISCORD_API,
        name: 'discord_api',
        message: 'Failed to check Discord API',
        responseTime: Date.now() - startTime,
        timestamp: new Date(),
        error: error as Error
      };
    }
  }

  /**
   * Check database connectivity
   */
  async checkDatabase(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      // This would be implemented with actual database connection
      // For now, we'll simulate the check
      const isConnected = true; // Replace with actual database check
      const responseTime = Date.now() - startTime;

      return {
        status: isConnected ? HealthStatus.HEALTHY : HealthStatus.UNHEALTHY,
        checkType: CheckType.DATABASE,
        name: 'database',
        message: isConnected ? 'Database connected' : 'Database disconnected',
        responseTime,
        timestamp: new Date(),
        details: {
          connected: isConnected,
          responseTime
        }
      };
    } catch (error) {
      return {
        status: HealthStatus.UNHEALTHY,
        checkType: CheckType.DATABASE,
        name: 'database',
        message: 'Failed to connect to database',
        responseTime: Date.now() - startTime,
        timestamp: new Date(),
        error: error as Error
      };
    }
  }

  /**
   * Check memory usage
   */
  async checkMemory(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      const memoryUsage = process.memoryUsage() as MemoryUsage;
      const totalMemory = memoryUsage.heapTotal;
      const usedMemory = memoryUsage.heapUsed;
      const memoryUsagePercent = usedMemory / totalMemory;

      let status: HealthStatus;
      if (memoryUsagePercent < healthCheckThresholds.memory.warning) {
        status = HealthStatus.HEALTHY;
      } else if (memoryUsagePercent < healthCheckThresholds.memory.critical) {
        status = HealthStatus.DEGRADED;
      } else {
        status = HealthStatus.UNHEALTHY;
      }

      return {
        status,
        checkType: CheckType.MEMORY,
        name: 'memory',
        message: `Memory usage: ${(memoryUsagePercent * 100).toFixed(2)}%`,
        responseTime: Date.now() - startTime,
        timestamp: new Date(),
        details: {
          usage: memoryUsage,
          usagePercent: memoryUsagePercent,
          total: totalMemory,
          used: usedMemory
        }
      };
    } catch (error) {
      return {
        status: HealthStatus.UNHEALTHY,
        checkType: CheckType.MEMORY,
        name: 'memory',
        message: 'Failed to check memory usage',
        responseTime: Date.now() - startTime,
        timestamp: new Date(),
        error: error as Error
      };
    }
  }

  /**
   * Check CPU usage
   */
  async checkCpu(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      const currentCpuUsage = process.cpuUsage();
      const userDiff = currentCpuUsage.user - this.lastCpuUsage.user;
      const systemDiff = currentCpuUsage.system - this.lastCpuUsage.system;
      const totalDiff = userDiff + systemDiff;
      const timeDiff = Date.now() - startTime;
      
      // Calculate CPU usage percentage (simplified)
      const cpuUsagePercent = Math.min((totalDiff / (timeDiff * 1000)) * 100, 100);
      
      this.lastCpuUsage = currentCpuUsage;

      let status: HealthStatus;
      if (cpuUsagePercent < healthCheckThresholds.cpu.warning * 100) {
        status = HealthStatus.HEALTHY;
      } else if (cpuUsagePercent < healthCheckThresholds.cpu.critical * 100) {
        status = HealthStatus.DEGRADED;
      } else {
        status = HealthStatus.UNHEALTHY;
      }

      return {
        status,
        checkType: CheckType.CPU,
        name: 'cpu',
        message: `CPU usage: ${cpuUsagePercent.toFixed(2)}%`,
        responseTime: Date.now() - startTime,
        timestamp: new Date(),
        details: {
          usage: currentCpuUsage,
          usagePercent: cpuUsagePercent / 100
        }
      };
    } catch (error) {
      return {
        status: HealthStatus.UNHEALTHY,
        checkType: CheckType.CPU,
        name: 'cpu',
        message: 'Failed to check CPU usage',
        responseTime: Date.now() - startTime,
        timestamp: new Date(),
        error: error as Error
      };
    }
  }

  /**
   * Check disk usage
   */
  async checkDisk(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      // This would be implemented with actual disk space checking
      // For now, we'll simulate the check
      const diskUsagePercent = Math.random() * 100; // Replace with actual disk usage
      
      let status: HealthStatus;
      if (diskUsagePercent < 80) {
        status = HealthStatus.HEALTHY;
      } else if (diskUsagePercent < 95) {
        status = HealthStatus.DEGRADED;
      } else {
        status = HealthStatus.UNHEALTHY;
      }

      return {
        status,
        checkType: CheckType.DISK,
        name: 'disk',
        message: `Disk usage: ${diskUsagePercent.toFixed(2)}%`,
        responseTime: Date.now() - startTime,
        timestamp: new Date(),
        details: {
          usagePercent: diskUsagePercent / 100
        }
      };
    } catch (error) {
      return {
        status: HealthStatus.UNHEALTHY,
        checkType: CheckType.DISK,
        name: 'disk',
        message: 'Failed to check disk usage',
        responseTime: Date.now() - startTime,
        timestamp: new Date(),
        error: error as Error
      };
    }
  }

  /**
   * Check external API connectivity
   */
  async checkExternalApi(url: string = 'https://discord.com/api/v10/gateway'): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), healthCheckTimeouts.externalApi);

      const response = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      const responseTime = Date.now() - startTime;

      const status = response.ok 
        ? HealthStatus.HEALTHY 
        : HealthStatus.UNHEALTHY;

      return {
        status,
        checkType: CheckType.EXTERNAL_API,
        name: 'external_api',
        message: `External API ${response.ok ? 'accessible' : 'inaccessible'} (${response.status})`,
        responseTime,
        timestamp: new Date(),
        details: {
          url,
          status: response.status,
          statusText: response.statusText
        }
      };
    } catch (error) {
      return {
        status: HealthStatus.UNHEALTHY,
        checkType: CheckType.EXTERNAL_API,
        name: 'external_api',
        message: 'Failed to check external API',
        responseTime: Date.now() - startTime,
        timestamp: new Date(),
        error: error as Error
      };
    }
  }

  /**
   * Get system uptime
   */
  getUptime(): number {
    return Date.now() - this.startTime;
  }

  /**
   * Get current memory usage
   */
  getMemoryUsage(): MemoryUsage {
    return process.memoryUsage() as MemoryUsage;
  }

  /**
   * Get current CPU usage
   */
  getCpuUsage(): CpuUsage {
    return process.cpuUsage();
  }

  /**
   * Run a custom health check
   */
  async runCustomCheck(check: HealthCheck): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      const result = await Promise.race([
        check.check(),
        new Promise<HealthCheckResult>((_, reject) => 
          setTimeout(() => reject(new Error('Health check timeout')), 
          check.options?.timeout || healthCheckTimeouts.system)
        )
      ]);

      return {
        ...result,
        responseTime: Date.now() - startTime
      };
    } catch (error) {
      return {
        status: HealthStatus.UNHEALTHY,
        checkType: CheckType.CUSTOM,
        name: check.name,
        message: `Custom check failed: ${(error as Error).message}`,
        responseTime: Date.now() - startTime,
        timestamp: new Date(),
        error: error as Error
      };
    }
  }
}