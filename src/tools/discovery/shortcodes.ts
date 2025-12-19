/**
 * Shortcodes Discovery Tool
 *
 * Lists all registered WordPress shortcodes.
 *
 * @package WP_Navigator_Pro
 * @since 2.8.0
 */

import { toolRegistry, ToolCategory } from '../../tool-registry/index.js';

/**
 * Register shortcodes discovery tool
 */
export function registerShortcodesTools() {
  toolRegistry.register({
    definition: {
      name: 'wpnav_list_shortcodes',
      description:
        'List all registered WordPress shortcodes. Shows which shortcodes are available for use in content.',
      inputSchema: {
        type: 'object',
        properties: {
          search: {
            type: 'string',
            description: 'Search shortcode names (partial match)',
          },
          include_callback: {
            type: 'boolean',
            description: 'Include callback function info (default: false)',
          },
        },
      },
    },
    handler: async (args, context) => {
      const params = new URLSearchParams();

      if (args.search) {
        params.append('search', args.search);
      }
      if (args.include_callback !== undefined) {
        params.append('include_callback', String(args.include_callback));
      }

      const queryString = params.toString();
      const endpoint = queryString
        ? `/wpnav/v1/discovery/shortcodes?${queryString}`
        : '/wpnav/v1/discovery/shortcodes';

      const result = await context.wpRequest(endpoint);

      return {
        content: [{ type: 'text', text: context.clampText(JSON.stringify(result, null, 2)) }],
      };
    },
    category: ToolCategory.DISCOVERY,
  });
}
