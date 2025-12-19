/**
 * Users Tools Registration
 *
 * Handles: User management (CRUD operations)
 *
 * @package WP_Navigator_Pro
 * @since 1.3.0
 */

import { toolRegistry, ToolCategory } from '../../tool-registry/index.js';
import {
  validateRequired,
  validatePagination,
  validateId,
  buildQueryString,
  buildFieldsParam,
} from '../../tool-registry/utils.js';
import {
  createCompactListResponse,
  createSummaryOnlyListResponse,
} from '../../compression/index.js';

/**
 * Register user management tools
 */
export function registerUserTools() {
  // ============================================================================
  // LIST USERS
  // ============================================================================
  toolRegistry.register({
    definition: {
      name: 'wpnav_list_users',
      description:
        'List WordPress users with optional filtering. Returns user ID, username, email, roles, and display name.',
      inputSchema: {
        type: 'object',
        properties: {
          page: { type: 'number', description: 'Page number for pagination (default: 1)' },
          per_page: {
            type: 'number',
            description: 'Number of users to return (default: 10, max: 100)',
          },
          roles: {
            type: 'string',
            description: 'Filter by role: administrator, editor, author, contributor, subscriber',
          },
          search: {
            type: 'string',
            description: 'Search term to filter users by username, email, or display name',
          },
          fields: {
            type: 'array',
            items: { type: 'string' },
            description: 'Fields to return (e.g., ["id", "name", "email"]). Reduces response size.',
          },
          compact: {
            type: 'boolean',
            default: false,
            description: 'Return AI-optimized compact response with summary and top items only',
          },
          summary_only: {
            type: 'boolean',
            default: false,
            description:
              'Return AI-focused natural language summary only without item list (maximum compression)',
          },
        },
        required: [],
      },
    },
    handler: async (args, context) => {
      const { page, per_page } = validatePagination(args);
      const qs = buildQueryString({
        page,
        per_page,
        roles: args.roles,
        search: args.search,
        _fields: buildFieldsParam(args.fields),
      });

      const users = await context.wpRequest(`/wp/v2/users?${qs}`);

      if (args.summary_only) {
        const summaryOnly = createSummaryOnlyListResponse('users', users);
        return {
          content: [{ type: 'text', text: JSON.stringify(summaryOnly, null, 2) }],
        };
      }

      if (args.compact) {
        const compact = createCompactListResponse('users', users, 5, {
          roles: args.roles,
        });
        return {
          content: [{ type: 'text', text: JSON.stringify(compact, null, 2) }],
        };
      }

      return {
        content: [{ type: 'text', text: context.clampText(JSON.stringify(users, null, 2)) }],
      };
    },
    category: ToolCategory.USERS,
  });

  // ============================================================================
  // GET USER
  // ============================================================================
  toolRegistry.register({
    definition: {
      name: 'wpnav_get_user',
      description:
        'Get a single WordPress user by ID. Returns full user profile including roles, capabilities, and metadata.',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'number', description: 'WordPress user ID' },
          fields: {
            type: 'array',
            items: { type: 'string' },
            description: 'Fields to return (e.g., ["id", "name", "email"]). Reduces response size.',
          },
        },
        required: ['id'],
      },
    },
    handler: async (args, context) => {
      validateRequired(args, ['id']);
      const id = validateId(args.id, 'User');

      const fieldsParam = buildFieldsParam(args.fields);
      const url = fieldsParam ? `/wp/v2/users/${id}?_fields=${fieldsParam}` : `/wp/v2/users/${id}`;
      const user = await context.wpRequest(url);

      return {
        content: [{ type: 'text', text: context.clampText(JSON.stringify(user, null, 2)) }],
      };
    },
    category: ToolCategory.USERS,
  });

  // ============================================================================
  // CREATE USER
  // ============================================================================
  toolRegistry.register({
    definition: {
      name: 'wpnav_create_user',
      description:
        'Create a new WordPress user. Requires username and email. Changes are logged in audit trail. HIGH RISK: Can create admin users.',
      inputSchema: {
        type: 'object',
        properties: {
          username: { type: 'string', description: 'Username (required, must be unique)' },
          email: { type: 'string', description: 'Email address (required, must be unique)' },
          password: {
            type: 'string',
            description: 'User password (optional, auto-generated if not provided)',
          },
          roles: {
            type: 'array',
            items: {
              type: 'string',
              enum: ['administrator', 'editor', 'author', 'contributor', 'subscriber'],
            },
            description: 'User roles (default: ["subscriber"])',
          },
          first_name: { type: 'string', description: 'First name (optional)' },
          last_name: { type: 'string', description: 'Last name (optional)' },
        },
        required: ['username', 'email'],
      },
    },
    handler: async (args, context) => {
      try {
        validateRequired(args, ['username', 'email']);

        const createData: any = {
          username: args.username,
          email: args.email,
        };
        if (args.password) createData.password = args.password;
        if (args.roles) createData.roles = args.roles;
        if (args.first_name) createData.first_name = args.first_name;
        if (args.last_name) createData.last_name = args.last_name;

        const result = await context.wpRequest('/wp/v2/users', {
          method: 'POST',
          body: JSON.stringify(createData),
        });

        return {
          content: [
            {
              type: 'text',
              text: context.clampText(
                JSON.stringify(
                  {
                    id: result.id,
                    username: result.username,
                    email: result.email,
                    roles: result.roles,
                    message: 'User created successfully',
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
                  code: isWritesDisabled ? 'WRITES_DISABLED' : 'CREATE_FAILED',
                  message: errorMessage,
                  context: {
                    resource_type: 'user',
                    username: args.username,
                    suggestion: isWritesDisabled
                      ? 'Set WPNAV_ENABLE_WRITES=1 in MCP server config (.mcp.json env section)'
                      : 'Check username and email are unique',
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
    category: ToolCategory.USERS,
  });

  // ============================================================================
  // UPDATE USER
  // ============================================================================
  toolRegistry.register({
    definition: {
      name: 'wpnav_update_user',
      description:
        'Update a WordPress user. Requires user ID and at least one field to update. Changes are logged in audit trail.',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'number', description: 'WordPress user ID' },
          email: { type: 'string', description: 'New email address' },
          display_name: { type: 'string', description: 'New display name' },
          first_name: { type: 'string', description: 'New first name' },
          last_name: { type: 'string', description: 'New last name' },
          password: { type: 'string', description: 'New password' },
          roles: {
            type: 'array',
            items: {
              type: 'string',
              enum: ['administrator', 'editor', 'author', 'contributor', 'subscriber'],
            },
            description: 'New user roles. HIGH RISK: Can escalate to administrator.',
          },
        },
        required: ['id'],
      },
    },
    handler: async (args, context) => {
      try {
        validateRequired(args, ['id']);
        const id = validateId(args.id, 'User');

        const updateData: any = {};
        if (args.email) updateData.email = args.email;
        if (args.display_name) updateData.display_name = args.display_name;
        if (args.first_name) updateData.first_name = args.first_name;
        if (args.last_name) updateData.last_name = args.last_name;
        if (args.password) updateData.password = args.password;
        if (args.roles) updateData.roles = args.roles;

        if (Object.keys(updateData).length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    error: 'validation_failed',
                    code: 'VALIDATION_FAILED',
                    message: 'At least one field must be provided for update',
                    context: { resource_type: 'user', resource_id: args.id },
                  },
                  null,
                  2
                ),
              },
            ],
            isError: true,
          };
        }

        const result = await context.wpRequest(`/wp/v2/users/${id}`, {
          method: 'POST',
          body: JSON.stringify(updateData),
        });

        return {
          content: [
            {
              type: 'text',
              text: context.clampText(
                JSON.stringify(
                  {
                    id: result.id,
                    username: result.username,
                    email: result.email,
                    message: 'User updated successfully',
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
                    resource_type: 'user',
                    resource_id: args.id,
                    suggestion: isWritesDisabled
                      ? 'Set WPNAV_ENABLE_WRITES=1 in MCP server config (.mcp.json env section)'
                      : 'Check user ID exists with wpnav_get_user',
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
    category: ToolCategory.USERS,
  });

  // ============================================================================
  // DELETE USER
  // ============================================================================
  toolRegistry.register({
    definition: {
      name: 'wpnav_delete_user',
      description:
        'Delete a WordPress user by ID. HIGH RISK: Permanent data loss. User content will be reassigned to specified user. Changes are logged in audit trail.',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'number', description: 'WordPress user ID to delete' },
          reassign: {
            type: 'number',
            description: "User ID to reassign deleted user's content to (required)",
          },
          force: {
            type: 'boolean',
            description: 'Force permanent deletion. Default: true',
            default: true,
          },
        },
        required: ['id', 'reassign'],
      },
    },
    handler: async (args, context) => {
      try {
        validateRequired(args, ['id', 'reassign']);
        const id = validateId(args.id, 'User');
        const reassignId = validateId(args.reassign, 'Reassign User');

        const params = new URLSearchParams({
          force: String(args.force !== false),
          reassign: String(reassignId),
        });

        const result = await context.wpRequest(`/wp/v2/users/${id}?${params.toString()}`, {
          method: 'DELETE',
        });

        return {
          content: [
            {
              type: 'text',
              text: context.clampText(
                JSON.stringify(
                  {
                    id: result.id,
                    message: 'User deleted successfully',
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
                    resource_type: 'user',
                    resource_id: args.id,
                    suggestion: isWritesDisabled
                      ? 'Set WPNAV_ENABLE_WRITES=1 in MCP server config (.mcp.json env section)'
                      : 'Check user ID exists with wpnav_get_user',
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
    category: ToolCategory.USERS,
  });
}
