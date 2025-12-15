import { BotError } from '../../types';

/**
 * Connection states for the Discord bot
 */
export enum ConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
  DEGRADED = 'degraded',
  FAILED = 'failed',
  MAINTENANCE = 'maintenance'
}

/**
 * Connection health levels
 */
export enum ConnectionHealthLevel {
  HEALTHY = 'healthy',
  WARNING = 'warning',
  CRITICAL = 'critical',
  UNKNOWN = 'unknown'
}

/**
 * Circuit breaker states
 */
export enum CircuitBreakerState {
  CLOSED = 'closed',      // Normal operation
  OPEN = 'open',          // Failing, reject calls
  HALF_OPEN = 'half_open' // Testing if service recovered
}

/**
 * Connection event types
 */
export enum ConnectionEventType {
  STATE_CHANGED = 'state_changed',
  HEALTH_CHANGED = 'health_changed',
  CIRCUIT_BREAKER_TRIGGERED = 'circuit_breaker_triggered',
  DEGRADATION_ACTIVATED = 'degradation_activated',
  DEGRADATION_DEACTIVATED = 'degradation_deactivated',
  ERROR_OCCURRED = 'error_occurred',
  RECOVERY_ATTEMPTED = 'recovery_attempted',
  RECOVERY_COMPLETED = 'recovery_completed'
}

/**
 * Connection event data
 */
export interface ConnectionEvent {
  type: ConnectionEventType;
  timestamp: Date;
  data: {
    previousState?: ConnectionState;
    currentState?: ConnectionState;
    previousHealth?: ConnectionHealthLevel;
    currentHealth?: ConnectionHealthLevel;
    error?: Error | BotError;
    circuitBreakerState?: CircuitBreakerState;
    degradationLevel?: DegradationLevel;
    metadata?: Record<string, any>;
  };
}

/**
 * Connection metrics
 */
export interface ConnectionMetrics {
  // Basic connection stats
  totalConnections: number;
  totalDisconnections: number;
  totalReconnections: number;
  currentUptime: number;
  averageUptime: number;
  
  // Performance metrics
  latency: number;
  averageLatency: number;
  lastLatencyCheck: Date;
  
  // Error tracking
  totalErrors: number;
  consecutiveErrors: number;
  errorRate: number;
  lastError?: Date;
  
  // Health metrics
  healthScore: number;
  stabilityScore: number;
  reliabilityScore: number;
  
  // Timestamps
  lastConnected?: Date;
  lastDisconnected?: Date;
  lastHealthCheck: Date;
  
  // Gateway specific
  gatewayResumes: number;
  gatewayHeartbeats: number;
  missedHeartbeats: number;
  
  // Session metrics
  sessionId: string;
  sessionStartTime?: Date;
  sessionDuration: number;
}

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  enabled: boolean;
  failureThreshold: number;
  recoveryThreshold: number;
  timeout: number;
  monitoringPeriod: number;
  halfOpenMaxCalls: number;
  resetTimeout: number;
}

/**
 * Circuit breaker metrics
 */
export interface CircuitBreakerMetrics {
  state: CircuitBreakerState;
  failureCount: number;
  successCount: number;
  lastFailureTime?: Date;
  lastSuccessTime?: Date;
  nextAttempt?: Date;
  totalCalls: number;
  rejectedCalls: number;
}

/**
 * Degradation levels
 */
export enum DegradationLevel {
  NONE = 'none',
  MINIMAL = 'minimal',
  MODERATE = 'moderate',
  SEVERE = 'severe',
  CRITICAL = 'critical'
}

/**
 * Degradation configuration
 */
export interface DegradationConfig {
  enabled: boolean;
  thresholds: {
    latency: number;
    errorRate: number;
    consecutiveErrors: number;
  };
  actions: {
    [DegradationLevel.MINIMAL]: string[];
    [DegradationLevel.MODERATE]: string[];
    [DegradationLevel.SEVERE]: string[];
    [DegradationLevel.CRITICAL]: string[];
  };
  recoveryThreshold: number;
  recoveryDelay: number;
}

/**
 * Degradation metrics
 */
export interface DegradationMetrics {
  currentLevel: DegradationLevel;
  activeActions: string[];
  lastActivated?: Date;
  lastDeactivated?: Date;
  totalActivations: number;
  activationHistory: Array<{
    level: DegradationLevel;
    timestamp: Date;
    duration: number;
    trigger: string;
  }>;
}

/**
 * Health check configuration
 */
export interface HealthCheckConfig {
  enabled: boolean;
  interval: number;
  timeout: number;
  retries: number;
  checks: HealthCheck[];
}

/**
 * Health check definition
 */
export interface HealthCheck {
  name: string;
  type: 'latency' | 'gateway' | 'api' | 'custom';
  enabled: boolean;
  threshold: number;
  critical: boolean;
  executor: () => Promise<HealthCheckResult>;
}

/**
 * Health check result
 */
export interface HealthCheckResult {
  name: string;
  passed: boolean;
  value?: number;
  threshold: number;
  message?: string;
  duration: number;
  timestamp: Date;
}

/**
 * Connection configuration
 */
export interface ConnectionConfig {
  // Basic connection settings
  token: string;
  intents: string[];
  shards?: number;
  shardCount?: number;
  
  // Connection management
  autoReconnect: boolean;
  maxReconnectAttempts: number;
  reconnectDelay: number;
  reconnectBackoffMultiplier: number;
  maxReconnectDelay: number;
  
  // Health monitoring
  healthCheck: HealthCheckConfig;
  
  // Circuit breaker
  circuitBreaker: CircuitBreakerConfig;
  
  // Graceful degradation
  degradation: DegradationConfig;
  
  // Performance tuning
  connectionTimeout: number;
  heartbeatInterval: number;
  heartbeatTimeout: number;
  
  // Session management
  sessionId: string;
  sessionTimeout: number;
  resumeGatewayUrl?: string;
  
  // Advanced settings
  compress: boolean;
  restTimeout: number;
  restRetries: number;
  restRetryDelay: number;
  
  // Monitoring
  metricsEnabled: boolean;
  metricsInterval: number;
  eventsEnabled: boolean;
}

/**
 * Connection state snapshot
 */
export interface ConnectionStateSnapshot {
  state: ConnectionState;
  health: ConnectionHealthLevel;
  metrics: ConnectionMetrics;
  circuitBreaker: CircuitBreakerMetrics;
  degradation: DegradationMetrics;
  timestamp: Date;
  config: Partial<ConnectionConfig>;
}

/**
 * Connection event listener
 */
export type ConnectionEventListener = (event: ConnectionEvent) => void | Promise<void>;

/**
 * Recovery strategy
 */
export interface RecoveryStrategy {
  name: string;
  priority: number;
  conditions: (error: Error | BotError, metrics: ConnectionMetrics) => boolean;
  execute: (error: Error | BotError, metrics: ConnectionMetrics) => Promise<boolean>;
  rollback?: () => Promise<void>;
}

/**
 * Connection status
 */
export interface ConnectionStatus {
  state: ConnectionState;
  health: ConnectionHealthLevel;
  uptime: number;
  latency: number;
  errorRate: number;
  lastError?: string;
  lastConnected?: Date;
  sessionId: string;
}

/**
 * Connection statistics
 */
export interface ConnectionStatistics {
  totalSessions: number;
  totalConnections: number;
  totalDisconnections: number;
  totalReconnections: number;
  totalErrors: number;
  averageSessionDuration: number;
  averageUptime: number;
  averageLatency: number;
  reliability: number;
  availability: number;
  lastReset: Date;
}

/**
 * Connection diagnostics
 */
export interface ConnectionDiagnostics {
  timestamp: Date;
  state: ConnectionState;
  health: ConnectionHealthLevel;
  metrics: ConnectionMetrics;
  circuitBreaker: CircuitBreakerMetrics;
  degradation: DegradationMetrics;
  recentErrors: Array<{
    error: string;
    timestamp: Date;
    context?: Record<string, any>;
  }>;
  recentEvents: Array<{
    type: ConnectionEventType;
    timestamp: Date;
    data: any;
  }>;
  systemInfo: {
    nodeVersion: string;
    platform: string;
    arch: string;
    memory: {
      used: number;
      total: number;
      percentage: number;
    };
    cpu: {
      usage: number;
      loadAverage: number[];
    };
  };
}

/**
 * Connection action types for degradation
 */
export type ConnectionAction = 
  | 'disable_non_critical_features'
  | 'increase_timeouts'
  | 'reduce_concurrent_requests'
  | 'enable_aggressive_caching'
  | 'disable_analytics'
  | 'reduce_logging_level'
  | 'enable_read_only_mode'
  | 'shutdown_non_essential_services';

/**
 * Connection recovery options
 */
export interface ConnectionRecoveryOptions {
  strategy: 'aggressive' | 'conservative' | 'automatic';
  maxAttempts: number;
  delay: number;
  backoffMultiplier: number;
  timeout: number;
  forceReconnect: boolean;
  resetMetrics: boolean;
  notifyUsers: boolean;
}

/**
 * Connection notification options
 */
export interface ConnectionNotificationOptions {
  enabled: boolean;
  channels: string[];
  events: ConnectionEventType[];
  template?: string;
  includeMetrics: boolean;
  includeDiagnostics: boolean;
}

/**
 * Default connection configuration
 */
export const DEFAULT_CONNECTION_CONFIG: ConnectionConfig = {
  token: '',
  intents: [],
  autoReconnect: true,
  maxReconnectAttempts: 10,
  reconnectDelay: 5000,
  reconnectBackoffMultiplier: 2,
  maxReconnectDelay: 300000,
  healthCheck: {
    enabled: true,
    interval: 30000,
    timeout: 10000,
    retries: 3,
    checks: []
  },
  circuitBreaker: {
    enabled: true,
    failureThreshold: 5,
    recoveryThreshold: 3,
    timeout: 60000,
    monitoringPeriod: 300000,
    halfOpenMaxCalls: 3,
    resetTimeout: 120000
  },
  degradation: {
    enabled: true,
    thresholds: {
      latency: 1000,
      errorRate: 0.1,
      consecutiveErrors: 3
    },
    actions: {
      [DegradationLevel.MINIMAL]: [
        'reduce_logging_level'
      ],
      [DegradationLevel.MODERATE]: [
        'disable_analytics',
        'increase_timeouts'
      ],
      [DegradationLevel.SEVERE]: [
        'disable_non_critical_features',
        'reduce_concurrent_requests',
        'enable_aggressive_caching'
      ],
      [DegradationLevel.CRITICAL]: [
        'enable_read_only_mode',
        'shutdown_non_essential_services'
      ]
    },
    recoveryThreshold: 0.05,
    recoveryDelay: 30000
  },
  connectionTimeout: 30000,
  heartbeatInterval: 41250,
  heartbeatTimeout: 60000,
  sessionId: '',
  sessionTimeout: 300000,
  compress: true,
  restTimeout: 15000,
  restRetries: 3,
  restRetryDelay: 1000,
  metricsEnabled: true,
  metricsInterval: 60000,
  eventsEnabled: true
};