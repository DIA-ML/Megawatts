// Core type definitions for the self-editing Discord bot

export interface BotConfig {
  token: string;
  clientId: string;
  guildId: string;
  prefix: string;
  intents: string[];
  presence: {
    status: string;
    activities: Array<{
      name: string;
      type: string;
    }>;
  };
}

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl: boolean;
  pool: {
    min: number;
    max: number;
    idle: number;
  };
}

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db: number;
}

export interface AIConfig {
  openai?: {
    apiKey: string;
    model: string;
    maxTokens: number;
    temperature: number;
  };
  anthropic?: {
    apiKey: string;
    model: string;
    maxTokens: number;
  };
}

export interface StorageConfig {
  postgres: DatabaseConfig;
  redis: RedisConfig;
  vector?: {
    provider: 'pinecone' | 'weaviate' | 'qdrant';
    config: Record<string, any>;
  };
}

export interface LoggingConfig {
  level: 'error' | 'warn' | 'info' | 'debug';
  format: 'json' | 'text';
  transports: Array<{
    type: 'console' | 'file' | 'database';
    config: Record<string, any>;
  }>;
}

export interface SelfEditingConfig {
  enabled: boolean;
  interval: number; // minutes
  criteria: {
    performance: {
      enabled: boolean;
      thresholds: {
        responseTime: number;
        errorRate: number;
      };
    };
    userFeedback: {
      enabled: boolean;
      minInteractions: number;
      feedbackWeight: number;
    };
    codeQuality: {
      enabled: boolean;
      metrics: ['complexity', 'maintainability', 'testCoverage'];
    };
  };
  learning: {
    enabled: boolean;
    adaptationRate: number;
    maxChangesPerSession: number;
  };
}

export interface PluginConfig {
  name: string;
  enabled: boolean;
  config: Record<string, any>;
  dependencies?: string[];
}

export interface ToolConfig {
  name: string;
  enabled: boolean;
  permissions: string[];
  config: Record<string, any>;
}

export interface ConfigSchema {
  bot: BotConfig;
  storage: StorageConfig;
  ai: AIConfig;
  logging: LoggingConfig;
  selfEditing: SelfEditingConfig;
  plugins: PluginConfig[];
  tools: ToolConfig[];
  environment: 'development' | 'staging' | 'production';
}

// Event types
export interface DiscordEvent {
  type: string;
  data: any;
  timestamp: Date;
  guildId?: string;
  userId?: string;
  channelId?: string;
}

export interface SelfEditingMetrics {
  timestamp: Date;
  type: 'performance' | 'user_feedback' | 'code_quality' | 'adaptation';
  metrics: Record<string, number | string | boolean>;
  confidence: number;
  actionTaken?: {
    type: string;
    description: string;
    result: 'success' | 'failure' | 'partial';
  };
}

// Database types
export interface User {
  id: string;
  discordId: string;
  username: string;
  discriminator: string;
  avatar?: string;
  roles: string[];
  permissions: string[];
  createdAt: Date;
  updatedAt: Date;
  lastSeen?: Date;
}

export interface Guild {
  id: string;
  name: string;
  icon?: string;
  ownerId: string;
  memberCount: number;
  features: {
    textChannels: number;
    voiceChannels: number;
    roles: number;
    emojis: number;
  };
  settings: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

// AI Tool types
export interface AITool {
  name: string;
  description: string;
  parameters: Record<string, {
    type: 'string' | 'number' | 'boolean' | 'array' | 'object';
    required: boolean;
    description: string;
  }>;
  examples?: Array<{
    input: Record<string, any>;
    output: any;
    description: string;
  }>;
}

export interface ToolCall {
  id: string;
  tool: string;
  input: Record<string, any>;
  output: any;
  timestamp: Date;
  executionTime: number;
  success: boolean;
  error?: string;
}

// Plugin types
export interface Plugin {
  name: string;
  version: string;
  description: string;
  author: string;
  enabled: boolean;
  hooks: {
    onMessage?: string;
    onReaction?: string;
    onJoin?: string;
    onLeave?: string;
  };
  config: Record<string, any>;
}

// Error types
export interface BotError extends Error {
  code: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  context?: Record<string, any>;
  timestamp: Date;
}

export interface ConfigurationError extends BotError {
  field: string;
  expectedValue: any;
  actualValue: any;
}

export interface DatabaseError extends BotError {
  query?: string;
  parameters?: Record<string, any>;
}

export interface AIError extends BotError {
  provider: 'openai' | 'anthropic';
  model?: string;
  tokensUsed?: number;
}

export interface SelfEditingError extends BotError {
  metricType: string;
  threshold?: number;
  actualValue?: number;
  suggestedAction?: string;
}