export class BotError extends Error {
  constructor(
    message: string,
    code: string = 'BOT_ERROR',
    details?: any
  ) {
    super(message);
    this.message = message;
    this.code = code;
    this.details = details;
  }
}

export class ConfigurationError extends BotError {
  constructor(message: string, details?: any) {
    super(message, 'CONFIG_ERROR', details);
  }
}

export class SecurityError extends BotError {
  constructor(message: string, details?: any) {
    super(message, 'SECURITY_ERROR', details);
  }
}

export class ValidationError extends BotError {
  constructor(message: string, details?: any) {
    super(message, 'VALIDATION_ERROR', details);
  }
}

export class ToolExecutionError extends BotError {
  constructor(message: string, details?: any) {
    super(message, 'TOOL_EXECUTION_ERROR', details);
  }
}

export class SelfModificationError extends BotError {
  constructor(message: string, details?: any) {
    super(message, 'SELF_MODIFICATION_ERROR', details);
  }
}