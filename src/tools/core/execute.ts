/**
 * Execute Tool Meta-Tool
 *
 * Enables AI agents to execute any WP Navigator tool dynamically.
 * This is the third step in the dynamic tool discovery workflow:
 * 1. wpnav_search_tools - Find relevant tools by query/category
 * 2. wpnav_describe_tools - Get full schemas for tools you want to use
 * 3. wpnav_execute - Execute tools with validated arguments
 *
 * @package WP_Navigator_MCP
 * @since 2.7.0
 */

import { toolRegistry, ToolCategory } from '../../tool-registry/index.js';
import type { ToolExecutionContext, ToolResult } from '../../tool-registry/types.js';

/**
 * Available tool categories for hint messages
 */
const AVAILABLE_CATEGORIES = [
  'core',
  'content',
  'taxonomy',
  'users',
  'plugins',
  'themes',
  'gutenberg',
  'batch',
  'cookbook',
  'roles',
];

/**
 * Tool definition for wpnav_execute
 */
export const executeToolDefinition = {
  name: 'wpnav_execute',
  description:
    'Execute any WP Navigator tool by name. Use wpnav_search_tools to discover tools and wpnav_describe_tools to get their schemas first.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      tool: {
        type: 'string',
        description: 'Tool name to execute (e.g., "wpnav_create_post", "wpnav_list_pages")',
      },
      arguments: {
        type: 'object',
        description: "Tool arguments matching the tool's inputSchema",
        additionalProperties: true,
      },
    },
    required: ['tool', 'arguments'],
  },
};

/**
 * Error response helper
 */
function errorResponse(code: string, message: string, extra?: Record<string, unknown>): ToolResult {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(
          {
            error: code,
            message,
            ...extra,
          },
          null,
          2
        ),
      },
    ],
  };
}

/**
 * Handler for wpnav_execute
 *
 * Executes a tool by name with provided arguments.
 * Validates tool exists and is enabled before execution.
 */
export async function executeToolHandler(
  args: { tool: string; arguments: Record<string, unknown> },
  context: ToolExecutionContext
): Promise<ToolResult> {
  const { tool: toolName, arguments: toolArgs } = args;

  // Validate input - tool name is required
  if (!toolName || typeof toolName !== 'string') {
    return errorResponse('INVALID_INPUT', 'tool parameter is required and must be a string');
  }

  // Validate input - arguments must be an object
  if (toolArgs === null || typeof toolArgs !== 'object' || Array.isArray(toolArgs)) {
    return errorResponse('INVALID_INPUT', 'arguments must be an object');
  }

  // 1. Check tool exists
  const tool = toolRegistry.getTool(toolName);
  if (!tool) {
    return errorResponse('TOOL_NOT_FOUND', `Tool '${toolName}' does not exist`, {
      available_categories: AVAILABLE_CATEGORIES,
      hint: 'Use wpnav_search_tools to find available tools',
    });
  }

  // 2. Check tool is enabled (focus modes, role restrictions, feature flags)
  if (!toolRegistry.isEnabled(toolName)) {
    // Determine reason for being disabled
    let reason = 'focus mode or role restrictions';
    if (tool.featureFlag) {
      reason = `feature flag '${tool.featureFlag}' is not enabled`;
    }

    return errorResponse('TOOL_DISABLED', `Tool '${toolName}' is disabled by ${reason}`, {
      hint: 'Check your wpnavigator.jsonc focus mode and role settings',
    });
  }

  // 3. Execute the tool
  // Note: Individual tools handle their own schema validation
  // WPNAV_ENABLE_WRITES is enforced at the tool level, not here
  try {
    const result = await toolRegistry.execute(toolName, toolArgs, context);
    return result;
  } catch (error) {
    // Handle execution errors
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Check for common error patterns
    if (errorMessage.includes('required')) {
      return errorResponse('VALIDATION_FAILED', errorMessage, {
        hint: 'Use wpnav_describe_tools to get the full schema for this tool',
        tool: toolName,
      });
    }

    if (errorMessage.includes('WRITES_DISABLED') || errorMessage.includes('write operations')) {
      return errorResponse(
        'WRITES_DISABLED',
        'Write operations are disabled. Set WPNAV_ENABLE_WRITES=1 to enable.',
        {
          tool: toolName,
        }
      );
    }

    // Generic execution error
    return errorResponse('EXECUTION_FAILED', `Failed to execute '${toolName}': ${errorMessage}`, {
      tool: toolName,
    });
  }
}

/**
 * Register the execute tool meta-tool
 */
export function registerExecuteTool(): void {
  toolRegistry.register({
    definition: executeToolDefinition,
    handler: executeToolHandler,
    category: ToolCategory.CORE,
  });
}
