/**
 * Block Templates Discovery Tool
 *
 * Lists WordPress FSE templates and template parts.
 *
 * @package WP_Navigator_Pro
 * @since 2.8.0
 */

import { toolRegistry, ToolCategory } from '../../tool-registry/index.js';

/**
 * Register block templates discovery tool
 */
export function registerBlockTemplatesTools() {
  toolRegistry.register({
    definition: {
      name: 'wpnav_list_block_templates',
      description:
        'List WordPress Full Site Editing templates and template parts. Includes headers, footers, and page templates.',
      inputSchema: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['wp_template', 'wp_template_part'],
            description: 'Filter by type (default: both)',
          },
          area: {
            type: 'string',
            description: "Filter template parts by area (e.g., 'header', 'footer', 'sidebar')",
          },
          search: {
            type: 'string',
            description: 'Search template names',
          },
          include_content: {
            type: 'boolean',
            description: 'Include template block markup (default: false, can be large)',
          },
        },
      },
    },
    handler: async (args, context) => {
      const params = new URLSearchParams();

      if (args.type) {
        params.append('type', args.type);
      }
      if (args.area) {
        params.append('area', args.area);
      }
      if (args.search) {
        params.append('search', args.search);
      }
      if (args.include_content !== undefined) {
        params.append('include_content', String(args.include_content));
      }

      const queryString = params.toString();
      const endpoint = queryString
        ? `/wpnav/v1/discovery/templates?${queryString}`
        : '/wpnav/v1/discovery/templates';

      const result = await context.wpRequest(endpoint);

      return {
        content: [{ type: 'text', text: context.clampText(JSON.stringify(result, null, 2)) }],
      };
    },
    category: ToolCategory.DISCOVERY,
  });
}
