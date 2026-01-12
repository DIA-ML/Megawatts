/**
 * Self-Editing Tools
 *
 * This module defines all self-editing tools that expose self-editing capabilities
 * to the AI through the tool calling interface. These tools enable the AI to analyze,
 * modify, validate, test, and optimize code.
 */

import {
  Tool,
  ToolParameter,
  ParameterType,
  ToolCategory,
  ToolSafety,
  ToolMetadata,
  ToolExample
} from '../types/ai';

// ============================================================================
// TOOL DEFINITIONS
// ============================================================================

/**
 * Code Modification Tool
 *
 * Allows the AI to request code modifications through the self-editing system.
 * Modifications are validated, tested, and can be rolled back if needed.
 */
export const codeModificationTool: Tool = {
  name: 'self_editing_code_modification',
  description: 'Request code modifications through the self-editing system with full validation and rollback capability. Use this to modify code based on natural language requests.',
  parameters: [
    {
      name: 'request',
      type: 'string' as ParameterType,
      required: true,
      description: 'Natural language description of the code modification to perform',
      validation: {
        minLength: 10,
        maxLength: 2000
      }
    },
    {
      name: 'code',
      type: 'string' as ParameterType,
      required: false,
      description: 'Optional existing code to modify. If not provided, system will generate new code.',
      validation: {
        maxLength: 50000
      }
    }
  ],
  category: 'ai' as ToolCategory,
  safety: {
    level: 'dangerous',
    requiresApproval: true,
    rateLimit: {
      requestsPerMinute: 5,
      requestsPerHour: 20
    },
    sandboxed: true,
    auditLog: true
  } as ToolSafety,
  permissions: ['self-edit:execute', 'code:modify'],
  metadata: {
    version: '1.0.0',
    author: 'Megawatts Bot',
    tags: ['self-editing', 'code-modification', 'ai'],
    documentation: 'https://docs.megawatts.bot/tools/self-editing/code-modification',
    deprecated: false,
    examples: [
      {
        name: 'Add error handling',
        description: 'Add error handling to a function',
        parameters: {
          request: 'Add try-catch error handling to this function',
          code: 'function processData(data) { return data.map(x => x * 2); }'
        },
        expectedOutput: {
          success: true,
          modifiedCode: 'function processData(data) { try { return data.map(x => x * 2); } catch (error) { console.error("Error processing data:", error); throw error; } }'
        }
      } as ToolExample
    ]
  } as ToolMetadata,
  execute: async (args: Record<string, any>) => {
    throw new Error('Tool execution handled by SelfEditingToolAdapter');
  }
};

/**
 * Natural Language to Code Tool
 *
 * Converts natural language descriptions into executable code.
 */
export const naturalLanguageToCodeTool: Tool = {
  name: 'self_editing_natural_language_to_code',
  description: 'Convert natural language descriptions into executable code. Use this to generate code from descriptions.',
  parameters: [
    {
      name: 'description',
      type: 'string' as ParameterType,
      required: true,
      description: 'Natural language description of the code to generate',
      validation: {
        minLength: 10,
        maxLength: 2000
      }
    },
    {
      name: 'language',
      type: 'string' as ParameterType,
      required: false,
      description: 'Programming language for the generated code',
      validation: {
        enum: ['typescript', 'javascript', 'python', 'java', 'go', 'rust']
      }
    }
  ],
  category: 'ai' as ToolCategory,
  safety: {
    level: 'restricted',
    requiresApproval: false,
    rateLimit: {
      requestsPerMinute: 10,
      requestsPerHour: 50
    },
    sandboxed: true,
    auditLog: true
  } as ToolSafety,
  permissions: ['self-edit:read', 'code:generate'],
  metadata: {
    version: '1.0.0',
    author: 'Megawatts Bot',
    tags: ['self-editing', 'code-generation', 'ai', 'nlp'],
    documentation: 'https://docs.megawatts.bot/tools/self-editing/natural-language-to-code',
    deprecated: false,
    examples: [
      {
        name: 'Generate sorting function',
        description: 'Generate a function to sort an array',
        parameters: {
          description: 'Create a function that sorts an array of numbers in ascending order',
          language: 'typescript'
        },
        expectedOutput: {
          success: true,
          code: 'function sortNumbers(numbers: number[]): number[] { return numbers.sort((a, b) => a - b); }'
        }
      } as ToolExample
    ]
  } as ToolMetadata,
  execute: async (args: Record<string, any>) => {
    throw new Error('Tool execution handled by SelfEditingToolAdapter');
  }
};

/**
 * Code Suggestions Tool
 *
 * Provides code improvement suggestions based on analysis.
 */
export const codeSuggestionsTool: Tool = {
  name: 'self_editing_code_suggestions',
  description: 'Get code improvement suggestions based on code analysis. Use this to identify potential improvements in code quality, performance, and maintainability.',
  parameters: [
    {
      name: 'code',
      type: 'string' as ParameterType,
      required: true,
      description: 'Code to analyze and provide suggestions for',
      validation: {
        minLength: 1,
        maxLength: 50000
      }
    }
  ],
  category: 'ai' as ToolCategory,
  safety: {
    level: 'safe',
    requiresApproval: false,
    rateLimit: {
      requestsPerMinute: 15,
      requestsPerHour: 100
    },
    sandboxed: true,
    auditLog: false
  } as ToolSafety,
  permissions: ['self-edit:read'],
  metadata: {
    version: '1.0.0',
    author: 'Megawatts Bot',
    tags: ['self-editing', 'code-analysis', 'suggestions', 'ai'],
    documentation: 'https://docs.megawatts.bot/tools/self-editing/code-suggestions',
    deprecated: false,
    examples: [
      {
        name: 'Get suggestions for inefficient code',
        description: 'Get suggestions to improve code efficiency',
        parameters: {
          code: 'function sumArray(arr) { let sum = 0; for (let i = 0; i < arr.length; i++) { sum = sum + arr[i]; } return sum; }'
        },
        expectedOutput: {
          success: true,
          suggestions: [
            {
              type: 'optimize',
              priority: 'medium',
              description: 'Use reduce() for more idiomatic array summation',
              codeSnippet: 'function sumArray(arr) { return arr.reduce((sum, val) => sum + val, 0); }'
            }
          ]
        }
      } as ToolExample
    ]
  } as ToolMetadata,
  execute: async (args: Record<string, any>) => {
    throw new Error('Tool execution handled by SelfEditingToolAdapter');
  }
};

/**
 * Automated Testing Tool
 *
 * Runs automated tests on code modifications.
 */
export const automatedTestingTool: Tool = {
  name: 'self_editing_automated_testing',
  description: 'Run automated tests on code to verify functionality and coverage. Use this to ensure code quality and correctness.',
  parameters: [
    {
      name: 'code',
      type: 'string' as ParameterType,
      required: true,
      description: 'Code to test',
      validation: {
        minLength: 1,
        maxLength: 50000
      }
    },
    {
      name: 'testType',
      type: 'string' as ParameterType,
      required: false,
      description: 'Type of tests to run',
      validation: {
        enum: ['unit', 'integration', 'performance', 'all']
      }
    }
  ],
  category: 'ai' as ToolCategory,
  safety: {
    level: 'restricted',
    requiresApproval: false,
    rateLimit: {
      requestsPerMinute: 10,
      requestsPerHour: 50
    },
    sandboxed: true,
    auditLog: true
  } as ToolSafety,
  permissions: ['self-edit:read', 'self-edit:execute'],
  metadata: {
    version: '1.0.0',
    author: 'Megawatts Bot',
    tags: ['self-editing', 'testing', 'validation', 'ai'],
    documentation: 'https://docs.megawatts.bot/tools/self-editing/automated-testing',
    deprecated: false,
    examples: [
      {
        name: 'Run unit tests',
        description: 'Run unit tests on a function',
        parameters: {
          code: 'function add(a, b) { return a + b; }',
          testType: 'unit'
        },
        expectedOutput: {
          success: true,
          testResults: {
            passed: true,
            coverage: 0.8
          }
        }
      } as ToolExample
    ]
  } as ToolMetadata,
  execute: async (args: Record<string, any>) => {
    throw new Error('Tool execution handled by SelfEditingToolAdapter');
  }
};

/**
 * Performance Optimization Tool
 *
 * Provides performance optimization recommendations.
 */
export const performanceOptimizationTool: Tool = {
  name: 'self_editing_performance_optimization',
  description: 'Get performance optimization recommendations for code. Use this to identify and fix performance bottlenecks.',
  parameters: [
    {
      name: 'code',
      type: 'string' as ParameterType,
      required: true,
      description: 'Code to analyze for performance optimizations',
      validation: {
        minLength: 1,
        maxLength: 50000
      }
    }
  ],
  category: 'ai' as ToolCategory,
  safety: {
    level: 'safe',
    requiresApproval: false,
    rateLimit: {
      requestsPerMinute: 10,
      requestsPerHour: 50
    },
    sandboxed: true,
    auditLog: false
  } as ToolSafety,
  permissions: ['self-edit:read'],
  metadata: {
    version: '1.0.0',
    author: 'Megawatts Bot',
    tags: ['self-editing', 'performance', 'optimization', 'ai'],
    documentation: 'https://docs.megawatts.bot/tools/self-editing/performance-optimization',
    deprecated: false,
    examples: [
      {
        name: 'Optimize loop performance',
        description: 'Get optimization recommendations for a loop',
        parameters: {
          code: 'function processItems(items) { for (let i = 0; i < items.length; i++) { console.log(items[i]); } }'
        },
        expectedOutput: {
          success: true,
          optimizations: [
            {
              type: 'caching',
              description: 'Cache array length to avoid repeated lookups',
              expectedImprovement: { responseTime: 0.1 }
            }
          ]
        }
      } as ToolExample
    ]
  } as ToolMetadata,
  execute: async (args: Record<string, any>) => {
    throw new Error('Tool execution handled by SelfEditingToolAdapter');
  }
};

// ============================================================================
// TOOL COLLECTION EXPORT
// ============================================================================

/**
 * Collection of all self-editing tools
 */
export const selfEditingTools: Tool[] = [
  codeModificationTool,
  naturalLanguageToCodeTool,
  codeSuggestionsTool,
  automatedTestingTool,
  performanceOptimizationTool
];

/**
 * Get a self-editing tool by name
 */
export function getSelfEditingTool(name: string): Tool | undefined {
  return selfEditingTools.find(tool => tool.name === name);
}

/**
 * Check if a tool is a self-editing tool
 */
export function isSelfEditingTool(toolName: string): boolean {
  return toolName.startsWith('self_editing_');
}

/**
 * Get all self-editing tool names
 */
export function getSelfEditingToolNames(): string[] {
  return selfEditingTools.map(tool => tool.name);
}
