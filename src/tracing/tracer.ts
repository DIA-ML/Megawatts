/**
 * @fileoverview OpenTelemetry Tracer Implementation
 * 
 * Provides comprehensive tracing capabilities including:
 * - Trace initialization and configuration
 * - Span creation and management
 * - Span attributes and events
 * - Span links and references
 * - Span status handling
 * 
 * @module tracing/tracer
 */

import {
  trace,
  Tracer,
  Span,
  SpanKind,
  SpanOptions,
  diag,
  DiagConsoleLogger,
  DiagLogLevel,
} from '@opentelemetry/api';
import {
  NodeTracerProvider,
  SimpleSpanProcessor,
  BatchSpanProcessor,
} from '@opentelemetry/sdk-trace-node';
import { Resource } from '@opentelemetry/resources';
import { SEMRESATTRS_SERVICE_NAME, SEMRESATTRS_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { Logger } from '../utils/logger';
import { BotError } from '../utils/errors';
import { TracingExporter } from './exporter';

/**
 * Tracer configuration options
 */
export interface TracerConfig {
  /** Service name for tracing */
  serviceName: string;
  /** Service version */
  serviceVersion?: string;
  /** Sampling rate (0.0 to 1.0) */
  samplingRate?: number;
  /** Enable batch processing */
  enableBatch?: boolean;
  /** Batch export timeout in milliseconds */
  batchTimeout?: number;
  /** Maximum batch size */
  maxBatchSize?: number;
  /** Maximum queue size */
  maxQueueSize?: number;
}

/**
 * Span attribute types
 */
export type SpanAttributeValue = string | number | boolean | string[] | number[] | boolean[] | null;

/**
 * Span event data
 */
export interface SpanEventData {
  /** Event name */
  name: string;
  /** Event timestamp (default: now) */
  timestamp?: number;
  /** Event attributes */
  attributes?: Record<string, SpanAttributeValue>;
}

/**
 * Span link data
 */
export interface SpanLinkData {
  /** Span context to link to */
  context: any;
  /** Link attributes */
  attributes?: Record<string, SpanAttributeValue>;
}

/**
 * Span status codes
 */
export enum SpanStatusCode {
  /** Operation completed successfully */
  OK = 1,
  /** Operation completed with errors */
  ERROR = 2,
  /** Operation was cancelled */
  UNSET = 0,
}

/**
 * Span status
 */
export interface SpanStatus {
  /** Status code */
  code: SpanStatusCode;
  /** Status description */
  description?: string;
}

/**
 * Tracer class for managing OpenTelemetry spans
 */
export class MegawattsTracer {
  private tracer: Tracer;
  private provider: NodeTracerProvider;
  private logger: Logger;
  private config: TracerConfig;
  private activeSpans: Map<string, Span> = new Map();

  /**
   * Creates a new MegawattsTracer instance
   * @param config - Tracer configuration
   * @param exporter - Tracing exporter instance
   */
  constructor(config: TracerConfig, exporter: TracingExporter) {
    this.logger = new Logger('MegawattsTracer');
    this.config = {
      samplingRate: 1.0,
      enableBatch: true,
      batchTimeout: 5000,
      maxBatchSize: 512,
      maxQueueSize: 2048,
      ...config,
    };

    // Set up diagnostics
    diag.setLogger(new DiagConsoleLogger(), process.env.OTEL_LOG_LEVEL === 'debug' ? DiagLogLevel.DEBUG : DiagLogLevel.INFO);

    // Create resource
    const resource = new Resource({
      [SEMRESATTRS_SERVICE_NAME]: this.config.serviceName,
      [SEMRESATTRS_SERVICE_VERSION]: this.config.serviceVersion || '1.0.0',
    });

    // Create provider
    this.provider = new NodeTracerProvider({ resource });

    // Add span processor
    const processor = this.config.enableBatch
      ? new BatchSpanProcessor(exporter.getExporter())
      : new SimpleSpanProcessor(exporter.getExporter());

    this.provider.addSpanProcessor(processor);

    // Register provider
    this.provider.register();

    // Get tracer
    this.tracer = trace.getTracer(this.config.serviceName);

    this.logger.info('Tracer initialized', {
      serviceName: this.config.serviceName,
      samplingRate: this.config.samplingRate,
      enableBatch: this.config.enableBatch,
    });
  }

  /**
   * Starts a new span
   * @param name - Span name
   * @param options - Span options
   * @returns The created span
   */
  startSpan(name: string, options?: SpanOptions): Span {
    try {
      const span = this.tracer.startSpan(name, options);
      // Store span by span context since Span doesn't have name property
      const spanContext = span.spanContext();
      if (spanContext) {
        this.activeSpans.set(spanContext.spanId, span);
      }
      this.logger.debug(`Span started: ${name}`);
      return span;
    } catch (error) {
      this.logger.error('Failed to start span', error as Error, { name });
      throw new BotError('Failed to start span', 'medium', { name, error });
    }
  }

  /**
   * Starts a new span with a specific kind
   * @param name - Span name
   * @param kind - Span kind (SERVER, CLIENT, PRODUCER, CONSUMER, INTERNAL)
   * @param options - Additional span options
   * @returns The created span
   */
  startSpanWithKind(
    name: string,
    kind: SpanKind,
    options?: SpanOptions
  ): Span {
    return this.startSpan(name, { ...options, kind });
  }

  /**
   * Ends a span
   * @param span - Span to end
   * @param timestamp - Optional end timestamp
   */
  endSpan(span: Span, timestamp?: number): void {
    try {
      span.end(timestamp);
      // Remove from active spans by span context since Span doesn't have name property
      const spanContext = span.spanContext();
      if (spanContext) {
        this.activeSpans.delete(spanContext.spanId);
      }
      this.logger.debug(`Span ended`);
    } catch (error) {
      this.logger.error('Failed to end span', error as Error);
    }
  }

  /**
   * Sets attributes on a span
   * @param span - Span to set attributes on
   * @param attributes - Attributes to set
   */
  setAttributes(span: Span, attributes: Record<string, SpanAttributeValue>): void {
    try {
      span.setAttributes(attributes);
      this.logger.debug(`Attributes set on span`, { attributes });
    } catch (error) {
      this.logger.error('Failed to set span attributes', error as Error, {
        attributes,
      });
    }
  }

  /**
   * Sets a single attribute on a span
   * @param span - Span to set attribute on
   * @param key - Attribute key
   * @param value - Attribute value
   */
  setAttribute(span: Span, key: string, value: SpanAttributeValue): void {
    try {
      span.setAttribute(key, value);
      this.logger.debug(`Attribute set on span`, { key, value });
    } catch (error) {
      this.logger.error('Failed to set span attribute', error as Error, {
        key,
        value,
      });
    }
  }

  /**
   * Adds an event to a span
   * @param span - Span to add event to
   * @param eventData - Event data
   */
  addEvent(span: Span, eventData: SpanEventData): void {
    try {
      span.addEvent(eventData.name, eventData.attributes, eventData.timestamp);
      this.logger.debug(`Event added to span`, { eventData });
    } catch (error) {
      this.logger.error('Failed to add event to span', error as Error, {
        eventData,
      });
    }
  }

  /**
   * Adds multiple events to a span
   * @param span - Span to add events to
   * @param events - Array of event data
   */
  addEvents(span: Span, events: SpanEventData[]): void {
    for (const event of events) {
      this.addEvent(span, event);
    }
  }

  /**
   * Sets status of a span
   * @param span - Span to set status on
   * @param status - Span status
   */
  setStatus(span: Span, status: SpanStatus): void {
    try {
      span.setStatus({
        code: status.code,
        message: status.description,
      });
      this.logger.debug(`Status set on span`, { status });
    } catch (error) {
      this.logger.error('Failed to set span status', error as Error, {
        status,
      });
    }
  }

  /**
   * Records an exception on a span
   * @param span - Span to record exception on
   * @param error - Error to record
   * @param time - Optional timestamp
   */
  recordException(span: Span, error: Error, time?: number): void {
    try {
      span.recordException(error, time);
      this.setStatus(span, {
        code: SpanStatusCode.ERROR,
        description: error.message,
      });
      this.logger.debug(`Exception recorded on span`, {
        error: error.message,
      });
    } catch (err) {
      this.logger.error('Failed to record exception on span', err as Error, {
        error: error.message,
      });
    }
  }

  /**
   * Adds links to a span
   * @param span - Span to add links to
   * @param links - Array of span link data
   */
  addLinks(span: Span, links: SpanLinkData[]): void {
    try {
      // addLinks method doesn't exist in current API, links must be added via span options
      // This is a no-op for now
      this.logger.debug(`Links to add to span`, { count: links.length });
    } catch (error) {
      this.logger.error('Failed to add links to span', error as Error, {
        linkCount: links.length,
      });
    }
  }

  /**
   * Gets current span from context
   * @returns Current span or undefined
   */
  getCurrentSpan(): Span | undefined {
    // Get span from current context - trace.getSpan() takes optional context
    return trace.getSpan(undefined as any);
  }

  /**
   * Gets the active span by name
   * @param name - Span name
   * @returns Active span or undefined
   */
  getActiveSpan(name: string): Span | undefined {
    return this.activeSpans.get(name);
  }

  /**
   * Gets all active spans
   * @returns Map of active spans
   */
  getAllActiveSpans(): Map<string, Span> {
    return new Map(this.activeSpans);
  }

  /**
   * Wraps a function with a span
   * @param name - Span name
   * @param fn - Function to wrap
   * @param options - Span options
   * @returns Wrapped function
   */
  wrapWithSpan<T extends (...args: any[]) => any>(
    name: string,
    fn: T,
    options?: SpanOptions
  ): T {
    return ((...args: any[]) => {
      const span = this.startSpan(name, options);
      try {
        const result = fn(...args);
        if (result instanceof Promise) {
          return result
            .then((value: any) => {
              this.endSpan(span);
              return value;
            })
            .catch((error: Error) => {
              this.recordException(span, error);
              this.endSpan(span);
              throw error;
            });
        }
        this.endSpan(span);
        return result;
      } catch (error) {
        this.recordException(span, error as Error);
        this.endSpan(span);
        throw error;
      }
    }) as T;
  }

  /**
   * Wraps an async function with a span
   * @param name - Span name
   * @param fn - Async function to wrap
   * @param options - Span options
   * @returns Wrapped async function
   */
  wrapAsyncWithSpan<T extends (...args: any[]) => Promise<any>>(
    name: string,
    fn: T,
    options?: SpanOptions
  ): T {
    return (async (...args: any[]) => {
      const span = this.startSpan(name, options);
      try {
        const result = await fn(...args);
        this.endSpan(span);
        return result;
      } catch (error) {
        this.recordException(span, error as Error);
        this.endSpan(span);
        throw error;
      }
    }) as T;
  }

  /**
   * Creates a child span from current context
   * @param name - Child span name
   * @param options - Span options
   * @returns Child span
   */
  startChildSpan(name: string, options?: SpanOptions): Span {
    return this.tracer.startSpan(name, {
      ...options,
    });
  }

  /**
   * Shuts down tracer provider
   * @returns Promise that resolves when shutdown is complete
   */
  async shutdown(): Promise<void> {
    try {
      await this.provider.shutdown();
      this.activeSpans.clear();
      this.logger.info('Tracer shutdown complete');
    } catch (error) {
      this.logger.error('Failed to shutdown tracer', error as Error);
      throw new BotError('Failed to shutdown tracer', 'high', { error });
    }
  }

  /**
   * Force flushes all pending spans
   * @returns Promise that resolves when flush is complete
   */
  async forceFlush(): Promise<void> {
    try {
      await this.provider.forceFlush();
      this.logger.debug('Tracer flushed');
    } catch (error) {
      this.logger.error('Failed to flush tracer', error as Error);
      throw new BotError('Failed to flush tracer', 'medium', { error });
    }
  }

  /**
   * Gets tracer configuration
   * @returns Tracer configuration
   */
  getConfig(): TracerConfig {
    return { ...this.config };
  }

  /**
   * Gets number of active spans
   * @returns Number of active spans
   */
  getActiveSpanCount(): number {
    return this.activeSpans.size;
  }
}
