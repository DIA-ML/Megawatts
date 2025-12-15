import { ConnectionConfig, DEFAULT_CONNECTION_CONFIG } from './types';
import { Logger } from '../../utils/logger';

/**
 * Connection configuration manager
 */
export class ConnectionConfigManager {
  private config: ConnectionConfig;
  private logger: Logger;

  constructor(config: Partial<ConnectionConfig>, logger: Logger) {
    this.logger = new Logger('ConnectionConfigManager');
    this.config = this.mergeWithDefaults(config);
    this.validateConfig();
  }

  /**
   * Merge user config with defaults
   */
  private mergeWithDefaults(userConfig: Partial<ConnectionConfig>): ConnectionConfig {
    const merged = { ...DEFAULT_CONNECTION_CONFIG, ...userConfig };
    
    // Deep merge nested objects
    if (userConfig.healthCheck) {
      merged.healthCheck = { ...DEFAULT_CONNECTION_CONFIG.healthCheck, ...userConfig.healthCheck };
    }
    
    if (userConfig.circuitBreaker) {
      merged.circuitBreaker = { ...DEFAULT_CONNECTION_CONFIG.circuitBreaker, ...userConfig.circuitBreaker };
    }
    
    if (userConfig.degradation) {
      merged.degradation = { ...DEFAULT_CONNECTION_CONFIG.degradation, ...userConfig.degradation };
      
      if (userConfig.degradation.actions) {
        merged.degradation.actions = {
          ...DEFAULT_CONNECTION_CONFIG.degradation.actions,
          ...userConfig.degradation.actions
        };
      }
    }
    
    return merged;
  }

  /**
   * Validate configuration
   */
  private validateConfig(): void {
    const errors: string[] = [];

    // Validate required fields
    if (!this.config.token) {
      errors.push('Token is required');
    }

    if (!this.config.intents || this.config.intents.length === 0) {
      errors.push('At least one intent is required');
    }

    // Validate numeric values
    if (this.config.maxReconnectAttempts < 1) {
      errors.push('maxReconnectAttempts must be at least 1');
    }

    if (this.config.reconnectDelay < 1000) {
      errors.push('reconnectDelay must be at least 1000ms');
    }

    if (this.config.reconnectBackoffMultiplier < 1) {
      errors.push('reconnectBackoffMultiplier must be at least 1');
    }

    if (this.config.connectionTimeout < 5000) {
      errors.push('connectionTimeout must be at least 5000ms');
    }

    // Validate health check config
    if (this.config.healthCheck.enabled) {
      if (this.config.healthCheck.interval < 10000) {
        errors.push('healthCheck.interval must be at least 10000ms');
      }

      if (this.config.healthCheck.timeout < 5000) {
        errors.push('healthCheck.timeout must be at least 5000ms');
      }

      if (this.config.healthCheck.retries < 1) {
        errors.push('healthCheck.retries must be at least 1');
      }
    }

    // Validate circuit breaker config
    if (this.config.circuitBreaker.enabled) {
      if (this.config.circuitBreaker.failureThreshold < 1) {
        errors.push('circuitBreaker.failureThreshold must be at least 1');
      }

      if (this.config.circuitBreaker.recoveryThreshold < 1) {
        errors.push('circuitBreaker.recoveryThreshold must be at least 1');
      }

      if (this.config.circuitBreaker.timeout < 10000) {
        errors.push('circuitBreaker.timeout must be at least 10000ms');
      }

      if (this.config.circuitBreaker.halfOpenMaxCalls < 1) {
        errors.push('circuitBreaker.halfOpenMaxCalls must be at least 1');
      }
    }

    // Validate degradation config
    if (this.config.degradation.enabled) {
      if (this.config.degradation.thresholds.latency < 100) {
        errors.push('degradation.thresholds.latency must be at least 100ms');
      }

      if (this.config.degradation.thresholds.errorRate < 0.01) {
        errors.push('degradation.thresholds.errorRate must be at least 0.01');
      }

      if (this.config.degradation.thresholds.consecutiveErrors < 1) {
        errors.push('degradation.thresholds.consecutiveErrors must be at least 1');
      }

      if (this.config.degradation.recoveryThreshold < 0.01) {
        errors.push('degradation.recoveryThreshold must be at least 0.01');
      }

      if (this.config.degradation.recoveryDelay < 5000) {
        errors.push('degradation.recoveryDelay must be at least 5000ms');
      }
    }

    if (errors.length > 0) {
      throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
    }

    this.logger.debug('Configuration validation passed');
  }

  /**
   * Get configuration
   */
  public getConfig(): ConnectionConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  public updateConfig(updates: Partial<ConnectionConfig>): void {
    const oldConfig = { ...this.config };
    this.config = this.mergeWithDefaults(updates);
    
    try {
      this.validateConfig();
      this.logger.info('Configuration updated successfully', {
        updates: Object.keys(updates),
        oldConfig,
        newConfig: this.config
      });
    } catch (error) {
      // Revert to old config on validation failure
      this.config = oldConfig;
      this.logger.error('Configuration update failed, reverting:', error as Error);
      throw error;
    }
  }

  /**
   * Get health check configuration
   */
  public getHealthCheckConfig() {
    return { ...this.config.healthCheck };
  }

  /**
   * Update health check configuration
   */
  public updateHealthCheckConfig(updates: Partial<typeof this.config.healthCheck>): void {
    this.updateConfig({
      healthCheck: { ...this.config.healthCheck, ...updates }
    });
  }

  /**
   * Get circuit breaker configuration
   */
  public getCircuitBreakerConfig() {
    return { ...this.config.circuitBreaker };
  }

  /**
   * Update circuit breaker configuration
   */
  public updateCircuitBreakerConfig(updates: Partial<typeof this.config.circuitBreaker>): void {
    this.updateConfig({
      circuitBreaker: { ...this.config.circuitBreaker, ...updates }
    });
  }

  /**
   * Get degradation configuration
   */
  public getDegradationConfig() {
    return { ...this.config.degradation };
  }

  /**
   * Update degradation configuration
   */
  public updateDegradationConfig(updates: Partial<typeof this.config.degradation>): void {
    this.updateConfig({
      degradation: { ...this.config.degradation, ...updates }
    });
  }

  /**
   * Get token (masked for logging)
   */
  public getMaskedToken(): string {
    if (!this.config.token) {
      return 'not set';
    }

    if (this.config.token.length <= 8) {
      return '*'.repeat(this.config.token.length);
    }

    return this.config.token.substring(0, 4) + '*'.repeat(this.config.token.length - 4);
  }

  /**
   * Set token
   */
  public setToken(token: string): void {
    this.updateConfig({ token });
  }

  /**
   * Get intents
   */
  public getIntents(): string[] {
    return [...this.config.intents];
  }

  /**
   * Set intents
   */
  public setIntents(intents: string[]): void {
    this.updateConfig({ intents });
  }

  /**
   * Enable/disable auto reconnect
   */
  public setAutoReconnect(enabled: boolean): void {
    this.updateConfig({ autoReconnect: enabled });
  }

  /**
   * Get auto reconnect status
   */
  public getAutoReconnect(): boolean {
    return this.config.autoReconnect;
  }

  /**
   * Enable/disable metrics
   */
  public setMetricsEnabled(enabled: boolean): void {
    this.updateConfig({ metricsEnabled: enabled });
  }

  /**
   * Get metrics enabled status
   */
  public getMetricsEnabled(): boolean {
    return this.config.metricsEnabled;
  }

  /**
   * Enable/disable events
   */
  public setEventsEnabled(enabled: boolean): void {
    this.updateConfig({ eventsEnabled: enabled });
  }

  /**
   * Get events enabled status
   */
  public getEventsEnabled(): boolean {
    return this.config.eventsEnabled;
  }

  /**
   * Get configuration summary
   */
  public getConfigSummary(): {
    token: string;
    intents: number;
    autoReconnect: boolean;
    healthCheckEnabled: boolean;
    circuitBreakerEnabled: boolean;
    degradationEnabled: boolean;
    metricsEnabled: boolean;
    eventsEnabled: boolean;
  } {
    return {
      token: this.getMaskedToken(),
      intents: this.config.intents.length,
      autoReconnect: this.config.autoReconnect,
      healthCheckEnabled: this.config.healthCheck.enabled,
      circuitBreakerEnabled: this.config.circuitBreaker.enabled,
      degradationEnabled: this.config.degradation.enabled,
      metricsEnabled: this.config.metricsEnabled,
      eventsEnabled: this.config.eventsEnabled
    };
  }

  /**
   * Export configuration to JSON
   */
  public exportConfig(): string {
    const exportData = {
      ...this.config,
      token: this.getMaskedToken(),
      exportedAt: new Date().toISOString(),
      version: '1.0.0'
    };

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Import configuration from JSON
   */
  public importConfig(configJson: string): void {
    try {
      const importData = JSON.parse(configJson);
      
      // Validate import data structure
      if (!importData || typeof importData !== 'object') {
        throw new Error('Invalid configuration JSON');
      }

      // Remove import-specific fields
      const { exportedAt, version, ...configData } = importData;

      this.logger.info('Importing configuration', {
        exportedAt,
        version,
        configKeys: Object.keys(configData)
      });

      this.updateConfig(configData);
      
    } catch (error) {
      this.logger.error('Failed to import configuration:', error as Error);
      throw new Error(`Configuration import failed: ${(error as Error).message}`);
    }
  }

  /**
   * Save configuration to file
   */
  public async saveToFile(filePath: string): Promise<void> {
    try {
      const fs = (require as any)('fs').promises;
      await fs.writeFile(filePath, this.exportConfig(), 'utf8');
      this.logger.info(`Configuration saved to ${filePath}`);
    } catch (error) {
      this.logger.error(`Failed to save configuration to ${filePath}:`, error as Error);
      throw new Error(`Failed to save configuration: ${(error as Error).message}`);
    }
  }

  /**
   * Load configuration from file
   */
  public async loadFromFile(filePath: string): Promise<void> {
    try {
      const fs = (require as any)('fs').promises;
      const configJson = await fs.readFile(filePath, 'utf8');
      this.importConfig(configJson);
      this.logger.info(`Configuration loaded from ${filePath}`);
    } catch (error) {
      this.logger.error(`Failed to load configuration from ${filePath}:`, error as Error);
      throw new Error(`Failed to load configuration: ${(error as Error).message}`);
    }
  }

  /**
   * Get environment-specific configuration
   */
  public static fromEnvironment(logger: Logger): ConnectionConfigManager {
    const envConfig: Partial<ConnectionConfig> = {
      token: (global as any).process?.env?.DISCORD_TOKEN || '',
      intents: (global as any).process?.env?.DISCORD_INTENTS?.split(',') || [],
      autoReconnect: (global as any).process?.env?.DISCORD_AUTO_RECONNECT !== 'false',
      maxReconnectAttempts: parseInt((global as any).process?.env?.DISCORD_MAX_RECONNECT_ATTEMPTS || '10'),
      reconnectDelay: parseInt((global as any).process?.env?.DISCORD_RECONNECT_DELAY || '5000'),
      reconnectBackoffMultiplier: parseFloat((global as any).process?.env?.DISCORD_RECONNECT_BACKOFF || '2'),
      maxReconnectDelay: parseInt((global as any).process?.env?.DISCORD_MAX_RECONNECT_DELAY || '300000'),
      connectionTimeout: parseInt((global as any).process?.env?.DISCORD_CONNECTION_TIMEOUT || '30000'),
      heartbeatInterval: parseInt((global as any).process?.env?.DISCORD_HEARTBEAT_INTERVAL || '41250'),
      heartbeatTimeout: parseInt((global as any).process?.env?.DISCORD_HEARTBEAT_TIMEOUT || '60000'),
      sessionId: (global as any).process?.env?.DISCORD_SESSION_ID || `session_${Date.now()}`,
      compress: (global as any).process?.env?.DISCORD_COMPRESS !== 'false',
      restTimeout: parseInt((global as any).process?.env?.DISCORD_REST_TIMEOUT || '15000'),
      restRetries: parseInt(process.env.DISCORD_REST_RETRIES || '3'),
      restRetryDelay: parseInt(process.env.DISCORD_REST_RETRY_DELAY || '1000'),
      metricsEnabled: process.env.DISCORD_METRICS_ENABLED !== 'false',
      metricsInterval: parseInt(process.env.DISCORD_METRICS_INTERVAL || '60000'),
      eventsEnabled: process.env.DISCORD_EVENTS_ENABLED !== 'false'
    };

    return new ConnectionConfigManager(envConfig, logger);
  }

  /**
   * Get default configuration
   */
  public static getDefault(): ConnectionConfigManager {
    return new ConnectionConfigManager({}, logger);
  }

  /**
   * Validate configuration for specific environment
   */
  public validateForEnvironment(environment: 'development' | 'staging' | 'production'): {
    valid: boolean;
    warnings: string[];
    errors: string[];
  } {
    const warnings: string[] = [];
    const errors: string[] = [];

    // Environment-specific validations
    switch (environment) {
      case 'production':
        if (this.config.metricsInterval < 30000) {
          warnings.push('Consider increasing metricsInterval for production (recommended: 30000ms+)');
        }
        
        if (this.config.reconnectDelay < 10000) {
          warnings.push('Consider increasing reconnectDelay for production (recommended: 10000ms+)');
        }
        
        if (!this.config.circuitBreaker.enabled) {
          warnings.push('Circuit breaker should be enabled in production');
        }
        
        if (!this.config.degradation.enabled) {
          warnings.push('Graceful degradation should be enabled in production');
        }
        break;

      case 'development':
        if (this.config.healthCheck.interval < 10000) {
          warnings.push('Health check interval is aggressive for development (recommended: 10000ms+)');
        }
        break;

      case 'staging':
        // Staging can use production-like settings
        if (this.config.metricsInterval < 30000) {
          warnings.push('Consider increasing metricsInterval for staging (recommended: 30000ms+)');
        }
        break;
    }

    // General validations
    if (this.config.token && this.config.token.length < 50) {
      warnings.push('Token seems unusually short');
    }

    if (this.config.intents.length === 0) {
      errors.push('At least one intent is required');
    }

    if (this.config.maxReconnectAttempts > 50) {
      warnings.push('Very high maxReconnectAttempts may cause issues');
    }

    return {
      valid: errors.length === 0,
      warnings,
      errors
    };
  }

  /**
   * Get recommended settings for bot size
   */
  public static getRecommendedConfig(botSize: 'small' | 'medium' | 'large'): Partial<ConnectionConfig> {
    switch (botSize) {
      case 'small':
        return {
          maxReconnectAttempts: 5,
          reconnectDelay: 10000,
          healthCheck: {
            interval: 60000,
            timeout: 15000
          },
          circuitBreaker: {
            failureThreshold: 3,
            timeout: 30000
          },
          degradation: {
            thresholds: {
              latency: 2000,
              errorRate: 0.2,
              consecutiveErrors: 5
            }
          }
        };

      case 'medium':
        return {
          maxReconnectAttempts: 10,
          reconnectDelay: 5000,
          healthCheck: {
            interval: 30000,
            timeout: 10000
          },
          circuitBreaker: {
            failureThreshold: 5,
            timeout: 60000
          },
          degradation: {
            thresholds: {
              latency: 1000,
              errorRate: 0.1,
              consecutiveErrors: 3
            }
          }
        };

      case 'large':
        return {
          maxReconnectAttempts: 20,
          reconnectDelay: 3000,
          healthCheck: {
            interval: 15000,
            timeout: 5000
          },
          circuitBreaker: {
            failureThreshold: 10,
            timeout: 120000
          },
          degradation: {
            thresholds: {
              latency: 500,
              errorRate: 0.05,
              consecutiveErrors: 2
            }
          }
        };
    }
  }
}