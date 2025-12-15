export enum StorageErrorCode {
  CONNECTION_FAILED = 'CONNECTION_FAILED',
  DISCONNECTION_FAILED = 'DISCONNECTION_FAILED',
  OPERATION_FAILED = 'OPERATION_FAILED',
  TIMEOUT = 'TIMEOUT',
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  RESOURCE_ALREADY_EXISTS = 'RESOURCE_ALREADY_EXISTS',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
}

export class StorageError extends Error {
  public readonly code: StorageErrorCode;
  public readonly context: Record<string, any> | undefined;
  public readonly timestamp: Date;
  public readonly retryable: boolean;

  constructor(
    code: StorageErrorCode,
    message: string,
    context?: Record<string, any>,
    retryable: boolean = false
  ) {
    super(message);
    this.name = 'StorageError';
    this.code = code;
    this.context = context;
    this.timestamp = new Date();
    this.retryable = retryable;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if ((Error as any).captureStackTrace) {
      (Error as any).captureStackTrace(this, StorageError);
    }
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      context: this.context,
      timestamp: this.timestamp,
      retryable: this.retryable,
      stack: this.stack,
    };
  }
}