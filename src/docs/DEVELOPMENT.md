# Development Setup Guide

This guide will help you set up a complete development environment for the self-editing Discord bot.

## Prerequisites

### System Requirements

- **Node.js**: Version 18.0.0 or higher
- **npm**: Version 8.0.0 or higher
- **Docker**: Version 20.0.0 or higher
- **Docker Compose**: Version 2.0.0 or higher
- **Git**: Version 2.30.0 or higher
- **PostgreSQL**: Version 15.0 or higher (for local development)
- **Redis**: Version 7.0 or higher (for local development)

### Development Tools

- **IDE**: Visual Studio Code (recommended) with these extensions:
  - TypeScript and JavaScript Language Features
  - ESLint
  - Prettier
  - Docker
  - GitLens
  - Thunder Client (for GraphQL)

- **API Client**: Postman or Insomnia for API testing
- **Database Client**: pgAdmin, DBeaver, or TablePlus

## Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/your-org/self-editing-discord-bot.git
cd self-editing-discord-bot
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Configuration

Copy the example environment file and configure your settings:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```bash
# Discord Configuration
DISCORD_TOKEN=your_discord_bot_token
DISCORD_CLIENT_ID=your_discord_client_id
DISCORD_GUILD_ID=your_test_guild_id

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_USER=botuser
DB_PASSWORD=botpass
DB_NAME=discord_bot_dev

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=redispass

# AI Service Configuration
OPENAI_API_KEY=your_openai_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key

# Storage Configuration
S3_BUCKET=your_s3_bucket
S3_REGION=your_s3_region
S3_ACCESS_KEY_ID=your_s3_access_key
S3_SECRET_ACCESS_KEY=your_s3_secret_key

# Development Configuration
NODE_ENV=development
LOG_LEVEL=debug
```

### 4. Start Development Environment

#### Option A: Docker Development (Recommended)

```bash
# Start all services with Docker Compose
npm run docker:dev

# Or manually
docker-compose -f docker/docker-compose.dev.yml up --build
```

This will start:
- The bot application with hot-reloading
- PostgreSQL database
- Redis cache
- Adminer (database admin UI) at http://localhost:8081
- Redis Commander (Redis admin UI) at http://localhost:8082

#### Option B: Local Development

```bash
# Start local services
npm run dev

# Or with specific configuration
npm run dev -- --env development --log-level debug
```

### 5. Verify Setup

1. **Check Application Health**:
   ```bash
   curl http://localhost:8080/health
   ```

2. **Check Database Connection**:
   ```bash
   npm run db:check
   ```

3. **Check Redis Connection**:
   ```bash
   npm run redis:check
   ```

## Development Workflow

### Daily Development

1. **Create a Feature Branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make Changes**:
   - Write TypeScript code in `src/`
   - Follow the established patterns and conventions
   - Add tests for new functionality

3. **Run Tests**:
   ```bash
   # Run all tests
   npm run test
   
   # Run specific test types
   npm run test:unit
   npm run test:integration
   npm run test:e2e
   ```

4. **Code Quality Checks**:
   ```bash
   # Lint code
   npm run lint
   
   # Format code
   npm run format
   
   # Type check
   npm run type-check
   ```

5. **Commit Changes**:
   ```bash
   git add .
   git commit -m "feat: add your feature description"
   ```

6. **Push and Create PR**:
   ```bash
   git push origin feature/your-feature-name
   # Create pull request on GitHub
   ```

### Testing Strategy

#### Unit Tests
- Location: `src/**/__tests__/*.test.ts`
- Run with: `npm run test:unit`
- Coverage requirement: 80% minimum

#### Integration Tests
- Location: `src/tests/integration/*.test.ts`
- Run with: `npm run test:integration`
- Test database and external service interactions

#### End-to-End Tests
- Location: `src/tests/e2e/*.test.ts`
- Run with: `npm run test:e2e`
- Test complete user workflows

#### Performance Tests
- Location: `tests/performance/*.js`
- Run with: `npm run test:performance`
- Load testing with k6

## Database Management

### Migrations

```bash
# Run pending migrations
npm run migrate -- --direction up

# Rollback migration
npm run migrate -- --direction down --version 1.0.0

# Check migration status
npm run migrate -- --direction status
```

### Database Seeding

```bash
# Seed development data
npm run db:seed

# Reset database
npm run db:reset
```

## Debugging

### VS Code Debugging

1. Install the recommended VS Code extensions
2. Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug Bot",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/src/index.ts",
      "outFiles": ["${workspaceFolder}/dist/**/*.js"],
      "runtimeArgs": ["-r", "ts-node/register"],
      "env": {
        "NODE_ENV": "development"
      },
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen"
    }
  ]
}
```

### Docker Debugging

```bash
# Attach to running container
docker exec -it discord-bot-dev /bin/sh

# View logs
docker-compose -f docker/docker-compose.dev.yml logs -f app

# Debug with Node.js inspector
docker-compose -f docker/docker-compose.dev.yml run --rm --service-ports app node --inspect=0.0.0.0:9229 dist/index.js
```

### Logging

Configure logging levels in `.env`:

```bash
LOG_LEVEL=debug    # Most verbose
LOG_LEVEL=info     # Normal operation
LOG_LEVEL=warn     # Warnings only
LOG_LEVEL=error    # Errors only
```

## Code Organization

### Project Structure

```
src/
├── ai/                    # AI and machine learning components
├── core/                   # Core bot functionality
│   ├── bot.ts            # Main bot class
│   ├── commands/          # Command handling
│   ├── events/            # Event handling
│   ├── health/            # Health checks
│   └── lifecycle/         # Lifecycle management
├── config/                 # Configuration management
├── self-editing/           # Self-editing capabilities
├── storage/                # Data storage
├── utils/                  # Utility functions
├── types/                  # TypeScript type definitions
├── scripts/                # Build and deployment scripts
├── tests/                  # Test setup and utilities
└── docs/                   # Documentation
```

### Coding Standards

1. **TypeScript**: Use strict TypeScript with proper typing
2. **ESLint**: Follow the configured linting rules
3. **Prettier**: Use the configured formatting
4. **Naming**: Use descriptive names following conventions
5. **Comments**: Document complex logic and public APIs
6. **Error Handling**: Use proper error handling patterns

## Common Issues & Solutions

### Port Conflicts

If ports are already in use:

```bash
# Find what's using the port
lsof -i :8080

# Kill the process
kill -9 <PID>

# Or use different ports in docker-compose.dev.yml
```

### Docker Issues

```bash
# Clean up Docker resources
docker system prune -f

# Rebuild containers
docker-compose -f docker/docker-compose.dev.yml up --build --force-recreate
```

### Database Connection Issues

```bash
# Check PostgreSQL status
docker-compose -f docker/docker-compose.dev.yml ps postgres

# View database logs
docker-compose -f docker/docker-compose.dev.yml logs postgres

# Reset database
docker-compose -f docker/docker-compose.dev.yml down -v
docker-compose -f docker/docker-compose.dev.yml up -d postgres
```

### Node Modules Issues

```bash
# Clean node modules
rm -rf node_modules package-lock.json

# Reinstall
npm install
```

## Performance Tips

### Development Performance

1. **Use Hot Reloading**: Enabled by default in development
2. **Enable Source Maps**: For better debugging
3. **Use SSD**: For better I/O performance
4. **Allocate Enough Memory**: At least 4GB RAM recommended

### Build Performance

```bash
# Use build cache
npm run build -- --cached

# Parallel builds
npm run build -- --parallel

# Incremental builds
npm run build -- --incremental
```

## Contributing

### Before Contributing

1. Read the [Contributing Guide](CONTRIBUTING.md)
2. Check existing issues and pull requests
3. Discuss significant changes in an issue first

### Pull Request Process

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Ensure all tests pass
6. Update documentation
7. Submit a pull request

### Code Review

All pull requests require:
- At least one approval
- Passing tests
- No linting errors
- Documentation updates for new features

## Getting Help

### Resources

- **Documentation**: [src/docs/](./)
- **API Reference**: [API.md](./API.md)
- **Architecture**: [ARCHITECTURE.md](./ARCHITECTURE.md)
- **Issues**: [GitHub Issues](https://github.com/your-org/self-editing-discord-bot/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-org/self-editing-discord-bot/discussions)

### Troubleshooting

If you encounter issues:

1. Check the [Troubleshooting Guide](./TROUBLESHOOTING.md)
2. Search existing issues
3. Create a new issue with:
   - Detailed description
   - Steps to reproduce
   - Environment details
   - Error logs
   - Expected vs actual behavior

## Advanced Features

This section documents the advanced features implemented in the bot.

### Code Modification Engine

The Code Modification Engine ([`code-modification-engine.ts`](../self-editing/modification/code-modification-engine.ts:1)) provides sophisticated autonomous code analysis and modification capabilities.

#### Overview

The engine enables the bot to:
- Analyze code using Abstract Syntax Tree (AST) parsing
- Apply targeted code modifications with precise line-level control
- Validate changes through comprehensive testing and verification
- Maintain complete modification history with rollback capabilities
- Support multiple modification types: ADD, MODIFY, DELETE, REFACTOR, OPTIMIZE, ENHANCE, FIX

#### Usage Example

```typescript
import { CodeModificationEngine } from './self-editing/modification/code-modification-engine';
import { Logger } from './utils/logger';

const logger = new Logger('CodeModification');
const engine = new CodeModificationEngine(logger);

// Define code changes
const changes = [
  {
    id: 'change_1',
    type: ModificationType.MODIFY,
    file: 'src/example.ts',
    location: {
        file: 'src/example.ts',
        line: 42,
        function: 'processData',
        class: 'DataProcessor'
    },
    originalCode: 'const result = data.map(x => x * 2);',
    newCode: 'const result = data.map(x => x * 2).filter(x => x > 0);',
    description: 'Add filter to ensure positive values'
  }
];

// Apply modification with validation
const modificationId = await engine.applyModification(changes, {
    dryRun: false,
    skipValidation: false,
    skipBackup: false,
    priority: 'high'
});

console.log(`Modification ${modificationId} completed successfully`);

// Get modification history
const history = engine.getModificationHistory(10);
console.log('Recent modifications:', history);

// Get statistics
const stats = engine.getModificationStatistics();
console.log('Modification stats:', stats);
```

#### Configuration Options

- **dryRun**: Preview changes without applying them (default: `false`)
- **skipValidation**: Skip validation checks (not recommended) (default: `false`)
- **skipBackup**: Skip creating backups (not recommended) (default: `false`)
- **force**: Force modification even if validation fails (default: `false`)
- **priority**: Modification priority level: `'low' | 'medium' | 'high' | 'critical'` (default: `'medium'`)

#### Modification Workflow

1. **Pre-modification Validation**: Static analysis and security scanning
2. **Backup Creation**: Automatic backup of files before modification
3. **Change Application**: Apply changes with line-level precision
4. **Post-modification Validation**: TypeScript compilation and verification
5. **Test Execution**: Run relevant Jest tests
6. **Verification**: Confirm changes applied correctly
7. **Rollback**: Automatic rollback on failure

#### Troubleshooting

**Issue**: Modification fails validation
- **Solution**: Check code syntax, ensure originalCode matches exactly, verify file path is correct

**Issue**: Tests fail after modification
- **Solution**: Review test files, ensure new code logic is correct, check for missing dependencies

**Issue**: Rollback fails
- **Solution**: Verify backup files exist in `.backups` directory, check file permissions

**Issue**: TypeScript compilation errors
- **Solution**: Run `npx tsc --noEmit` to identify type errors, ensure imports are correct

---

### Vector Database Integration

The Vector Database Integration ([`vectorDatabase.ts`](../storage/vector/vectorDatabase.ts:1)) provides semantic search and embedding storage capabilities.

#### Overview

Supports multiple vector database providers:
- **Qdrant** (fully implemented)
- **Pinecone** (placeholder)
- **Weaviate** (placeholder)
- **Chroma** (placeholder)
- **Milvus** (placeholder)

Features include:
- Semantic search with configurable distance metrics (cosine, euclidean, dotproduct)
- Batch embedding generation with OpenAI models
- Message embedding and storage for Discord messages
- Hybrid search combining vector and keyword matching
- Automatic caching for embeddings to reduce API calls

#### Usage Example

```typescript
import { createVectorDatabaseClient } from './storage/vector';
import { AdvancedBotConfig } from './config/advancedConfig';

const config: AdvancedBotConfig = {
    // ... other config
    storage: {
        vectorDatabase: {
            provider: 'qdrant',
            apiKey: process.env.QDRANT_API_KEY,
            cloud: {
                endpoint: process.env.QDRANT_ENDPOINT || 'http://localhost:6333'
            },
            dimension: 1536,
            metric: 'cosine'
        }
    }
};

const vectorDb = createVectorDatabaseClient(config, process.env.OPENAI_API_KEY);

// Connect to database
await vectorDb.connect();

// Create collection
await vectorDb.createCollection('messages', 1536);

// Embed and store a Discord message
await vectorDb.embedMessage('messages', {
    messageId: 'msg_123456',
    channelId: 'channel_789',
    guildId: 'guild_123',
    authorId: 'user_456',
    authorName: 'User123',
    content: 'This is a sample message',
    timestamp: new Date()
});

// Semantic search
const query = 'Find messages about AI';
const results = await vectorDb.searchMessages('messages', query, 10);

console.log('Search results:', results);

// Hybrid search
const hybridResults = await vectorDb.hybridSearch(
    'messages',
    'AI and machine learning',
    10,
    { channel: 'channel_789' },
    0.7,  // vector weight
    0.3   // keyword weight
);

console.log('Hybrid search results:', hybridResults);

// Disconnect
await vectorDb.disconnect();
```

#### Configuration Options

**VectorDatabaseConfig**:
- **provider**: `'qdrant' | 'pinecone' | 'weaviate' | 'chroma' | 'milvus'` (required)
- **apiKey**: API key for the provider (optional for local instances)
- **environment**: Environment identifier (e.g., 'production', 'development')
- **indexName**: Name of the index/collection (default: auto-generated)
- **dimension**: Vector dimension (default: 1536 for OpenAI embeddings)
- **metric**: Distance metric: `'cosine' | 'euclidean' | 'dotproduct'` (default: `'cosine'`)
- **cloud**: Cloud configuration with `region` and `endpoint`

**SearchFilter**:
- **channel**: Filter by channel ID(s)
- **author**: Filter by author ID(s)
- **startDate**: Filter messages after this date
- **endDate**: Filter messages before this date

#### Supported Embedding Models

- `text-embedding-3-small`: 1536 dimensions
- `text-embedding-3-large`: 3072 dimensions
- `text-embedding-ada-002`: 1536 dimensions

#### Troubleshooting

**Issue**: Connection fails to vector database
- **Solution**: Verify endpoint URL, check API key, ensure database is running, check network connectivity

**Issue**: Embedding generation fails
- **Solution**: Verify OpenAI API key, check API quota, ensure model name is correct

**Issue**: Search returns no results
- **Solution**: Check collection exists, verify data was inserted, try different query terms, check filter conditions

**Issue**: High API costs
- **Solution**: Enable embedding caching, use batch operations, monitor cache hit rate with `getEmbeddingCacheSize()`

---

### Safety Validation Pipeline

The Safety Validation Pipeline ([`validation-pipeline.ts`](../self-editing/safety/validation-pipeline.ts:1)) orchestrates comprehensive safety checks for self-editing operations.

#### Overview

Multi-stage validation system including:
- **Static Analysis**: Code security scanning and quality metrics
- **Security Scanning**: Vulnerability detection (SQL injection, XSS, command injection, etc.)
- **Code Quality Analysis**: Cyclomatic complexity, maintainability index, technical debt
- **Dependency Validation**: Version compatibility and vulnerability scanning
- **Impact Analysis**: Pre and post-modification impact assessment
- **Behavioral Monitoring**: Runtime behavior consistency checks

#### Usage Example

```typescript
import { ValidationPipeline } from './self-editing/safety/validation-pipeline';
import { SafetyAnalyzer } from './ai/safety/safety-analyzer';
import { SafetyValidator } from './self-editing/safety/safety-validator';
import { ImpactAnalyzer } from './self-editing/safety/impact-analyzer';
import { Logger } from './utils/logger';

const logger = new Logger('ValidationPipeline');

// Initialize components
const safetyAnalyzer = new SafetyAnalyzer({
    enabledChecks: ['toxicity', 'personal_info', 'violence', 'security'],
    strictMode: true,
    maxConcurrentAnalyses: 10,
    enableCodeSecurityAnalysis: true,
    maxCyclomaticComplexity: 15,
    minMaintainabilityIndex: 50,
    enableSecretDetection: true,
    enableDependencyScanning: true,
    securityThresholds: {
        critical: 25,
        high: 15,
        medium: 8
    }
}, logger);

const safetyValidator = new SafetyValidator({
    strictMode: true,
    requireHumanReviewForCritical: true,
    maxModificationsPerHour: 10,
    maxModificationsPerDay: 50,
    enableBehavioralMonitoring: true,
    enablePerformanceMonitoring: true
}, logger);

const impactAnalyzer = new ImpactAnalyzer({
    enablePerformanceImpact: true,
    enableBehavioralImpact: true,
    enableSecurityImpact: true,
    enableDataIntegrityImpact: true,
    performanceThresholds: {
        responseTime: { warning: 200, critical: 500 },
        throughput: { warning: 0.9, critical: 0.7 },
        errorRate: { warning: 0.05, critical: 0.1 }
    }
}, logger);

const validationPipeline = new ValidationPipeline(
    safetyAnalyzer,
    safetyValidator,
    impactAnalyzer,
    {
        safetyAnalyzer: safetyAnalyzer.config,
        safetyValidator: safetyValidator.config,
        impactAnalyzer: impactAnalyzer.config,
        enableParallelExecution: true,
        maxConcurrentValidations: 5,
        timeoutPerStage: 30000, // 30 seconds
        autoApproveSafeChanges: false,
        requireHumanReviewForCritical: true,
        approvalWorkflow: 'semi-automatic',
        approvalThresholds: {
            maxViolations: 0,
            maxWarnings: 5,
            maxCriticalIssues: 0
        }
    },
    logger
);

// Validate a modification
const modification: ModificationContext = {
    id: 'mod_123',
    filePath: 'src/example.ts',
    code: 'const result = data.map(x => x * 2);',
    newCode: 'const result = data.map(x => x * 2).filter(x => x > 0);',
    language: 'typescript',
    dependencies: [
        { name: 'lodash', version: '^4.17.0' }
    ]
};

const report = await validationPipeline.validateModification(modification);

console.log('Validation report:', report);
console.log('Overall passed:', report.overallPassed);
console.log('Can proceed:', report.canProceed);
console.log('Requires human review:', report.requiresHumanReview);
console.log('Recommended action:', report.recommendedAction);

// Get validation history
const history = validationPipeline.getValidationHistory('mod_123');
console.log('Validation history:', history);
```

#### Configuration Options

**SafetyAnalyzerConfig**:
- **enabledChecks**: Array of safety check types to enable
- **strictMode**: Enable strict validation mode (default: `false`)
- **blockThreshold**: Safety level threshold for blocking
- **maxConcurrentAnalyses**: Maximum concurrent safety analyses (default: `10`)
- **enableCodeSecurityAnalysis**: Enable static code security analysis (default: `true`)
- **maxCyclomaticComplexity**: Maximum allowed complexity (default: `15`)
- **minMaintainabilityIndex**: Minimum maintainability score (default: `50`)
- **enableSecretDetection**: Detect hardcoded secrets (default: `true`)
- **enableDependencyScanning**: Scan dependencies for vulnerabilities (default: `true`)
- **securityThresholds**: Score thresholds for security issues

**ValidationPipelineConfig**:
- **enableParallelExecution**: Run stages in parallel (default: `true`)
- **maxConcurrentValidations**: Maximum parallel validations (default: `5`)
- **timeoutPerStage**: Timeout per stage in milliseconds (default: `30000`)
- **autoApproveSafeChanges**: Auto-approve safe changes (default: `false`)
- **requireHumanReviewForCritical**: Require human review for critical (default: `true`)
- **approvalWorkflow**: `'automatic' | 'semi-automatic' | 'manual'` (default: `'semi-automatic'`)
- **approvalThresholds**: Limits for violations, warnings, and critical issues

#### Validation Stages

1. **Static Analysis**: Security vulnerability scanning
2. **Security Scanning**: Code security checks
3. **Code Quality**: Complexity and maintainability analysis
4. **Dependency Validation**: Version compatibility checks
5. **Impact Analysis**: Pre-modification impact assessment
6. **Dynamic Analysis**: Post-modification runtime validation
7. **Behavioral Consistency**: Behavior monitoring and comparison

#### Troubleshooting

**Issue**: Validation fails with no clear reason
- **Solution**: Enable debug logging, check validation logs, verify configuration is correct

**Issue**: False positives in security scanning
- **Solution**: Adjust security thresholds, add exceptions for known safe patterns, review security rules

**Issue**: Validation timeout
- **Solution**: Increase `timeoutPerStage`, optimize code complexity, reduce concurrent validations

**Issue**: Too many human reviews required
- **Solution**: Adjust `approvalWorkflow` to `'automatic'`, tune `approvalThresholds`, improve code quality

---

### Tool Execution Framework

The Tool Execution Framework ([`discord-tools.ts`](../tools/discord-tools.ts:1)) provides an extensible system for executing Discord-specific operations.

#### Overview

Comprehensive Discord tool library including:
- **Role Management**: Create, update, delete, assign, and remove roles
- **Channel Management**: Create, update, delete channels, get channel info
- **User Management**: Kick, ban, timeout users, get user info
- **Message Management**: Send, edit, delete, pin/unpin messages
- **Server Management**: Get server info, members, and channels
- **Webhook Management**: Create, update, delete, and execute webhooks

Each tool includes:
- Parameter validation with type checking
- Safety level classification (safe, restricted, dangerous)
- Permission requirements
- Rate limiting
- Usage examples

#### Usage Example

```typescript
import { DiscordToolExecutor, discordTools } from './tools/discord-tools';
import { Logger } from './utils/logger';

const logger = new Logger('DiscordTools');
const executor = new DiscordToolExecutor(logger);

// Set Discord client (injected from main bot)
executor.setClient(discordClient);

// List available tools
console.log('Available tools:', discordTools.map(t => t.name));

// Execute a tool
const result = await executor.execute('create_role', {
    guild_id: '123456789012345678',
    name: 'Moderator',
    description: 'Server moderation team',
    color: '#00FF00',
    permissions: ['KICK_MEMBERS', 'BAN_MEMBERS', 'MANAGE_MESSAGES'],
    hoist: true,
    mentionable: true
});

console.log('Tool execution result:', result);

// Execute multiple tools
const results = await Promise.all([
    executor.execute('assign_role', {
        guild_id: '123456789012345678',
        user_id: '987654321098765432',
        role_id: '111222333444555666',
        reason: 'User reached VIP status'
    }),
    executor.execute('send_message', {
        channel_id: '123456789012345678',
        content: 'Welcome to the server!',
        embed: {
            title: 'Welcome',
            color: '#00FF00',
            description: 'Please read our community guidelines.'
        }
    })
]);

console.log('Batch execution results:', results);
```

#### Tool Categories

**Role Management**:
- `create_role`: Create new role with permissions
- `update_role`: Update existing role
- `delete_role`: Delete a role
- `assign_role`: Assign role to user
- `remove_role`: Remove role from user

**Channel Management**:
- `create_channel`: Create text/voice/category channel
- `update_channel`: Update channel settings
- `delete_channel`: Delete a channel
- `get_channel_info`: Get channel information

**User Management**:
- `kick_user`: Kick user from server
- `ban_user`: Ban user from server
- `timeout_user`: Timeout user for specified duration
- `remove_timeout`: Remove timeout from user
- `get_user_info`: Get user information

**Message Management**:
- `send_message`: Send message to channel
- `edit_message`: Edit existing message
- `delete_message`: Delete message
- `get_message`: Get message by ID
- `pin_message`: Pin message
- `unpin_message`: Unpin message

**Server Management**:
- `get_server_info`: Get server information
- `get_server_members`: Get server members
- `get_server_channels`: Get server channels

**Webhook Management**:
- `create_webhook`: Create webhook for channel
- `update_webhook`: Update existing webhook
- `delete_webhook`: Delete webhook
- `execute_webhook`: Execute webhook to send message

#### Safety Levels

- **safe**: Read-only operations, no side effects
- **restricted**: Operations requiring permissions, monitored
- **dangerous**: Destructive operations (delete, ban, kick), heavily monitored

#### Rate Limits

Tools include built-in rate limiting (requests per minute):
- Safe operations: 60 requests/minute
- Restricted operations: 10-20 requests/minute
- Dangerous operations: 3-5 requests/minute

#### Troubleshooting

**Issue**: Tool execution fails with permission error
- **Solution**: Verify bot has required permissions, check role hierarchy, ensure bot is in server

**Issue**: Tool returns "Unknown Discord tool"
- **Solution**: Verify tool name is correct, check tool is registered, ensure executor is initialized

**Issue**: Rate limit exceeded
- **Solution**: Reduce request frequency, implement retry logic, check rate limit configuration

**Issue**: Webhook execution fails
- **Solution**: Verify webhook URL is correct, check webhook token, ensure webhook exists

---

### Plugin Loading System

The Plugin Loading System ([`plugin-loader.ts`](../self-editing/plugins/plugin-loader.ts:1)) provides dynamic plugin discovery, loading, validation, and hot-reloading.

#### Overview

Comprehensive plugin system featuring:
- **Dynamic Discovery**: Auto-discover plugins from filesystem
- **Multi-Source Loading**: Load from file, URL, or package
- **Validation**: Manifest validation, security scanning, dependency resolution
- **Version Compatibility**: Semantic version checking and constraint validation
- **Hot-Reloading**: Watch for changes and auto-reload plugins
- **Dependency Resolution**: Topological sort for load order
- **Security Scanning**: Detect dangerous patterns in plugin code
- **Sandboxing**: Isolated plugin execution environment

#### Usage Example

```typescript
import { PluginLoader } from './self-editing/plugins/plugin-loader';
import { Logger } from './utils/logger';

const logger = new Logger('PluginLoader');

// Initialize plugin loader with hot-reload
const pluginLoader = new PluginLoader(
    logger,
    './plugins',  // plugin directory
    {
        enabled: true,
        watchPaths: ['./plugins'],
        debounceMs: 500,
        reloadOnFileChange: true
    }
);

// Discover plugins
const { discovered, failed } = await pluginLoader.discoverPlugins();

console.log(`Discovered ${discovered.length} plugins`);
console.log('Failed discoveries:', failed);

// Load a plugin from file
const loadResult = await pluginLoader.loadFromSource('./plugins/my-plugin', 'file');

if (loadResult.success) {
    console.log('Plugin loaded:', loadResult.plugin);
    console.log('Manifest:', loadResult.plugin.manifest);
} else {
    console.error('Load failed:', loadResult.error);
}

// Validate a plugin
const validation = await pluginLoader.validatePlugin(
    loadResult.plugin.manifest,
    loadResult.plugin.code
);

console.log('Validation result:', validation);
console.log('Valid:', validation.valid);
console.log('Errors:', validation.errors);
console.log('Warnings:', validation.warnings);
console.log('Security issues:', validation.securityIssues);

// Resolve dependencies
const depResult = await pluginLoader.resolveDependencies(loadResult.plugin.manifest);

console.log('Dependencies resolved:', depResult.resolved);
console.log('Missing dependencies:', depResult.missing);
console.log('Conflicts:', depResult.conflicts);
console.log('Resolution order:', depResult.resolutionOrder);

// Enable hot-reload for a plugin
await pluginLoader.enableHotReload('my-plugin-id');

// Reload a plugin
await pluginLoader.reloadPlugin('my-plugin-id');

// Get loaded plugins
const loadedPlugins = pluginLoader.getAllLoadedPlugins();
console.log('Loaded plugins:', loadedPlugins);

// Unload a plugin
await pluginLoader.unloadPlugin('my-plugin-id');

// Cleanup
await pluginLoader.cleanup();
```

#### Plugin Manifest Structure

```json
{
  "id": "my-plugin-id",
  "name": "My Plugin",
  "version": "1.0.0",
  "description": "A sample plugin for demonstration",
  "author": "Plugin Author",
  "main": "index.js",
  "dependencies": [
    {
      "name": "another-plugin",
      "version": "^2.0.0",
      "optional": false
    }
  ],
  "peerDependencies": [
    {
      "name": "core-plugin",
      "version": ">=1.0.0",
      "optional": true
    }
  ],
  "permissions": ["read_messages", "send_messages"],
  "minMegawattsVersion": "1.0.0",
  "maxMegawattsVersion": "2.0.0",
  "keywords": ["plugin", "example"],
  "license": "MIT",
  "homepage": "https://example.com/my-plugin",
  "repository": "https://github.com/example/my-plugin"
}
```

#### Configuration Options

**HotReloadConfig**:
- **enabled**: Enable hot-reloading (default: `false`)
- **watchPaths**: Array of paths to watch (default: `[pluginDirectory]`)
- **debounceMs**: Debounce delay in milliseconds (default: `500`)
- **reloadOnFileChange**: Reload on file change (default: `true`)

#### Security Scanning

The plugin loader scans for dangerous patterns:
- `eval()` usage (critical)
- `Function()` constructor (critical)
- `child_process` usage (high)
- `fs` module usage (medium)
- `net` module usage (medium)
- `http`/`https` module usage (medium)
- `process.env` access (low)
- `__dirname`/`__filename` exposure (low)

#### Troubleshooting

**Issue**: Plugin discovery fails
- **Solution**: Check plugin directory exists, verify `plugin.json` or `package.json` is present, validate manifest structure

**Issue**: Plugin validation fails
- **Solution**: Fix manifest errors, address security issues, ensure version format is valid, resolve dependencies

**Issue**: Dependency resolution fails
- **Solution**: Install missing dependencies, resolve version conflicts, check for circular dependencies

**Issue**: Hot-reload not working
- **Solution**: Verify hot-reload is enabled, check watch paths, ensure file system events are supported

**Issue**: Plugin fails to load
- **Solution**: Verify main file exists, check exports (default or initialize), ensure no syntax errors

**Issue**: Security scan blocks valid plugin
- **Solution**: Review security issues, fix dangerous patterns, add exceptions if needed, adjust security thresholds

---

Happy coding! 🚀