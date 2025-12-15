import {
  ErrorReport,
  ErrorMetrics,
  ErrorClassification,
  ErrorContext,
  ErrorSeverity,
  ErrorCategory
} from './types';
import { Logger } from '../../utils/logger';
import { SelfEditingEngine } from '../../self-editing/engine';

export interface ErrorReportingConfig {
  enableSelfEditingReporting: boolean;
  enableMetricsCollection: boolean;
  enablePersistentStorage: boolean;
  metricsRetentionPeriod: number; // in hours
  reportingThreshold: ErrorSeverity;
  batchReportingSize: number;
  batchReportingInterval: number; // in milliseconds
}

export class ErrorReporter {
  private logger: Logger;
  private selfEditingEngine?: SelfEditingEngine;
  private config: ErrorReportingConfig;
  private errorReports: ErrorReport[] = [];
  private metrics: ErrorMetrics;
  private lastMetricsUpdate: Date = new Date();
  private batchTimer?: any;

  constructor(
    config: ErrorReportingConfig,
    logger: Logger,
    selfEditingEngine?: SelfEditingEngine
  ) {
    this.config = config;
    this.logger = logger;
    this.selfEditingEngine = selfEditingEngine;
    this.metrics = this.initializeMetrics();

    if (this.config.batchReportingInterval > 0) {
      this.startBatchReporting();
    }
  }

  /**
   * Report an error to various systems
   */
  public async reportError(
    error: Error,
    classification: ErrorClassification,
    context: ErrorContext,
    retryAttempts: number = 0
  ): Promise<void> {
    const errorReport: ErrorReport = {
      id: this.generateErrorId(),
      timestamp: new Date(),
      error,
      classification,
      context,
      retryAttempts,
      resolved: false
    };

    // Add to reports collection
    this.errorReports.push(errorReport);
    this.updateMetrics(errorReport);

    // Log the error
    this.logError(errorReport);

    // Report to self-editing engine if enabled and meets threshold
    if (this.shouldReportToSelfEditing(classification)) {
      await this.reportToSelfEditing(errorReport);
    }

    // Clean up old reports if persistent storage is enabled
    if (this.config.enablePersistentStorage) {
      this.cleanupOldReports();
    }

    this.logger.debug('Error reported successfully', {
      errorId: errorReport.id,
      category: classification.category,
      severity: classification.severity
    });
  }

  /**
   * Mark an error as resolved
   */
  public resolveError(
    errorId: string,
    resolutionAction: string
  ): void {
    const errorReport = this.errorReports.find(report => report.id === errorId);
    if (errorReport) {
      errorReport.resolved = true;
      errorReport.resolutionTime = new Date();
      errorReport.resolutionAction = resolutionAction;

      this.logger.info('Error resolved', {
        errorId,
        resolutionAction,
        resolutionTime: errorReport.resolutionTime
      });
    } else {
      this.logger.warn('Attempted to resolve non-existent error', { errorId });
    }
  }

  /**
   * Get current error metrics
   */
  public getMetrics(): ErrorMetrics {
    return { ...this.metrics };
  }

  /**
   * Get error reports with optional filtering
   */
  public getErrorReports(filter?: {
    category?: ErrorCategory;
    severity?: ErrorSeverity;
    resolved?: boolean;
    startDate?: Date;
    endDate?: Date;
  }): ErrorReport[] {
    let reports = [...this.errorReports];

    if (filter) {
      if (filter.category) {
        reports = reports.filter(r => r.classification.category === filter.category);
      }
      if (filter.severity) {
        reports = reports.filter(r => r.classification.severity === filter.severity);
      }
      if (filter.resolved !== undefined) {
        reports = reports.filter(r => r.resolved === filter.resolved);
      }
      if (filter.startDate) {
        reports = reports.filter(r => r.timestamp >= filter.startDate!);
      }
      if (filter.endDate) {
        reports = reports.filter(r => r.timestamp <= filter.endDate!);
      }
    }

    return reports.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Get error trends analysis
   */
  public getErrorTrends(timeWindow: number = 24): {
    hourlyTrends: Array<{ hour: number; count: number }>;
    categoryTrends: Record<ErrorCategory, number>;
    severityTrends: Record<ErrorSeverity, number>;
    resolutionRate: number;
    averageResolutionTime: number;
  } {
    const now = new Date();
    const windowStart = new Date(now.getTime() - timeWindow * 60 * 60 * 1000);
    
    const recentReports = this.errorReports.filter(r => r.timestamp >= windowStart);
    
    // Hourly trends
    const hourlyTrends = Array.from({ length: timeWindow }, (_, i) => {
      const hourStart = new Date(windowStart.getTime() + i * 60 * 60 * 1000);
      const hourEnd = new Date(hourStart.getTime() + 60 * 60 * 1000);
      const count = recentReports.filter(r => 
        r.timestamp >= hourStart && r.timestamp < hourEnd
      ).length;
      return { hour: i, count };
    });

    // Category trends
    const categoryTrends: Record<ErrorCategory, number> = {} as Record<ErrorCategory, number>;
    Object.values(ErrorCategory).forEach(category => {
      categoryTrends[category] = recentReports.filter(r => r.classification.category === category).length;
    });

    // Severity trends
    const severityTrends: Record<ErrorSeverity, number> = {} as Record<ErrorSeverity, number>;
    Object.values(ErrorSeverity).forEach(severity => {
      severityTrends[severity] = recentReports.filter(r => r.classification.severity === severity).length;
    });

    // Resolution metrics
    const resolvedReports = recentReports.filter(r => r.resolved);
    const resolutionRate = recentReports.length > 0 ? resolvedReports.length / recentReports.length : 0;
    
    const averageResolutionTime = resolvedReports.length > 0
      ? resolvedReports.reduce((sum, r) => {
          const resolutionTime = r.resolutionTime ? r.resolutionTime.getTime() - r.timestamp.getTime() : 0;
          return sum + resolutionTime;
        }, 0) / resolvedReports.length
      : 0;

    return {
      hourlyTrends,
      categoryTrends,
      severityTrends,
      resolutionRate,
      averageResolutionTime
    };
  }

  /**
   * Generate error summary for reporting
   */
  public generateErrorSummary(): {
    totalErrors: number;
    criticalErrors: number;
    unresolvedErrors: number;
    topCategories: Array<{ category: ErrorCategory; count: number }>;
    recommendations: string[];
  } {
    const unresolvedReports = this.errorReports.filter(r => !r.resolved);
    const criticalReports = this.errorReports.filter(r => r.classification.severity === ErrorSeverity.CRITICAL);

    // Top error categories
    const categoryCounts: Record<ErrorCategory, number> = {} as Record<ErrorCategory, number>;
    this.errorReports.forEach(report => {
      categoryCounts[report.classification.category] = (categoryCounts[report.classification.category] || 0) + 1;
    });

    const topCategories = Object.entries(categoryCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([category, count]) => ({ category: category as ErrorCategory, count }));

    // Generate recommendations
    const recommendations = this.generateRecommendations();

    return {
      totalErrors: this.errorReports.length,
      criticalErrors: criticalReports.length,
      unresolvedErrors: unresolvedReports.length,
      topCategories,
      recommendations
    };
  }

  /**
   * Cleanup old error reports
   */
  private cleanupOldReports(): void {
    const cutoffTime = new Date(Date.now() - this.config.metricsRetentionPeriod * 60 * 60 * 1000);
    const initialCount = this.errorReports.length;
    
    this.errorReports = this.errorReports.filter(report => report.timestamp >= cutoffTime);
    
    const removedCount = initialCount - this.errorReports.length;
    if (removedCount > 0) {
      this.logger.debug('Cleaned up old error reports', { removedCount });
    }
  }

  /**
   * Initialize error metrics
   */
  private initializeMetrics(): ErrorMetrics {
    const metrics: ErrorMetrics = {
      totalErrors: 0,
      errorsByCategory: {} as Record<ErrorCategory, number>,
      errorsBySeverity: {} as Record<ErrorSeverity, number>,
      retrySuccessRate: 0,
      averageResolutionTime: 0,
      criticalErrors: 0,
      escalatedErrors: 0
    };

    Object.values(ErrorCategory).forEach(category => {
      metrics.errorsByCategory[category] = 0;
    });

    Object.values(ErrorSeverity).forEach(severity => {
      metrics.errorsBySeverity[severity] = 0;
    });

    return metrics;
  }

  /**
   * Update metrics with new error report
   */
  private updateMetrics(report: ErrorReport): void {
    this.metrics.totalErrors++;
    this.metrics.errorsByCategory[report.classification.category]++;
    this.metrics.errorsBySeverity[report.classification.severity]++;

    if (report.classification.severity === ErrorSeverity.CRITICAL) {
      this.metrics.criticalErrors++;
    }

    if (report.classification.requiresEscalation) {
      this.metrics.escalatedErrors++;
    }

    // Update retry success rate
    const retriedErrors = this.errorReports.filter(r => r.retryAttempts > 0);
    const successfulRetries = retriedErrors.filter(r => r.resolved);
    this.metrics.retrySuccessRate = retriedErrors.length > 0 ? successfulRetries.length / retriedErrors.length : 0;

    // Update average resolution time
    const resolvedErrors = this.errorReports.filter(r => r.resolved && r.resolutionTime);
    if (resolvedErrors.length > 0) {
      const totalResolutionTime = resolvedErrors.reduce((sum, r) => 
        sum + (r.resolutionTime!.getTime() - r.timestamp.getTime()), 0
      );
      this.metrics.averageResolutionTime = totalResolutionTime / resolvedErrors.length;
    }
  }

  /**
   * Log error with appropriate level
   */
  private logError(report: ErrorReport): void {
    const logData = {
      errorId: report.id,
      category: report.classification.category,
      severity: report.classification.severity,
      action: report.classification.action,
      retryAttempts: report.retryAttempts,
      userId: report.context.userId,
      guildId: report.context.guildId,
      command: report.context.command
    };

    switch (report.classification.severity) {
      case ErrorSeverity.CRITICAL:
        this.logger.error(`Critical error [${report.id}]: ${report.error.message}`, report.error, logData);
        break;
      case ErrorSeverity.HIGH:
        this.logger.error(`High severity error [${report.id}]: ${report.error.message}`, report.error, logData);
        break;
      case ErrorSeverity.MEDIUM:
        this.logger.warn(`Medium severity error [${report.id}]: ${report.error.message}`, logData);
        break;
      case ErrorSeverity.LOW:
        this.logger.info(`Low severity error [${report.id}]: ${report.error.message}`, logData);
        break;
    }
  }

  /**
   * Check if error should be reported to self-editing engine
   */
  private shouldReportToSelfEditing(classification: ErrorClassification): boolean {
    if (!this.config.enableSelfEditingReporting || !this.selfEditingEngine) {
      return false;
    }

    const severityLevels = {
      [ErrorSeverity.LOW]: 0,
      [ErrorSeverity.MEDIUM]: 1,
      [ErrorSeverity.HIGH]: 2,
      [ErrorSeverity.CRITICAL]: 3
    };

    const thresholdLevel = severityLevels[this.config.reportingThreshold];
    const errorLevel = severityLevels[classification.severity];

    return errorLevel >= thresholdLevel || classification.requiresEscalation;
  }

  /**
   * Report error to self-editing engine
   */
  private async reportToSelfEditing(report: ErrorReport): Promise<void> {
    if (!this.selfEditingEngine) {
      return;
    }

    try {
      // This would integrate with the self-editing engine to analyze and potentially fix the error
      this.logger.info('Reporting error to self-editing engine', {
        errorId: report.id,
        category: report.classification.category,
        severity: report.classification.severity
      });

      // The self-editing engine would analyze the error and potentially make corrections
      // For now, we'll just log the intent
      await this.selfEditingEngine.analyzePerformance();
    } catch (error) {
      this.logger.error('Failed to report error to self-editing engine', error as Error, {
        originalErrorId: report.id
      });
    }
  }

  /**
   * Generate recommendations based on error patterns
   */
  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    const trends = this.getErrorTrends();

    // Check for high error rates
    if (this.metrics.totalErrors > 100) {
      recommendations.push('Consider implementing more robust error handling and monitoring');
    }

    // Check for high critical error rate
    if (this.metrics.criticalErrors > 10) {
      recommendations.push('Immediate attention required: High number of critical errors detected');
    }

    // Check for low resolution rate
    if (trends.resolutionRate < 0.5) {
      recommendations.push('Improve error resolution processes and automation');
    }

    // Check for specific category patterns
    const topCategory = Object.entries(trends.categoryTrends)
      .sort(([, a], [, b]) => b - a)[0];

    if (topCategory && topCategory[1] > 20) {
      recommendations.push(`Focus on reducing ${topCategory[0]} errors, which are most frequent`);
    }

    // Check for retry patterns
    if (this.metrics.retrySuccessRate < 0.3) {
      recommendations.push('Review retry logic - current success rate is low');
    }

    return recommendations;
  }

  /**
   * Generate unique error ID
   */
  private generateErrorId(): string {
    return `ERR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Start batch reporting timer
   */
  private startBatchReporting(): void {
    this.batchTimer = setInterval(() => {
      this.processBatchReports();
    }, this.config.batchReportingInterval);
  }

  /**
   * Process batch reports
   */
  private processBatchReports(): void {
    const unresolvedReports = this.errorReports.filter(r => !r.resolved);
    
    if (unresolvedReports.length >= this.config.batchReportingSize) {
      this.logger.info('Processing batch error reports', {
        reportCount: unresolvedReports.length
      });
      
      // Here you could send batch reports to external monitoring systems
      // For now, we'll just log the batch processing
    }
  }

  /**
   * Cleanup resources
   */
  public destroy(): void {
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
    }
  }
}