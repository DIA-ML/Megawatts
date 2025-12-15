import { RateLimitStore, RateLimitBucket, RateLimitInfo, RateLimitMetrics } from './types';
import { Logger } from '../../utils/logger';

const logger = new Logger('RateLimitStore');

/**
 * In-memory rate limit store with TTL support
 */
export class MemoryRateLimitStore implements RateLimitStore {
  private buckets: Map<string, RateLimitBucket>;
  private globalLimit: RateLimitInfo | null;
  private metrics: RateLimitMetrics;
  private cleanupInterval: ReturnType<typeof setInterval> | null;

  constructor(private cleanupIntervalMs: number = 60000) {
    this.buckets = new Map();
    this.globalLimit = null;
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      rateLimitedRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      bucketCount: 0,
      queueSize: 0,
      globalRateLimits: 0,
      lastReset: Date.now(),
    };
    this.cleanupInterval = null;
    
    this.startCleanup();
  }

  async getBucket(bucketId: string): Promise<RateLimitBucket | null> {
    const bucket = this.buckets.get(bucketId);
    
    if (!bucket) {
      return null;
    }
    
    // Check if bucket is expired
    if (Date.now() > bucket.resetAt) {
      this.buckets.delete(bucketId);
      return null;
    }
    
    return bucket;
  }

  async setBucket(bucketId: string, bucket: RateLimitBucket): Promise<void> {
    // Update bucket metadata
    bucket.lastUsed = Date.now();
    
    this.buckets.set(bucketId, bucket);
    this.metrics.bucketCount = this.buckets.size;
    
    logger.debug(`Rate limit bucket updated: ${bucketId}`, {
      remaining: bucket.remaining,
      resetAt: bucket.resetAt,
    });
  }

  async deleteBucket(bucketId: string): Promise<void> {
    this.buckets.delete(bucketId);
    this.metrics.bucketCount = this.buckets.size;
  }

  async getAllBuckets(): Promise<RateLimitBucket[]> {
    const now = Date.now();
    const activeBuckets: RateLimitBucket[] = [];
    
    for (const [bucketId, bucket] of this.buckets.entries()) {
      if (now <= bucket.resetAt) {
        activeBuckets.push(bucket);
      } else {
        this.buckets.delete(bucketId);
      }
    }
    
    this.metrics.bucketCount = this.buckets.size;
    return activeBuckets;
  }

  async clearExpiredBuckets(): Promise<void> {
    const now = Date.now();
    let cleared = 0;
    
    for (const [bucketId, bucket] of this.buckets.entries()) {
      if (now > bucket.resetAt) {
        this.buckets.delete(bucketId);
        cleared++;
      }
    }
    
    this.metrics.bucketCount = this.buckets.size;
    
    if (cleared > 0) {
      logger.debug(`Cleared ${cleared} expired rate limit buckets`);
    }
  }

  async getGlobalLimit(): Promise<RateLimitInfo | null> {
    if (!this.globalLimit) {
      return null;
    }
    
    // Check if global limit is expired
    if (Date.now() > this.globalLimit.resetAfter) {
      this.globalLimit = null;
      return null;
    }
    
    return this.globalLimit;
  }

  async setGlobalLimit(limit: RateLimitInfo): Promise<void> {
    this.globalLimit = {
      ...limit,
      resetAfter: Date.now() + limit.resetAfter,
    };
    
    this.metrics.globalRateLimits++;
    
    logger.warn('Global rate limit applied', {
      limit: limit.limit,
      resetAfter: limit.resetAfter,
    });
  }

  async incrementMetric(metric: keyof RateLimitMetrics): Promise<void> {
    switch (metric) {
      case 'totalRequests':
        this.metrics.totalRequests++;
        break;
      case 'successfulRequests':
        this.metrics.successfulRequests++;
        break;
      case 'rateLimitedRequests':
        this.metrics.rateLimitedRequests++;
        break;
      case 'failedRequests':
        this.metrics.failedRequests++;
        break;
      case 'globalRateLimits':
        this.metrics.globalRateLimits++;
        break;
    }
  }

  async getMetrics(): Promise<RateLimitMetrics> {
    return { ...this.metrics };
  }

  /**
   * Update average response time
   */
  updateAverageResponseTime(responseTime: number): void {
    const total = this.metrics.totalRequests || 1;
    this.metrics.averageResponseTime = 
      (this.metrics.averageResponseTime * (total - 1) + responseTime) / total;
  }

  /**
   * Update queue size metric
   */
  updateQueueSize(size: number): void {
    this.metrics.queueSize = size;
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      rateLimitedRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      bucketCount: this.buckets.size,
      queueSize: 0,
      globalRateLimits: 0,
      lastReset: Date.now(),
    };
  }

  /**
   * Start cleanup interval
   */
  private startCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    this.cleanupInterval = setInterval(async () => {
      await this.clearExpiredBuckets();
    }, this.cleanupIntervalMs);
  }

  /**
   * Stop cleanup interval
   */
  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Get bucket statistics
   */
  getBucketStats(): Record<string, any> {
    const stats: Record<string, any> = {
      totalBuckets: this.buckets.size,
      expiredBuckets: 0,
      activeBuckets: 0,
      averageRemaining: 0,
    };
    
    const now = Date.now();
    let totalRemaining = 0;
    
    for (const [bucketId, bucket] of this.buckets.entries()) {
      if (now > bucket.resetAt) {
        stats.expiredBuckets++;
      } else {
        stats.activeBuckets++;
        totalRemaining += bucket.remaining;
      }
    }
    
    if (stats.activeBuckets > 0) {
      stats.averageRemaining = totalRemaining / stats.activeBuckets;
    }
    
    return stats;
  }

  /**
   * Export store state for persistence
   */
  exportState(): {
    buckets: Record<string, RateLimitBucket>;
    globalLimit: RateLimitInfo | null;
    metrics: RateLimitMetrics;
  } {
    const buckets: Record<string, RateLimitBucket> = {};
    this.buckets.forEach((bucket, id) => {
      buckets[id] = { ...bucket };
    });
    
    return {
      buckets,
      globalLimit: this.globalLimit ? { ...this.globalLimit } : null,
      metrics: { ...this.metrics },
    };
  }

  /**
   * Import store state from persistence
   */
  importState(state: {
    buckets: Record<string, RateLimitBucket>;
    globalLimit: RateLimitInfo | null;
    metrics: RateLimitMetrics;
  }): void {
    this.buckets.clear();
    
    Object.entries(state.buckets).forEach(([id, bucket]) => {
      this.buckets.set(id, bucket);
    });
    
    this.globalLimit = state.globalLimit;
    this.metrics = state.metrics;
    this.metrics.bucketCount = this.buckets.size;
  }

  /**
   * Cleanup and destroy store
   */
  destroy(): void {
    this.stopCleanup();
    this.buckets.clear();
    this.globalLimit = null;
    this.resetMetrics();
  }
}

/**
 * Redis-based rate limit store for distributed systems
 */
export class RedisRateLimitStore implements RateLimitStore {
  constructor(
    private redis: any, // Redis client instance
    private keyPrefix: string = 'ratelimit:',
    private ttl: number = 300 // 5 minutes default TTL
  ) {}

  async getBucket(bucketId: string): Promise<RateLimitBucket | null> {
    try {
      const key = `${this.keyPrefix}bucket:${bucketId}`;
      const data = await this.redis.get(key);
      
      if (!data) {
        return null;
      }
      
      const bucket: RateLimitBucket = JSON.parse(data);
      
      // Check if bucket is expired
      if (Date.now() > bucket.resetAt) {
        await this.redis.del(key);
        return null;
      }
      
      return bucket;
    } catch (error) {
      logger.error('Failed to get rate limit bucket from Redis', error as Error, { bucketId });
      return null;
    }
  }

  async setBucket(bucketId: string, bucket: RateLimitBucket): Promise<void> {
    try {
      const key = `${this.keyPrefix}bucket:${bucketId}`;
      bucket.lastUsed = Date.now();
      
      const ttlMs = bucket.resetAt - Date.now();
      await this.redis.setex(key, Math.ceil(ttlMs / 1000), JSON.stringify(bucket));
    } catch (error) {
      logger.error('Failed to set rate limit bucket in Redis', error as Error, { bucketId });
    }
  }

  async deleteBucket(bucketId: string): Promise<void> {
    try {
      const key = `${this.keyPrefix}bucket:${bucketId}`;
      await this.redis.del(key);
    } catch (error) {
      logger.error('Failed to delete rate limit bucket from Redis', error as Error, { bucketId });
    }
  }

  async getAllBuckets(): Promise<RateLimitBucket[]> {
    // This would require scanning all keys, which is expensive
    // For Redis, it's better to maintain a separate index of active buckets
    throw new Error('getAllBuckets is not recommended for Redis store');
  }

  async clearExpiredBuckets(): Promise<void> {
    // Redis handles TTL automatically
    // This could be implemented with a scan if needed
  }

  async getGlobalLimit(): Promise<RateLimitInfo | null> {
    try {
      const key = `${this.keyPrefix}global`;
      const data = await this.redis.get(key);
      
      if (!data) {
        return null;
      }
      
      const limit: RateLimitInfo = JSON.parse(data);
      
      if (Date.now() > limit.resetAfter) {
        await this.redis.del(key);
        return null;
      }
      
      return limit;
    } catch (error) {
      logger.error('Failed to get global rate limit from Redis', error as Error);
      return null;
    }
  }

  async setGlobalLimit(limit: RateLimitInfo): Promise<void> {
    try {
      const key = `${this.keyPrefix}global`;
      const updatedLimit = {
        ...limit,
        resetAfter: Date.now() + limit.resetAfter,
      };
      
      await this.redis.setex(key, Math.ceil(limit.resetAfter / 1000), JSON.stringify(updatedLimit));
    } catch (error) {
      logger.error('Failed to set global rate limit in Redis', error as Error);
    }
  }

  async incrementMetric(metric: keyof RateLimitMetrics): Promise<void> {
    try {
      const key = `${this.keyPrefix}metrics:${metric}`;
      await this.redis.incr(key);
      await this.redis.expire(key, this.ttl);
    } catch (error) {
      logger.error('Failed to increment metric in Redis', error as Error, { metric });
    }
  }

  async getMetrics(): Promise<RateLimitMetrics> {
    try {
      const keys = await this.redis.keys(`${this.keyPrefix}metrics:*`);
      const metrics: Partial<RateLimitMetrics> = {};
      
      for (const key of keys) {
        const metric = key.replace(`${this.keyPrefix}metrics:`, '');
        const value = await this.redis.get(key);
        metrics[metric as keyof RateLimitMetrics] = parseInt(value || '0');
      }
      
      return {
        totalRequests: metrics.totalRequests || 0,
        successfulRequests: metrics.successfulRequests || 0,
        rateLimitedRequests: metrics.rateLimitedRequests || 0,
        failedRequests: metrics.failedRequests || 0,
        averageResponseTime: metrics.averageResponseTime || 0,
        bucketCount: metrics.bucketCount || 0,
        queueSize: metrics.queueSize || 0,
        globalRateLimits: metrics.globalRateLimits || 0,
        lastReset: metrics.lastReset || Date.now(),
      };
    } catch (error) {
      logger.error('Failed to get metrics from Redis', error as Error);
      return {
        totalRequests: 0,
        successfulRequests: 0,
        rateLimitedRequests: 0,
        failedRequests: 0,
        averageResponseTime: 0,
        bucketCount: 0,
        queueSize: 0,
        globalRateLimits: 0,
        lastReset: Date.now(),
      };
    }
  }
}