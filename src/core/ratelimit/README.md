# Discord API Rate Limiting Module

This module provides comprehensive rate limiting for Discord API calls, ensuring reliable operation and preventing API abuse.

## Features

- **Bucket Management**: Automatic management of Discord API rate limit buckets
- **Priority Queue**: Request prioritization with 5 priority levels (CRITICAL to BULK)
- **Automatic Retry**: Exponential backoff retry logic for failed requests
- **Global Limits**: Support for both global and per-bucket rate limits
- **Metrics & Monitoring**: Comprehensive metrics collection and reporting
- **Persistent Storage**: In-memory and Redis-based storage options
- **TypeScript Support**: Full TypeScript support with comprehensive type definitions

## Architecture

### Core Components

1. **Types** (`types.ts`): Comprehensive type definitions for all rate limiting components
2. **Configuration** (`config.ts`): Default configurations and endpoint-specific limits
3. **Priority Queue** (`priorityQueue.ts`): Priority-based request queuing system
4. **Rate Limit Store** (`store.ts`): Storage abstraction with in-memory and Redis implementations
5. **Bucket Manager** (`bucketManager.ts`): Manages rate limit buckets and request consumption
6. **Middleware** (`middleware.ts`): HTTP middleware for automatic rate limit handling
7. **Orchestrator** (`orchestrator.ts`): Main coordinator that ties all components together

## Usage

### Basic Usage

```typescript
import { createRateLimitOrchestrator, QueuedRequest, RequestPriority } from './core/ratelimit';

// Create orchestrator with HTTP client
const orchestrator = createRateLimitOrchestrator(async (request) => {
  // Your HTTP client implementation
  return await makeHttpRequest(request);
});

// Enqueue a request
const request: QueuedRequest = {
  id: 'unique-request-id',
  url: 'https://discord.com/api/v9/channels/123/messages',
  method: 'POST',
  priority: RequestPriority.HIGH,
  timestamp: Date.now(),
  retryCount: 0,
  maxRetries: 3,
  resolve: (result) => console.log('Success:', result),
  reject: (error) => console.error('Error:', error),
  body: { content: 'Hello, world!' }
};

try {
  const response = await orchestrator.enqueue(request);
  console.log('Request completed:', response);
} catch (error) {
  console.error('Request failed:', error);
}
```

### Advanced Usage with Custom Configuration

```typescript
import { 
  createRateLimitOrchestrator, 
  createMemoryStore,
  createBucketManager,
  createPriorityQueue 
} from './core/ratelimit';

// Create custom store
const store = createMemoryStore(60000); // 60 second cleanup interval

// Create bucket manager
const bucketManager = createBucketManager(store);

// Create priority queue with custom size
const queue = createPriorityQueue(500);

// Create orchestrator with custom configuration
const orchestrator = createRateLimitOrchestrator(httpClient, {
  maxQueueSize: 500,
  requestTimeout: 45000,
  maxRetries: 5,
  enableMetrics: true
});
```

### Redis Storage

```typescript
import { createRedisStore, createRateLimitOrchestrator } from './core/ratelimit';
import Redis from 'ioredis';

// Create Redis client
const redis = new Redis({
  host: 'localhost',
  port: 6379,
  password: 'your-redis-password'
});

// Create Redis store
const store = createRedisStore(redis, 'discord-ratelimit:', 300);

// Create orchestrator with Redis store
const orchestrator = createRateLimitOrchestrator(httpClient, {
  storeType: 'redis',
  redis
});
```

## Request Priority Levels

- **CRITICAL (0)**: Bot lifecycle, emergency responses
- **HIGH (1)**: User interactions, commands
- **NORMAL (2)**: Regular API calls
- **LOW (3)**: Background tasks, analytics
- **BULK (4)**: Mass operations, non-urgent

## Rate Limit Configuration

The module includes pre-configured rate limits for common Discord API endpoints:

- **Messages**: 5 requests per 5 seconds
- **Interactions**: 1 request per 3 seconds
- **Typing**: 5 requests per 10 seconds
- **Audit Logs**: 10 requests per 10 seconds
- **Bulk Operations**: 1 request per 5 seconds

## Metrics and Monitoring

```typescript
// Get comprehensive metrics
const metrics = await orchestrator.getMetrics();
console.log('Total requests:', metrics.totalRequests);
console.log('Success rate:', metrics.successfulRequests / metrics.totalRequests);
console.log('Rate limit hits:', metrics.rateLimitedRequests);

// Get detailed statistics
const stats = await orchestrator.getDetailedStats();
console.log('Queue stats:', stats.queue);
console.log('Bucket stats:', stats.buckets);
```

## Error Handling

The module provides comprehensive error handling:

- **Rate Limit Errors**: Automatic retry with exponential backoff
- **Network Errors**: Configurable retry logic
- **Timeout Errors**: Request timeout handling
- **Bucket Exhaustion**: Automatic queuing when limits are reached

## Best Practices

1. **Set Appropriate Priorities**: Use CRITICAL for essential bot operations
2. **Monitor Metrics**: Regularly check rate limit metrics
3. **Handle Timeouts**: Implement proper timeout handling
4. **Use Redis for Production**: Redis provides better scalability
5. **Configure Cleanup**: Set appropriate cleanup intervals

## Testing

The module includes comprehensive tests:

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- src/core/ratelimit/__tests__/priorityQueue.test.ts
```

## Configuration Options

```typescript
interface RateLimitConfig {
  defaultLimit: number;           // Default bucket limit
  defaultResetAfter: number;       // Default reset time (ms)
  maxRetries: number;             // Maximum retry attempts
  retryDelay: number;             // Base retry delay (ms)
  maxQueueSize: number;           // Maximum queue size
  globalLimit: number;            // Global rate limit
  globalResetAfter: number;        // Global reset time (ms)
  bucketCleanupInterval: number;    // Cleanup interval (ms)
  requestTimeout: number;          // Request timeout (ms)
  enablePriorityQueue: boolean;    // Enable priority queuing
  enableMetrics: boolean;         // Enable metrics collection
}
```

## Integration with Discord.js

```typescript
import { Client } from 'discord.js';
import { createRateLimitOrchestrator } from './core/ratelimit';

const client = new Client({
  intents: ['Guilds', 'Messages']
});

// Create rate limit orchestrator
const orchestrator = createRateLimitOrchestrator(async (request) => {
  // Use Discord.js's internal REST manager
  return client.rest.makeRequest(
    request.method,
    request.url,
    request.body,
    request.headers
  );
});

client.on('ready', () => {
  console.log('Bot is ready with rate limiting');
});

client.login('your-bot-token');
```

## Performance Considerations

- **Memory Usage**: Monitor memory usage with large queues
- **Cleanup Frequency**: Balance cleanup frequency with performance
- **Batch Operations**: Use bulk operations when possible
- **Connection Pooling**: Reuse HTTP connections for better performance

## Troubleshooting

### Common Issues

1. **Queue Full**: Increase `maxQueueSize` or process requests faster
2. **High Memory**: Reduce cleanup interval or queue size
3. **Redis Connection**: Check Redis configuration and connectivity
4. **Rate Limit Hits**: Review request patterns and priorities

### Debug Mode

```typescript
const orchestrator = createRateLimitOrchestrator(httpClient, {
  enableMetrics: true,
  debug: true
});

// Get detailed debug information
const stats = await orchestrator.getDetailedStats();
console.log('Debug stats:', JSON.stringify(stats, null, 2));
```

## License

MIT License - see LICENSE file for details.