/**
 * Site Settings Tools Registration
 *
 * Handles: WordPress core settings read/write
 *
 * @package WP_Navigator_Pro
 * @since 2.8.0
 */

import { toolRegistry, ToolCategory } from '../../tool-registry/index.js';
import { validateRequired } from '../../tool-registry/utils.js';

/**
 * Register site settings tools
 */
export function registerSettingsTools() {
  // ============================================================================
  // GET SITE SETTINGS
  // ============================================================================
  toolRegistry.register({
    definition: {
      name: 'wpnav_site_settings',
      description:
        'Read WordPress core settings like blogname, blogdescription, timezone, date format, etc. ' +
        'Returns settings grouped by category (general, reading, discussion, media, permalinks) ' +
        'and indicates which settings are read-only.',
      inputSchema: {
        type: 'object',
        properties: {
          keys: {
            type: 'array',
            items: { type: 'string' },
            description:
              'Optional list of specific setting keys to retrieve (e.g., ["blogname", "timezone_string"])',
          },
        },
        required: [],
      },
    },
    handler: async (args, context) => {
      const params = new URLSearchParams();

      // Add keys filter if provided
      if (args.keys && Array.isArray(args.keys) && args.keys.length > 0) {
        args.keys.forEach((key: string) => {
          params.append('keys[]', key);
        });
      }

      const queryString = params.toString();
      const endpoint = queryString ? `/wpnav/v1/settings?${queryString}` : '/wpnav/v1/settings';
      const result = await context.wpRequest(endpoint);

      return {
        content: [{ type: 'text', text: context.clampText(JSON.stringify(result, null, 2)) }],
      };
    },
    category: ToolCategory.SETTINGS,
  });

  // ============================================================================
  // UPDATE SITE SETTINGS
  // ============================================================================
  toolRegistry.register({
    definition: {
      name: 'wpnav_update_settings',
      description:
        'Update WordPress core settings. Accepts an object of setting key-value pairs. ' +
        'Read-only settings (siteurl, home) are automatically rejected by the plugin. ' +
        'Returns which settings were updated and which were rejected.',
      inputSchema: {
        type: 'object',
        properties: {
          settings: {
            type: 'object',
            description:
              'Object of settings to update (e.g., {"blogname": "New Name", "blogdescription": "New tagline"})',
            additionalProperties: true,
          },
        },
        required: ['settings'],
      },
    },
    handler: async (args, context) => {
      validateRequired(args, ['settings']);

      if (typeof args.settings !== 'object' || args.settings === null) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  error: 'INVALID_SETTINGS',
                  message: 'The "settings" parameter must be an object with key-value pairs.',
                },
                null,
                2
              ),
            },
          ],
          isError: true,
        };
      }

      const result = await context.wpRequest('/wpnav/v1/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: args.settings }),
      });

      return {
        content: [{ type: 'text', text: context.clampText(JSON.stringify(result, null, 2)) }],
      };
    },
    category: ToolCategory.SETTINGS,
  });
}
