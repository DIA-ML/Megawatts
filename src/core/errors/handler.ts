import {
  ErrorCategory,
  ErrorSeverity,
  ErrorAction,
  ErrorClassification,
  ErrorContext,
  ErrorHandlerConfig,
  RetryConfig,
  ErrorReport
} from './types';
import { Logger } from '../../utils/logger';
import { ErrorClassifier } from './classifier';
import { RetryHandler, RetryResult } from './retry';
import { ErrorMessageFormatter } from './formatter';
import { ErrorReporter, ErrorReportingConfig } from './reporter';
import { SelfEditingEngine } from '../../self-editing/engine';

export interface ErrorHandlingResult {
  success: boolean;
  error?: Error;
  classification?: ErrorClassification;
  retryResult?: RetryResult;
  userMessage?: string;
  escalated: boolean;
  reported: boolean;
}

export interface DiscordContext {
  userId?: string;
  guildId?: string;
  channelId?: string;
  command?: string;
  interaction?: string;
  requestId?: string;
}

export class ErrorHandler {
  private logger: Logger;
  private classifier: ErrorClassifier;
  private retryHandler: RetryHandler;
  private formatter: ErrorMessageFormatter;
  private reporter: ErrorReporter;
  private config: ErrorHandlerConfig;

  constructor(
    config: ErrorHandlerConfig,
    logger: Logger,
    selfEditingEngine?: SelfEditingEngine
  ) {
    this.config = config;
    this.logger = logger;
    
    // Initialize components
    this.classifier = new ErrorClassifier(
      config.classificationRules,
      config.defaultRetryConfig,
      logger
    );
    
    this.retryHandler = new RetryHandler(config.defaultRetryConfig, logger);
    this.formatter = new ErrorMessageFormatter(logger);
    
    const reportingConfig: ErrorReportingConfig = {
      enableSelfEditingReporting: config.enableReporting,
      enableMetricsCollection: true,
      enablePersistentStorage: true,
      metricsRetentionPeriod: 24 * 7, // 1 week
      reportingThreshold: config.reportingThreshold,
      batchReportingSize: 50,
      batchReportingInterval: 60000 // 1 minute
    };
    
    this.reporter = new ErrorReporter(reportingConfig, logger, selfEditingEngine);
  }

  /**
   * Handle an error with full processing pipeline
   */
  public async handleError(
    error: Error,
    discordContext?: DiscordContext,
    additionalMetadata?: Record<string, any>
  ): Promise<ErrorHandlingResult> {
    const context = this.createErrorContext(discordContext, additionalMetadata);
    
    try {
      // Step 1: Classify the error
      const classification = this.classifier.classifyError(error, context);
      
      this.logger.debug('Error classified', {
        category: classification.category,
        severity: classification.severity,
        action: classification.action,
        isRetryable: classification.isRetryable
      });

      // Step 2: Take action based on classification
      const result = await this.takeAction(error, classification, context);

      // Step 3: Report error if enabled
      if (this.config.enableReporting) {
        await this.reportError(error, classification, context, result.retryResult);
      }

      // Step 4: Generate user message if needed
      let userMessage: string | undefined;
      if (this.config.enableUserNotification && classification.action === ErrorAction.NOTIFY_USER) {
        userMessage = this.formatter.createSimpleMessage(classification, context);
      }

      return {
        success: result.success,
        error: result.success ? undefined : error,
        classification,
        retryResult: result.retryResult,
        userMessage,
        escalated: classification.requiresEscalation,
        reported: this.config.enableReporting
      };

    } catch (handlingError) {
      this.logger.error('Error in error handling process', handlingError as Error, {
        originalError: error.message
      });

      return {
        success: false,
        error: handlingError as Error,
        escalated: true,
        reported: false
      };
    }
  }

  /**
   * Execute a function with automatic error handling
   */
  public async executeWithErrorHandling<T>(
    fn: () => Promise<T>,
    discordContext?: DiscordContext,
    additionalMetadata?: Record<string, any>
  ): Promise<{
    success: boolean;
    result?: T;
    error?: Error;
    handlingResult?: ErrorHandlingResult;
  }> {
    try {
      const result = await fn();
      return { success: true, result };
    } catch (error) {
      const handlingResult = await this.handleError(
        error as Error,
        discordContext,
        additionalMetadata
      );
      
      return {
        success: false,
        error: error as Error,
        handlingResult
      };
    }
  }

  /**
   * Execute a function with retry logic and error handling
   */
  public async executeWithRetryAndHandling<T>(
    fn: () => Promise<T>,
    discordContext?: DiscordContext,
    additionalMetadata?: Record<string, any>,
    customRetryConfig?: Partial<RetryConfig>
  ): Promise<{
    success: boolean;
    result?: T;
    error?: Error;
    handlingResult?: ErrorHandlingResult;
  }> {
    try {
      // First attempt to classify without error to get classification for retry
      const mockContext = this.createErrorContext(discordContext, additionalMetadata);
      const mockError = new Error('Mock error for classification');
      const classification = this.classifier.classifyError(mockError, mockContext);
      
      // Execute with retry
      const retryResult = await this.retryHandler.executeWithRetry(
        fn,
        classification,
        customRetryConfig
      );

      if (retryResult.success) {
        return { success: true, result: retryResult.result };
      } else {
        // Handle the retry failure
        const handlingResult = await this.handleError(
          retryResult.finalError!,
          discordContext,
          additionalMetadata
        );
        
        return {
          success: false,
          error: retryResult.finalError,
          handlingResult
        };
      }
    } catch (error) {
      const handlingResult = await this.handleError(
        error as Error,
        discordContext,
        additionalMetadata
      );
      
      return {
        success: false,
        error: error as Error,
        handlingResult
      };
    }
  }

  /**
   * Get formatted Discord embed for error
   */
  public createDiscordEmbed(
    error: Error,
    discordContext?: DiscordContext,
    additionalMetadata?: Record<string, any>
  ): any {
    const context = this.createErrorContext(discordContext, additionalMetadata);
    const classification = this.classifier.classifyError(error, context);
    
    return this.formatter.createDiscordEmbed(error, classification, context);
  }

  /**
   * Get error metrics
   */
  public getMetrics() {
    return this.reporter.getMetrics();
  }

  /**
   * Get error trends
   */
  public getErrorTrends(timeWindow?: number) {
    return this.reporter.getErrorTrends(timeWindow);
  }

  /**
   * Get error summary
   */
  public getErrorSummary() {
    return this.reporter.generateErrorSummary();
  }

  /**
   * Get error reports
   */
  public getErrorReports(filter?: {
    category?: ErrorCategory;
    severity?: ErrorSeverity;
    resolved?: boolean;
    startDate?: Date;
    endDate?: Date;
  }) {
    return this.reporter.getErrorReports(filter);
  }

  /**
   * Resolve an error
   */
  public resolveError(errorId: string, resolutionAction: string) {
    this.reporter.resolveError(errorId, resolutionAction);
  }

  /**
   * Take action based on error classification
   */
  private async takeAction(
    error: Error,
    classification: ErrorClassification,
    context: ErrorContext
  ): Promise<{
    success: boolean;
    retryResult?: RetryResult;
  }> {
    switch (classification.action) {
      case ErrorAction.RETRY:
        if (this.config.enableRetry) {
          const retryResult = await this.retryHandler.executeWithRetry(
            async () => { throw error; }, // Re-throw the error for retry
            classification
          );
          return { success: retryResult.success, retryResult };
        }
        return { success: false };

      case ErrorAction.ESCALATE:
        this.logger.error('Error escalated', error, {
          category: classification.category,
          severity: classification.severity,
          context
        });
        return { success: false };

      case ErrorAction.IGNORE:
        this.logger.debug('Error ignored as per classification', {
          category: classification.category,
          message: error.message
        });
        return { success: true };

      case ErrorAction.RESTART:
        this.logger.error('Initiating restart due to critical error', error);
        // In a real implementation, this would trigger a graceful restart
        setTimeout(() => {
          // Use global process if available
          if (typeof globalThis !== 'undefined' && (globalThis as any).process) {
            (globalThis as any).process.exit(1);
          }
        }, 5000);
        return { success: false };

      case ErrorAction.NOTIFY_USER:
        // User notification is handled in the main error handler
        return { success: false };

      case ErrorAction.LOG_ONLY:
        this.logger.warn('Error logged only', {
          category: classification.category,
          message: error.message
        });
        return { success: false };

      default:
        this.logger.warn('Unknown error action', {
          action: classification.action,
          category: classification.category
        });
        return { success: false };
    }
  }

  /**
   * Report error to reporting system
   */
  private async reportError(
    error: Error,
    classification: ErrorClassification,
    context: ErrorContext,
    retryResult?: RetryResult
  ): Promise<void> {
    try {
      await this.reporter.reportError(
        error,
        classification,
        context,
        retryResult?.attempts.length || 0
      );
    } catch (reportingError) {
      this.logger.error('Failed to report error', reportingError as Error, {
        originalError: error.message
      });
    }
  }

  /**
   * Create error context from Discord context
   */
  private createErrorContext(
    discordContext?: DiscordContext,
    additionalMetadata?: Record<string, any>
  ): ErrorContext {
    return {
      userId: discordContext?.userId,
      guildId: discordContext?.guildId,
      channelId: discordContext?.channelId,
      command: discordContext?.command,
      interaction: discordContext?.interaction,
      requestId: discordContext?.requestId || this.generateRequestId(),
      timestamp: new Date(),
      metadata: additionalMetadata
    };
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `REQ_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get default error handler configuration
   */
  public static getDefaultConfig(): ErrorHandlerConfig {
    return {
      enableRetry: true,
      enableReporting: true,
      enableUserNotification: true,
      defaultRetryConfig: ErrorClassifier.getDefaultRetryConfig(),
      classificationRules: ErrorClassifier.getDefaultRules(),
      reportingThreshold: ErrorSeverity.MEDIUM
    };
  }

  /**
   * Cleanup resources
   */
  public destroy(): void {
    this.reporter.destroy();
  }
}