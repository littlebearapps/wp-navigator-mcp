/**
 * Cookbook Tools Registration
 *
 * Tools for discovering and loading plugin-specific AI guidance cookbooks.
 *
 * @package WP_Navigator_MCP
 * @since 2.1.0
 */

import { toolRegistry, ToolCategory } from '../../tool-registry/index.js';
import {
  discoverCookbooks,
  getCookbook,
  matchCookbooksToPlugins,
  type LoadedSkillCookbook,
  type PluginInfo,
} from '../../cookbook/index.js';

/**
 * Register cookbook tools
 */
export function registerCookbookTools() {
  // ============================================================================
  // wpnav_list_cookbooks - List available cookbooks
  // ============================================================================
  toolRegistry.register({
    definition: {
      name: 'wpnav_list_cookbooks',
      description:
        'List all available plugin cookbooks with metadata. Cookbooks provide AI guidance for specific WordPress plugins like Gutenberg, Elementor, etc. Returns slug, name, version, source (bundled/project), and version requirements.',
      inputSchema: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
    handler: async (_args, _context) => {
      const { cookbooks, sources } = discoverCookbooks();

      const cookbookList = Array.from(cookbooks.entries()).map(([slug, cookbook]) => {
        const skillCookbook = cookbook as LoadedSkillCookbook;
        return {
          slug,
          name: cookbook.plugin.name,
          version: cookbook.cookbook_version,
          source: cookbook.source,
          min_plugin_version: cookbook.plugin.min_version || null,
          max_plugin_version: cookbook.plugin.max_version || null,
          has_skill_body: !!skillCookbook.skillBody,
          allowed_tools_count: skillCookbook.allowedTools?.length || 0,
        };
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                total: cookbookList.length,
                cookbooks: cookbookList,
                sources: {
                  bundled: sources.bundled.length,
                  project: sources.project.length,
                },
              },
              null,
              2
            ),
          },
        ],
      };
    },
    category: ToolCategory.COOKBOOK,
  });

  // ============================================================================
  // wpnav_get_cookbook - Get full cookbook content by slug
  // ============================================================================
  toolRegistry.register({
    definition: {
      name: 'wpnav_get_cookbook',
      description:
        'Get full cookbook content for a specific plugin by slug. Returns the SKILL.md body (AI guidance), frontmatter metadata, and allowed tools list. Use this to load guidance before working with a specific plugin.',
      inputSchema: {
        type: 'object',
        properties: {
          slug: {
            type: 'string',
            description: 'Plugin slug (e.g., "gutenberg", "elementor")',
          },
        },
        required: ['slug'],
      },
    },
    handler: async (args, context) => {
      const { slug } = args as { slug: string };

      if (!slug || typeof slug !== 'string') {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ error: 'Missing required parameter: slug' }),
            },
          ],
          isError: true,
        };
      }

      const cookbook = getCookbook(slug);

      if (!cookbook) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                error: `Cookbook not found: ${slug}`,
                available: discoverCookbooks().cookbooks.size,
                hint: 'Use wpnav_list_cookbooks to see available cookbooks',
              }),
            },
          ],
          isError: true,
        };
      }

      const skillCookbook = cookbook as LoadedSkillCookbook;

      const result = {
        slug: cookbook.plugin.slug,
        name: cookbook.plugin.name,
        version: cookbook.cookbook_version,
        source: cookbook.source,
        plugin: {
          min_version: cookbook.plugin.min_version || null,
          max_version: cookbook.plugin.max_version || null,
        },
        // SKILL.md specific fields
        skill_body: skillCookbook.skillBody || null,
        frontmatter: skillCookbook.skillFrontmatter || null,
        allowed_tools: skillCookbook.allowedTools || [],
      };

      return {
        content: [
          {
            type: 'text',
            text: context.clampText(JSON.stringify(result, null, 2)),
          },
        ],
      };
    },
    category: ToolCategory.COOKBOOK,
  });

  // ============================================================================
  // wpnav_match_cookbooks - Match cookbooks to active plugins
  // ============================================================================
  toolRegistry.register({
    definition: {
      name: 'wpnav_match_cookbooks',
      description:
        'Match available cookbooks against active WordPress plugins. Fetches active plugins from WordPress and returns cookbooks that match, with version compatibility status. Use this to discover which plugin guidance is available for the current site.',
      inputSchema: {
        type: 'object',
        properties: {
          plugins: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                slug: { type: 'string' },
                version: { type: 'string' },
                name: { type: 'string' },
              },
              required: ['slug'],
            },
            description:
              'Optional: Provide plugin list directly. If not provided, fetches active plugins from WordPress.',
          },
        },
        required: [],
      },
    },
    handler: async (args, context) => {
      const { plugins: providedPlugins } = args as { plugins?: PluginInfo[] };
      const { wpRequest } = context;

      let plugins: PluginInfo[];

      if (providedPlugins && Array.isArray(providedPlugins)) {
        // Use provided plugin list
        plugins = providedPlugins;
      } else {
        // Fetch active plugins from WordPress
        try {
          const wpPlugins = await wpRequest('/wp/v2/plugins?status=active');

          if (!Array.isArray(wpPlugins)) {
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    error: 'Failed to fetch plugins from WordPress',
                    hint: 'Provide plugins array directly or check WordPress connection',
                  }),
                },
              ],
              isError: true,
            };
          }

          // Extract slug and version from WordPress plugin response
          // WordPress plugin slugs are in format "plugin-dir/plugin-file.php"
          plugins = wpPlugins.map((p: any) => {
            // Extract directory name as slug (e.g., "elementor/elementor.php" -> "elementor")
            const pluginFile = p.plugin || '';
            const slug = pluginFile.split('/')[0] || pluginFile;
            return {
              slug,
              version: p.version,
              name: p.name?.rendered || p.name || slug,
              status: p.status,
            };
          });
        } catch (error) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  error: 'Failed to fetch plugins from WordPress',
                  details: error instanceof Error ? error.message : String(error),
                  hint: 'Provide plugins array directly',
                }),
              },
            ],
            isError: true,
          };
        }
      }

      // Discover available cookbooks
      const { cookbooks, sources } = discoverCookbooks();

      // Match cookbooks to plugins
      const matches = matchCookbooksToPlugins(cookbooks, plugins);

      // Build response
      const result = {
        total_plugins: plugins.length,
        matched_cookbooks: matches.length,
        matches: matches.map((m) => {
          const skillCookbook = m.cookbook as LoadedSkillCookbook;
          return {
            plugin: {
              slug: m.plugin.slug,
              version: m.plugin.version,
              name: m.plugin.name,
            },
            cookbook: {
              slug: m.cookbook.plugin.slug,
              name: m.cookbook.plugin.name,
              version: m.cookbook.cookbook_version,
              source: m.cookbook.source,
              min_version: m.cookbook.plugin.min_version || null,
              max_version: m.cookbook.plugin.max_version || null,
            },
            compatible: m.compatible,
            reason: m.reason || null,
            has_skill_body: !!skillCookbook.skillBody,
            allowed_tools: skillCookbook.allowedTools || [],
          };
        }),
        unmatched_plugins: plugins
          .filter((p) => !matches.some((m) => m.plugin.slug === p.slug))
          .map((p) => p.slug),
        available_cookbooks: {
          bundled: sources.bundled,
          project: sources.project,
        },
      };

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    },
    category: ToolCategory.COOKBOOK,
  });
}
