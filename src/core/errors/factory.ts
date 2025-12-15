import { Logger } from '../../utils/logger';
import { ErrorHandler } from './handler';
import { ErrorHandlerConfig, ErrorSeverity } from './types';
import { SelfEditingEngine } from '../../self-editing/engine';

/**
 * Factory function to create a default error handler instance
 */
export function createDefaultErrorHandler(
  logger: Logger,
  selfEditingEngine?: SelfEditingEngine
): ErrorHandler {
  const config: ErrorHandlerConfig = ErrorHandler.getDefaultConfig();
  
  return new ErrorHandler(config, logger, selfEditingEngine);
}

/**
 * Factory function to create a custom error handler instance
 */
export function createCustomErrorHandler(
  config: ErrorHandlerConfig,
  logger: Logger,
  selfEditingEngine?: SelfEditingEngine
): ErrorHandler {
  return new ErrorHandler(config, logger, selfEditingEngine);
}

/**
 * Factory function to create error handler with custom configuration
 */
export function createErrorHandlerWithOptions(
  options: {
    enableRetry?: boolean;
    enableReporting?: boolean;
    enableUserNotification?: boolean;
    reportingThreshold?: 'low' | 'medium' | 'high' | 'critical';
    maxRetries?: number;
    baseDelay?: number;
    maxDelay?: number;
  },
  logger: Logger,
  selfEditingEngine?: SelfEditingEngine
): ErrorHandler {
  const config: ErrorHandlerConfig = ErrorHandler.getDefaultConfig();
  
  // Override default config with provided options
  if (options.enableRetry !== undefined) {
    config.enableRetry = options.enableRetry;
  }
  
  if (options.enableReporting !== undefined) {
    config.enableReporting = options.enableReporting;
  }
  
  if (options.enableUserNotification !== undefined) {
    config.enableUserNotification = options.enableUserNotification;
  }
  
  if (options.reportingThreshold !== undefined) {
    config.reportingThreshold = options.reportingThreshold as any;
  }
  
  if (options.maxRetries !== undefined) {
    config.defaultRetryConfig.maxAttempts = options.maxRetries;
  }
  
  if (options.baseDelay !== undefined) {
    config.defaultRetryConfig.baseDelay = options.baseDelay;
  }
  
  if (options.maxDelay !== undefined) {
    config.defaultRetryConfig.maxDelay = options.maxDelay;
  }
  
  return new ErrorHandler(config, logger, selfEditingEngine);
}