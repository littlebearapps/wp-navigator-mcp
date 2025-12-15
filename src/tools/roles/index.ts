/**
 * Role Tools Registration
 *
 * Tools for discovering and loading AI role definitions.
 *
 * @package WP_Navigator_MCP
 * @since 2.6.0
 */

import { toolRegistry, ToolCategory } from '../../tool-registry/index.js';
import { discoverRoles, getRole, type LoadedRole } from '../../roles/index.js';

/**
 * Register role tools
 */
export function registerRoleTools() {
  // ============================================================================
  // wpnav_list_roles - List available roles
  // ============================================================================
  toolRegistry.register({
    definition: {
      name: 'wpnav_list_roles',
      description:
        'List all available AI roles with metadata. Roles define how AI assistants should interact with WordPress - including focus areas, things to avoid, and allowed/denied tools. Returns slug, description, focus areas, tool counts, and source (bundled/global/project).',
      inputSchema: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
    handler: async (_args, _context) => {
      const { roles, sources } = discoverRoles();

      const roleList = Array.from(roles.entries()).map(([slug, role]) => ({
        slug,
        name: role.name,
        description: role.description,
        source: role.source,
        focus_areas: role.focus_areas || [],
        avoid: role.avoid || [],
        tools_allowed_count: role.tools?.allowed?.length || 0,
        tools_denied_count: role.tools?.denied?.length || 0,
        tags: role.tags || [],
        author: role.author || null,
      }));

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                total: roleList.length,
                roles: roleList,
                sources: {
                  bundled: sources.bundled.length,
                  global: sources.global.length,
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
    category: ToolCategory.ROLES,
  });

  // ============================================================================
  // wpnav_load_role - Load full role content by slug
  // ============================================================================
  toolRegistry.register({
    definition: {
      name: 'wpnav_load_role',
      description:
        'Load a role by slug to get AI guidance for a specific persona. Returns the full role definition including context (system prompt), focus areas, things to avoid, and allowed/denied tools lists. Use this when you need detailed role configuration.',
      inputSchema: {
        type: 'object',
        properties: {
          slug: {
            type: 'string',
            description: 'Role slug (e.g., "content-editor", "developer", "site-admin")',
          },
        },
        required: ['slug'],
      },
    },
    handler: async (args, _context) => {
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

      const role = getRole(slug);

      if (!role) {
        const { roles } = discoverRoles();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                error: `Role not found: ${slug}`,
                available: Array.from(roles.keys()).sort(),
                hint: 'Use wpnav_list_roles to see available roles',
              }),
            },
          ],
          isError: true,
        };
      }

      const result = {
        slug: role.name,
        name: role.name,
        description: role.description,
        context: role.context,
        source: role.source,
        focus_areas: role.focus_areas || [],
        avoid: role.avoid || [],
        tools: {
          allowed: role.tools?.allowed || [],
          denied: role.tools?.denied || [],
        },
        tags: role.tags || [],
        author: role.author || null,
        version: role.version || null,
        schema_version: role.schema_version,
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
    category: ToolCategory.ROLES,
  });
}
