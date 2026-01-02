import { HealthOrchestrator } from './orchestrator';
import { Logger } from '../../utils/logger';

// Define basic interfaces for compatibility
export interface Request {
  method: string;
  url: string;
  headers: Record<string, string>;
  ip?: string;
  timestamp?: number;
}

export interface Response {
  statusCode?: number;
  getHeader(name: string): string | undefined;
  end(...args: any[]): void;
}

export interface NextFunction {
  (error?: any): void;
}

export class HealthMiddleware {
  private orchestrator: HealthOrchestrator;
  private logger: Logger;
  private requestCounts: Map<string, number> = new Map();
  private responseTimes: number[] = [];
  private errorCounts: Map<string, number> = new Map();

  constructor(orchestrator: HealthOrchestrator) {
    this.orchestrator = orchestrator;
    this.logger = new Logger('HealthMiddleware');
  }

  /**
   * Request logging middleware
   */
  requestLogger() {
    return (req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();
      req.timestamp = startTime;

      // Log request start
      this.logger.debug(`${req.method} ${req.url}`, {
        method: req.method,
        url: req.url,
        ip: req.ip,
        userAgent: req.headers['user-agent']
      });

      // Override res.end to log response
      const originalEnd = res.end.bind(res);
      res.end = (...args: any[]) => {
        const duration = Date.now() - startTime;
        
        this.logger.debug(`${req.method} ${req.url} - ${res.statusCode} (${duration}ms)`, {
          method: req.method,
          url: req.url,
          statusCode: res.statusCode,
          duration,
          ip: req.ip
        });

        // Update metrics
        this.updateMetrics(req, res, duration);

        originalEnd.apply(res, args);
      };

      next();
    };
  }

  /**
   * Health check middleware that adds health info to requests
   */
  healthCheck() {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        // Add health information to request
        (req as any).health = {
          uptime: Date.now(), // Simplified uptime
          timestamp: new Date(),
          monitoring: this.orchestrator.isMonitoring ? this.orchestrator.isMonitoring() : false
        };

        next();
      } catch (error) {
        this.logger.error('Health check middleware failed', error as Error);
        next();
      }
    };
  }

  /**
   * Rate limiting middleware
   */
  rateLimit(options: {
    windowMs: number;
    maxRequests: number;
    message?: string;
  }) {
    const requests = new Map<string, { count: number; resetTime: number }>();

    return (req: Request, res: Response, next: NextFunction) => {
      const clientId = req.ip || 'unknown';
      const now = Date.now();

      const clientData = requests.get(clientId);

      if (!clientData || now > clientData.resetTime) {
        requests.set(clientId, {
          count: 1,
          resetTime: now + options.windowMs
        });
        return next();
      }

      if (clientData.count >= options.maxRequests) {
        const retryAfter = Math.ceil((clientData.resetTime - now) / 1000);
        
        this.logger.warn(`Rate limit exceeded for ${clientId}`, {
          clientId,
          count: clientData.count,
          maxRequests: options.maxRequests,
          retryAfter
        });

        (res as any).statusCode = 429;
        return next(new Error(options.message || `Rate limit exceeded. Try again in ${retryAfter} seconds.`));
      }

      clientData.count++;
      next();
    };
  }

  /**
   * Error tracking middleware
   */
  errorTracker() {
    return (error: Error, req: Request, res: Response, next: NextFunction) => {
      const errorKey = `${error.name}:${error.message}`;
      const currentCount = this.errorCounts.get(errorKey) || 0;
      this.errorCounts.set(errorKey, currentCount + 1);

      this.logger.error(`Request error: ${error.message}`, error, {
        method: req.method,
        url: req.url,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        errorCount: currentCount + 1
      });

      next(error);
    };
  }

  /**
   * Performance monitoring middleware
   */
  performanceMonitor() {
    return (req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();

      // Override res.end to track performance
      const originalEnd = res.end.bind(res);
      res.end = (...args: any[]) => {
        const duration = Date.now() - startTime;
        this.responseTimes.push(duration);

        // Keep only last 1000 response times
        if (this.responseTimes.length > 1000) {
          this.responseTimes = this.responseTimes.slice(-1000);
        }

        // Log slow requests
        if (duration > 1000) {
          this.logger.warn(`Slow request detected: ${req.method} ${req.url} (${duration}ms)`, {
            method: req.method,
            url: req.url,
            duration,
            ip: req.ip
          });
        }

        originalEnd.apply(res, args);
      };

      next();
    };
  }

  /**
   * Update internal metrics
   */
  private updateMetrics(req: Request, res: Response, duration: number): void {
    // Update request counts
    const methodKey = req.method;
    const currentCount = this.requestCounts.get(methodKey) || 0;
    this.requestCounts.set(methodKey, currentCount + 1);

    // Update response times
    this.responseTimes.push(duration);
    if (this.responseTimes.length > 1000) {
      this.responseTimes = this.responseTimes.slice(-1000);
    }

    // Update error counts
    if (res.statusCode && res.statusCode >= 400) {
      const errorKey = `HTTP_${res.statusCode}`;
      const errorCount = this.errorCounts.get(errorKey) || 0;
      this.errorCounts.set(errorKey, errorCount + 1);
    }
  }

  /**
   * Get current metrics
   */
  getMetrics() {
    const avgResponseTime = this.responseTimes.length > 0 
      ? this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length 
      : 0;

    const maxResponseTime = this.responseTimes.length > 0 
      ? Math.max(...this.responseTimes) 
      : 0;

    const minResponseTime = this.responseTimes.length > 0 
      ? Math.min(...this.responseTimes) 
      : 0;

    return {
      requests: {
        total: Array.from(this.requestCounts.values()).reduce((a, b) => a + b, 0),
        byMethod: Object.fromEntries(this.requestCounts)
      },
      responseTime: {
        average: avgResponseTime,
        min: minResponseTime,
        max: maxResponseTime,
        count: this.responseTimes.length
      },
      errors: {
        total: Array.from(this.errorCounts.values()).reduce((a, b) => a + b, 0),
        byType: Object.fromEntries(this.errorCounts)
      },
      timestamp: new Date()
    };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.requestCounts.clear();
    this.responseTimes = [];
    this.errorCounts.clear();
    this.logger.info('Health middleware metrics reset');
  }

  /**
   * Create a custom health check based on metrics
   */
  createMetricsHealthCheck() {
    return {
      name: 'middleware_metrics',
      type: 'custom' as const,
      check: async () => {
        const metrics = this.getMetrics();
        const avgResponseTime = metrics.responseTime.average;
        const errorRate = metrics.requests.total > 0 
          ? metrics.errors.total / metrics.requests.total 
          : 0;

        let status: 'healthy' | 'degraded' | 'unhealthy';
        let message: string;

        if (avgResponseTime > 2000 || errorRate > 0.1) {
          status = 'unhealthy';
          message = `High response time (${avgResponseTime.toFixed(2)}ms) or error rate (${(errorRate * 100).toFixed(2)}%)`;
        } else if (avgResponseTime > 1000 || errorRate > 0.05) {
          status = 'degraded';
          message = `Elevated response time (${avgResponseTime.toFixed(2)}ms) or error rate (${(errorRate * 100).toFixed(2)}%)`;
        } else {
          status = 'healthy';
          message = `Performance is good (avg: ${avgResponseTime.toFixed(2)}ms, error rate: ${(errorRate * 100).toFixed(2)}%)`;
        }

        return {
          status,
          checkType: 'custom' as const,
          name: 'middleware_metrics',
          message,
          timestamp: new Date(),
          details: metrics
        };
      }
    };
  }
}