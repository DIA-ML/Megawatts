import { PriorityQueue } from '../priorityQueue';
import { QueuedRequest, RequestPriority } from '../types';

describe('PriorityQueue', () => {
  let queue: PriorityQueue;

  beforeEach(() => {
    queue = new PriorityQueue(10);
  });

  afterEach(() => {
    queue.clear();
  });

  describe('enqueue', () => {
    it('should add requests to the queue', async () => {
      const request: QueuedRequest = {
        id: '1',
        url: 'https://discord.com/api/v9/channels/123/messages',
        method: 'POST',
        priority: RequestPriority.NORMAL,
        timestamp: Date.now(),
        retryCount: 0,
        maxRetries: 3,
        resolve: jest.fn(),
        reject: jest.fn(),
      };

      const result = queue.enqueue(request);
      expect(result).toBeInstanceOf(Promise);
      expect(queue.getTotalSize()).toBe(1);
    });

    it('should reject when queue is full', async () => {
      const fullQueue = new PriorityQueue(1);
      const request: QueuedRequest = {
        id: '1',
        url: 'https://discord.com/api/v9/channels/123/messages',
        method: 'POST',
        priority: RequestPriority.NORMAL,
        timestamp: Date.now(),
        retryCount: 0,
        maxRetries: 3,
        resolve: jest.fn(),
        reject: jest.fn(),
      };

      await fullQueue.enqueue(request);
      
      const secondRequest: QueuedRequest = {
        id: '2',
        url: 'https://discord.com/api/v9/channels/123/messages',
        method: 'POST',
        priority: RequestPriority.NORMAL,
        timestamp: Date.now(),
        retryCount: 0,
        maxRetries: 3,
        resolve: jest.fn(),
        reject: jest.fn(),
      };

      await expect(fullQueue.enqueue(secondRequest)).rejects.toThrow('Rate limit queue is full');
    });
  });

  describe('dequeue', () => {
    it('should return highest priority request first', async () => {
      const criticalRequest: QueuedRequest = {
        id: 'critical',
        url: 'https://discord.com/api/v9/interactions/123/callback',
        method: 'POST',
        priority: RequestPriority.CRITICAL,
        timestamp: Date.now(),
        retryCount: 0,
        maxRetries: 3,
        resolve: jest.fn(),
        reject: jest.fn(),
      };

      const normalRequest: QueuedRequest = {
        id: 'normal',
        url: 'https://discord.com/api/v9/channels/123/messages',
        method: 'POST',
        priority: RequestPriority.NORMAL,
        timestamp: Date.now(),
        retryCount: 0,
        maxRetries: 3,
        resolve: jest.fn(),
        reject: jest.fn(),
      };

      await queue.enqueue(normalRequest);
      await queue.enqueue(criticalRequest);

      const dequeued = queue.dequeue();
      expect(dequeued?.id).toBe('critical');
      expect(queue.getTotalSize()).toBe(1);
    });

    it('should return null when queue is empty', () => {
      const dequeued = queue.dequeue();
      expect(dequeued).toBeNull();
    });
  });

  describe('peek', () => {
    it('should return next request without removing it', async () => {
      const request: QueuedRequest = {
        id: '1',
        url: 'https://discord.com/api/v9/channels/123/messages',
        method: 'POST',
        priority: RequestPriority.NORMAL,
        timestamp: Date.now(),
        retryCount: 0,
        maxRetries: 3,
        resolve: jest.fn(),
        reject: jest.fn(),
      };

      await queue.enqueue(request);

      const peeked = queue.peek();
      expect(peeked?.id).toBe('1');
      expect(queue.getTotalSize()).toBe(1);
    });

    it('should return null when queue is empty', () => {
      const peeked = queue.peek();
      expect(peeked).toBeNull();
    });
  });

  describe('removeExpired', () => {
    it('should remove expired requests', async () => {
      const expiredRequest: QueuedRequest = {
        id: 'expired',
        url: 'https://discord.com/api/v9/channels/123/messages',
        method: 'POST',
        priority: RequestPriority.NORMAL,
        timestamp: Date.now() - 40000, // 40 seconds ago
        retryCount: 0,
        maxRetries: 3,
        resolve: jest.fn(),
        reject: jest.fn(),
      };

      const validRequest: QueuedRequest = {
        id: 'valid',
        url: 'https://discord.com/api/v9/channels/123/messages',
        method: 'POST',
        priority: RequestPriority.NORMAL,
        timestamp: Date.now() - 10000, // 10 seconds ago
        retryCount: 0,
        maxRetries: 3,
        resolve: jest.fn(),
        reject: jest.fn(),
      };

      await queue.enqueue(expiredRequest);
      await queue.enqueue(validRequest);

      const removed = queue.removeExpired(30000); // 30 second timeout
      expect(removed).toBe(1);
      expect(queue.getTotalSize()).toBe(1);
      expect(expiredRequest.reject).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('clearBucket', () => {
    it('should remove all requests for a specific bucket', async () => {
      const bucket1Request: QueuedRequest = {
        id: 'bucket1',
        url: 'https://discord.com/api/v9/channels/123/messages',
        method: 'POST',
        priority: RequestPriority.NORMAL,
        timestamp: Date.now(),
        retryCount: 0,
        maxRetries: 3,
        bucketId: 'bucket1',
        resolve: jest.fn(),
        reject: jest.fn(),
      };

      const bucket2Request: QueuedRequest = {
        id: 'bucket2',
        url: 'https://discord.com/api/v9/channels/456/messages',
        method: 'POST',
        priority: RequestPriority.NORMAL,
        timestamp: Date.now(),
        retryCount: 0,
        maxRetries: 3,
        bucketId: 'bucket2',
        resolve: jest.fn(),
        reject: jest.fn(),
      };

      await queue.enqueue(bucket1Request);
      await queue.enqueue(bucket2Request);

      const cleared = queue.clearBucket('bucket1');
      expect(cleared).toBe(1);
      expect(queue.getTotalSize()).toBe(1);
      expect(bucket1Request.reject).toHaveBeenCalledWith(expect.any(Error));
      expect(bucket2Request.reject).not.toHaveBeenCalled();
    });
  });

  describe('getStats', () => {
    it('should return queue statistics', async () => {
      const criticalRequest: QueuedRequest = {
        id: 'critical',
        url: 'https://discord.com/api/v9/interactions/123/callback',
        method: 'POST',
        priority: RequestPriority.CRITICAL,
        timestamp: Date.now(),
        retryCount: 0,
        maxRetries: 3,
        resolve: jest.fn(),
        reject: jest.fn(),
      };

      const normalRequest: QueuedRequest = {
        id: 'normal',
        url: 'https://discord.com/api/v9/channels/123/messages',
        method: 'POST',
        priority: RequestPriority.NORMAL,
        timestamp: Date.now(),
        retryCount: 0,
        maxRetries: 3,
        resolve: jest.fn(),
        reject: jest.fn(),
      };

      await queue.enqueue(criticalRequest);
      await queue.enqueue(normalRequest);

      const stats = queue.getStats();
      expect(stats.total).toBe(2);
      expect(stats.priority_0).toBe(1); // CRITICAL
      expect(stats.priority_2).toBe(1); // NORMAL
      expect(stats.priority_1).toBe(0); // HIGH
      expect(stats.priority_3).toBe(0); // LOW
      expect(stats.priority_4).toBe(0); // BULK
    });
  });

  describe('promoteRequests', () => {
    it('should promote requests to higher priority', async () => {
      const lowPriorityRequest: QueuedRequest = {
        id: 'low',
        url: 'https://discord.com/api/v9/channels/123/messages',
        method: 'POST',
        priority: RequestPriority.LOW,
        timestamp: Date.now(),
        retryCount: 0,
        maxRetries: 3,
        bucketId: 'bucket1',
        resolve: jest.fn(),
        reject: jest.fn(),
      };

      await queue.enqueue(lowPriorityRequest);

      const promoted = queue.promoteRequests('bucket1', RequestPriority.HIGH);
      expect(promoted).toBe(1);
      expect(queue.getQueueSize(RequestPriority.LOW)).toBe(0);
      expect(queue.getQueueSize(RequestPriority.HIGH)).toBe(1);
    });
  });
});