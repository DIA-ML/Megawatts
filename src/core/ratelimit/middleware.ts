import { RateLimitMiddleware, QueuedRequest, RateLimitInfo } from './types';
import { BucketManager } from './bucketManager';
import { PriorityQueue } from './priorityQueue';
import { Logger } from '../../utils/logger';
import { extractBucketId, extractRateLimitInfo, getRateLimitConfig } from './config';

const logger = new Logger('RateLimitMiddleware');

/**
 * HTTP response interface for rate limit extraction
 */
export interface HttpResponse {
  status: number;
  headers: Record<string, string>;
  data?: any;
}

/**
 * Rate limit middleware for Discord API calls
 */
export class DiscordRateLimitMiddleware implements RateLimitMiddleware {
  private queue: PriorityQueue;
  private processing: boolean = false;
  private requestTimeout: number;

  constructor(
    private bucketManager: BucketManager,
    private config: any = {},
    private httpClient: (request: QueuedRequest) => Promise<HttpResponse>
  ) {
    const rateLimitConfig = getRateLimitConfig('');
    this.queue = new PriorityQueue(rateLimitConfig.maxQueueSize);
    this.requestTimeout = rateLimitConfig.requestTimeout;
    
    // Start processing queue
    this.startQueueProcessor();
  }

  /**
   * Execute a request with rate limiting
   */
  async execute(request: QueuedRequest): Promise<any> {
    const startTime = Date.now();
    
    try {
      // Extract bucket ID from request URL
      const bucketId = await this.extractBucketIdFromRequest(request);
      request.bucketId = bucketId;
      
      // Check if we're rate limited
      const isLimited = await this.isRateLimited(bucketId);
      if (isLimited) {
        // Queue the request
        return this.queue.enqueue(request);
      }
      
      // Try to consume a request from the bucket
      const consumed = await this.bucketManager.consumeRequest(bucketId);
      if (!consumed) {
        // Queue the request if bucket is exhausted
        return this.queue.enqueue(request);
      }
      
      // Execute the request immediately
      return this.executeRequest(request);
      
    } catch (error) {
      logger.error('Request execution failed', error as Error, {
        url: request.url,
        method: request.method,
        bucketId: request.bucketId,
      });
      throw error;
    } finally {
      const responseTime = Date.now() - startTime;
      await this.bucketManager.store.incrementMetric('totalRequests');
      // Note: updateAverageResponseTime method doesn't exist, skipping for now
    }
  }

  /**
   * Check if a bucket is rate limited
   */
  async isRateLimited(bucketId: string): Promise<boolean> {
    // Check global rate limit first
    const globalLimit = await this.bucketManager.store.getGlobalLimit();
    if (globalLimit) {
      const now = Date.now();
      if (now < globalLimit.resetAfter) {
        return true;
      }
    }
    
    // Check bucket-specific rate limit
    return this.bucketManager.isRateLimited(bucketId);
  }

  /**
   * Get wait time for a bucket
   */
  async getWaitTime(bucketId: string): Promise<number> {
    // Check global wait time first
    const globalLimit = await this.bucketManager.store.getGlobalLimit();
    if (globalLimit) {
      const now = Date.now();
      if (now < globalLimit.resetAfter) {
        return globalLimit.resetAfter - now;
      }
    }
    
    // Check bucket-specific wait time
    return this.bucketManager.getWaitTime(bucketId);
  }

  /**
   * Update bucket with rate limit info
   */
  async updateBucket(bucketId: string, info: RateLimitInfo): Promise<void> {
    await this.bucketManager.handleRateLimit(bucketId, info);
  }

  /**
   * Execute a single request
   */
  private async executeRequest(request: QueuedRequest): Promise<any> {
    const startTime = Date.now();
    
    try {
      // Add timeout to request
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Request timeout after ${this.requestTimeout}ms`));
        }, this.requestTimeout);
      });
      
      // Execute request with timeout
      const response = await Promise.race([
        this.httpClient(request),
        timeoutPromise,
      ]) as HttpResponse;
      
      // Extract rate limit info from response
      const rateLimitInfo = extractRateLimitInfo(response.headers);
      
      // Update bucket with rate limit info
      if (rateLimitInfo.bucket) {
        const bucketInfo: RateLimitInfo = {
          ...rateLimitInfo,
          resetAfter: rateLimitInfo.resetAfter,
          maxRetries: 3,
          retryAfter: rateLimitInfo.resetAfter,
          bucket: rateLimitInfo.bucket,
        };
        await this.updateBucket(rateLimitInfo.bucket!, bucketInfo);
      }
      
      // Handle rate limit response
      if (response.status === 429) {
        await this.handleRateLimitResponse(request, response);
        return this.retryRequest(request);
      }
      
      // Handle successful response
      if (response.status >= 200 && response.status < 300) {
        await this.bucketManager.store.incrementMetric('successfulRequests');
        return response.data;
      }
      
      // Handle error response
      await this.bucketManager.store.incrementMetric('failedRequests');
      throw new Error(`HTTP ${response.status}: ${response.data?.message || 'Unknown error'}`);
      
    } catch (error) {
      await this.bucketManager.store.incrementMetric('failedRequests');
      
      // Retry on network errors
      if (this.shouldRetry(error, request)) {
        return this.retryRequest(request);
      }
      
      throw error;
    }
  }

  /**
   * Handle rate limit response
   */
  private async handleRateLimitResponse(request: QueuedRequest, response: HttpResponse): Promise<void> {
    const rateLimitInfo = extractRateLimitInfo(response.headers);
    const retryAfter = response.data?.retry_after || rateLimitInfo.resetAfter;
    
    await this.bucketManager.store.incrementMetric('rateLimitedRequests');
    
    logger.warn('Rate limit hit', {
      url: request.url,
      method: request.method,
      bucketId: request.bucketId,
      retryAfter,
      global: rateLimitInfo.global,
    });
    
    // Update bucket with rate limit info
    if (request.bucketId) {
      const bucketInfo: RateLimitInfo = {
        ...rateLimitInfo,
        retryAfter,
        resetAfter: retryAfter,
        maxRetries: 3,
        bucket: request.bucketId,
      };
      await this.updateBucket(request.bucketId!, bucketInfo);
    }
  }

  /**
   * Retry a request
   */
  private async retryRequest(request: QueuedRequest): Promise<any> {
    request.retryCount++;
    
    if (request.retryCount > request.maxRetries) {
      throw new Error(`Request failed after ${request.maxRetries} retries`);
    }
    
    // Calculate delay
    const delay = this.bucketManager.calculateRetryDelay(request);
    
    // Wait before retrying
    await new Promise(resolve => setTimeout(resolve, delay));
    
    // Re-queue the request
    return this.queue.enqueue(request);
  }

  /**
   * Determine if a request should be retried
   */
  private shouldRetry(error: any, request: QueuedRequest): boolean {
    // Don't retry if max retries exceeded
    if (request.retryCount >= request.maxRetries) {
      return false;
    }
    
    // Retry on network errors
    if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
      return true;
    }
    
    // Retry on timeout
    if (error.message.includes('timeout')) {
      return true;
    }
    
    // Retry on 5xx server errors
    if (error.message.includes('HTTP 5')) {
      return true;
    }
    
    // Retry on rate limit
    if (error.message.includes('HTTP 429')) {
      return true;
    }
    
    return false;
  }

  /**
   * Extract bucket ID from request
   */
  private async extractBucketIdFromRequest(request: QueuedRequest): Promise<string> {
    // Use existing bucket ID if available
    if (request.bucketId) {
      return request.bucketId;
    }
    
    // Extract bucket ID from URL pattern
    // This is a simplified implementation - in practice, you'd want
    // more sophisticated bucket ID extraction based on Discord's API patterns
    const urlPattern = this.extractUrlPattern(request.url);
    return `bucket:${urlPattern}:${request.method}`;
  }

  /**
   * Extract URL pattern for bucket identification
   */
  private extractUrlPattern(url: string): string {
    // Discord API endpoint patterns
    const patterns = [
      /\/channels\/\d+\/messages/,
      /\/guilds\/\d+\/members/,
      /\/guilds\/\d+\/bans/,
      /\/users\/\d+/,
      /\/webhooks\/\d+/,
      /\/interactions/,
    ];
    
    for (const pattern of patterns) {
      if (pattern.test(url)) {
        return pattern.source.replace(/\\\//g, '/').replace(/\\\d+/g, '{id}');
      }
    }
    
    // Default pattern - use path segments
    const urlObj = new URL(url);
    return urlObj.pathname;
  }

  /**
   * Start the queue processor
   */
  private startQueueProcessor(): void {
    if (this.processing) {
      return;
    }
    
    this.processing = true;
    this.processQueue();
  }

  /**
   * Process the request queue
   */
  private async processQueue(): Promise<void> {
    while (this.processing) {
      try {
        const request = this.queue.dequeue();
        
        if (!request) {
          // No requests in queue, wait a bit
          await new Promise(resolve => setTimeout(resolve, 100));
          continue;
        }
        
        // Check if request can be executed
        const canExecute = await this.canExecuteRequest(request);
        
        if (!canExecute) {
          // Re-queue the request and wait
          this.queue.enqueue(request);
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }
        
        // Execute the request
        this.executeRequest(request)
          .then(result => {
            request.resolve(result);
          })
          .catch(error => {
            request.reject(error);
          });
          
      } catch (error) {
        logger.error('Queue processor error', error as Error);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  /**
   * Check if a request can be executed
   */
  private async canExecuteRequest(request: QueuedRequest): Promise<boolean> {
    if (!request.bucketId) {
      return true;
    }
    
    const isLimited = await this.isRateLimited(request.bucketId);
    return !isLimited;
  }

  /**
   * Stop the queue processor
   */
  stop(): void {
    this.processing = false;
  }

  /**
   * Get queue statistics
   */
  getQueueStats(): Record<string, any> {
    return {
      ...this.queue.getStats(),
      processing: this.processing,
      requestTimeout: this.requestTimeout,
    };
  }

  /**
   * Clear the queue
   */
  clearQueue(): void {
    this.queue.clear();
  }
}