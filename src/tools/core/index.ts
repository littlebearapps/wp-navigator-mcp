/**
 * Core Tools Registration
 *
 * @package WP_Navigator_Pro
 * @since 1.3.0
 */

import { toolRegistry, ToolCategory } from '../../tool-registry/index.js';

/**
 * Register core tools (introspection, help, status)
 */
export function registerCoreTools() {
  // ============================================================================
  // wpnav_help - Connection status and quickstart
  // ============================================================================
  toolRegistry.register({
    definition: {
      name: 'wpnav_help',
      description:
        'Get connection status, environment hints, and quickstart actions for using WP Navigator MCP with CLI clients.',
      inputSchema: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
    handler: async (args, context) => {
      const { config } = context;

      const hints = [
        '# WP Navigator MCP - Connected! 🎉',
        '',
        '## Environment',
        `- WordPress: ${config.baseUrl}`,
        `- REST API: ${config.restApi}`,
        `- WPNav Base: ${config.wpnavBase}`,
        `- Writes: ${config.toggles.enableWrites ? '✅ Enabled' : '❌ Disabled'}`,
        '',
        '## Quick Start',
        '1. Call **wpnav_introspect** to get API capabilities and policy',
        '2. Use **wpnav_list_*** tools to browse content (pages, posts, etc.)',
        '3. Use **wpnav_get_*<id>** to fetch specific items',
        '4. Use **wpnav_create_***, **wpnav_update_***, **wpnav_delete_*** for mutations',
        '',
        '## Available Categories',
        '- Content: pages, posts, media, comments',
        '- Taxonomy: categories, tags, taxonomies',
        '- Users: user management',
        '- Plugins: plugin management',
        '- Themes: theme management',
        '',
        '## Need Help?',
        '- Run **wpnav_introspect** for detailed API capabilities',
        '- All tool names follow pattern: wpnav_{action}_{resource}',
        '',
        '🚀 Ready to build with WordPress!',
      ];

      return {
        content: [{ type: 'text', text: hints.join('\n') }],
      };
    },
    category: ToolCategory.CORE,
    aliases: ['wpnav.help'], // Backward compatibility
  });

  // ============================================================================
  // wpnav_introspect - API capabilities and policy
  // ============================================================================
  toolRegistry.register({
    definition: {
      name: 'wpnav_introspect',
      description:
        'Get WP Navigator Pro API capabilities, policy configuration, and environment hints. Call this first to understand what the API can do.',
      inputSchema: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
    handler: async (args, context) => {
      const { wpRequest, config } = context;

      const introspectUrl = config.wpnavIntrospect;
      const data = await wpRequest(introspectUrl);

      return {
        content: [
          {
            type: 'text',
            text: context.clampText(JSON.stringify(data, null, 2)),
          },
        ],
      };
    },
    category: ToolCategory.CORE,
  });
}
