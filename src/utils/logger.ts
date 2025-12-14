export enum LogLevel {
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error'
}

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
  metadata?: Record<string, any>;
}

export class Logger {
  private context: string = 'BOT';

  constructor(context: string = 'BOT') {
    this.context = context;
  }

  private formatMessage(entry: LogEntry): string {
    const timestamp = entry.timestamp.toISOString();
    const metadataStr = entry.metadata ? JSON.stringify(entry.metadata) : '';
    
    return `[${timestamp}] [${entry.level.toUpperCase()}] ${this.context}: ${entry.message}${metadataStr ? ' ' + metadataStr : ''}`;
  }

  info(message: string, metadata?: Record<string, any>): void {
    this.log({
      timestamp: new Date(),
      level: LogLevel.INFO,
      message,
      metadata
    });
  }

  warn(message: string, metadata?: Record<string, any>): void {
    this.log({
      timestamp: new Date(),
      level: LogLevel.WARN,
      message,
      metadata
    });
  }

  error(message: string, error?: Error, metadata?: Record<string, any>): void {
    this.log({
      timestamp: new Date(),
      level: LogLevel.ERROR,
      message,
      metadata: {
        ...metadata,
        error: error?.message,
        stack: error?.stack
      }
    });
  }
}