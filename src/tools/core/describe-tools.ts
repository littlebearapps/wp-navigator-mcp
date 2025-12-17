/**
 * Describe Tools Meta-Tool
 *
 * Enables AI agents to retrieve full input schemas for specific WP Navigator
 * tools. This is the second step in the dynamic tool discovery workflow:
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
 * Maximum number of tools that can be described in a single request.
 * This prevents accidental full-list loading which defeats token savings.
 */
const MAX_TOOLS = 10;

/**
 * Category name mapping from enum to lowercase string
 */
const CATEGORY_NAMES: Record<ToolCategory, string> = {
  [ToolCategory.CORE]: 'core',
  [ToolCategory.CONTENT]: 'content',
  [ToolCategory.TAXONOMY]: 'taxonomy',
  [ToolCategory.USERS]: 'users',
  [ToolCategory.PLUGINS]: 'plugins',
  [ToolCategory.THEMES]: 'themes',
  [ToolCategory.WORKFLOWS]: 'workflows',
  [ToolCategory.COOKBOOK]: 'cookbook',
  [ToolCategory.ROLES]: 'roles',
  [ToolCategory.BATCH]: 'batch',
};

/**
 * Tool definition for wpnav_describe_tools
 */
export const describeToolsDefinition = {
  name: 'wpnav_describe_tools',
  description:
    'Get full input schemas for specific WP Navigator tools. Call this after using wpnav_search_tools to get the schemas you need before calling wpnav_execute.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      tools: {
        type: 'array',
        items: { type: 'string' },
        maxItems: MAX_TOOLS,
        description: `Array of tool names to describe (e.g., ["wpnav_create_post", "wpnav_update_post"]). Maximum ${MAX_TOOLS} tools per request.`,
      },
    },
    required: ['tools'],
  },
};

/**
 * Response format for describe tools
 */
interface DescribeToolsResponse {
  tools: Array<{
    name: string;
    description: string;
    inputSchema: object;
    category: string;
  }>;
  not_found: string[];
}

/**
 * Handler for wpnav_describe_tools
 *
 * Retrieves full tool definitions including inputSchema for requested tools.
 * Returns not_found array for any invalid tool names.
 */
export async function describeToolsHandler(
  args: { tools: string[] },
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  context: ToolExecutionContext
): Promise<ToolResult> {
  const { tools: requestedTools } = args;

  // Validate input
  if (!Array.isArray(requestedTools)) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              error: 'INVALID_INPUT',
              message: 'tools must be an array of tool names',
            },
            null,
            2
          ),
        },
      ],
    };
  }

  if (requestedTools.length === 0) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              error: 'INVALID_INPUT',
              message: 'tools array cannot be empty',
              hint: 'Use wpnav_search_tools to find tools first',
            },
            null,
            2
          ),
        },
      ],
    };
  }

  // Enforce max items limit
  const toolsToDescribe = requestedTools.slice(0, MAX_TOOLS);
  const truncated = requestedTools.length > MAX_TOOLS;

  // Build response
  const response: DescribeToolsResponse = {
    tools: [],
    not_found: [],
  };

  for (const toolName of toolsToDescribe) {
    const tool = toolRegistry.getTool(toolName);

    if (!tool) {
      response.not_found.push(toolName);
      continue;
    }

    // Get category name
    const categoryName = CATEGORY_NAMES[tool.category] || 'other';

    response.tools.push({
      name: tool.definition.name,
      description: tool.definition.description || '',
      inputSchema: tool.definition.inputSchema,
      category: categoryName,
    });
  }

  // Add truncation warning if applicable
  const result: Record<string, unknown> = { ...response };
  if (truncated) {
    result.warning = `Only first ${MAX_TOOLS} tools described. Request contained ${requestedTools.length} tools.`;
  }

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(result, null, 2),
      },
    ],
  };
}

/**
 * Register the describe tools meta-tool
 */
export function registerDescribeTools(): void {
  toolRegistry.register({
    definition: describeToolsDefinition,
    handler: describeToolsHandler,
    category: ToolCategory.CORE,
  });
}
