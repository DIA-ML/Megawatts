import { BucketManager } from '../bucketManager';
import { MemoryRateLimitStore } from '../store';
import { RateLimitInfo, QueuedRequest } from '../types';

describe('BucketManager', () => {
  let bucketManager: BucketManager;
  let store: MemoryRateLimitStore;

  beforeEach(() => {
    store = new MemoryRateLimitStore();
    bucketManager = new BucketManager(store);
  });

  afterEach(async () => {
    await store.destroy();
  });

  describe('getBucket', () => {
    it('should create new bucket if not exists', async () => {
      const bucket = await bucketManager.getBucket('test-bucket', 5, 5000);
      
      expect(bucket.id).toBe('test-bucket');
      expect(bucket.limit).toBe(5);
      expect(bucket.remaining).toBe(5);
      expect(bucket.resetAt).toBeGreaterThan(Date.now());
    });

    it('should return existing bucket', async () => {
      // Create bucket first
      await bucketManager.getBucket('test-bucket', 5, 5000);
      
      // Get existing bucket
      const bucket = await bucketManager.getBucket('test-bucket');
      
      expect(bucket.id).toBe('test-bucket');
      expect(bucket.limit).toBe(5);
    });
  });

  describe('isRateLimited', () => {
    it('should return false for new bucket', async () => {
      const isLimited = await bucketManager.isRateLimited('test-bucket');
      expect(isLimited).toBe(false);
    });

    it('should return true for exhausted bucket', async () => {
      const bucket = await bucketManager.getBucket('test-bucket', 5, 5000);
      bucket.remaining = 0;
      await bucketManager.store.setBucket('test-bucket', bucket);
      
      const isLimited = await bucketManager.isRateLimited('test-bucket');
      expect(isLimited).toBe(true);
    });
  });

  describe('consumeRequest', () => {
    it('should consume request from bucket', async () => {
      const consumed = await bucketManager.consumeRequest('test-bucket');
      expect(consumed).toBe(true);
      
      const bucket = await bucketManager.getBucket('test-bucket');
      expect(bucket.remaining).toBe(4);
    });

    it('should return false when bucket is exhausted', async () => {
      const bucket = await bucketManager.getBucket('test-bucket', 5, 5000);
      bucket.remaining = 0;
      await bucketManager.store.setBucket('test-bucket', bucket);
      
      const consumed = await bucketManager.consumeRequest('test-bucket');
      expect(consumed).toBe(false);
    });
  });

  describe('updateBucket', () => {
    it('should update bucket with rate limit info', async () => {
      const rateLimitInfo: RateLimitInfo = {
        limit: 10,
        remaining: 8,
        resetAfter: 10000,
        maxRetries: 3,
        retryAfter: 1000,
        global: false,
        bucket: 'test-bucket',
      };
      
      await bucketManager.updateBucket('test-bucket', rateLimitInfo);
      
      const bucket = await bucketManager.getBucket('test-bucket');
      expect(bucket.limit).toBe(10);
      expect(bucket.remaining).toBe(8);
      expect(bucket.resetAfter).toBe(10000);
    });
  });

  describe('handleRateLimit', () => {
    it('should handle global rate limit', async () => {
      const rateLimitInfo: RateLimitInfo = {
        limit: 50,
        remaining: 0,
        resetAfter: 1000,
        maxRetries: 3,
        retryAfter: 1000,
        global: true,
      };
      
      await bucketManager.handleRateLimit('global', rateLimitInfo);
      
      const globalLimit = await store.getGlobalLimit();
      expect(globalLimit).toBeTruthy();
      expect(globalLimit?.global).toBe(true);
    });

    it('should handle bucket rate limit', async () => {
      const rateLimitInfo: RateLimitInfo = {
        limit: 5,
        remaining: 0,
        resetAfter: 5000,
        maxRetries: 3,
        retryAfter: 1000,
        global: false,
        bucket: 'test-bucket',
      };
      
      await bucketManager.handleRateLimit('test-bucket', rateLimitInfo);
      
      const bucket = await bucketManager.getBucket('test-bucket');
      expect(bucket.remaining).toBe(0);
      expect(bucket.limit).toBe(5);
    });
  });

  describe('queueRequest', () => {
    it('should add request to bucket queue', async () => {
      const request: QueuedRequest = {
        id: 'test-request',
        url: 'https://discord.com/api/v9/channels/123/messages',
        method: 'POST',
        priority: 0,
        timestamp: Date.now(),
        retryCount: 0,
        maxRetries: 3,
        resolve: () => {},
        reject: () => {},
      };
      
      await bucketManager.queueRequest('test-bucket', request);
      
      const bucket = await bucketManager.getBucket('test-bucket');
      expect(bucket.requests).toHaveLength(1);
      expect(bucket.requests[0].id).toBe('test-request');
    });
  });

  describe('resetBucket', () => {
    it('should reset bucket to initial state', async () => {
      // Create and consume some requests
      await bucketManager.consumeRequest('test-bucket');
      await bucketManager.consumeRequest('test-bucket');
      
      // Reset bucket
      await bucketManager.resetBucket('test-bucket');
      
      const bucket = await bucketManager.getBucket('test-bucket');
      expect(bucket.remaining).toBe(5); // Back to initial limit
      expect(bucket.requests).toHaveLength(0);
    });
  });

  describe('deleteBucket', () => {
    it('should delete bucket and reject queued requests', async () => {
      const request: QueuedRequest = {
        id: 'test-request',
        url: 'https://discord.com/api/v9/channels/123/messages',
        method: 'POST',
        priority: 0,
        timestamp: Date.now(),
        retryCount: 0,
        maxRetries: 3,
        resolve: jest.fn(),
        reject: jest.fn(),
      };
      
      await bucketManager.queueRequest('test-bucket', request);
      await bucketManager.deleteBucket('test-bucket');
      
      const bucket = await bucketManager.getBucket('test-bucket');
      expect(bucket).toBeNull();
      expect(request.reject).toHaveBeenCalledWith(expect.any(Error));
    });
  });
});