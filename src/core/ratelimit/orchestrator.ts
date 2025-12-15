import { RateLimitOrchestrator, QueuedRequest, RateLimitInfo, RateLimitMetrics } from './types';
import { BucketManager } from './bucketManager';
import { DiscordRateLimitMiddleware } from './middleware';
import { MemoryRateLimitStore } from './store';
import { Logger } from '../../utils/logger';
import { DEFAULT_RATE_LIMIT_CONFIG, getRateLimitConfig } from './config';

const logger = new Logger('RateLimitOrchestrator');

/**
 * Main rate limit orchestrator that coordinates all rate limiting components
 */
export class DiscordRateLimitOrchestrator implements RateLimitOrchestrator {
  private middleware: DiscordRateLimitMiddleware;
  private bucketManager: BucketManager;
  private store: MemoryRateLimitStore;
  private isShutdown: boolean = false;
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    private httpClient: (request: QueuedRequest) => Promise<any>,
    private config: any = {}
  ) {
    // Initialize store
    this.store = new MemoryRateLimitStore(
      config.cleanupInterval || DEFAULT_RATE_LIMIT_CONFIG.bucketCleanupInterval
    );
    
    // Initialize bucket manager
    this.bucketManager = new BucketManager(this.store);
    
    // Initialize middleware
    this.middleware = new DiscordRateLimitMiddleware(
      this.bucketManager,
      config,
      this.wrapHttpClient(httpClient)
    );
    
    // Start cleanup interval
    this.startCleanupInterval();
    
    logger.info('Rate limit orchestrator initialized', {
      config: DEFAULT_RATE_LIMIT_CONFIG,
    });
  }

  /**
   * Enqueue a request for rate-limited execution
   */
  async enqueue(request: QueuedRequest): Promise<any> {
    if (this.isShutdown) {
      throw new Error('Rate limit orchestrator is shutdown');
    }
    
    // Set default values if not provided
    if (!request.priority) {
      request.priority = this.getPriorityFromEndpoint(request.url);
    }
    
    if (!request.maxRetries) {
      request.maxRetries = this.config.maxRetries || DEFAULT_RATE_LIMIT_CONFIG.maxRetries;
    }
    
    if (!request.timeout) {
      request.timeout = this.config.requestTimeout || DEFAULT_RATE_LIMIT_CONFIG.requestTimeout;
    }
    
    logger.debug('Enqueuing request', {
      url: request.url,
      method: request.method,
      priority: request.priority,
      bucketId: request.bucketId,
    });
    
    return this.middleware.execute(request);
  }

  /**
   * Process the request queue (handled by middleware)
   */
  async processQueue(): Promise<void> {
    // Queue processing is handled by the middleware
    // This method is kept for interface compatibility
    logger.debug('Queue processing delegated to middleware');
  }

  /**
   * Handle a rate limit response
   */
  async handleRateLimit(info: RateLimitInfo): Promise<void> {
    if (this.isShutdown) {
      return;
    }
    
    logger.warn('Handling rate limit', {
      bucket: info.bucket,
      global: info.global,
      retryAfter: info.retryAfter,
      remaining: info.remaining,
    });
    
    if (info.global) {
      await this.store.setGlobalLimit(info);
    } else if (info.bucket) {
      await this.bucketManager.handleRateLimit(info.bucket, info);
    }
  }

  /**
   * Get rate limit metrics
   */
  async getMetrics(): Promise<RateLimitMetrics> {
    const metrics = await this.store.getMetrics();
    const queueStats = this.middleware.getQueueStats();
    const bucketStats = await this.bucketManager.getAllBucketStats();
    
    return {
      ...metrics,
      queueSize: queueStats.total,
      bucketCount: bucketStats.totalBuckets,
    };
  }

  /**
   * Get detailed statistics
   */
  async getDetailedStats(): Promise<Record<string, any>> {
    const metrics = await this.getMetrics();
    const queueStats = this.middleware.getQueueStats();
    const bucketStats = await this.bucketManager.getAllBucketStats();
    
    return {
      metrics,
      queue: queueStats,
      buckets: bucketStats,
      config: DEFAULT_RATE_LIMIT_CONFIG,
      uptime: Date.now(), // Use current time as uptime fallback
      isShutdown: this.isShutdown,
    };
  }

  /**
   * Get bucket-specific statistics
   */
  async getBucketStats(bucketId: string): Promise<Record<string, any> | null> {
    return this.bucketManager.getBucketStats(bucketId);
  }

  /**
   * Check if a specific endpoint is rate limited
   */
  async isRateLimited(bucketId: string): Promise<boolean> {
    return this.middleware.isRateLimited(bucketId);
  }

  /**
   * Get wait time for a specific bucket
   */
  async getWaitTime(bucketId: string): Promise<number> {
    return this.middleware.getWaitTime(bucketId);
  }

  /**
   * Reset a specific bucket
   */
  async resetBucket(bucketId: string): Promise<void> {
    await this.bucketManager.resetBucket(bucketId);
    logger.info(`Reset rate limit bucket: ${bucketId}`);
  }

  /**
   * Clear all rate limit data
   */
  async clearAll(): Promise<void> {
    // Clear queue
    this.middleware.clearQueue();
    
    // Clear all buckets
    const buckets = await this.store.getAllBuckets();
    for (const bucket of buckets) {
      await this.bucketManager.deleteBucket(bucket.id);
    }
    
    // Reset metrics
    this.store.resetMetrics();
    
    logger.info('Cleared all rate limit data');
  }

  /**
   * Export current state for persistence
   */
  async exportState(): Promise<Record<string, any>> {
    const state = this.store.exportState();
    const detailedStats = await this.getDetailedStats();
    
    return {
      ...state,
      stats: detailedStats,
      exportedAt: Date.now(),
    };
  }

  /**
   * Import state from persistence
   */
  async importState(state: Record<string, any>): Promise<void> {
    if (this.isShutdown) {
      throw new Error('Cannot import state while orchestrator is shutdown');
    }
    
    this.store.importState({
      buckets: state.buckets || {},
      globalLimit: state.globalLimit || null,
      metrics: state.metrics || {
        totalRequests: 0,
        successfulRequests: 0,
        rateLimitedRequests: 0,
        failedRequests: 0,
        averageResponseTime: 0,
        bucketCount: 0,
        queueSize: 0,
        globalRateLimits: 0,
        lastReset: Date.now(),
      },
    });
    
    logger.info('Imported rate limit state', {
      bucketCount: Object.keys(state.buckets || {}).length,
      exportedAt: state.exportedAt,
    });
  }

  /**
   * Gracefully shutdown the orchestrator
   */
  async shutdown(): Promise<void> {
    if (this.isShutdown) {
      return;
    }
    
    logger.info('Shutting down rate limit orchestrator');
    
    this.isShutdown = true;
    
    // Stop cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    // Stop middleware
    this.middleware.stop();
    
    // Reject all queued requests
    this.middleware.clearQueue();
    
    // Cleanup store
    this.store.destroy();
    
    logger.info('Rate limit orchestrator shutdown complete');
  }

  /**
   * Get priority from endpoint
   */
  private getPriorityFromEndpoint(url: string): number {
    const endpointConfig = getRateLimitConfig(url);
    
    // Critical endpoints
    if (url.includes('/interactions/') && url.includes('/callback')) {
      return 0; // CRITICAL
    }
    
    // High priority endpoints
    if (url.includes('/typing') || url.startsWith('DELETE/')) {
      return 1; // HIGH
    }
    
    // Normal endpoints
    if (url.startsWith('POST/') || url.startsWith('PUT/')) {
      return 2; // NORMAL
    }
    
    // Low priority endpoints
    if (url.startsWith('GET/') && url.includes('/audit-logs')) {
      return 3; // LOW
    }
    
    // Bulk operations
    if (url.includes('/bulk-')) {
      return 4; // BULK
    }
    
    return endpointConfig.defaultLimit > 5 ? 1 : 2; // Default based on limit
  }

  /**
   * Wrap HTTP client to add rate limit handling
   */
  private wrapHttpClient(client: (request: QueuedRequest) => Promise<any>) {
    return async (request: QueuedRequest): Promise<any> => {
      try {
        const response = await client(request);
        
        // Extract rate limit headers and update bucket
        if (response && response.headers) {
          const rateLimitInfo = this.extractRateLimitFromHeaders(response.headers);
          if (rateLimitInfo.bucket || rateLimitInfo.global) {
            await this.handleRateLimit(rateLimitInfo);
          }
        }
        
        return response;
      } catch (error) {
        // Handle rate limit errors
        if ((error as any).response?.status === 429) {
          const rateLimitInfo = this.extractRateLimitFromHeaders((error as any).response.headers);
          await this.handleRateLimit(rateLimitInfo);
        }
        
        throw error;
      }
    };
  }

  /**
   * Extract rate limit info from HTTP headers
   */
  private extractRateLimitFromHeaders(headers: Record<string, string>): RateLimitInfo {
    return {
      limit: parseInt(headers['x-ratelimit-limit'] || '0'),
      remaining: parseInt(headers['x-ratelimit-remaining'] || '0'),
      resetAfter: parseInt(headers['x-ratelimit-reset-after'] || '0'),
      maxRetries: 3,
      retryAfter: parseInt(headers['retry-after'] || '0'),
      global: headers['x-ratelimit-global'] === 'true',
      bucket: headers['x-ratelimit-bucket'] || '',
    };
  }

  /**
   * Start cleanup interval
   */
  private startCleanupInterval(): void {
    const interval = this.config.cleanupInterval || DEFAULT_RATE_LIMIT_CONFIG.bucketCleanupInterval;
    
    this.cleanupInterval = setInterval(async () => {
      if (!this.isShutdown) {
        try {
          await this.bucketManager.cleanup();
          logger.debug('Rate limit cleanup completed');
        } catch (error) {
          logger.error('Rate limit cleanup failed', error as Error);
        }
      }
    }, interval);
  }

  /**
   * Health check for the orchestrator
   */
  async healthCheck(): Promise<Record<string, any>> {
    const metrics = await this.getMetrics();
    const now = Date.now();
    
    return {
      healthy: !this.isShutdown,
      uptime: Date.now(),
      metrics,
      lastCleanup: now - (this.config.lastCleanup || 0),
      queueProcessing: this.middleware.getQueueStats().processing,
      memoryUsage: { rss: 0, heapUsed: 0 }, // Fallback memory usage
    };
  }
}