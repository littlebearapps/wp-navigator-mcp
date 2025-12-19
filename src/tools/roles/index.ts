/**
 * Role Tools Registration
 *
 * Tools for discovering and loading AI role definitions.
 *
 * @package WP_Navigator_MCP
 * @since 2.6.0
 */

import { toolRegistry, ToolCategory } from '../../tool-registry/index.js';
import { discoverRoles, getRole, runtimeRoleState, type LoadedRole } from '../../roles/index.js';
import { createSummaryOnlyListResponse } from '../../compression/index.js';

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
        properties: {
          summary_only: {
            type: 'boolean',
            default: false,
            description:
              'Return AI-focused natural language summary only without role list (maximum compression)',
          },
        },
        required: [],
      },
    },
    handler: async (args, _context) => {
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

      if (args.summary_only) {
        const summaryOnly = createSummaryOnlyListResponse('roles', roleList);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(summaryOnly, null, 2),
            },
          ],
        };
      }

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
  // wpnav_load_role - Load full role content by slug and activate it
  // ============================================================================
  toolRegistry.register({
    definition: {
      name: 'wpnav_load_role',
      description:
        'Load and activate a role by slug. Sets the role as active for this session, applies its tool restrictions, and returns the full role definition including context (system prompt), focus areas, things to avoid, and allowed/denied tools lists. The role change takes effect immediately for tool filtering.',
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

      // Set the runtime role state
      const stateResult = runtimeRoleState.setRole(slug, 'tool');
      if (!stateResult.success) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                error: `Failed to activate role: ${stateResult.error}`,
              }),
            },
          ],
          isError: true,
        };
      }

      // Recompute the tool filter with the new active role
      const newFilter = toolRegistry.recomputeFilter({ activeRole: role });
      const enabledCount = newFilter?.enabledTools.size ?? 'unknown';

      const result = {
        activated: true,
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
        enabled_tool_count: enabledCount,
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
