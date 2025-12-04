/**
 * Taxonomy Tools Registration
 *
 * Handles: Categories, Tags, Taxonomies (CRUD operations)
 *
 * @package WP_Navigator_Pro
 * @since 1.3.0
 */

import { toolRegistry, ToolCategory } from '../../tool-registry/index.js';
import { validateRequired, validatePagination, validateId, buildQueryString } from '../../tool-registry/utils.js';

/**
 * Register taxonomy management tools (categories, tags, taxonomies)
 */
export function registerTaxonomyTools() {
  // ============================================================================
  // CATEGORIES
  // ============================================================================
  toolRegistry.register({
    definition: {
      name: 'wpnav_list_categories',
      description: 'List all WordPress categories with optional filtering. Returns category ID, name, slug, count, and parent.',
      inputSchema: {
        type: 'object',
        properties: {
          page: { type: 'number', description: 'Page number for pagination (default: 1)' },
          per_page: { type: 'number', description: 'Number of categories to return (default: 10, max: 100)' },
          search: { type: 'string', description: 'Search term to filter categories by name' },
          parent: { type: 'number', description: 'Filter by parent category ID' },
        },
        required: [],
      },
    },
    handler: async (args, context) => {
      const { page, per_page } = validatePagination(args);
      const qs = buildQueryString({ page, per_page, search: args.search, parent: args.parent });

      const categories = await context.wpRequest(`/wp/v2/categories?${qs}`);

      return {
        content: [{ type: 'text', text: context.clampText(JSON.stringify(categories, null, 2)) }],
      };
    },
    category: ToolCategory.TAXONOMY,
  });

  toolRegistry.register({
    definition: {
      name: 'wpnav_get_category',
      description: 'Get a single WordPress category by ID. Returns full category details including description and post count.',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'number', description: 'WordPress category ID' },
        },
        required: ['id'],
      },
    },
    handler: async (args, context) => {
      validateRequired(args, ['id']);
      const id = validateId(args.id, 'Category');

      const category = await context.wpRequest(`/wp/v2/categories/${id}`);

      return {
        content: [{ type: 'text', text: context.clampText(JSON.stringify(category, null, 2)) }],
      };
    },
    category: ToolCategory.TAXONOMY,
  });

  toolRegistry.register({
    definition: {
      name: 'wpnav_create_category',
      description: 'Create a new WordPress category. Requires name. Changes are logged in audit trail.',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Category name' },
          description: { type: 'string', description: 'Category description (optional)' },
          slug: { type: 'string', description: 'Category slug (optional, auto-generated from name if not provided)' },
          parent: { type: 'number', description: 'Parent category ID (optional, for hierarchical categories)' },
        },
        required: ['name'],
      },
    },
    handler: async (args, context) => {
      try {
        validateRequired(args, ['name']);

        const createData: any = { name: args.name };
        if (args.description) createData.description = args.description;
        if (args.slug) createData.slug = args.slug;
        if (args.parent) createData.parent = args.parent;

        const result = await context.wpRequest('/wp/v2/categories', {
          method: 'POST',
          body: JSON.stringify(createData),
        });

        return {
          content: [{
            type: 'text',
            text: context.clampText(JSON.stringify({
              id: result.id,
              name: result.name,
              slug: result.slug,
              link: result.link,
              message: 'Category created successfully',
            }, null, 2)),
          }],
        };
      } catch (error: any) {
        const errorMessage = error.message || 'Unknown error';
        const isWritesDisabled = errorMessage.includes('WRITES_DISABLED');
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              error: isWritesDisabled ? 'writes_disabled' : 'operation_failed',
              code: isWritesDisabled ? 'WRITES_DISABLED' : 'CREATE_FAILED',
              message: errorMessage,
              context: {
                resource_type: 'category',
                name: args.name,
                suggestion: isWritesDisabled ? 'Set WPNAV_ENABLE_WRITES=1 in MCP server config (.mcp.json env section)' : 'Check category name is unique',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    },
    category: ToolCategory.TAXONOMY,
  });

  toolRegistry.register({
    definition: {
      name: 'wpnav_update_category',
      description: 'Update a WordPress category. Requires category ID and at least one field to update. Changes are logged in audit trail.',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'number', description: 'WordPress category ID' },
          name: { type: 'string', description: 'New category name' },
          description: { type: 'string', description: 'New category description' },
          slug: { type: 'string', description: 'New category slug' },
          parent: { type: 'number', description: 'New parent category ID' },
        },
        required: ['id'],
      },
    },
    handler: async (args, context) => {
      try {
        validateRequired(args, ['id']);
        const id = validateId(args.id, 'Category');

        const updateData: any = {};
        if (args.name) updateData.name = args.name;
        if (args.description) updateData.description = args.description;
        if (args.slug) updateData.slug = args.slug;
        if (args.parent !== undefined) updateData.parent = args.parent;

        if (Object.keys(updateData).length === 0) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                error: 'validation_failed',
                code: 'VALIDATION_FAILED',
                message: 'At least one field (name, description, slug, or parent) must be provided',
                context: { resource_type: 'category', resource_id: args.id },
              }, null, 2),
            }],
            isError: true,
          };
        }

        const result = await context.wpRequest(`/wp/v2/categories/${id}`, {
          method: 'POST',
          body: JSON.stringify(updateData),
        });

        return {
          content: [{
            type: 'text',
            text: context.clampText(JSON.stringify({
              id: result.id,
              name: result.name,
              slug: result.slug,
              message: 'Category updated successfully',
            }, null, 2)),
          }],
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
                resource_type: 'category',
                resource_id: args.id,
                suggestion: isWritesDisabled ? 'Set WPNAV_ENABLE_WRITES=1 in MCP server config (.mcp.json env section)' : 'Check category ID exists with wpnav_get_category',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    },
    category: ToolCategory.TAXONOMY,
  });

  toolRegistry.register({
    definition: {
      name: 'wpnav_delete_category',
      description: 'Delete a WordPress category by ID. Posts in this category will be reassigned to Uncategorized. WARNING: This action cannot be undone.',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'number', description: 'WordPress category ID' },
          force: { type: 'boolean', description: 'Force permanent deletion. Default: true', default: true },
        },
        required: ['id'],
      },
    },
    handler: async (args, context) => {
      try {
        validateRequired(args, ['id']);
        const id = validateId(args.id, 'Category');

        const params = new URLSearchParams({ force: String(args.force !== false) });

        const result = await context.wpRequest(`/wp/v2/categories/${id}?${params.toString()}`, {
          method: 'DELETE',
        });

        return {
          content: [{
            type: 'text',
            text: context.clampText(JSON.stringify({
              id: result.id,
              message: 'Category deleted successfully',
            }, null, 2)),
          }],
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
                resource_type: 'category',
                resource_id: args.id,
                suggestion: isWritesDisabled ? 'Set WPNAV_ENABLE_WRITES=1 in MCP server config (.mcp.json env section)' : 'Check category ID exists with wpnav_get_category',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    },
    category: ToolCategory.TAXONOMY,
  });

  // ============================================================================
  // TAGS
  // ============================================================================
  toolRegistry.register({
    definition: {
      name: 'wpnav_list_tags',
      description: 'List all WordPress tags with optional filtering. Returns tag ID, name, slug, and count.',
      inputSchema: {
        type: 'object',
        properties: {
          page: { type: 'number', description: 'Page number for pagination (default: 1)' },
          per_page: { type: 'number', description: 'Number of tags to return (default: 10, max: 100)' },
          search: { type: 'string', description: 'Search term to filter tags by name' },
        },
        required: [],
      },
    },
    handler: async (args, context) => {
      const { page, per_page } = validatePagination(args);
      const qs = buildQueryString({ page, per_page, search: args.search });

      const tags = await context.wpRequest(`/wp/v2/tags?${qs}`);

      return {
        content: [{ type: 'text', text: context.clampText(JSON.stringify(tags, null, 2)) }],
      };
    },
    category: ToolCategory.TAXONOMY,
  });

  toolRegistry.register({
    definition: {
      name: 'wpnav_get_tag',
      description: 'Get a single WordPress tag by ID. Returns full tag details including description and post count.',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'number', description: 'WordPress tag ID' },
        },
        required: ['id'],
      },
    },
    handler: async (args, context) => {
      validateRequired(args, ['id']);
      const id = validateId(args.id, 'Tag');

      const tag = await context.wpRequest(`/wp/v2/tags/${id}`);

      return {
        content: [{ type: 'text', text: context.clampText(JSON.stringify(tag, null, 2)) }],
      };
    },
    category: ToolCategory.TAXONOMY,
  });

  toolRegistry.register({
    definition: {
      name: 'wpnav_create_tag',
      description: 'Create a new WordPress tag. Requires name. Changes are logged in audit trail.',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Tag name' },
          description: { type: 'string', description: 'Tag description (optional)' },
          slug: { type: 'string', description: 'Tag slug (optional, auto-generated from name if not provided)' },
        },
        required: ['name'],
      },
    },
    handler: async (args, context) => {
      try {
        validateRequired(args, ['name']);

        const createData: any = { name: args.name };
        if (args.description) createData.description = args.description;
        if (args.slug) createData.slug = args.slug;

        const result = await context.wpRequest('/wp/v2/tags', {
          method: 'POST',
          body: JSON.stringify(createData),
        });

        return {
          content: [{
            type: 'text',
            text: context.clampText(JSON.stringify({
              id: result.id,
              name: result.name,
              slug: result.slug,
              link: result.link,
              message: 'Tag created successfully',
            }, null, 2)),
          }],
        };
      } catch (error: any) {
        const errorMessage = error.message || 'Unknown error';
        const isWritesDisabled = errorMessage.includes('WRITES_DISABLED');
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              error: isWritesDisabled ? 'writes_disabled' : 'operation_failed',
              code: isWritesDisabled ? 'WRITES_DISABLED' : 'CREATE_FAILED',
              message: errorMessage,
              context: {
                resource_type: 'tag',
                name: args.name,
                suggestion: isWritesDisabled ? 'Set WPNAV_ENABLE_WRITES=1 in MCP server config (.mcp.json env section)' : 'Check tag name is unique',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    },
    category: ToolCategory.TAXONOMY,
  });

  toolRegistry.register({
    definition: {
      name: 'wpnav_update_tag',
      description: 'Update a WordPress tag. Requires tag ID and at least one field to update. Changes are logged in audit trail.',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'number', description: 'WordPress tag ID' },
          name: { type: 'string', description: 'New tag name' },
          description: { type: 'string', description: 'New tag description' },
          slug: { type: 'string', description: 'New tag slug' },
        },
        required: ['id'],
      },
    },
    handler: async (args, context) => {
      try {
        validateRequired(args, ['id']);
        const id = validateId(args.id, 'Tag');

        const updateData: any = {};
        if (args.name) updateData.name = args.name;
        if (args.description) updateData.description = args.description;
        if (args.slug) updateData.slug = args.slug;

        if (Object.keys(updateData).length === 0) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                error: 'validation_failed',
                code: 'VALIDATION_FAILED',
                message: 'At least one field (name, description, or slug) must be provided',
                context: { resource_type: 'tag', resource_id: args.id },
              }, null, 2),
            }],
            isError: true,
          };
        }

        const result = await context.wpRequest(`/wp/v2/tags/${id}`, {
          method: 'POST',
          body: JSON.stringify(updateData),
        });

        return {
          content: [{
            type: 'text',
            text: context.clampText(JSON.stringify({
              id: result.id,
              name: result.name,
              slug: result.slug,
              message: 'Tag updated successfully',
            }, null, 2)),
          }],
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
                resource_type: 'tag',
                resource_id: args.id,
                suggestion: isWritesDisabled ? 'Set WPNAV_ENABLE_WRITES=1 in MCP server config (.mcp.json env section)' : 'Check tag ID exists with wpnav_get_tag',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    },
    category: ToolCategory.TAXONOMY,
  });

  toolRegistry.register({
    definition: {
      name: 'wpnav_delete_tag',
      description: 'Delete a WordPress tag by ID. Posts with this tag will have it removed. WARNING: This action cannot be undone.',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'number', description: 'WordPress tag ID' },
          force: { type: 'boolean', description: 'Force permanent deletion. Default: true', default: true },
        },
        required: ['id'],
      },
    },
    handler: async (args, context) => {
      try {
        validateRequired(args, ['id']);
        const id = validateId(args.id, 'Tag');

        const params = new URLSearchParams({ force: String(args.force !== false) });

        const result = await context.wpRequest(`/wp/v2/tags/${id}?${params.toString()}`, {
          method: 'DELETE',
        });

        return {
          content: [{
            type: 'text',
            text: context.clampText(JSON.stringify({
              id: result.id,
              message: 'Tag deleted successfully',
            }, null, 2)),
          }],
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
                resource_type: 'tag',
                resource_id: args.id,
                suggestion: isWritesDisabled ? 'Set WPNAV_ENABLE_WRITES=1 in MCP server config (.mcp.json env section)' : 'Check tag ID exists with wpnav_get_tag',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    },
    category: ToolCategory.TAXONOMY,
  });

  // ============================================================================
  // TAXONOMIES (Read-Only Discovery)
  // ============================================================================
  toolRegistry.register({
    definition: {
      name: 'wpnav_list_taxonomies',
      description: 'List all registered WordPress taxonomies (categories, tags, custom). Returns taxonomy name, labels, and capabilities. Always available for site structure discovery.',
      inputSchema: {
        type: 'object',
        properties: {
          type: { type: 'string', description: 'Filter by post type (e.g., "post", "page")' },
        },
        required: [],
      },
    },
    handler: async (args, context) => {
      const qs = buildQueryString({ type: args.type });

      const taxonomies = await context.wpRequest(`/wp/v2/taxonomies?${qs}`);

      return {
        content: [{ type: 'text', text: context.clampText(JSON.stringify(taxonomies, null, 2)) }],
      };
    },
    category: ToolCategory.TAXONOMY,
  });

  toolRegistry.register({
    definition: {
      name: 'wpnav_get_taxonomy',
      description: 'Get details about a specific taxonomy by name. Returns full taxonomy configuration including hierarchical status, REST base, and labels. Always available for site structure discovery.',
      inputSchema: {
        type: 'object',
        properties: {
          taxonomy: { type: 'string', description: 'Taxonomy name (e.g., "category", "post_tag", or custom taxonomy)' },
        },
        required: ['taxonomy'],
      },
    },
    handler: async (args, context) => {
      validateRequired(args, ['taxonomy']);

      const taxonomy = await context.wpRequest(`/wp/v2/taxonomies/${args.taxonomy}`);

      return {
        content: [{ type: 'text', text: context.clampText(JSON.stringify(taxonomy, null, 2)) }],
      };
    },
    category: ToolCategory.TAXONOMY,
  });
}
