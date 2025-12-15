# Connection Management System

This directory contains a comprehensive connection management system for the Discord bot, providing robust connection handling, health monitoring, circuit breaker patterns, and graceful degradation.

## Overview

The connection management system consists of several coordinated components:

- **Connection Orchestrator**: Main coordinator that manages all connection components
- **Health Monitor**: Monitors connection health with comprehensive metrics
- **Circuit Breaker**: Implements circuit breaker pattern for fault tolerance
- **Degradation Handler**: Manages graceful degradation during issues
- **Configuration Manager**: Handles connection configuration and validation

## Components

### Connection Orchestrator (`orchestrator.ts`)

The main coordinator that manages the entire connection lifecycle.

**Key Features:**
- Coordinates all connection components
- Handles Discord client lifecycle events
- Manages connection state transitions
- Provides recovery strategies
- Emits unified connection events

**Usage:**
```typescript
import { ConnectionOrchestrator } from './connection';

const orchestrator = new ConnectionOrchestrator(config, logger);
await orchestrator.start();
```

### Health Monitor (`healthMonitor.ts`)

Monitors connection health with advanced metrics and automated health checks.

**Key Features:**
- Real-time health monitoring
- Configurable health checks (latency, gateway, error rate)
- Health scoring and trend analysis
- Historical health data
- Automatic health status updates

**Health Checks:**
- **Latency Check**: Monitors API response times
- **Gateway Check**: Verifies Discord gateway connectivity
- **Error Rate Check**: Tracks error frequency

**Usage:**
```typescript
const healthStatus = orchestrator.getHealthMonitor().getHealthStatus();
const diagnostics = orchestrator.getHealthMonitor().getDiagnostics();
```

### Circuit Breaker (`circuitBreaker.ts`)

Implements the circuit breaker pattern for fault tolerance and automatic recovery.

**Key Features:**
- Automatic circuit opening on failures
- Configurable failure thresholds
- Half-open state for testing recovery
- Exponential backoff for retries
- Detailed circuit metrics

**States:**
- **CLOSED**: Normal operation, all requests pass through
- **OPEN**: Failing state, all requests are rejected
- **HALF_OPEN**: Testing state, limited requests allowed

**Usage:**
```typescript
const result = await orchestrator.getCircuitBreaker().execute(
  () => someOperation(),
  'operation_name'
);
```

### Degradation Handler (`degradationHandler.ts`)

Manages graceful degradation when connection issues are detected.

**Key Features:**
- Automatic degradation activation based on metrics
- Configurable degradation levels and actions
- Automatic recovery when conditions improve
- Action rollback on recovery
- Degradation history tracking

**Degradation Levels:**
- **MINIMAL**: Minor performance optimizations
- **MODERATE**: Disable non-essential features
- **SEVERE**: Significant feature limitations
- **CRITICAL**: Read-only mode, essential services only

**Actions:**
- `disable_non_critical_features`: Disable music, games, etc.
- `increase_timeouts`: Extend operation timeouts
- `reduce_concurrent_requests`: Limit concurrent operations
- `enable_aggressive_caching`: Cache all responses
- `disable_analytics`: Stop collecting metrics
- `reduce_logging_level`: Log only errors/warnings
- `enable_read_only_mode`: Only respond to read operations
- `shutdown_non_essential_services`: Stop background tasks

**Usage:**
```typescript
const evaluation = orchestrator.getDegradationHandler().evaluateDegradation(metrics);
if (evaluation.shouldDegrade) {
  await orchestrator.getDegradationHandler().activateDegradation(
    evaluation.level,
    evaluation.actions,
    evaluation.reason
  );
}
```

### Configuration Manager (`config.ts`)

Manages connection configuration with validation and environment support.

**Key Features:**
- Configuration validation with detailed error reporting
- Environment variable support
- File-based configuration import/export
- Environment-specific recommendations
- Bot size-based presets

**Environment Variables:**
- `DISCORD_TOKEN`: Bot authentication token
- `DISCORD_INTENTS`: Comma-separated list of intents
- `DISCORD_AUTO_RECONNECT`: Enable/disable auto reconnect
- `DISCORD_MAX_RECONNECT_ATTEMPTS`: Maximum reconnection attempts
- And many more...

**Usage:**
```typescript
const configManager = ConnectionConfigManager.fromEnvironment(logger);
const config = configManager.getConfig();
```

## Configuration

### Basic Configuration

```typescript
const config: ConnectionConfig = {
  token: 'your-bot-token',
  intents: ['Guilds', 'GuildMessages', 'MessageContent'],
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
    checks: [
      {
        name: 'latency_check',
        type: 'latency',
        enabled: true,
        threshold: 1000,
        critical: false,
        executor: async () => { /* custom check */ }
      }
    ]
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
      minimal: ['reduce_logging_level'],
      moderate: ['disable_analytics', 'increase_timeouts'],
      severe: ['disable_non_critical_features', 'reduce_concurrent_requests'],
      critical: ['enable_read_only_mode', 'shutdown_non_essential_services']
    },
    recoveryThreshold: 0.05,
    recoveryDelay: 30000
  }
};
```

### Environment-Specific Presets

**Small Bot (< 100 servers):**
- Conservative reconnection settings
- Longer health check intervals
- Lower failure thresholds

**Medium Bot (100-1000 servers):**
- Balanced settings
- Moderate health monitoring
- Standard failure thresholds

**Large Bot (> 1000 servers):**
- Aggressive reconnection settings
- Frequent health monitoring
- Higher failure thresholds

## Event System

The connection system emits various events for monitoring and integration:

### Event Types

- `STATE_CHANGED`: Connection state changed
- `HEALTH_CHANGED`: Health status changed
- `CIRCUIT_BREAKER_TRIGGERED`: Circuit breaker state changed
- `DEGRADATION_ACTIVATED`: Degradation activated
- `DEGRADATION_DEACTIVATED`: Degradation deactivated
- `ERROR_OCCURRED`: Error occurred
- `RECOVERY_ATTEMPTED`: Recovery attempt started
- `RECOVERY_COMPLETED`: Recovery attempt finished

### Event Listening

```typescript
orchestrator.addEventListener(ConnectionEventType.HEALTH_CHANGED, async (event) => {
  console.log('Health changed from', event.data.previousHealth, 'to', event.data.currentHealth);
});
```

## Monitoring and Diagnostics

### Health Metrics

The system tracks comprehensive metrics:

- **Connection Metrics**: Total connections, disconnections, uptime
- **Performance Metrics**: Latency, error rates, response times
- **Health Scores**: Overall health, stability, reliability
- **Circuit Breaker Metrics**: Failure counts, rejection rates
- **Degradation Metrics**: Activation history, current level

### Diagnostics

```typescript
const diagnostics = orchestrator.getDiagnostics();
console.log('Connection state:', diagnostics.state);
console.log('Health score:', diagnostics.health);
console.log('Active actions:', diagnostics.degradation.activeActions);
```

## Recovery Strategies

The system supports custom recovery strategies:

```typescript
const recoveryStrategy: RecoveryStrategy = {
  name: 'restart_client',
  priority: 1,
  conditions: (error, metrics) => {
    return error.message.includes('ECONNRESET');
  },
  execute: async (error, metrics) => {
    // Custom recovery logic
    return true;
  }
};

orchestrator.addRecoveryStrategy(recoveryStrategy);
```

## Best Practices

### Configuration

1. **Use Environment Variables**: Store sensitive data like tokens in environment variables
2. **Enable All Features**: Use health monitoring, circuit breaker, and degradation together
3. **Tune Thresholds**: Adjust thresholds based on your bot's usage patterns
4. **Monitor Metrics**: Regularly check health metrics and diagnostics

### Error Handling

1. **Implement Recovery Strategies**: Add custom recovery strategies for known issues
2. **Monitor Circuit Breaker**: Watch for frequent circuit openings
3. **Track Degradation**: Monitor degradation frequency and duration
4. **Log Events**: Listen to connection events for debugging

### Performance

1. **Optimize Health Checks**: Balance check frequency with performance impact
2. **Configure Circuit Breaker**: Set appropriate thresholds for your use case
3. **Use Degradation**: Prevent complete failures with graceful degradation
4. **Monitor Resources**: Track memory and CPU usage during connection issues

## Integration

### With Existing Lifecycle Managers

The connection system is designed to integrate with existing lifecycle managers:

```typescript
// In your existing connection manager
import { ConnectionOrchestrator } from './connection';

class EnhancedConnectionManager {
  private connectionOrchestrator: ConnectionOrchestrator;
  
  constructor(config: BotConfig, logger: Logger) {
    this.connectionOrchestrator = new ConnectionOrchestrator(
      this.convertConfig(config),
      logger
    );
    
    // Forward events to existing listeners
    this.connectionOrchestrator.addEventListener(
      ConnectionEventType.STATE_CHANGED,
      this.handleStateChange.bind(this)
    );
  }
  
  private convertConfig(botConfig: BotConfig): ConnectionConfig {
    // Convert your existing config format
    return {
      token: botConfig.token,
      intents: botConfig.intents,
      // ... map other properties
    };
  }
}
```

### With Health Monitoring

```typescript
// Enhance existing health monitoring
const healthMonitor = orchestrator.getHealthMonitor();

// Add custom health checks
healthMonitor.updateConfig({
  checks: [
    ...healthMonitor.getConfig().checks,
    {
      name: 'custom_check',
      type: 'custom',
      enabled: true,
      threshold: 100,
      critical: false,
      executor: async () => {
        // Custom health check logic
        return { name: 'custom_check', passed: true, threshold: 100, duration: 50, timestamp: new Date() };
      }
    }
  ]
});
```

## Troubleshooting

### Common Issues

1. **Circuit Breaker Always Open**:
   - Check failure threshold settings
   - Verify health check implementations
   - Monitor error rates

2. **Frequent Degradation**:
   - Review degradation thresholds
   - Check underlying connection issues
   - Optimize bot performance

3. **High Error Rates**:
   - Verify Discord API usage
   - Check rate limiting
   - Review error handling

4. **Connection Timeouts**:
   - Increase timeout values
   - Check network connectivity
   - Verify Discord API status

### Debug Information

Enable debug logging for detailed troubleshooting:

```typescript
const configManager = new ConnectionConfigManager({
  // ... your config
}, new Logger('ConnectionConfig', 'debug'));
```

This will provide detailed logs about:
- Configuration validation
- State transitions
- Health check results
- Circuit breaker actions
- Degradation decisions

## Examples

See the `examples/` directory for complete usage examples:

- `basic-usage.ts`: Simple connection management
- `advanced-configuration.ts`: Complex configuration scenarios
- `custom-health-checks.ts`: Custom health check implementations
- `recovery-strategies.ts`: Custom recovery strategy examples

## API Reference

Detailed API documentation is available in the TypeScript interfaces and JSDoc comments in each file. Key interfaces:

- `ConnectionConfig`: Main configuration interface
- `ConnectionMetrics`: Metrics tracking
- `ConnectionEvent`: Event system
- `RecoveryStrategy`: Custom recovery implementations

## Contributing

When contributing to the connection system:

1. **Maintain Compatibility**: Ensure changes work with existing lifecycle managers
2. **Add Tests**: Include unit tests for new features
3. **Update Documentation**: Keep README and JSDoc comments current
4. **Test Integration**: Verify integration with existing bot components

## License

This connection management system is part of the Discord bot project and follows the same license terms.