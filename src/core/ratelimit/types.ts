/**
 * Rate limiting types for Discord API
 */

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  resetAfter: number;
  maxRetries: number;
  retryAfter: number;
  global: boolean;
  bucket?: string;
  messageId?: string;
  connectionId?: string;
}

export interface RateLimitBucket {
  id: string;
  limit: number;
  remaining: number;
  resetAt: number;
  resetAfter: number;
  maxRetries: number;
  lastUsed: number;
  requests: QueuedRequest[];
}

export interface QueuedRequest {
  id: string;
  url: string;
  method: string;
  priority: RequestPriority;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
  timeout?: number;
  body?: any;
  headers?: Record<string, string>;
  resolve: (value: any) => void;
  reject: (reason: any) => void;
  bucketId?: string;
  isGlobal?: boolean;
}

export enum RequestPriority {
  CRITICAL = 0,    // Bot lifecycle, emergency responses
  HIGH = 1,        // User interactions, commands
  NORMAL = 2,      // Regular API calls
  LOW = 3,         // Background tasks, analytics
  BULK = 4,        // Mass operations, non-urgent
}

export interface RateLimitConfig {
  defaultLimit: number;
  defaultResetAfter: number;
  maxRetries: number;
  retryDelay: number;
  maxQueueSize: number;
  globalLimit: number;
  globalResetAfter: number;
  bucketCleanupInterval: number;
  requestTimeout: number;
  enablePriorityQueue: boolean;
  enableMetrics: boolean;
}

export interface RateLimitMetrics {
  totalRequests: number;
  successfulRequests: number;
  rateLimitedRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  bucketCount: number;
  queueSize: number;
  globalRateLimits: number;
  lastReset: number;
}

export interface RateLimitStore {
  getBucket(bucketId: string): Promise<RateLimitBucket | null>;
  setBucket(bucketId: string, bucket: RateLimitBucket): Promise<void>;
  deleteBucket(bucketId: string): Promise<void>;
  getAllBuckets(): Promise<RateLimitBucket[]>;
  clearExpiredBuckets(): Promise<void>;
  getGlobalLimit(): Promise<RateLimitInfo | null>;
  setGlobalLimit(limit: RateLimitInfo): Promise<void>;
  incrementMetric(metric: keyof RateLimitMetrics): Promise<void>;
  getMetrics(): Promise<RateLimitMetrics>;
}

export interface RateLimitMiddleware {
  execute(request: QueuedRequest): Promise<any>;
  isRateLimited(bucketId: string): Promise<boolean>;
  getWaitTime(bucketId: string): Promise<number>;
  updateBucket(bucketId: string, info: RateLimitInfo): Promise<void>;
}

export interface RateLimitOrchestrator {
  enqueue(request: QueuedRequest): Promise<any>;
  processQueue(): Promise<void>;
  handleRateLimit(info: RateLimitInfo): Promise<void>;
  getMetrics(): Promise<RateLimitMetrics>;
  shutdown(): Promise<void>;
}