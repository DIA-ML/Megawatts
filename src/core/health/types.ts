/**
 * Health check system types and interfaces
 */

export interface MemoryUsage {
  rss: number;
  heapTotal: number;
  heapUsed: number;
  external: number;
  arrayBuffers: number;
}

export interface CpuUsage {
  user: number;
  system: number;
}

export enum HealthStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNHEALTHY = 'unhealthy',
  UNKNOWN = 'unknown'
}

export enum CheckType {
  DATABASE = 'database',
  DISCORD_API = 'discord_api',
  MEMORY = 'memory',
  CPU = 'cpu',
  DISK = 'disk',
  EXTERNAL_API = 'external_api',
  CUSTOM = 'custom'
}

export interface HealthCheckResult {
  status: HealthStatus;
  checkType: CheckType;
  name: string;
  message?: string;
  responseTime?: number;
  timestamp: Date;
  details?: Record<string, any>;
  error?: Error;
}

export interface HealthCheckOptions {
  timeout?: number;
  retries?: number;
  interval?: number;
  critical?: boolean;
}

export interface HealthCheck {
  name: string;
  type: CheckType;
  check: () => Promise<HealthCheckResult>;
  options?: HealthCheckOptions;
}

export interface SystemHealth {
  status: HealthStatus;
  timestamp: Date;
  uptime: number;
  version: string;
  checks: HealthCheckResult[];
  summary: {
    total: number;
    healthy: number;
    degraded: number;
    unhealthy: number;
    critical: number;
  };
}

export interface HealthEndpointConfig {
  enabled: boolean;
  path: string;
  method: 'GET' | 'POST';
  authentication?: {
    enabled: boolean;
    token?: string;
    header?: string;
  };
  rateLimit?: {
    enabled: boolean;
    maxRequests: number;
    windowMs: number;
  };
}

export interface HealthMonitorConfig {
  enabled: boolean;
  checkInterval: number;
  alertThreshold: number;
  metricsRetention: number;
  endpoints: Record<string, HealthEndpointConfig>;
}

export interface HealthMetrics {
  timestamp: Date;
  systemHealth: SystemHealth;
  performance: {
    responseTime: number;
    memoryUsage: MemoryUsage;
    cpuUsage: CpuUsage;
  };
  discord: {
    connected: boolean;
    guilds: number;
    users: number;
    ping: number;
  };
}

export interface HealthAlert {
  id: string;
  timestamp: Date;
  severity: 'info' | 'warning' | 'error' | 'critical';
  checkName: string;
  message: string;
  resolved: boolean;
  resolvedAt?: Date;
}