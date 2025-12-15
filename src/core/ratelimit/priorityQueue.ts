import { QueuedRequest, RequestPriority } from './types';

/**
 * Priority queue for managing Discord API requests
 */
export class PriorityQueue {
  private queues: Map<RequestPriority, QueuedRequest[]>;
  private processing: boolean;
  private maxSize: number;
  private totalSize: number;

  constructor(maxSize: number = 1000) {
    this.queues = new Map();
    this.processing = false;
    this.maxSize = maxSize;
    this.totalSize = 0;
    
    // Initialize queues for each priority level
    Object.values(RequestPriority).forEach(priority => {
      if (typeof priority === 'number') {
        this.queues.set(priority, []);
      }
    });
  }

  /**
   * Add a request to the queue
   */
  enqueue(request: QueuedRequest): Promise<any> {
    return new Promise((resolve, reject) => {
      // Check if queue is full
      if (this.totalSize >= this.maxSize) {
        reject(new Error('Rate limit queue is full'));
        return;
      }

      // Attach resolve/reject to request
      request.resolve = resolve;
      request.reject = reject;

      const queue = this.queues.get(request.priority);
      if (queue) {
        queue.push(request);
        this.totalSize++;
        
        // Sort queue by timestamp to maintain FIFO within same priority
        queue.sort((a, b) => a.timestamp - b.timestamp);
      } else {
        reject(new Error(`Invalid priority level: ${request.priority}`));
      }
    });
  }

  /**
   * Get the next request to process
   */
  dequeue(): QueuedRequest | null {
    // Process queues in priority order (0 = highest priority)
    for (let priority = 0; priority <= 4; priority++) {
      const queue = this.queues.get(priority);
      if (queue && queue.length > 0) {
        const request = queue.shift();
        if (request) {
          this.totalSize--;
          return request;
        }
      }
    }
    
    return null;
  }

  /**
   * Peek at the next request without removing it
   */
  peek(): QueuedRequest | null {
    for (let priority = 0; priority <= 4; priority++) {
      const queue = this.queues.get(priority);
      if (queue && queue.length > 0) {
        return queue[0] || null;
      }
    }
    
    return null;
  }

  /**
   * Get the size of a specific priority queue
   */
  getQueueSize(priority: RequestPriority): number {
    const queue = this.queues.get(priority);
    return queue ? queue.length : 0;
  }

  /**
   * Get total queue size across all priorities
   */
  getTotalSize(): number {
    return this.totalSize;
  }

  /**
   * Get queue statistics
   */
  getStats(): Record<string, number> {
    const stats: Record<string, number> = {
      total: this.totalSize,
    };
    
    this.queues.forEach((queue, priority) => {
      stats[`priority_${priority}`] = queue.length;
    });
    
    return stats;
  }

  /**
   * Remove expired requests from the queue
   */
  removeExpired(timeoutMs: number = 30000): number {
    let removed = 0;
    const now = Date.now();
    
    this.queues.forEach(queue => {
      for (let i = queue.length - 1; i >= 0; i--) {
        const request = queue[i];
        if (request && now - request.timestamp > timeoutMs) {
          const expired = queue.splice(i, 1)[0];
          if (expired) {
            expired.reject(new Error('Request timed out in queue'));
            removed++;
            this.totalSize--;
          }
        }
      }
    });
    
    return removed;
  }

  /**
   * Clear all requests from the queue
   */
  clear(): void {
    this.queues.forEach(queue => {
      queue.forEach(request => {
        request.reject(new Error('Queue cleared'));
      });
      queue.length = 0;
    });
    this.totalSize = 0;
  }

  /**
   * Clear requests for a specific bucket
   */
  clearBucket(bucketId: string): number {
    let cleared = 0;
    
    this.queues.forEach(queue => {
      for (let i = queue.length - 1; i >= 0; i--) {
        const request = queue[i];
        if (request && request.bucketId === bucketId) {
          const removed = queue.splice(i, 1)[0];
          if (removed) {
            removed.reject(new Error(`Bucket ${bucketId} rate limited`));
            cleared++;
            this.totalSize--;
          }
        }
      }
    });
    
    return cleared;
  }

  /**
   * Get requests by bucket ID
   */
  getRequestsByBucket(bucketId: string): QueuedRequest[] {
    const requests: QueuedRequest[] = [];
    
    this.queues.forEach(queue => {
      queue.forEach(request => {
        if (request.bucketId === bucketId) {
          requests.push(request);
        }
      });
    });
    
    return requests;
  }

  /**
   * Promote requests to higher priority (emergency use)
   */
  promoteRequests(bucketId: string, newPriority: RequestPriority): number {
    let promoted = 0;
    const requestsToMove: QueuedRequest[] = [];
    
    // Find requests to promote
    this.queues.forEach((queue, priority) => {
      if (priority > newPriority) {
        for (let i = queue.length - 1; i >= 0; i--) {
          const request = queue[i];
          if (request && request.bucketId === bucketId) {
            const removed = queue.splice(i, 1)[0];
            if (removed) {
              requestsToMove.push(removed);
              this.totalSize--;
            }
          }
        }
      }
    });
    
    // Move to new priority queue
    const targetQueue = this.queues.get(newPriority);
    if (targetQueue) {
      requestsToMove.forEach(request => {
        request.priority = newPriority;
        targetQueue.push(request);
        this.totalSize++;
        promoted++;
      });
      
      // Sort by timestamp
      targetQueue.sort((a, b) => a.timestamp - b.timestamp);
    }
    
    return promoted;
  }

  /**
   * Check if queue is processing
   */
  isProcessing(): boolean {
    return this.processing;
  }

  /**
   * Set processing state
   */
  setProcessing(processing: boolean): void {
    this.processing = processing;
  }

  /**
   * Get next request wait time
   */
  getNextWaitTime(): number {
    const nextRequest = this.peek();
    if (!nextRequest) {
      return 0;
    }
    
    const now = Date.now();
    return Math.max(0, nextRequest.timestamp - now);
  }

  /**
   * Get estimated processing time for all requests
   */
  getEstimatedProcessingTime(): number {
    let totalTime = 0;
    let requestCount = 0;
    
    // Rough estimate: 100ms per request average
    this.queues.forEach(queue => {
      totalTime += queue.length * 100;
      requestCount += queue.length;
    });
    
    return totalTime;
  }
}