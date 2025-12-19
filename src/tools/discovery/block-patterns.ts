/**
 * Block Patterns Discovery Tool
 *
 * Lists all registered WordPress block patterns.
 *
 * @package WP_Navigator_Pro
 * @since 2.8.0
 */

import { toolRegistry, ToolCategory } from '../../tool-registry/index.js';

/**
 * Register block patterns discovery tool
 */
export function registerBlockPatternsTools() {
  toolRegistry.register({
    definition: {
      name: 'wpnav_list_block_patterns',
      description:
        'List all registered WordPress block patterns. Patterns are pre-designed block layouts that can be inserted into content.',
      inputSchema: {
        type: 'object',
        properties: {
          category: {
            type: 'string',
            description: "Filter by category (e.g., 'featured', 'gallery', 'header')",
          },
          search: {
            type: 'string',
            description: 'Search pattern names and descriptions',
          },
          include_content: {
            type: 'boolean',
            description: 'Include pattern block markup (default: false, can be large)',
          },
        },
      },
    },
    handler: async (args, context) => {
      const params = new URLSearchParams();

      if (args.category) {
        params.append('category', args.category);
      }
      if (args.search) {
        params.append('search', args.search);
      }
      if (args.include_content !== undefined) {
        params.append('include_content', String(args.include_content));
      }

      const queryString = params.toString();
      const endpoint = queryString
        ? `/wpnav/v1/discovery/patterns?${queryString}`
        : '/wpnav/v1/discovery/patterns';

      const result = await context.wpRequest(endpoint);

      return {
        content: [{ type: 'text', text: context.clampText(JSON.stringify(result, null, 2)) }],
      };
    },
    category: ToolCategory.DISCOVERY,
  });
}
