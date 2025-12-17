/**
 * Search Tools Meta-Tool
 *
 * Enables AI agents to discover relevant WP Navigator tools by natural
 * language query or category filter. Returns tool names and descriptions
 * only (not full schemas) for token efficiency.
 *
 * @package WP_Navigator_MCP
 * @since 2.7.0
 */

import { toolRegistry, ToolCategory } from '../../tool-registry/index.js';
import {
  searchTools as embeddingsSearch,
  searchByCategory,
  getCategories,
  type ToolSearchResult,
} from '../../embeddings/index.js';

/**
 * Valid category values for the enum
 */
const VALID_CATEGORIES = [
  'batch',
  'content',
  'cookbook',
  'core',
  'plugins',
  'roles',
  'taxonomy',
  'themes',
  'users',
] as const;

type ValidCategory = (typeof VALID_CATEGORIES)[number];

/**
 * Tool definition for wpnav_search_tools
 */
export const searchToolsDefinition = {
  name: 'wpnav_search_tools',
  description:
    'Find WP Navigator tools by natural language query or category. Returns tool names and brief descriptions only (not full schemas). Use wpnav_describe_tools to get full schemas for tools you want to use.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      query: {
        type: 'string',
        description:
          'Natural language search query (e.g., "create a blog post", "manage plugins", "edit pages")',
      },
      category: {
        type: 'string',
        enum: VALID_CATEGORIES as unknown as string[],
        description: 'Filter by tool category',
      },
      limit: {
        type: 'number',
        default: 10,
        maximum: 25,
        minimum: 1,
        description: 'Maximum number of results (default: 10, max: 25)',
      },
    },
  },
};

/**
 * Response format for search results
 */
interface SearchToolsResponse {
  tools: Array<{
    name: string;
    description: string;
    category: string;
  }>;
  total_matching: number;
  hint: string;
}

/**
 * Handler for wpnav_search_tools
 *
 * Search logic:
 * 1. If query only: Use semantic search via embeddings
 * 2. If category only: Filter by category
 * 3. If both: Semantic search then filter by category
 */
export async function searchToolsHandler(
  args: { query?: string; category?: string; limit?: number },
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  context: any
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const { query, category, limit = 10 } = args;

  // Validate: at least one of query or category required
  if (!query && !category) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              error: 'At least one of query or category is required',
              available_categories: VALID_CATEGORIES,
            },
            null,
            2
          ),
        },
      ],
    };
  }

  // Validate category if provided
  if (category && !VALID_CATEGORIES.includes(category as ValidCategory)) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              error: `Invalid category: ${category}`,
              available_categories: VALID_CATEGORIES,
            },
            null,
            2
          ),
        },
      ],
    };
  }

  // Clamp limit to valid range
  const effectiveLimit = Math.max(1, Math.min(25, limit));

  let results: ToolSearchResult[];

  if (query && category) {
    // Combined: semantic search then filter by category
    // Search with higher limit to ensure we get enough after filtering
    const searchResults = embeddingsSearch(query, { limit: effectiveLimit * 3 });
    results = searchResults.filter((r) => r.category.toLowerCase() === category.toLowerCase());
    results = results.slice(0, effectiveLimit);
  } else if (query) {
    // Query only: semantic search
    results = embeddingsSearch(query, { limit: effectiveLimit });
  } else {
    // Category only: filter by category
    const categoryResults = searchByCategory(category!);
    results = categoryResults.slice(0, effectiveLimit);
  }

  // Build response
  const response: SearchToolsResponse = {
    tools: results.map((r) => ({
      name: r.name,
      description: r.description,
      category: r.category,
    })),
    total_matching: results.length,
    hint: 'Use wpnav_describe_tools to get full schemas for these tools',
  };

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      },
    ],
  };
}

/**
 * Register the search tools meta-tool
 */
export function registerSearchTools(): void {
  toolRegistry.register({
    definition: searchToolsDefinition,
    handler: searchToolsHandler,
    category: ToolCategory.CORE,
  });
}
