# Health Check Module

Comprehensive health monitoring and status checking system for the Discord bot. This module provides system diagnostics, API monitoring, and health check endpoints.

## Features

- **System Health Monitoring**: Monitor CPU, memory, disk usage, and other system metrics
- **Discord API Health**: Check Discord API connectivity and latency
- **Database Health**: Monitor database connection status
- **External API Monitoring**: Check external service availability
- **Health Check Endpoints**: HTTP endpoints for health monitoring
- **Alerting System**: Automatic alert generation for health issues
- **Metrics Collection**: Collect and store performance metrics
- **Middleware Support**: Request/response monitoring and rate limiting

## Architecture

```
src/core/health/
├── types.ts          # Type definitions and interfaces
├── config.ts         # Configuration and thresholds
├── service.ts        # Health check service implementations
├── orchestrator.ts   # Main health check orchestrator
├── endpoints.ts      # HTTP endpoints for health checks
├── middleware.ts     # Request/response middleware
├── index.ts         # Main exports and HealthManager
└── README.md         # This documentation
```

## Quick Start

### Basic Usage

```typescript
import { HealthManager } from './core/health';

// Create health manager
const healthManager = new HealthManager({
  enabled: true,
  checkInterval: 30000, // 30 seconds
  endpoints: {
    basic: {
      enabled: true,
      path: '/health',
      method: 'GET'
    }
  }
});

// Initialize
await healthManager.initialize();

// Setup endpoints (Express example)
app.use('/health', healthManager.getEndpoints());

// Start monitoring
healthManager.startMonitoring();
```

### Express Integration

```typescript
import { setupHealthMonitoring } from './core/health';

// Quick setup with Express
const healthManager = await setupHealthMonitoring(app, {
  enabled: true,
  checkInterval: 30000
});
```

## Health Check Types

### Built-in Checks

1. **Discord API** (`discord_api`)
   - Checks Discord API connectivity
   - Monitors ping latency
   - Tracks guild and user counts

2. **Database** (`database`)
   - Validates database connection
   - Measures response time
   - Critical for bot operation

3. **Memory** (`memory`)
   - Monitors heap usage
   - Tracks memory leaks
   - Warning at 80%, critical at 95%

4. **CPU** (`cpu`)
   - Measures CPU usage
   - Tracks performance degradation
   - Warning at 80%, critical at 95%

5. **Disk** (`disk`)
   - Monitors disk space
   - Prevents storage issues
   - Warning at 80%, critical at 95%

6. **External API** (`external_api`)
   - Checks external service availability
   - Customizable target URLs
   - Timeout handling

### Custom Health Checks

```typescript
import { HealthCheck, CheckType, HealthStatus } from './core/health';

const customCheck: HealthCheck = {
  name: 'custom_service',
  type: CheckType.CUSTOM,
  check: async () => {
    // Your custom health check logic
    const isHealthy = await checkCustomService();
    
    return {
      status: isHealthy ? HealthStatus.HEALTHY : HealthStatus.UNHEALTHY,
      checkType: CheckType.CUSTOM,
      name: 'custom_service',
      message: isHealthy ? 'Service is healthy' : 'Service is down',
      timestamp: new Date(),
      details: { /* additional data */ }
    };
  },
  options: {
    timeout: 5000,
    critical: true
  }
};

healthManager.addHealthCheck(customCheck);
```

## Endpoints

### Basic Health Check

**GET** `/health`

Returns basic health status:

```json
{
  "status": "healthy",
  "timestamp": "2023-12-15T10:30:00.000Z",
  "uptime": 3600000,
  "version": "1.0.0",
  "summary": {
    "total": 6,
    "healthy": 6,
    "degraded": 0,
    "unhealthy": 0,
    "critical": 0
  }
}
```

### Detailed Health Check

**GET** `/health/detailed`

Requires authentication (if configured):

```json
{
  "status": "healthy",
  "timestamp": "2023-12-15T10:30:00.000Z",
  "uptime": 3600000,
  "version": "1.0.0",
  "summary": { /* ... */ },
  "checks": [
    {
      "status": "healthy",
      "checkType": "discord_api",
      "name": "discord_api",
      "message": "Discord API connected, ping: 45.23ms",
      "responseTime": 123,
      "timestamp": "2023-12-15T10:30:00.000Z",
      "details": {
        "connected": true,
        "ping": 45.23,
        "guilds": 5,
        "users": 1000
      }
    }
  ],
  "metrics": [ /* recent metrics */ ],
  "alerts": [ /* active alerts */ ],
  "monitoring": {
    "enabled": true,
    "interval": 30000
  }
}
```

### Readiness Probe

**GET** `/ready`

Returns service readiness status:

```json
{
  "ready": true,
  "timestamp": "2023-12-15T10:30:00.000Z",
  "checks": [
    {
      "name": "discord_api",
      "status": "healthy",
      "message": "Discord API connected"
    }
  ]
}
```

### Liveness Probe

**GET** `/live`

Returns process liveness status:

```json
{
  "alive": true,
  "timestamp": "2023-12-15T10:30:00.000Z",
  "uptime": 3600000
}
```

### Additional Endpoints

- **GET** `/health/metrics` - Get performance metrics
- **GET** `/health/alerts` - Get health alerts
- **GET** `/health/checks` - List all health checks
- **GET** `/health/check/:name` - Run specific health check

## Configuration

### Basic Configuration

```typescript
const config = {
  enabled: true,
  checkInterval: 30000, // 30 seconds
  alertThreshold: 3, // Alert after 3 consecutive failures
  metricsRetention: 86400000, // 24 hours
  endpoints: {
    basic: {
      enabled: true,
      path: '/health',
      method: 'GET',
      authentication: {
        enabled: false
      },
      rateLimit: {
        enabled: true,
        maxRequests: 10,
        windowMs: 60000
      }
    },
    detailed: {
      enabled: true,
      path: '/health/detailed',
      method: 'GET',
      authentication: {
        enabled: true,
        token: 'your-secret-token',
        header: 'X-Health-Token'
      }
    }
  }
};
```

### Thresholds

```typescript
const thresholds = {
  memory: {
    warning: 0.8,    // 80%
    critical: 0.95    // 95%
  },
  cpu: {
    warning: 0.8,     // 80%
    critical: 0.95     // 95%
  },
  responseTime: {
    warning: 1000,     // 1 second
    critical: 5000     // 5 seconds
  },
  discord: {
    pingWarning: 500,  // 500ms
    pingCritical: 2000  // 2 seconds
  }
};
```

## Middleware

### Request Logging

```typescript
app.use(healthManager.getMiddleware().requestLogger());
```

### Performance Monitoring

```typescript
app.use(healthManager.getMiddleware().performanceMonitor());
```

### Rate Limiting

```typescript
app.use('/api', healthManager.getMiddleware().rateLimit({
  windowMs: 60000,    // 1 minute
  maxRequests: 100,    // 100 requests per minute
  message: 'Too many requests'
}));
```

### Error Tracking

```typescript
app.use(healthManager.getMiddleware().errorTracker());
```

## Alerting

The system automatically generates alerts when health checks fail:

```typescript
// Get active alerts
const alerts = healthManager.getActiveAlerts();

// Alert structure
interface HealthAlert {
  id: string;
  timestamp: Date;
  severity: 'info' | 'warning' | 'error' | 'critical';
  checkName: string;
  message: string;
  resolved: boolean;
  resolvedAt?: Date;
}
```

## Metrics

Health metrics are collected and stored for analysis:

```typescript
// Get recent metrics
const metrics = healthManager.getMetrics(100); // Last 100 metrics

// Metric structure
interface HealthMetrics {
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
```

## Docker Integration

### Health Checks in Docker

```dockerfile
# Dockerfile
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1
```

### Docker Compose

```yaml
# docker-compose.yml
services:
  bot:
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

## Kubernetes Integration

### Liveness and Readiness Probes

```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: discord-bot
spec:
  template:
    spec:
      containers:
      - name: bot
        image: discord-bot:latest
        livenessProbe:
          httpGet:
            path: /live
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
```

## Best Practices

1. **Configure Appropriate Timeouts**: Set realistic timeouts for health checks
2. **Use Critical Flags**: Mark essential checks as critical
3. **Monitor Trends**: Use metrics to identify performance trends
4. **Set Up Alerts**: Configure alerting for critical failures
5. **Test Failures**: Regularly test failure scenarios
6. **Document Endpoints**: Ensure monitoring systems know about health endpoints
7. **Security**: Use authentication for detailed health endpoints
8. **Rate Limiting**: Prevent abuse of health endpoints

## Troubleshooting

### Common Issues

1. **Health Checks Failing**: Check network connectivity and service dependencies
2. **High Memory Usage**: Monitor for memory leaks in custom checks
3. **Slow Response Times**: Optimize health check implementations
4. **False Alerts**: Adjust thresholds and retry counts
5. **Endpoint Not Accessible**: Verify firewall and routing configurations

### Debug Mode

Enable debug logging for troubleshooting:

```typescript
import { Logger } from './utils/logger';

const logger = new Logger('Health');
logger.setLogLevel('DEBUG');
```

## API Reference

### HealthManager

Main class for managing health monitoring.

#### Methods

- `initialize()`: Initialize health monitoring
- `setupEndpoints(app)`: Setup HTTP endpoints
- `runHealthChecks()`: Run all health checks
- `getReadiness()`: Check service readiness
- `getLiveness()`: Check process liveness
- `addHealthCheck(check)`: Add custom health check
- `removeHealthCheck(name)`: Remove health check
- `startMonitoring()`: Start continuous monitoring
- `stopMonitoring()`: Stop monitoring
- `getMetrics(limit)`: Get performance metrics
- `getActiveAlerts()`: Get active alerts

### HealthOrchestrator

Core orchestrator for health checks.

#### Methods

- `runAllChecks()`: Execute all health checks
- `runCheck(name)`: Run specific health check
- `addCheck(check)`: Add health check
- `removeCheck(name)`: Remove health check
- `getChecks()`: Get all registered checks
- `getMetrics(limit)`: Get stored metrics
- `getActiveAlerts()`: Get unresolved alerts
- `startMonitoring()`: Start background monitoring
- `stopMonitoring()`: Stop background monitoring

### HealthService

Service implementations for health checks.

#### Methods

- `checkDiscordApi()`: Check Discord API health
- `checkDatabase()`: Check database connectivity
- `checkMemory()`: Check memory usage
- `checkCpu()`: Check CPU usage
- `checkDisk()`: Check disk space
- `checkExternalApi(url)`: Check external API
- `runCustomCheck(check)`: Run custom health check

## Contributing

When adding new health checks:

1. Follow the existing patterns in `service.ts`
2. Add appropriate error handling
3. Include meaningful details in results
4. Update documentation
5. Add unit tests
6. Consider performance impact

## License

This module is part of the Discord bot project and follows the same license terms.