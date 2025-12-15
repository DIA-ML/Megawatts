/**
 * Discord API Rate Limiting Module
 *
 * This module provides comprehensive rate limiting for Discord API calls including:
 * - Bucket management for different API endpoints
 * - Priority queue for request ordering
 * - Automatic retry with exponential backoff
 * - Global and per-bucket rate limits
 * - Metrics and monitoring
 * - Persistent storage support
 */

export { RequestPriority } from './types';
export type {
  RateLimitInfo,
  RateLimitBucket,
  QueuedRequest,
  RateLimitConfig,
  RateLimitMetrics,
  RateLimitStore,
  RateLimitMiddleware,
  RateLimitOrchestrator,
} from './types';

export { DEFAULT_RATE_LIMIT_CONFIG, ENDPOINT_RATE_LIMITS, getRateLimitConfig, extractBucketId, extractRateLimitInfo, calculateBackoffDelay, shouldUsePriorityQueue, getRequestPriority } from './config';

export { PriorityQueue } from './priorityQueue';
export { MemoryRateLimitStore, RedisRateLimitStore } from './store';
export { BucketManager } from './bucketManager';
export { DiscordRateLimitMiddleware, type HttpResponse } from './middleware';
export { DiscordRateLimitOrchestrator } from './orchestrator';

// Import classes for factory functions
import { DiscordRateLimitOrchestrator as Orchestrator } from './orchestrator';
import { DiscordRateLimitMiddleware as Middleware } from './middleware';
import { BucketManager } from './bucketManager';
import { MemoryRateLimitStore } from './store';
import { PriorityQueue } from './priorityQueue';
import { RedisRateLimitStore } from './store';

/**
 * Create a rate limit orchestrator with default configuration
 */
export function createRateLimitOrchestrator(
  httpClient: (request: any) => Promise<any>,
  config?: any
) {
  return new Orchestrator(httpClient, config);
}

/**
 * Create a rate limit middleware with default configuration
 */
export function createRateLimitMiddleware(
  bucketManager: any,
  httpClient: (request: any) => Promise<any>,
  config?: any
) {
  return new Middleware(bucketManager, config, httpClient);
}

/**
 * Create a bucket manager with default store
 */
export function createBucketManager(store?: any) {
  const storeInstance = store || new MemoryRateLimitStore();
  return new BucketManager(storeInstance);
}

/**
 * Create a priority queue
 */
export function createPriorityQueue(maxSize?: number) {
  return new PriorityQueue(maxSize);
}

/**
 * Create an in-memory rate limit store
 */
export function createMemoryStore(cleanupInterval?: number) {
  return new MemoryRateLimitStore(cleanupInterval);
}

/**
 * Create a Redis rate limit store
 */
export function createRedisStore(redis: any, keyPrefix?: string, ttl?: number) {
  return new RedisRateLimitStore(redis, keyPrefix, ttl);
}