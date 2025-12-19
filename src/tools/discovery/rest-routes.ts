/**
 * REST Routes Discovery Tool
 *
 * Lists all registered WordPress REST API endpoints.
 *
 * @package WP_Navigator_Pro
 * @since 2.8.0
 */

import { toolRegistry, ToolCategory } from '../../tool-registry/index.js';

/**
 * Register REST routes discovery tool
 */
export function registerRestRoutesTools() {
  toolRegistry.register({
    definition: {
      name: 'wpnav_list_rest_routes',
      description:
        'List all registered WordPress REST API endpoints. Useful for discovering available APIs from plugins and themes.',
      inputSchema: {
        type: 'object',
        properties: {
          namespace: {
            type: 'string',
            description: "Filter by namespace (e.g., 'wp/v2', 'wpnav/v1', 'wc/v3')",
          },
          include_methods: {
            type: 'boolean',
            description: 'Include HTTP methods for each route (default: true)',
          },
          include_args: {
            type: 'boolean',
            description: 'Include endpoint argument schemas (default: false)',
          },
        },
      },
    },
    handler: async (args, context) => {
      const params = new URLSearchParams();

      if (args.namespace) {
        params.append('namespace', args.namespace);
      }
      if (args.include_methods !== undefined) {
        params.append('include_methods', String(args.include_methods));
      }
      if (args.include_args !== undefined) {
        params.append('include_args', String(args.include_args));
      }

      const queryString = params.toString();
      const endpoint = queryString
        ? `/wpnav/v1/discovery/routes?${queryString}`
        : '/wpnav/v1/discovery/routes';

      const result = await context.wpRequest(endpoint);

      return {
        content: [{ type: 'text', text: context.clampText(JSON.stringify(result, null, 2)) }],
      };
    },
    category: ToolCategory.DISCOVERY,
  });
}
