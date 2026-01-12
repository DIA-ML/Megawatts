/**
 * Self-Editing Tool Integration Module
 *
 * This module integrates self-editing capabilities with the tool calling system,
 * enabling the AI to access self-editing operations through tools.
 */

import { ToolRegistry, ToolRegistryConfig } from '../tools/tool-registry';
import { ToolExecutor, ExecutionContext } from '../tools/tool-executor';
import { ToolSandbox } from '../tools/tool-sandbox';
import { SelfEditingIntegration, SelfEditingConfig } from './self-editing-integration';
import { SelfEditingToolAdapter, SelfEditingToolAdapterConfig } from '../../tools/self-editing-tool-adapter';
import { selfEditingTools, isSelfEditingTool } from '../../tools/self-editing-tools';
import { Logger } from '../../utils/logger';
import { BotError } from '../../utils/errors';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface SelfEditingToolIntegrationConfig {
  enabled: boolean;
  autoRegisterTools: boolean;
  adapterConfig: SelfEditingToolAdapterConfig;
  selfEditingConfig: SelfEditingConfig;
}

// ============================================================================
// SELF-EDITING TOOL INTEGRATION CLASS
// ============================================================================

export class SelfEditingToolIntegration {
  private toolRegistry: ToolRegistry;
  private toolExecutor: ToolExecutor;
  private selfEditingIntegration: SelfEditingIntegration;
  private selfEditingAdapter: SelfEditingToolAdapter;
  private logger: Logger;
  private config: SelfEditingToolIntegrationConfig;
  private initialized = false;

  constructor(
    toolRegistry: ToolRegistry,
    toolExecutor: ToolExecutor,
    config: SelfEditingToolIntegrationConfig,
    logger: Logger
  ) {
    this.toolRegistry = toolRegistry;
    this.toolExecutor = toolExecutor;
    this.config = config;
    this.logger = logger;

    // Initialize self-editing integration
    this.selfEditingIntegration = new SelfEditingIntegration(
      config.selfEditingConfig,
      logger
    );

    // Initialize self-editing tool adapter
    this.selfEditingAdapter = new SelfEditingToolAdapter(
      toolRegistry,
      this.selfEditingIntegration,
      config.adapterConfig,
      logger
    );

    this.logger.info('Self-editing tool integration created', {
      enabled: config.enabled,
      autoRegisterTools: config.autoRegisterTools
    });
  }

  /**
   * Initialize the self-editing tool integration
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      this.logger.warn('Self-editing tool integration already initialized');
      return;
    }

    if (!this.config.enabled) {
      this.logger.info('Self-editing tool integration is disabled');
      return;
    }

    try {
      this.logger.info('Initializing self-editing tool integration...');

      // Register self-editing tools if auto-registration is enabled
      if (this.config.autoRegisterTools) {
        await this.registerSelfEditingTools();
      }

      // Hook into tool executor for self-editing tools
      this.hookToolExecutor();

      this.initialized = true;

      this.logger.info('Self-editing tool integration initialized successfully', {
        toolsRegistered: selfEditingTools.length,
        features: {
          codeModification: this.config.adapterConfig.enableCodeModification,
          codeAnalysis: this.config.adapterConfig.enableCodeAnalysis,
          validation: this.config.adapterConfig.enableValidation,
          testing: this.config.adapterConfig.enableTesting,
          suggestions: this.config.adapterConfig.enableSuggestions
        }
      });

    } catch (error) {
      this.logger.error('Failed to initialize self-editing tool integration', error as Error);
      throw error;
    }
  }

  /**
   * Register all self-editing tools with the tool registry
   */
  private async registerSelfEditingTools(): Promise<void> {
    this.logger.info('Registering self-editing tools...');

    let registered = 0;
    let failed = 0;

    for (const tool of selfEditingTools) {
      try {
        // Check if tool is enabled in adapter config
        if (!this.selfEditingAdapter.isToolEnabled(tool.name)) {
          this.logger.debug('Skipping disabled self-editing tool', { toolName: tool.name });
          continue;
        }

        // Register the tool
        this.toolRegistry.registerTool(tool);
        registered++;

        this.logger.debug('Registered self-editing tool', {
          toolName: tool.name,
          category: tool.category,
          safetyLevel: tool.safety.level
        });

      } catch (error) {
        failed++;
        this.logger.error('Failed to register self-editing tool', error as Error, {
          toolName: tool.name
        });
      }
    }

    this.logger.info('Self-editing tool registration completed', {
      total: selfEditingTools.length,
      registered,
      failed,
      skipped: selfEditingTools.length - registered - failed
    });
  }

  /**
   * Hook the tool executor to route self-editing tools through the adapter
   */
  private hookToolExecutor(): void {
    // Store the original executeToolDirect method
    const originalExecuteToolDirect = (this.toolExecutor as any).executeToolDirect.bind(this.toolExecutor);

    // Override executeToolDirect to intercept self-editing tool calls
    (this.toolExecutor as any).executeToolDirect = async (
      toolCall: any,
      context: ExecutionContext,
      tool: any
    ): Promise<any> => {
      // Check if this is a self-editing tool
      if (isSelfEditingTool(tool.name)) {
        this.logger.debug('Routing self-editing tool through adapter', {
          toolName: tool.name,
          userId: context.userId
        });

        // Route through self-editing adapter
        const result = await this.selfEditingAdapter.executeTool(
          tool.name,
          toolCall.arguments,
          context
        );

        // Return the result in the expected format
        return result.result;
      }

      // For non-self-editing tools, use the original method
      return originalExecuteToolDirect(toolCall, context, tool);
    };

    this.logger.debug('Tool executor hooked for self-editing tools');
  }

  /**
   * Get the self-editing adapter
   */
  getSelfEditingAdapter(): SelfEditingToolAdapter {
    return this.selfEditingAdapter;
  }

  /**
   * Get the self-editing integration
   */
  getSelfEditingIntegration(): SelfEditingIntegration {
    return this.selfEditingIntegration;
  }

  /**
   * Check if the integration is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get configuration
   */
  getConfig(): SelfEditingToolIntegrationConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  async updateConfig(config: Partial<SelfEditingToolIntegrationConfig>): Promise<void> {
    this.config = { ...this.config, ...config };

    if (config.adapterConfig) {
      this.selfEditingAdapter.updateConfig(config.adapterConfig);
    }

    this.logger.info('Self-editing tool integration configuration updated', {
      config: this.config
    });
  }

  /**
   * Shutdown the integration
   */
  async shutdown(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    this.logger.info('Shutting down self-editing tool integration...');

    // Clear execution history
    this.selfEditingAdapter.clearExecutionHistory();

    this.initialized = false;

    this.logger.info('Self-editing tool integration shutdown complete');
  }

  /**
   * Get integration statistics
   */
  getStatistics(): {
    initialized: boolean;
    enabled: boolean;
    toolsRegistered: number;
    executionHistory: number;
    features: Record<string, boolean>;
  } {
    return {
      initialized: this.initialized,
      enabled: this.config.enabled,
      toolsRegistered: selfEditingTools.length,
      executionHistory: this.selfEditingAdapter.getExecutionHistory().length,
      features: {
        codeModification: this.config.adapterConfig.enableCodeModification,
        codeAnalysis: this.config.adapterConfig.enableCodeAnalysis,
        validation: this.config.adapterConfig.enableValidation,
        testing: this.config.adapterConfig.enableTesting,
        suggestions: this.config.adapterConfig.enableSuggestions
      }
    };
  }
}

// ============================================================================
// INTEGRATION FACTORY FUNCTION
// ============================================================================

/**
 * Create a self-editing tool integration instance
 */
export async function createSelfEditingToolIntegration(
  toolRegistry: ToolRegistry,
  toolExecutor: ToolExecutor,
  config: Partial<SelfEditingToolIntegrationConfig>,
  logger: Logger
): Promise<SelfEditingToolIntegration> {
  // Default configuration
  const defaultConfig: SelfEditingToolIntegrationConfig = {
    enabled: process.env.SELF_EDITING_TOOLS_ENABLED === 'true' || false,
    autoRegisterTools: process.env.SELF_EDITING_AUTO_REGISTER === 'true' || true,
    adapterConfig: {
      enabled: process.env.SELF_EDITING_ENABLED === 'true' || false,
      enableCodeAnalysis: process.env.SELF_EDITING_CODE_ANALYSIS === 'true' || true,
      enableCodeModification: process.env.SELF_EDITING_CODE_MODIFICATION === 'true' || false,
      enableValidation: process.env.SELF_EDITING_VALIDATION === 'true' || true,
      enableTesting: process.env.SELF_EDITING_TESTING === 'true' || true,
      enableSuggestions: process.env.SELF_EDITING_SUGGESTIONS === 'true' || true,
      requireApproval: process.env.SELF_EDITING_REQUIRE_APPROVAL === 'true' || true,
      maxModificationsPerSession: parseInt(process.env.SELF_EDITING_MAX_MODIFICATIONS || '10', 10)
    },
    selfEditingConfig: {
      analysis: {},
      nlp: {},
      testing: {},
      performance: {}
    }
  };

  // Merge with provided config
  const finalConfig = {
    ...defaultConfig,
    ...config,
    adapterConfig: {
      ...defaultConfig.adapterConfig,
      ...config.adapterConfig
    },
    selfEditingConfig: {
      ...defaultConfig.selfEditingConfig,
      ...config.selfEditingConfig
    }
  };

  // Create integration instance
  const integration = new SelfEditingToolIntegration(
    toolRegistry,
    toolExecutor,
    finalConfig,
    logger
  );

  // Initialize the integration
  await integration.initialize();

  return integration;
}
