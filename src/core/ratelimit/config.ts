import { RateLimitConfig } from './types';

/**
 * Default rate limit configuration for Discord API
 */
export const DEFAULT_RATE_LIMIT_CONFIG: RateLimitConfig = {
  // Discord's standard rate limits
  defaultLimit: 5,           // 5 requests per bucket
  defaultResetAfter: 5000,   // 5 seconds reset time
  
  // Retry configuration
  maxRetries: 3,
  retryDelay: 1000,          // 1 second base delay
  
  // Queue configuration
  maxQueueSize: 1000,
  
  // Global rate limits (Discord's global limits)
  globalLimit: 50,           // 50 requests per second globally
  globalResetAfter: 1000,     // 1 second global reset
  
  // Maintenance
  bucketCleanupInterval: 60000,  // 1 minute cleanup interval
  requestTimeout: 30000,         // 30 second timeout
  
  // Features
  enablePriorityQueue: true,
  enableMetrics: true,
};

/**
 * Rate limit configuration for different Discord API endpoints
 */
export const ENDPOINT_RATE_LIMITS: Record<string, Partial<RateLimitConfig>> = {
  // Message endpoints
  'POST/channels/:channel_id/messages': {
    defaultLimit: 5,
    defaultResetAfter: 5000,
  },
  'DELETE/channels/:channel_id/messages/:message_id': {
    defaultLimit: 5,
    defaultResetAfter: 5000,
  },
  
  // Bot endpoints (higher priority)
  'POST/guilds/:guild_id/bans/:user_id': {
    defaultLimit: 5,
    defaultResetAfter: 1000,
  },
  'POST/channels/:channel_id/typing': {
    defaultLimit: 5,
    defaultResetAfter: 10000,
  },
  
  // Gateway endpoints
  'GET/gateway/bot': {
    defaultLimit: 1,
    defaultResetAfter: 1000,
  },
  
  // Interaction endpoints
  'POST/interactions/:interaction_id/:interaction_token/callback': {
    defaultLimit: 1,
    defaultResetAfter: 3000,
  },
  
  // Bulk operations
  'POST/channels/:channel_id/messages/bulk-delete': {
    defaultLimit: 1,
    defaultResetAfter: 5000,
  },
  
  // Audit log endpoints
  'GET/guilds/:guild_id/audit-logs': {
    defaultLimit: 10,
    defaultResetAfter: 10000,
  },
};

/**
 * Get rate limit configuration for a specific endpoint
 */
export function getRateLimitConfig(endpoint: string): RateLimitConfig {
  const endpointConfig = ENDPOINT_RATE_LIMITS[endpoint];
  return {
    ...DEFAULT_RATE_LIMIT_CONFIG,
    ...endpointConfig,
  };
}

/**
 * Extract bucket ID from Discord API response headers
 */
export function extractBucketId(headers: Record<string, string>): string | null {
  const bucketHeader = headers['x-ratelimit-bucket'];
  const globalHeader = headers['x-ratelimit-global'];
  
  if (globalHeader === 'true') {
    return 'global';
  }
  
  return bucketHeader || null;
}

/**
 * Extract rate limit info from Discord API response headers
 */
export function extractRateLimitInfo(headers: Record<string, string>) {
  return {
    limit: parseInt(headers['x-ratelimit-limit'] || '0'),
    remaining: parseInt(headers['x-ratelimit-remaining'] || '0'),
    resetAfter: parseInt(headers['x-ratelimit-reset-after'] || '0'),
    global: headers['x-ratelimit-global'] === 'true',
    bucket: extractBucketId(headers),
  };
}

/**
 * Calculate exponential backoff delay for retries
 */
export function calculateBackoffDelay(retryCount: number, baseDelay: number = 1000): number {
  return Math.min(baseDelay * Math.pow(2, retryCount), 30000); // Max 30 seconds
}

/**
 * Determine if an endpoint should use priority queue
 */
export function shouldUsePriorityQueue(endpoint: string): boolean {
  const priorityEndpoints = [
    'POST/interactions',
    'POST/channels/:channel_id/typing',
    'DELETE/channels/:channel_id/messages/:message_id',
  ];
  
  return priorityEndpoints.some(ep => endpoint.startsWith(ep));
}

/**
 * Get request priority based on endpoint and context
 */
export function getRequestPriority(endpoint: string, priority?: number): number {
  if (priority !== undefined) {
    return priority;
  }
  
  // Critical endpoints
  if (endpoint.includes('/interactions/') && endpoint.includes('/callback')) {
    return 0; // CRITICAL
  }
  
  // High priority endpoints
  if (endpoint.includes('/typing') || endpoint.startsWith('DELETE/')) {
    return 1; // HIGH
  }
  
  // Normal endpoints
  if (endpoint.startsWith('POST/') || endpoint.startsWith('PUT/')) {
    return 2; // NORMAL
  }
  
  // Low priority endpoints
  if (endpoint.startsWith('GET/') && endpoint.includes('/audit-logs')) {
    return 3; // LOW
  }
  
  // Bulk operations
  if (endpoint.includes('/bulk-')) {
    return 4; // BULK
  }
  
  return 2; // Default to NORMAL
}