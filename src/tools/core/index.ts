/**
 * Core Tools Registration
 *
 * @package WP_Navigator_Pro
 * @since 1.3.0
 */

import { toolRegistry, ToolCategory } from '../../tool-registry/index.js';
import { discoverCookbooks, type LoadedSkillCookbook } from '../../cookbook/index.js';
import { discoverRoles } from '../../roles/index.js';

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

      // Fetch introspect, active plugins, and current user in parallel
      const [introspectData, wpPlugins, currentUser] = await Promise.all([
        wpRequest(config.wpnavIntrospect),
        wpRequest('/wp/v2/plugins?status=active').catch(() => []),
        wpRequest('/wp/v2/users/me').catch(() => null),
      ]);

      // Discover available cookbooks and roles
      const { cookbooks } = discoverCookbooks();
      const { roles: rolesMap } = discoverRoles();

      // Extract active plugin slugs from WordPress response
      // WordPress plugin slugs are in format "plugin-dir/plugin-file.php"
      const pluginArray = Array.isArray(wpPlugins) ? wpPlugins : [];
      const activePluginSlugs = new Set(
        pluginArray.map((p: { plugin?: string }) => {
          const pluginFile = p.plugin || '';
          return pluginFile.split('/')[0] || pluginFile;
        })
      );

      // Build available_cookbooks array
      const availableCookbooks = Array.from(cookbooks.entries()).map(([slug, cookbook]) => {
        const skillCookbook = cookbook as LoadedSkillCookbook;
        return {
          slug,
          description: skillCookbook.skillFrontmatter?.description || null,
          detected: activePluginSlugs.has(slug),
        };
      });

      // Build available_roles array and determine recommended role
      const availableRoles = Array.from(rolesMap.keys()).sort();

      // Determine recommended role based on WordPress user capabilities
      const userRoles: string[] = (currentUser as any)?.roles || [];
      let recommendedRole = 'content-editor'; // Safe default

      if (userRoles.includes('administrator')) {
        recommendedRole = 'site-admin';
      } else if (userRoles.includes('editor')) {
        recommendedRole = 'content-editor';
      } else if (userRoles.includes('author') || userRoles.includes('contributor')) {
        recommendedRole = 'content-editor';
      }
      // For subscriber or unknown roles, default to content-editor (already set)

      // Augment response with cookbook and role discovery
      const response = {
        ...(introspectData as object),
        available_cookbooks: availableCookbooks,
        roles: {
          available: availableRoles,
          recommended: recommendedRole,
          count: availableRoles.length,
        },
      };

      return {
        content: [
          {
            type: 'text',
            text: context.clampText(JSON.stringify(response, null, 2)),
          },
        ],
      };
    },
    category: ToolCategory.CORE,
  });

  // ============================================================================
  // wpnav_get_site_overview - Comprehensive site summary for AI agents
  // ============================================================================
  toolRegistry.register({
    definition: {
      name: 'wpnav_get_site_overview',
      description:
        'Get a comprehensive site overview including WordPress version, theme info, plugin counts, content summary, and user counts by role. Designed for AI agents to quickly understand site structure without multiple API calls.',
      inputSchema: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
    handler: async (args, context) => {
      const { wpRequest, config } = context;

      // Fetch data from multiple endpoints in parallel
      const [siteSettings, activeTheme, plugins, posts, pages, media, users, categories, tags] =
        await Promise.all([
          // Site settings (name, description, URL)
          wpRequest('/wp/v2/settings').catch(() => ({})),
          // Active theme
          wpRequest('/wp/v2/themes?status=active').catch(() => []),
          // All plugins
          wpRequest('/wp/v2/plugins').catch(() => []),
          // Post count (just need total from headers, fetch 1)
          wpRequest('/wp/v2/posts?per_page=1&_fields=id').catch(() => []),
          // Page count
          wpRequest('/wp/v2/pages?per_page=1&_fields=id').catch(() => []),
          // Media count
          wpRequest('/wp/v2/media?per_page=1&_fields=id').catch(() => []),
          // Users (to count by role)
          wpRequest('/wp/v2/users?per_page=100&_fields=id,roles').catch(() => []),
          // Categories count
          wpRequest('/wp/v2/categories?per_page=1&_fields=id').catch(() => []),
          // Tags count
          wpRequest('/wp/v2/tags?per_page=1&_fields=id').catch(() => []),
        ]);

      // Process theme info
      const theme = Array.isArray(activeTheme) && activeTheme.length > 0 ? activeTheme[0] : null;
      const themeInfo: Record<string, unknown> = {};
      if (theme) {
        themeInfo.name = theme.name?.rendered || theme.stylesheet || 'Unknown';
        themeInfo.version = theme.version || 'Unknown';
        themeInfo.stylesheet = theme.stylesheet || '';
        if (theme.template && theme.template !== theme.stylesheet) {
          themeInfo.parent_theme = theme.template;
          themeInfo.is_child_theme = true;
        } else {
          themeInfo.is_child_theme = false;
        }
      }

      // Process plugin counts
      const pluginList = Array.isArray(plugins) ? plugins : [];
      const activePlugins = pluginList.filter((p: any) => p.status === 'active');
      const inactivePlugins = pluginList.filter((p: any) => p.status === 'inactive');

      // Process user counts by role
      const userList = Array.isArray(users) ? users : [];
      const usersByRole: Record<string, number> = {};
      for (const user of userList) {
        const roles = Array.isArray(user.roles) ? user.roles : [];
        for (const role of roles) {
          usersByRole[role] = (usersByRole[role] || 0) + 1;
        }
      }

      // Build overview response
      const overview = {
        site: {
          name: siteSettings.title || 'Unknown',
          description: siteSettings.description || '',
          url: config.baseUrl,
          admin_email: siteSettings.email || '',
        },
        wordpress: {
          // Note: WP version requires introspect endpoint
          api_version: 'v2',
          rest_url: config.restApi,
        },
        theme: Object.keys(themeInfo).length > 0 ? themeInfo : null,
        plugins: {
          total: pluginList.length,
          active: activePlugins.length,
          inactive: inactivePlugins.length,
        },
        content: {
          posts: Array.isArray(posts) ? 'available' : 'error',
          pages: Array.isArray(pages) ? 'available' : 'error',
          media: Array.isArray(media) ? 'available' : 'error',
          categories: Array.isArray(categories) ? 'available' : 'error',
          tags: Array.isArray(tags) ? 'available' : 'error',
        },
        users: {
          total: userList.length,
          by_role: usersByRole,
        },
        config: {
          writes_enabled: config.toggles.enableWrites,
          timeout_ms: config.toggles.toolTimeoutMs,
        },
      };

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(overview, null, 2),
          },
        ],
      };
    },
    category: ToolCategory.CORE,
  });

  // ============================================================================
  // wpnav_list_post_types - Post types discovery
  // ============================================================================
  toolRegistry.register({
    definition: {
      name: 'wpnav_list_post_types',
      description:
        'List all registered WordPress post types including custom types (products, events, etc.). Returns REST API support status, capabilities, and hierarchical status for each type.',
      inputSchema: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
    handler: async (args, context) => {
      const types = await context.wpRequest('/wp/v2/types');

      // Transform object to array with type metadata
      const typeList = Object.entries(types).map(([slug, typeData]: [string, any]) => ({
        slug,
        name: typeData.name,
        description: typeData.description || null,
        hierarchical: typeData.hierarchical || false,
        rest_base: typeData.rest_base || slug,
        rest_namespace: typeData.rest_namespace || 'wp/v2',
      }));

      return {
        content: [{ type: 'text', text: context.clampText(JSON.stringify(typeList, null, 2)) }],
      };
    },
    category: ToolCategory.CORE,
  });
}
