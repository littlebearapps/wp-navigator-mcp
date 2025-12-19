/**
 * Rewrite Rules Tools Registration
 *
 * Handles: WordPress rewrite/permalink rules management
 *
 * @package WP_Navigator_Pro
 * @since 2.8.0
 */

import { toolRegistry, ToolCategory } from '../../tool-registry/index.js';

/**
 * Register rewrite rules tools
 */
export function registerRewriteTools() {
  // ============================================================================
  // GET REWRITE RULES
  // ============================================================================
  toolRegistry.register({
    definition: {
      name: 'wpnav_get_rewrite_rules',
      description:
        'List WordPress permalink rewrite rules. Returns all registered URL rewrite patterns, ' +
        'the current permalink structure, and whether mod_rewrite is in use.',
      inputSchema: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
    handler: async (_args, context) => {
      const result = await context.wpRequest('/wpnav/v1/rewrite/rules');

      return {
        content: [{ type: 'text', text: context.clampText(JSON.stringify(result, null, 2)) }],
      };
    },
    category: ToolCategory.MAINTENANCE,
  });

  // ============================================================================
  // FLUSH REWRITE RULES
  // ============================================================================
  toolRegistry.register({
    definition: {
      name: 'wpnav_flush_rewrite',
      description:
        'Flush WordPress rewrite rules. Use this to regenerate permalink rules after changes. ' +
        'The "hard" option also recreates the .htaccess file (Apache) or web.config (IIS).',
      inputSchema: {
        type: 'object',
        properties: {
          hard: {
            type: 'boolean',
            description:
              'Perform a hard flush that recreates .htaccess/web.config (default: false)',
          },
        },
        required: [],
      },
    },
    handler: async (args, context) => {
      const body: Record<string, unknown> = {};

      if (args.hard !== undefined) {
        body.hard = args.hard;
      }

      const result = await context.wpRequest('/wpnav/v1/rewrite/flush', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      return {
        content: [{ type: 'text', text: context.clampText(JSON.stringify(result, null, 2)) }],
      };
    },
    category: ToolCategory.MAINTENANCE,
  });
}
