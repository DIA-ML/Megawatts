import { HealthOrchestrator } from './orchestrator';
import { HealthEndpointConfig } from './types';
import { Logger } from '../../utils/logger';

// Define basic request/response interfaces for compatibility
interface Request {
  params: Record<string, string>;
  query: Record<string, string>;
  headers: Record<string, string>;
  ip?: string;
}

interface Response {
  status(code: number): Response;
  json(data: any): void;
}

export class HealthEndpoints {
  private orchestrator: HealthOrchestrator;
  private logger: Logger;

  constructor(orchestrator: HealthOrchestrator) {
    this.orchestrator = orchestrator;
    this.logger = new Logger('HealthEndpoints');
  }

  /**
   * Basic health check endpoint
   */
  async basicHealth(req: Request, res: Response): Promise<void> {
    try {
      const health = await this.orchestrator.runAllChecks();
      
      const statusCode = health.status === 'healthy' ? 200 : 
                        health.status === 'degraded' ? 200 : 503;

      res.status(statusCode).json({
        status: health.status,
        timestamp: health.timestamp,
        uptime: health.uptime,
        version: health.version,
        summary: health.summary
      });
    } catch (error) {
      this.logger.error('Basic health check failed', error as Error);
      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date(),
        error: 'Health check failed'
      });
    }
  }

  /**
   * Detailed health check endpoint
   */
  async detailedHealth(req: Request, res: Response): Promise<void> {
    try {
      const health = await this.orchestrator.runAllChecks();
      const metrics = this.orchestrator.getMetrics(10);
      const alerts = this.orchestrator.getActiveAlerts();
      
      const statusCode = health.status === 'healthy' ? 200 : 
                        health.status === 'degraded' ? 200 : 503;

      res.status(statusCode).json({
        status: health.status,
        timestamp: health.timestamp,
        uptime: health.uptime,
        version: health.version,
        summary: health.summary,
        checks: health.checks,
        metrics: metrics.slice(-5), // Last 5 metrics
        alerts: alerts,
        monitoring: {
          enabled: this.orchestrator.isMonitoring(),
          interval: 30000 // Would come from config
        }
      });
    } catch (error) {
      this.logger.error('Detailed health check failed', error as Error);
      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date(),
        error: 'Detailed health check failed'
      });
    }
  }

  /**
   * Readiness probe endpoint
   */
  async readiness(req: Request, res: Response): Promise<void> {
    try {
      const readiness = await this.orchestrator.getReadiness();
      
      const statusCode = readiness.ready ? 200 : 503;

      res.status(statusCode).json({
        ready: readiness.ready,
        timestamp: new Date(),
        checks: readiness.checks.map(check => ({
          name: check.name,
          status: check.status,
          message: check.message
        }))
      });
    } catch (error) {
      this.logger.error('Readiness check failed', error as Error);
      res.status(503).json({
        ready: false,
        timestamp: new Date(),
        error: 'Readiness check failed'
      });
    }
  }

  /**
   * Liveness probe endpoint
   */
  async liveness(req: Request, res: Response): Promise<void> {
    try {
      const liveness = await this.orchestrator.getLiveness();
      
      const statusCode = liveness.alive ? 200 : 503;

      res.status(statusCode).json({
        alive: liveness.alive,
        timestamp: new Date(),
        uptime: liveness.uptime
      });
    } catch (error) {
      this.logger.error('Liveness check failed', error as Error);
      res.status(503).json({
        alive: false,
        timestamp: new Date(),
        error: 'Liveness check failed'
      });
    }
  }

  /**
   * Get health metrics endpoint
   */
  async getMetrics(req: Request, res: Response): Promise<void> {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const metrics = this.orchestrator.getMetrics(limit);

      res.status(200).json({
        metrics,
        count: metrics.length,
        timestamp: new Date()
      });
    } catch (error) {
      this.logger.error('Get metrics failed', error as Error);
      res.status(500).json({
        error: 'Failed to get metrics',
        timestamp: new Date()
      });
    }
  }

  /**
   * Get alerts endpoint
   */
  async getAlerts(req: Request, res: Response): Promise<void> {
    try {
      const activeOnly = req.query.active === 'true';
      const alerts = activeOnly ? 
        this.orchestrator.getActiveAlerts() : 
        this.orchestrator.getAllAlerts();

      res.status(200).json({
        alerts,
        count: alerts.length,
        timestamp: new Date()
      });
    } catch (error) {
      this.logger.error('Get alerts failed', error as Error);
      res.status(500).json({
        error: 'Failed to get alerts',
        timestamp: new Date()
      });
    }
  }

  /**
   * Run specific health check endpoint
   */
  async runCheck(req: Request, res: Response): Promise<void> {
    try {
      const checkName = req.params.name;
      if (!checkName) {
        res.status(400).json({
          error: 'Check name is required',
          timestamp: new Date()
        });
        return;
      }

      const result = await this.orchestrator.runCheck(checkName);
      
      if (!result) {
        res.status(404).json({
          error: `Health check '${checkName}' not found`,
          timestamp: new Date()
        });
        return;
      }

      const statusCode = result.status === 'healthy' ? 200 : 
                        result.status === 'degraded' ? 200 : 503;

      res.status(statusCode).json(result);
    } catch (error) {
      this.logger.error(`Run check failed for ${req.params.name}`, error as Error);
      res.status(500).json({
        error: 'Failed to run health check',
        timestamp: new Date()
      });
    }
  }

  /**
   * Get all health checks endpoint
   */
  async getChecks(req: Request, res: Response): Promise<void> {
    try {
      const checks = this.orchestrator.getChecks();

      res.status(200).json({
        checks: checks.map(check => ({
          name: check.name,
          type: check.type,
          options: check.options
        })),
        count: checks.length,
        timestamp: new Date()
      });
    } catch (error) {
      this.logger.error('Get checks failed', error as Error);
      res.status(500).json({
        error: 'Failed to get health checks',
        timestamp: new Date()
      });
    }
  }

  /**
   * Middleware for authentication
   */
  authenticate(config: HealthEndpointConfig) {
    return (req: Request, res: Response, next: Function) => {
      if (!config.authentication?.enabled) {
        return next();
      }

      const token = req.headers[config.authentication.header || 'authorization'];
      const expectedToken = config.authentication.token;

      if (!token || token !== expectedToken) {
        res.status(401).json({
          error: 'Unauthorized',
          timestamp: new Date()
        });
        return;
      }

      next();
    };
  }

  /**
   * Middleware for rate limiting
   */
  rateLimit(config: HealthEndpointConfig) {
    const requests = new Map<string, { count: number; resetTime: number }>();

    return (req: Request, res: Response, next: Function) => {
      if (!config.rateLimit?.enabled) {
        return next();
      }

      const clientId = req.ip || 'unknown';
      const now = Date.now();
      const windowMs = config.rateLimit.windowMs;
      const maxRequests = config.rateLimit.maxRequests;

      const clientData = requests.get(clientId);

      if (!clientData || now > clientData.resetTime) {
        requests.set(clientId, {
          count: 1,
          resetTime: now + windowMs
        });
        return next();
      }

      if (clientData.count >= maxRequests) {
        res.status(429).json({
          error: 'Too many requests',
          timestamp: new Date(),
          retryAfter: Math.ceil((clientData.resetTime - now) / 1000)
        });
        return;
      }

      clientData.count++;
      next();
    };
  }

  /**
   * Setup all health endpoints
   */
  setupEndpoints(app: any, configs: Record<string, HealthEndpointConfig>): void {
    // Basic health endpoint
    if (configs.basic?.enabled) {
      app.get(
        configs.basic.path,
        this.rateLimit(configs.basic),
        this.authenticate(configs.basic),
        (req: Request, res: Response) => this.basicHealth(req, res)
      );
      this.logger.info(`Basic health endpoint configured: ${configs.basic.path}`);
    }

    // Detailed health endpoint
    if (configs.detailed?.enabled) {
      app.get(
        configs.detailed.path,
        this.rateLimit(configs.detailed),
        this.authenticate(configs.detailed),
        (req: Request, res: Response) => this.detailedHealth(req, res)
      );
      this.logger.info(`Detailed health endpoint configured: ${configs.detailed.path}`);
    }

    // Readiness endpoint
    if (configs.readiness?.enabled) {
      app.get(
        configs.readiness.path,
        this.rateLimit(configs.readiness),
        this.authenticate(configs.readiness),
        (req: Request, res: Response) => this.readiness(req, res)
      );
      this.logger.info(`Readiness endpoint configured: ${configs.readiness.path}`);
    }

    // Liveness endpoint
    if (configs.liveness?.enabled) {
      app.get(
        configs.liveness.path,
        this.rateLimit(configs.liveness),
        this.authenticate(configs.liveness),
        (req: Request, res: Response) => this.liveness(req, res)
      );
      this.logger.info(`Liveness endpoint configured: ${configs.liveness.path}`);
    }

    const defaultConfig: HealthEndpointConfig = {
      enabled: false,
      path: '/health',
      method: 'GET'
    };

    // Metrics endpoint
    app.get(
      '/health/metrics',
      this.rateLimit(configs.basic || defaultConfig),
      (req: Request, res: Response) => this.getMetrics(req, res)
    );
    this.logger.info('Metrics endpoint configured: /health/metrics');

    // Alerts endpoint
    app.get(
      '/health/alerts',
      this.rateLimit(configs.basic || defaultConfig),
      (req: Request, res: Response) => this.getAlerts(req, res)
    );
    this.logger.info('Alerts endpoint configured: /health/alerts');

    // Run specific check endpoint
    app.get(
      '/health/check/:name',
      this.rateLimit(configs.basic || defaultConfig),
      (req: Request, res: Response) => this.runCheck(req, res)
    );
    this.logger.info('Run check endpoint configured: /health/check/:name');

    // Get all checks endpoint
    app.get(
      '/health/checks',
      this.rateLimit(configs.basic || defaultConfig),
      (req: Request, res: Response) => this.getChecks(req, res)
    );
    this.logger.info('Get checks endpoint configured: /health/checks');
  }
}