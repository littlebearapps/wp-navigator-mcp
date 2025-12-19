/**
 * Options/Settings Tools Registration
 *
 * Handles: WordPress options read/write with plugin-prefix safety
 *
 * @package WP_Navigator_Pro
 * @since 2.8.0
 */

import { toolRegistry, ToolCategory } from '../../tool-registry/index.js';
import { validateRequired } from '../../tool-registry/utils.js';

/**
 * Normalize plugin slug to option prefix.
 * e.g., "woocommerce/woocommerce" → "woocommerce_"
 * e.g., "yoast-seo" → "yoast_seo_"
 */
function slugToPrefix(slug: string): string {
  // Take first part if directory plugin
  const base = slug.includes('/') ? slug.split('/')[0] : slug;
  // Replace hyphens with underscores, add trailing underscore
  return base.replace(/-/g, '_') + '_';
}

/**
 * Get allowed option prefixes from introspect data
 */
async function getAllowedPrefixes(context: any): Promise<string[]> {
  const introspect = await context.wpRequest('/wpnav/v1/introspect');
  const plugins = introspect.detected_plugins || [];

  // Convert plugin slugs to option prefixes
  const prefixes = plugins
    .map((p: any) => {
      // Use explicit option_prefix if provided, otherwise derive from slug
      return p.option_prefix || slugToPrefix(p.slug || p.plugin || '');
    })
    .filter((p: string) => p.length > 1);

  return prefixes;
}

/**
 * Register options tools
 */
export function registerOptionsTools() {
  // ============================================================================
  // GET OPTION
  // ============================================================================
  toolRegistry.register({
    definition: {
      name: 'wpnav_get_option',
      description:
        'Read a WordPress option by name. Returns the option value or default if not found.',
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Option name (e.g., "blogname", "woocommerce_currency")',
          },
          default: {
            description: 'Default value if option not found (optional)',
          },
        },
        required: ['name'],
      },
    },
    handler: async (args, context) => {
      validateRequired(args, ['name']);

      const params = new URLSearchParams();
      params.append('name', args.name);
      if (args.default !== undefined) {
        params.append('default', JSON.stringify(args.default));
      }

      const result = await context.wpRequest(`/wpnav/v1/options?${params.toString()}`);

      return {
        content: [{ type: 'text', text: context.clampText(JSON.stringify(result, null, 2)) }],
      };
    },
    category: ToolCategory.SETTINGS,
  });

  // ============================================================================
  // SET OPTION (with safety)
  // ============================================================================
  toolRegistry.register({
    definition: {
      name: 'wpnav_set_option',
      description:
        'Modify a WordPress option. SAFETY: Only options from detected plugins are allowed (e.g., woocommerce_*, yoast_*, elementor_*). Core WordPress options are blocked.',
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Option name (must match a detected plugin prefix)',
          },
          value: {
            description: 'New value for the option (any JSON-serializable type)',
          },
          autoload: {
            type: 'boolean',
            description: 'Whether to autoload option (default: keep existing)',
          },
        },
        required: ['name', 'value'],
      },
    },
    handler: async (args, context) => {
      validateRequired(args, ['name', 'value']);

      // Safety check: get allowed prefixes from introspect
      const allowedPrefixes = await getAllowedPrefixes(context);

      // Check if option name starts with an allowed prefix
      const isAllowed = allowedPrefixes.some((prefix) =>
        args.name.toLowerCase().startsWith(prefix.toLowerCase())
      );

      if (!isAllowed) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  error: 'OPTION_NOT_ALLOWED',
                  message: `Option '${args.name}' is not in the allowed list. Only plugin options are writable.`,
                  allowed_prefixes: allowedPrefixes,
                  hint: 'Only options from detected plugins can be modified for safety.',
                },
                null,
                2
              ),
            },
          ],
          isError: true,
        };
      }

      // Build request body
      const body: any = {
        name: args.name,
        value: args.value,
      };
      if (args.autoload !== undefined) {
        body.autoload = args.autoload;
      }

      const result = await context.wpRequest('/wpnav/v1/options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      return {
        content: [{ type: 'text', text: context.clampText(JSON.stringify(result, null, 2)) }],
      };
    },
    category: ToolCategory.SETTINGS,
  });
}
