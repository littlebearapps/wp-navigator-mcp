/**
 * Maintenance Mode Tools Registration
 *
 * Handles: WordPress maintenance mode status and control
 *
 * @package WP_Navigator_Pro
 * @since 2.8.0
 */

import { toolRegistry, ToolCategory } from '../../tool-registry/index.js';
import { validateRequired } from '../../tool-registry/utils.js';

/**
 * Register maintenance mode tools
 */
export function registerMaintenanceModeTools() {
  // ============================================================================
  // GET MAINTENANCE STATUS
  // ============================================================================
  toolRegistry.register({
    definition: {
      name: 'wpnav_get_maintenance',
      description:
        'Check WordPress maintenance mode status. Returns whether maintenance mode is currently enabled.',
      inputSchema: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
    handler: async (_args, context) => {
      const result = await context.wpRequest('/wpnav/v1/maintenance');

      return {
        content: [{ type: 'text', text: context.clampText(JSON.stringify(result, null, 2)) }],
      };
    },
    category: ToolCategory.MAINTENANCE,
  });

  // ============================================================================
  // SET MAINTENANCE MODE
  // ============================================================================
  toolRegistry.register({
    definition: {
      name: 'wpnav_set_maintenance',
      description:
        'Enable or disable WordPress maintenance mode. Can set a custom message, timeout duration, ' +
        'and optionally allow admin access during maintenance.',
      inputSchema: {
        type: 'object',
        properties: {
          enabled: {
            type: 'boolean',
            description: 'Whether to enable (true) or disable (false) maintenance mode',
          },
          message: {
            type: 'string',
            description: 'Custom maintenance message shown to visitors (optional)',
          },
          timeout: {
            type: 'integer',
            description:
              'Duration in seconds (60-86400). Maintenance mode auto-disables after this time.',
            minimum: 60,
            maximum: 86400,
          },
          allow_admins: {
            type: 'boolean',
            description: 'Allow admin users to access the site during maintenance (default: true)',
          },
        },
        required: ['enabled'],
      },
    },
    handler: async (args, context) => {
      validateRequired(args, ['enabled']);

      // Build request body
      const body: Record<string, unknown> = {
        enabled: args.enabled,
      };

      if (args.message !== undefined) {
        body.message = args.message;
      }

      if (args.timeout !== undefined) {
        // Validate timeout range
        const timeout = parseInt(args.timeout, 10);
        if (isNaN(timeout) || timeout < 60 || timeout > 86400) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    error: 'INVALID_TIMEOUT',
                    message: 'Timeout must be between 60 and 86400 seconds (1 minute to 24 hours).',
                  },
                  null,
                  2
                ),
              },
            ],
            isError: true,
          };
        }
        body.timeout = timeout;
      }

      if (args.allow_admins !== undefined) {
        body.allow_admins = args.allow_admins;
      }

      const result = await context.wpRequest('/wpnav/v1/maintenance', {
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
