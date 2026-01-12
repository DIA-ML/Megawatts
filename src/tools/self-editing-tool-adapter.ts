/**
 * Self-Editing Tool Adapter
 *
 * This module bridges self-editing operations with the tool execution system,
 * enabling AI to access self-editing capabilities through the tool calling interface.
 */

import { ToolRegistry, ToolExecutionResult } from '../ai/tools/tool-registry';
import { ExecutionContext } from '../ai/tools/tool-executor';
import { ValidationResult } from '../ai/tools/tool-executor';
import { SelfEditingIntegration } from '../ai/integration/self-editing-integration';
import { ConversationContext } from '../types/ai';
import { Logger } from '../utils/logger';
import { BotError } from '../utils/errors';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface SelfEditingToolAdapterConfig {
  enabled: boolean;
  enableCodeAnalysis: boolean;
  enableCodeModification: boolean;
  enableValidation: boolean;
  enableTesting: boolean;
  enableSuggestions: boolean;
  requireApproval: boolean;
  maxModificationsPerSession: number;
}

// ============================================================================
// SELF-EDITING TOOL ADAPTER CLASS
// ============================================================================

export class SelfEditingToolAdapter {
  private toolRegistry: ToolRegistry;
  private selfEditingIntegration: SelfEditingIntegration;
  private logger: Logger;
  private config: SelfEditingToolAdapterConfig;
  private executionHistory: Map<string, any> = new Map();

  constructor(
    toolRegistry: ToolRegistry,
    selfEditingIntegration: SelfEditingIntegration,
    config: SelfEditingToolAdapterConfig,
    logger: Logger
  ) {
    this.toolRegistry = toolRegistry;
    this.selfEditingIntegration = selfEditingIntegration;
    this.config = config;
    this.logger = logger;

    this.logger.info('Self-editing tool adapter initialized', {
      enabled: config.enabled,
      features: {
        codeAnalysis: config.enableCodeAnalysis,
        codeModification: config.enableCodeModification,
        validation: config.enableValidation,
        testing: config.enableTesting,
        suggestions: config.enableSuggestions
      }
    });
  }

  /**
   * Execute a self-editing tool
   */
  async executeTool(
    toolName: string,
    parameters: Record<string, any>,
    context: ExecutionContext
  ): Promise<ToolExecutionResult> {
    const startTime = Date.now();

    try {
      this.logger.info('Executing self-editing tool', {
        toolName,
        userId: context.userId,
        guildId: context.guildId
      });

      // Check if self-editing is enabled
      if (!this.config.enabled) {
        throw new BotError(
          'Self-editing is currently disabled',
          'medium',
          { toolName }
        );
      }

      // Convert execution context to conversation context
      const conversationContext = this.convertToConversationContext(context);

      // Route to appropriate handler based on tool name
      let result: any;
      switch (toolName) {
        case 'self_editing_code_modification':
          result = await this.handleCodeModification(parameters, conversationContext);
          break;
        case 'self_editing_natural_language_to_code':
          result = await this.handleNaturalLanguageToCode(parameters, conversationContext);
          break;
        case 'self_editing_code_suggestions':
          result = await this.handleCodeSuggestions(parameters, conversationContext);
          break;
        case 'self_editing_automated_testing':
          result = await this.handleAutomatedTesting(parameters, conversationContext);
          break;
        case 'self_editing_performance_optimization':
          result = await this.handlePerformanceOptimization(parameters, conversationContext);
          break;
        default:
          throw new BotError(
            `Unknown self-editing tool: ${toolName}`,
            'medium',
            { toolName }
          );
      }

      const executionTime = Date.now() - startTime;

      // Record execution in history
      this.recordExecution(toolName, parameters, result, executionTime, context);

      this.logger.info('Self-editing tool execution completed', {
        toolName,
        success: result.success,
        executionTime
      });

      return {
        success: result.success,
        result,
        executionTime,
        toolName,
        cached: false
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;

      this.logger.error('Self-editing tool execution failed', error as Error, {
        toolName,
        executionTime
      });

      return {
        success: false,
        error: {
          code: (error as any).code || 'EXECUTION_ERROR',
          message: (error as Error).message,
          retryable: false
        },
        executionTime,
        toolName,
        cached: false
      };
    }
  }

  /**
   * Handle code modification request
   */
  private async handleCodeModification(
    parameters: Record<string, any>,
    context: ConversationContext
  ): Promise<any> {
    if (!this.config.enableCodeModification) {
      throw new BotError(
        'Code modification is currently disabled',
        'medium'
      );
    }

    const { request, code } = parameters;

    if (!request) {
      throw new BotError(
        'Missing required parameter: request',
        'low',
        { parameters }
      );
    }

    return await this.selfEditingIntegration.processCodeModificationRequest(
      request,
      context,
      code
    );
  }

  /**
   * Handle natural language to code translation
   */
  private async handleNaturalLanguageToCode(
    parameters: Record<string, any>,
    context: ConversationContext
  ): Promise<any> {
    if (!this.config.enableCodeAnalysis) {
      throw new BotError(
        'Natural language to code is currently disabled',
        'medium'
      );
    }

    const { description, language } = parameters;

    if (!description) {
      throw new BotError(
        'Missing required parameter: description',
        'low',
        { parameters }
      );
    }

    return await this.selfEditingIntegration.naturalLanguageToCode(
      description,
      language || 'typescript',
      context
    );
  }

  /**
   * Handle code improvement suggestions
   */
  private async handleCodeSuggestions(
    parameters: Record<string, any>,
    context: ConversationContext
  ): Promise<any> {
    if (!this.config.enableSuggestions) {
      throw new BotError(
        'Code suggestions are currently disabled',
        'medium'
      );
    }

    const { code } = parameters;

    if (!code) {
      throw new BotError(
        'Missing required parameter: code',
        'low',
        { parameters }
      );
    }

    return await this.selfEditingIntegration.suggestCodeImprovements(
      code,
      context
    );
  }

  /**
   * Handle automated testing request
   */
  private async handleAutomatedTesting(
    parameters: Record<string, any>,
    context: ConversationContext
  ): Promise<any> {
    if (!this.config.enableTesting) {
      throw new BotError(
        'Automated testing is currently disabled',
        'medium'
      );
    }

    const { code, testType } = parameters;

    if (!code) {
      throw new BotError(
        'Missing required parameter: code',
        'low',
        { parameters }
      );
    }

    return await this.selfEditingIntegration.runAutomatedTesting(
      code,
      testType || 'all'
    );
  }

  /**
   * Handle performance optimization request
   */
  private async handlePerformanceOptimization(
    parameters: Record<string, any>,
    context: ConversationContext
  ): Promise<any> {
    if (!this.config.enableCodeAnalysis) {
      throw new BotError(
        'Performance optimization is currently disabled',
        'medium'
      );
    }

    const { code } = parameters;

    if (!code) {
      throw new BotError(
        'Missing required parameter: code',
        'low',
        { parameters }
      );
    }

    return await this.selfEditingIntegration.getPerformanceOptimizations(
      code,
      context
    );
  }

  /**
   * Convert execution context to conversation context
   */
  private convertToConversationContext(
    context: ExecutionContext
  ): ConversationContext {
    return {
      conversationId: context.requestId,
      userId: context.userId,
      guildId: context.guildId || '',
      channelId: context.channelId || '',
      messageHistory: [],
      currentTurn: 1,
      metadata: {
        timestamp: context.timestamp,
        permissions: context.permissions
      }
    } as ConversationContext;
  }

  /**
   * Record tool execution in history
   */
  private recordExecution(
    toolName: string,
    parameters: Record<string, any>,
    result: any,
    executionTime: number,
    context: ExecutionContext
  ): void {
    const executionId = `${toolName}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    this.executionHistory.set(executionId, {
      id: executionId,
      toolName,
      parameters,
      result,
      executionTime,
      context,
      timestamp: new Date()
    });

    // Keep only last 1000 executions
    if (this.executionHistory.size > 1000) {
      const firstKey = this.executionHistory.keys().next().value;
      this.executionHistory.delete(firstKey);
    }
  }

  /**
   * Get execution history
   */
  getExecutionHistory(limit?: number): any[] {
    const history = Array.from(this.executionHistory.values());
    if (limit) {
      return history.slice(-limit);
    }
    return history;
  }

  /**
   * Clear execution history
   */
  clearExecutionHistory(): void {
    this.executionHistory.clear();
    this.logger.info('Self-editing tool execution history cleared');
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<SelfEditingToolAdapterConfig>): void {
    this.config = { ...this.config, ...config };
    this.logger.info('Self-editing tool adapter configuration updated', { config: this.config });
  }

  /**
   * Get current configuration
   */
  getConfig(): SelfEditingToolAdapterConfig {
    return { ...this.config };
  }

  /**
   * Check if tool is enabled
   */
  isToolEnabled(toolName: string): boolean {
    if (!this.config.enabled) {
      return false;
    }

    switch (toolName) {
      case 'self_editing_code_modification':
        return this.config.enableCodeModification;
      case 'self_editing_natural_language_to_code':
        return this.config.enableCodeAnalysis;
      case 'self_editing_code_suggestions':
        return this.config.enableSuggestions;
      case 'self_editing_automated_testing':
        return this.config.enableTesting;
      case 'self_editing_performance_optimization':
        return this.config.enableCodeAnalysis;
      default:
        return false;
    }
  }
}
