# Error Handling System

A comprehensive error handling system for Discord bot operations that provides classification, retry logic, user-friendly messaging, and integration with the self-editing engine.

## Features

- **Error Classification**: Automatically categorizes errors by type, severity, and appropriate action
- **Retry Logic**: Exponential backoff with jitter for retryable operations
- **User-Friendly Messages**: Formatted error messages for Discord users
- **Error Reporting**: Integration with self-editing engine for automated error analysis
- **Metrics Collection**: Comprehensive error tracking and trend analysis
- **Flexible Configuration**: Customizable error handling behavior

## Architecture

```
src/core/errors/
├── types.ts          # Type definitions and interfaces
├── classifier.ts      # Error classification logic
├── retry.ts          # Retry logic with exponential backoff
├── formatter.ts       # User-friendly message formatting
├── reporter.ts        # Error reporting and metrics
├── handler.ts         # Main error handler orchestrator
├── factory.ts         # Factory functions for easy setup
└── index.ts          # Main exports
```

## Usage

### Basic Usage

```typescript
import { createDefaultErrorHandler } from './core/errors';
import { Logger } from './utils/logger';

const logger = new Logger('BOT');
const errorHandler = createDefaultErrorHandler(logger);

// Handle an error with Discord context
const result = await errorHandler.handleError(
  new Error('Something went wrong'),
  {
    userId: '123456789',
    guildId: '987654321',
    channelId: '555555555',
    command: 'help'
  }
);

if (result.userMessage) {
  // Send user-friendly message to Discord
  await channel.send(result.userMessage);
}
```

### Execute with Automatic Error Handling

```typescript
const result = await errorHandler.executeWithErrorHandling(
  async () => {
    // Your operation here
    await someDiscordOperation();
  },
  {
    userId: '123456789',
    guildId: '987654321',
    command: 'help'
  }
);

if (!result.success) {
  console.error('Operation failed:', result.error);
} else {
  console.log('Operation succeeded:', result.result);
}
```

### Execute with Retry Logic

```typescript
const result = await errorHandler.executeWithRetryAndHandling(
  async () => {
    // Operation that might need retrying
    await fetchExternalAPI();
  },
  {
    userId: '123456789',
    guildId: '987654321',
    command: 'fetch'
  },
  { maxAttempts: 5, baseDelay: 2000 }
);
```

### Custom Configuration

```typescript
import { createErrorHandlerWithOptions } from './core/errors';

const customErrorHandler = createErrorHandlerWithOptions(
  {
    enableRetry: true,
    enableReporting: true,
    enableUserNotification: true,
    reportingThreshold: 'medium',
    maxRetries: 5,
    baseDelay: 1000,
    maxDelay: 30000
  },
  logger,
  selfEditingEngine
);
```

## Error Categories

The system classifies errors into these categories:

- **DISCORD_API**: Discord API related errors
- **RATE_LIMIT**: Rate limiting errors
- **PERMISSION**: Permission related errors
- **NETWORK**: Network connectivity issues
- **CONNECTION**: Connection problems
- **TIMEOUT**: Operation timeouts
- **COMMAND**: Command execution errors
- **INTERACTION**: Interaction handling errors
- **MESSAGE**: Message processing errors
- **SYSTEM**: System-level errors
- **MEMORY**: Memory related errors
- **CPU**: CPU usage errors
- **AI_SERVICE**: AI service errors
- **DATABASE**: Database errors
- **STORAGE**: Storage errors
- **CONFIGURATION**: Configuration errors
- **VALIDATION**: Input validation errors
- **SELF_EDITING**: Self-editing system errors
- **ADAPTATION**: Behavior adaptation errors
- **UNKNOWN**: Unclassified errors

## Error Severity Levels

- **LOW**: Minor issues that don't affect functionality
- **MEDIUM**: Issues that may impact user experience
- **HIGH**: Serious issues affecting core functionality
- **CRITICAL**: Critical errors requiring immediate attention

## Error Actions

Based on classification, the system takes these actions:

- **RETRY**: Attempt operation again with exponential backoff
- **ESCALATE**: Report to development team
- **IGNORE**: Log error but don't take action
- **RESTART**: Restart the bot (for critical errors)
- **NOTIFY_USER**: Send user-friendly message
- **LOG_ONLY**: Just log the error

## Integration with Self-Editing Engine

The error reporting system integrates with the self-editing engine to:

- Analyze error patterns
- Generate improvement suggestions
- Trigger automated adaptations
- Monitor error trends
- Provide actionable insights

## Metrics and Monitoring

The system provides comprehensive metrics:

- Error counts by category and severity
- Retry success rates
- Average resolution times
- Error trends over time
- Resolution rate statistics
- Escalation tracking

## Configuration Options

```typescript
interface ErrorHandlerConfig {
  enableRetry: boolean;              // Enable retry logic
  enableReporting: boolean;           // Enable error reporting
  enableUserNotification: boolean;    // Enable user notifications
  defaultRetryConfig: RetryConfig;   // Default retry configuration
  classificationRules: ClassificationRule[]; // Custom classification rules
  reportingThreshold: ErrorSeverity;   // Minimum severity for reporting
}
```

## Best Practices

1. **Always provide Discord context** when handling errors for better classification
2. **Use executeWithErrorHandling** for automatic error handling
3. **Configure appropriate retry limits** based on operation type
4. **Monitor error metrics** to identify patterns
5. **Customize classification rules** for your specific use cases
6. **Enable user notifications** for better user experience
7. **Integrate with self-editing** for automated improvements

## Examples

### Handling Discord API Errors

```typescript
try {
  await discordApiRequest();
} catch (error) {
  const result = await errorHandler.handleError(error, {
    userId: interaction.user.id,
    guildId: interaction.guildId,
    command: interaction.commandName
  });
  
  if (result.userMessage) {
    await interaction.reply(result.userMessage);
  }
}
```

### Custom Error Classification

```typescript
const customRules = [
  {
    category: ErrorCategory.CUSTOM_API,
    patterns: [/custom_api_error/i],
    severity: ErrorSeverity.HIGH,
    action: ErrorAction.RETRY,
    isRetryable: true,
    retryConfig: { maxAttempts: 2, baseDelay: 5000 },
    userMessage: 'Custom API is temporarily unavailable.'
  }
];

const customHandler = createCustomErrorHandler(
  { ...defaultConfig, classificationRules: customRules },
  logger
);
```

This error handling system provides a robust foundation for managing errors in Discord bot operations with comprehensive features for classification, retry logic, user communication, and self-improvement integration.