/**
 * Plugins Tools Registration
 *
 * Handles: Plugin management (install, activate, deactivate, update, delete)
 *
 * @package WP_Navigator_Pro
 * @since 1.3.0
 */

import { toolRegistry, ToolCategory } from '../../tool-registry/index.js';
import { validateRequired } from '../../tool-registry/utils.js';

/**
 * Normalize plugin identifier for WordPress REST API.
 *
 * Claude Code's MCP client may pre-encode the `/` character to `%2F` in parameters.
 * We first decode any URL-encoded characters, then re-encode individual path segments
 * while preserving the slash separator.
 *
 * The MCP server uses `/wp-json/` path format (not `?rest_route=` query format).
 * With path format, the slash in plugin identifiers (e.g., "wordfence/wordfence")
 * must NOT be encoded, as web servers decode %2F differently in paths vs query strings.
 *
 * @example normalizePluginPath('hello') => 'hello'
 * @example normalizePluginPath('wordfence/wordfence') => 'wordfence/wordfence'
 * @example normalizePluginPath('wordfence%2Fwordfence') => 'wordfence/wordfence'
 * @example normalizePluginPath('my plugin/my-file') => 'my%20plugin/my-file'
 */
function normalizePluginPath(plugin: string): string {
  // First decode any URL-encoded characters (handles pre-encoded input from Claude Code)
  const decoded = decodeURIComponent(plugin);
  // Then encode individual parts but preserve the slash for /wp-json/ path format
  const result = decoded
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/');
  return result;
}

/**
 * Register plugin management tools
 */
export function registerPluginTools() {
  // ============================================================================
  // LIST PLUGINS
  // ============================================================================
  toolRegistry.register({
    definition: {
      name: 'wpnav_list_plugins',
      description:
        'List all installed WordPress plugins. Returns plugin identifier in "plugin" field (use this exact value for activate/deactivate/delete operations), name, version, and status (active/inactive). Format varies: single-file plugins use just the name (e.g., "hello"), directory plugins use "directory/file" without .php extension (e.g., "wordfence/wordfence", "wp-navigator-pro/wp-navigator-pro").',
      inputSchema: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            description:
              'Optional filter by status (e.g., "active" or "inactive"). If omitted or set to "all", returns all plugins.',
          },
        },
        required: [],
      },
    },
    handler: async (args, context) => {
      const params = new URLSearchParams();
      if (args.status && args.status !== 'all') {
        params.append('status', args.status);
      }

      const qs = params.toString();
      const endpoint = qs ? `/wp/v2/plugins?${qs}` : '/wp/v2/plugins';
      const plugins = await context.wpRequest(endpoint);

      return {
        content: [{ type: 'text', text: context.clampText(JSON.stringify(plugins, null, 2)) }],
      };
    },
    category: ToolCategory.PLUGINS,
  });

  // ============================================================================
  // GET PLUGIN
  // ============================================================================
  toolRegistry.register({
    definition: {
      name: 'wpnav_get_plugin',
      description:
        'Get details about a specific plugin by slug. Returns full metadata including description, author, and version.',
      inputSchema: {
        type: 'object',
        properties: {
          plugin: {
            type: 'string',
            description:
              'Plugin identifier from wpnav_list_plugins "plugin" field (e.g., "wordfence/wordfence", "hello"). Do NOT include .php extension.',
          },
        },
        required: ['plugin'],
      },
    },
    handler: async (args, context) => {
      validateRequired(args, ['plugin']);
      const endpoint = `/wp/v2/plugins/${normalizePluginPath(args.plugin)}`;
      const plugin = await context.wpRequest(endpoint);

      return {
        content: [{ type: 'text', text: context.clampText(JSON.stringify(plugin, null, 2)) }],
      };
    },
    category: ToolCategory.PLUGINS,
  });

  // ============================================================================
  // INSTALL PLUGIN
  // ============================================================================
  toolRegistry.register({
    definition: {
      name: 'wpnav_install_plugin',
      description:
        'Install a WordPress plugin from WordPress.org by slug. Changes are logged in audit trail.',
      inputSchema: {
        type: 'object',
        properties: {
          slug: { type: 'string', description: 'Plugin slug from WordPress.org (e.g., "akismet")' },
          activate: {
            type: 'boolean',
            description: 'Activate plugin after installation (default: false)',
            default: false,
          },
        },
        required: ['slug'],
      },
    },
    handler: async (args, context) => {
      try {
        validateRequired(args, ['slug']);

        const installData: any = { slug: args.slug };
        if (args.activate) {
          installData.status = 'active';
        }

        const result = await context.wpRequest('/wp/v2/plugins', {
          method: 'POST',
          body: JSON.stringify(installData),
        });

        return {
          content: [
            {
              type: 'text',
              text: context.clampText(
                JSON.stringify(
                  {
                    plugin: result.plugin,
                    name: result.name,
                    version: result.version,
                    status: result.status,
                    message: 'Plugin installed successfully',
                  },
                  null,
                  2
                )
              ),
            },
          ],
        };
      } catch (error: any) {
        const errorMessage = error.message || 'Unknown error';
        const isWritesDisabled = errorMessage.includes('WRITES_DISABLED');
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  error: isWritesDisabled ? 'writes_disabled' : 'operation_failed',
                  code: isWritesDisabled ? 'WRITES_DISABLED' : 'INSTALL_FAILED',
                  message: errorMessage,
                  context: {
                    resource_type: 'plugin',
                    slug: args.slug,
                    suggestion: isWritesDisabled
                      ? 'Set WPNAV_ENABLE_WRITES=1 in MCP server config (.mcp.json env section)'
                      : 'Check plugin slug exists on WordPress.org',
                  },
                },
                null,
                2
              ),
            },
          ],
          isError: true,
        };
      }
    },
    category: ToolCategory.PLUGINS,
  });

  // ============================================================================
  // ACTIVATE PLUGIN
  // ============================================================================
  toolRegistry.register({
    definition: {
      name: 'wpnav_activate_plugin',
      description: 'Activate a WordPress plugin by slug. Changes are logged in audit trail.',
      inputSchema: {
        type: 'object',
        properties: {
          plugin: {
            type: 'string',
            description:
              'Plugin identifier from wpnav_list_plugins "plugin" field (e.g., "wordfence/wordfence", "hello"). Do NOT include .php extension.',
          },
        },
        required: ['plugin'],
      },
    },
    handler: async (args, context) => {
      try {
        validateRequired(args, ['plugin']);

        const result = await context.wpRequest(
          `/wp/v2/plugins/${normalizePluginPath(args.plugin)}`,
          {
            method: 'POST',
            body: JSON.stringify({ status: 'active' }),
          }
        );

        return {
          content: [
            {
              type: 'text',
              text: context.clampText(
                JSON.stringify(
                  {
                    plugin: result.plugin,
                    name: result.name,
                    status: result.status,
                    message: 'Plugin activated successfully',
                  },
                  null,
                  2
                )
              ),
            },
          ],
        };
      } catch (error: any) {
        const errorMessage = error.message || 'Unknown error';
        const isWritesDisabled = errorMessage.includes('WRITES_DISABLED');
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  error: isWritesDisabled ? 'writes_disabled' : 'operation_failed',
                  code: isWritesDisabled ? 'WRITES_DISABLED' : 'ACTIVATE_FAILED',
                  message: errorMessage,
                  context: {
                    resource_type: 'plugin',
                    plugin: args.plugin,
                    suggestion: isWritesDisabled
                      ? 'Set WPNAV_ENABLE_WRITES=1 in MCP server config (.mcp.json env section)'
                      : 'Check plugin is installed with wpnav_list_plugins',
                  },
                },
                null,
                2
              ),
            },
          ],
          isError: true,
        };
      }
    },
    category: ToolCategory.PLUGINS,
  });

  // ============================================================================
  // DEACTIVATE PLUGIN
  // ============================================================================
  toolRegistry.register({
    definition: {
      name: 'wpnav_deactivate_plugin',
      description: 'Deactivate a WordPress plugin by slug. Changes are logged in audit trail.',
      inputSchema: {
        type: 'object',
        properties: {
          plugin: {
            type: 'string',
            description:
              'Plugin identifier from wpnav_list_plugins "plugin" field (e.g., "wordfence/wordfence", "hello"). Do NOT include .php extension.',
          },
        },
        required: ['plugin'],
      },
    },
    handler: async (args, context) => {
      try {
        validateRequired(args, ['plugin']);

        const result = await context.wpRequest(
          `/wp/v2/plugins/${normalizePluginPath(args.plugin)}`,
          {
            method: 'POST',
            body: JSON.stringify({ status: 'inactive' }),
          }
        );

        return {
          content: [
            {
              type: 'text',
              text: context.clampText(
                JSON.stringify(
                  {
                    plugin: result.plugin,
                    name: result.name,
                    status: result.status,
                    message: 'Plugin deactivated successfully',
                  },
                  null,
                  2
                )
              ),
            },
          ],
        };
      } catch (error: any) {
        const errorMessage = error.message || 'Unknown error';
        const isWritesDisabled = errorMessage.includes('WRITES_DISABLED');
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  error: isWritesDisabled ? 'writes_disabled' : 'operation_failed',
                  code: isWritesDisabled ? 'WRITES_DISABLED' : 'DEACTIVATE_FAILED',
                  message: errorMessage,
                  context: {
                    resource_type: 'plugin',
                    plugin: args.plugin,
                    suggestion: isWritesDisabled
                      ? 'Set WPNAV_ENABLE_WRITES=1 in MCP server config (.mcp.json env section)'
                      : 'Check plugin exists with wpnav_list_plugins',
                  },
                },
                null,
                2
              ),
            },
          ],
          isError: true,
        };
      }
    },
    category: ToolCategory.PLUGINS,
  });

  // ============================================================================
  // UPDATE PLUGIN
  // ============================================================================
  toolRegistry.register({
    definition: {
      name: 'wpnav_update_plugin',
      description:
        'Update a WordPress plugin to the latest version. Changes are logged in audit trail.',
      inputSchema: {
        type: 'object',
        properties: {
          plugin: {
            type: 'string',
            description:
              'Plugin identifier from wpnav_list_plugins "plugin" field (e.g., "wordfence/wordfence", "hello"). Do NOT include .php extension.',
          },
        },
        required: ['plugin'],
      },
    },
    handler: async (args, context) => {
      try {
        validateRequired(args, ['plugin']);

        const result = await context.wpRequest(
          `/wp/v2/plugins/${normalizePluginPath(args.plugin)}`,
          {
            method: 'POST',
            body: JSON.stringify({ status: 'active' }), // Update endpoint uses POST with current status
          }
        );

        return {
          content: [
            {
              type: 'text',
              text: context.clampText(
                JSON.stringify(
                  {
                    plugin: result.plugin,
                    name: result.name,
                    version: result.version,
                    message: 'Plugin updated successfully',
                  },
                  null,
                  2
                )
              ),
            },
          ],
        };
      } catch (error: any) {
        const errorMessage = error.message || 'Unknown error';
        const isWritesDisabled = errorMessage.includes('WRITES_DISABLED');
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  error: isWritesDisabled ? 'writes_disabled' : 'operation_failed',
                  code: isWritesDisabled ? 'WRITES_DISABLED' : 'UPDATE_FAILED',
                  message: errorMessage,
                  context: {
                    resource_type: 'plugin',
                    plugin: args.plugin,
                    suggestion: isWritesDisabled
                      ? 'Set WPNAV_ENABLE_WRITES=1 in MCP server config (.mcp.json env section)'
                      : 'Check plugin is installed with wpnav_list_plugins',
                  },
                },
                null,
                2
              ),
            },
          ],
          isError: true,
        };
      }
    },
    category: ToolCategory.PLUGINS,
  });

  // ============================================================================
  // DELETE PLUGIN
  // ============================================================================
  toolRegistry.register({
    definition: {
      name: 'wpnav_delete_plugin',
      description:
        'Delete a WordPress plugin by slug. Plugin must be deactivated first. WARNING: This permanently deletes the plugin files.',
      inputSchema: {
        type: 'object',
        properties: {
          plugin: {
            type: 'string',
            description:
              'Plugin identifier from wpnav_list_plugins "plugin" field (e.g., "wordfence/wordfence", "hello"). Do NOT include .php extension.',
          },
        },
        required: ['plugin'],
      },
    },
    handler: async (args, context) => {
      try {
        validateRequired(args, ['plugin']);

        const result = await context.wpRequest(
          `/wp/v2/plugins/${normalizePluginPath(args.plugin)}`,
          {
            method: 'DELETE',
          }
        );

        return {
          content: [
            {
              type: 'text',
              text: context.clampText(
                JSON.stringify(
                  {
                    plugin: result.plugin,
                    message: 'Plugin deleted successfully',
                  },
                  null,
                  2
                )
              ),
            },
          ],
        };
      } catch (error: any) {
        const errorMessage = error.message || 'Unknown error';
        const isWritesDisabled = errorMessage.includes('WRITES_DISABLED');
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  error: isWritesDisabled ? 'writes_disabled' : 'operation_failed',
                  code: isWritesDisabled ? 'WRITES_DISABLED' : 'DELETE_FAILED',
                  message: errorMessage,
                  context: {
                    resource_type: 'plugin',
                    plugin: args.plugin,
                    suggestion: isWritesDisabled
                      ? 'Set WPNAV_ENABLE_WRITES=1 in MCP server config (.mcp.json env section)'
                      : 'Check plugin is deactivated first with wpnav_deactivate_plugin',
                  },
                },
                null,
                2
              ),
            },
          ],
          isError: true,
        };
      }
    },
    category: ToolCategory.PLUGINS,
  });
}
