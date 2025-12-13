/**
 * Themes Tools Registration
 *
 * Handles: Theme management (install, activate, update, delete, revert)
 *
 * Uses custom WP Navigator REST endpoints (/wpnav/v1/themes/*) that bypass
 * WordPress core REST API limitations.
 *
 * @package WP_Navigator_Pro
 * @since 1.3.0
 */

import { toolRegistry, ToolCategory } from '../../tool-registry/index.js';
import { validateRequired } from '../../tool-registry/utils.js';

/**
 * Register theme management tools
 */
export function registerThemeTools() {
  // ============================================================================
  // LIST THEMES
  // ============================================================================
  toolRegistry.register({
    definition: {
      name: 'wpnav_list_themes',
      description: 'List all installed WordPress themes. Returns theme identifier in "stylesheet" field (use this exact value for get/activate/delete operations), name, version, and status (active/inactive). Stylesheet is typically a lowercase hyphenated name (e.g., "twentytwentyfour", "developer-starter").',
      inputSchema: {
        type: 'object',
        properties: {
          status: { type: 'string', description: 'Optional filter by status (e.g., "active" or "inactive"). If omitted or set to "all", returns all themes.' },
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
      const endpoint = qs ? `/wp/v2/themes?${qs}` : '/wp/v2/themes';
      const themes = await context.wpRequest(endpoint);

      return {
        content: [{ type: 'text', text: context.clampText(JSON.stringify(themes, null, 2)) }],
      };
    },
    category: ToolCategory.THEMES,
  });

  // ============================================================================
  // GET THEME
  // ============================================================================
  toolRegistry.register({
    definition: {
      name: 'wpnav_get_theme',
      description: 'Get details about a specific theme by slug. Returns full metadata including description, author, and version.',
      inputSchema: {
        type: 'object',
        properties: {
          stylesheet: { type: 'string', description: 'Theme stylesheet from wpnav_list_themes "stylesheet" field (e.g., "twentytwentyfour")' },
        },
        required: ['stylesheet'],
      },
    },
    handler: async (args, context) => {
      validateRequired(args, ['stylesheet']);

      const theme = await context.wpRequest(`/wp/v2/themes/${args.stylesheet}`);

      return {
        content: [{ type: 'text', text: context.clampText(JSON.stringify(theme, null, 2)) }],
      };
    },
    category: ToolCategory.THEMES,
  });

  // ============================================================================
  // INSTALL THEME
  // ============================================================================
  toolRegistry.register({
    definition: {
      name: 'wpnav_install_theme',
      description: 'Install a WordPress theme from WordPress.org by slug. Optionally activate after installation. Uses WP Navigator custom endpoint.',
      inputSchema: {
        type: 'object',
        properties: {
          slug: { type: 'string', description: 'Theme slug from WordPress.org (e.g., "flavor", "flavor-developer")' },
          activate: { type: 'boolean', description: 'Activate theme after installation (default: false)', default: false },
        },
        required: ['slug'],
      },
    },
    handler: async (args, context) => {
      try {
        validateRequired(args, ['slug']);

        const result = await context.wpRequest('/wpnav/v1/themes/install', {
          method: 'POST',
          body: JSON.stringify({
            slug: args.slug,
            activate: args.activate || false,
          }),
        });

        return {
          content: [{ type: 'text', text: context.clampText(JSON.stringify(result, null, 2)) }],
        };
      } catch (error: any) {
        const errorMessage = error.message || 'Unknown error';
        const isWritesDisabled = errorMessage.includes('WRITES_DISABLED');
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              error: isWritesDisabled ? 'writes_disabled' : 'operation_failed',
              code: isWritesDisabled ? 'WRITES_DISABLED' : 'INSTALL_FAILED',
              message: errorMessage,
              context: {
                resource_type: 'theme',
                slug: args.slug,
                suggestion: isWritesDisabled ? 'Set WPNAV_ENABLE_WRITES=1 in MCP server config (.mcp.json env section)' : 'Check theme slug exists on WordPress.org',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    },
    category: ToolCategory.THEMES,
  });

  // ============================================================================
  // ACTIVATE THEME
  // ============================================================================
  toolRegistry.register({
    definition: {
      name: 'wpnav_activate_theme',
      description: 'Activate a WordPress theme by stylesheet. The theme must already be installed. Use wpnav_list_themes to see available themes.',
      inputSchema: {
        type: 'object',
        properties: {
          stylesheet: { type: 'string', description: 'Theme stylesheet from wpnav_list_themes "stylesheet" field (e.g., "twentytwentyfour")' },
        },
        required: ['stylesheet'],
      },
    },
    handler: async (args, context) => {
      try {
        validateRequired(args, ['stylesheet']);

        const result = await context.wpRequest('/wpnav/v1/themes/activate', {
          method: 'POST',
          body: JSON.stringify({
            stylesheet: args.stylesheet,
          }),
        });

        return {
          content: [{ type: 'text', text: context.clampText(JSON.stringify(result, null, 2)) }],
        };
      } catch (error: any) {
        const errorMessage = error.message || 'Unknown error';
        const isWritesDisabled = errorMessage.includes('WRITES_DISABLED');
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              error: isWritesDisabled ? 'writes_disabled' : 'operation_failed',
              code: isWritesDisabled ? 'WRITES_DISABLED' : 'ACTIVATE_FAILED',
              message: errorMessage,
              context: {
                resource_type: 'theme',
                stylesheet: args.stylesheet,
                suggestion: isWritesDisabled ? 'Set WPNAV_ENABLE_WRITES=1 in MCP server config (.mcp.json env section)' : 'Check theme is installed with wpnav_list_themes',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    },
    category: ToolCategory.THEMES,
  });

  // ============================================================================
  // UPDATE THEME
  // ============================================================================
  toolRegistry.register({
    definition: {
      name: 'wpnav_update_theme',
      description: 'Update an installed WordPress theme to the latest version. The theme must be installed from WordPress.org.',
      inputSchema: {
        type: 'object',
        properties: {
          stylesheet: { type: 'string', description: 'Theme stylesheet from wpnav_list_themes "stylesheet" field (e.g., "flavor")' },
        },
        required: ['stylesheet'],
      },
    },
    handler: async (args, context) => {
      try {
        validateRequired(args, ['stylesheet']);

        const result = await context.wpRequest('/wpnav/v1/themes/update', {
          method: 'POST',
          body: JSON.stringify({
            stylesheet: args.stylesheet,
          }),
        });

        return {
          content: [{ type: 'text', text: context.clampText(JSON.stringify(result, null, 2)) }],
        };
      } catch (error: any) {
        const errorMessage = error.message || 'Unknown error';
        const isWritesDisabled = errorMessage.includes('WRITES_DISABLED');
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              error: isWritesDisabled ? 'writes_disabled' : 'operation_failed',
              code: isWritesDisabled ? 'WRITES_DISABLED' : 'UPDATE_FAILED',
              message: errorMessage,
              context: {
                resource_type: 'theme',
                stylesheet: args.stylesheet,
                suggestion: isWritesDisabled ? 'Set WPNAV_ENABLE_WRITES=1 in MCP server config (.mcp.json env section)' : 'Check theme is installed with wpnav_list_themes',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    },
    category: ToolCategory.THEMES,
  });

  // ============================================================================
  // DELETE THEME
  // ============================================================================
  toolRegistry.register({
    definition: {
      name: 'wpnav_delete_theme',
      description: 'Delete an installed WordPress theme. The theme must not be active - switch to a different theme first. Cannot delete parent theme while child theme is active.',
      inputSchema: {
        type: 'object',
        properties: {
          stylesheet: { type: 'string', description: 'Theme stylesheet from wpnav_list_themes "stylesheet" field (e.g., "flavor")' },
        },
        required: ['stylesheet'],
      },
    },
    handler: async (args, context) => {
      try {
        validateRequired(args, ['stylesheet']);

        const result = await context.wpRequest(`/wpnav/v1/themes/${args.stylesheet}`, {
          method: 'DELETE',
        });

        return {
          content: [{ type: 'text', text: context.clampText(JSON.stringify(result, null, 2)) }],
        };
      } catch (error: any) {
        const errorMessage = error.message || 'Unknown error';
        const isWritesDisabled = errorMessage.includes('WRITES_DISABLED');
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              error: isWritesDisabled ? 'writes_disabled' : 'operation_failed',
              code: isWritesDisabled ? 'WRITES_DISABLED' : 'DELETE_FAILED',
              message: errorMessage,
              context: {
                resource_type: 'theme',
                stylesheet: args.stylesheet,
                suggestion: isWritesDisabled ? 'Set WPNAV_ENABLE_WRITES=1 in MCP server config (.mcp.json env section)' : 'Check theme is not active and exists with wpnav_list_themes',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    },
    category: ToolCategory.THEMES,
  });

  // ============================================================================
  // REVERT THEME
  // ============================================================================
  toolRegistry.register({
    definition: {
      name: 'wpnav_revert_theme',
      description: 'Revert to the previously active theme. WordPress stores the previous theme when switching. Use this to quickly undo a theme change.',
      inputSchema: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
    handler: async (args, context) => {
      try {
        const result = await context.wpRequest('/wpnav/v1/themes/revert', {
          method: 'POST',
        });

        return {
          content: [{ type: 'text', text: context.clampText(JSON.stringify(result, null, 2)) }],
        };
      } catch (error: any) {
        const errorMessage = error.message || 'Unknown error';
        const isWritesDisabled = errorMessage.includes('WRITES_DISABLED');
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              error: isWritesDisabled ? 'writes_disabled' : 'operation_failed',
              code: isWritesDisabled ? 'WRITES_DISABLED' : 'REVERT_FAILED',
              message: errorMessage,
              context: {
                resource_type: 'theme',
                suggestion: isWritesDisabled ? 'Set WPNAV_ENABLE_WRITES=1 in MCP server config (.mcp.json env section)' : 'Ensure a previous theme exists to revert to',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    },
    category: ToolCategory.THEMES,
  });
}
