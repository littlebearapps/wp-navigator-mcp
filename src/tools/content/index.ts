/**
 * Content Tools Registration
 *
 * Handles: Pages, Posts, Media, Comments (CRUD operations)
 *
 * @package WP_Navigator_Pro
 * @since 1.3.0
 */

import { toolRegistry, ToolCategory } from '../../tool-registry/index.js';
import { validateRequired, validatePagination, validateId, buildQueryString, extractSummary } from '../../tool-registry/utils.js';
import { applyContentChanges, applyContentCreation } from '../../safety.js';
import fetch from 'cross-fetch';
import FormData from 'form-data';

/**
 * Register content management tools (pages, posts, media, comments)
 */
export function registerContentTools() {
  // ============================================================================
  // PAGES
  // ============================================================================
  toolRegistry.register({
    definition: {
      name: 'wpnav_list_pages',
      description: 'List WordPress pages with optional filtering. Returns page ID, title, status, and last modified date.',
      inputSchema: {
        type: 'object',
        properties: {
          page: { type: 'number', description: 'Page number for pagination (default: 1)' },
          per_page: { type: 'number', description: 'Number of pages to return (default: 10, max: 100)' },
          status: { type: 'string', enum: ['publish', 'draft', 'private', 'any'], description: 'Filter by status (default: publish)' },
          search: { type: 'string', description: 'Search term to filter pages by title or content' },
        },
        required: [],
      },
    },
    handler: async (args, context) => {
      const { page, per_page } = validatePagination(args);
      const status = args.status || 'publish';

      const qs = buildQueryString({ page, per_page, status, search: args.search });
      const pages = await context.wpRequest(`/wp/v2/pages?${qs}`);

      const summary = pages.map((p: any) => extractSummary(p, ['id', 'title.rendered', 'status', 'modified', 'link']));

      return {
        content: [{ type: 'text', text: context.clampText(JSON.stringify(summary, null, 2)) }],
      };
    },
    category: ToolCategory.CONTENT,
  });

  toolRegistry.register({
    definition: {
      name: 'wpnav_get_page',
      description: 'Get a single WordPress page by ID. Returns full page content, metadata, and edit history.',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'number', description: 'WordPress page ID' },
        },
        required: ['id'],
      },
    },
    handler: async (args, context) => {
      validateRequired(args, ['id']);
      const id = validateId(args.id, 'Page');

      const page = await context.wpRequest(`/wp/v2/pages/${id}`);

      const summary = extractSummary(page, [
        'id', 'title.rendered', 'content.rendered', 'status', 'author',
        'modified', 'link', 'template', 'parent', 'menu_order',
      ]);

      return {
        content: [{ type: 'text', text: context.clampText(JSON.stringify(summary, null, 2)) }],
      };
    },
    category: ToolCategory.CONTENT,
  });

  toolRegistry.register({
    definition: {
      name: 'wpnav_update_page',
      description: 'Update a WordPress page. Requires page ID and at least one field to update (title, content, or status). Changes are logged in audit trail.',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'number', description: 'WordPress page ID' },
          title: { type: 'string', description: 'New page title' },
          content: { type: 'string', description: 'New page content (HTML). WordPress will auto-save revisions.' },
          status: { type: 'string', enum: ['publish', 'draft', 'private'], description: 'Page status: publish, draft, private' },
          force: { type: 'boolean', description: 'Skip safety validation', default: false },
        },
        required: ['id'],
      },
    },
    handler: async (args, context) => {
      try {
        validateRequired(args, ['id']);
        const id = validateId(args.id, 'Page');

        const ops: any[] = [];
        if (args.title != null) ops.push({ op: 'replace', path: '/title', value: String(args.title) });
        if (args.content != null) ops.push({ op: 'replace', path: '/content', value: String(args.content) });
        if (args.status != null) ops.push({ op: 'replace', path: '/status', value: String(args.status) });

        if (!ops.length) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                error: 'validation_failed',
                code: 'VALIDATION_FAILED',
                message: 'At least one of title, content, or status must be provided',
                context: { resource_type: 'page', resource_id: id },
              }, null, 2),
            }],
            isError: true,
          };
        }

        const result = await applyContentChanges(context.wpRequest as any, context.config, {
          postId: id,
          operations: ops,
          force: !!args.force,
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
              context: { resource_type: 'page', resource_id: args.id, suggestion: 'Use wpnav_get_page to verify page exists' },
            }, null, 2),
          }],
          isError: true,
        };
      }
    },
    category: ToolCategory.CONTENT,
  });

  toolRegistry.register({
    definition: {
      name: 'wpnav_create_page',
      description: 'Create a new WordPress page. Requires title and optional content. Changes are logged in audit trail.',
      inputSchema: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Page title' },
          content: { type: 'string', description: 'Page content (HTML). Optional.' },
          status: { type: 'string', enum: ['publish', 'draft', 'private'], description: 'Page status: publish, draft, private (default: draft)', default: 'draft' },
        },
        required: ['title'],
      },
    },
    handler: async (args, context) => {
      try {
        validateRequired(args, ['title']);

        const result = await applyContentCreation(context.wpRequest as any, context.config, {
          postType: 'page',
          title: String(args.title),
          content: args.content ? String(args.content) : undefined,
          status: (args.status as 'draft' | 'publish' | 'private') || 'draft',
        });

        return {
          content: [{
            type: 'text',
            text: context.clampText(JSON.stringify({
              success: true,
              post_id: result.apply.post_id,
              title: args.title,
              status: args.status || 'draft',
              plan_id: result.plan.plan_id,
              message: 'Page created successfully',
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
              context: { resource_type: 'page', title: args.title },
            }, null, 2),
          }],
          isError: true,
        };
      }
    },
    category: ToolCategory.CONTENT,
  });

  toolRegistry.register({
    definition: {
      name: 'wpnav_delete_page',
      description: 'Delete a WordPress page by ID. Changes are logged in audit trail. WARNING: This action cannot be undone (page moves to trash by default).',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'number', description: 'WordPress page ID' },
          force: { type: 'boolean', description: 'Force permanent deletion (skip trash). Default: false', default: false },
        },
        required: ['id'],
      },
    },
    handler: async (args) => {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            error: 'not_supported',
            code: 'NOT_SUPPORTED',
            message: 'Page delete via safe plan/apply is not available in v1.1. Use update operations or wait for v1.2.',
            context: { resource_type: 'page', resource_id: args.id, suggestion: 'Use wpnav_update_page to change status to trash instead' },
          }, null, 2),
        }],
        isError: true,
      };
    },
    category: ToolCategory.CONTENT,
  });

  // ============================================================================
  // wpnav_snapshot_page - Comprehensive page snapshot for AI agents
  // ============================================================================
  toolRegistry.register({
    definition: {
      name: 'wpnav_snapshot_page',
      description:
        'Create a comprehensive snapshot of a WordPress page including metadata, Gutenberg blocks, featured image, and SEO data. Designed for AI agents to understand full page structure.',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'number', description: 'WordPress page ID' },
          include_raw_content: { type: 'boolean', description: 'Include raw HTML content (default: false)' },
        },
        required: ['id'],
      },
    },
    handler: async (args, context) => {
      validateRequired(args, ['id']);
      const id = validateId(args.id, 'Page');
      const includeRawContent = args.include_raw_content === true;

      // Fetch page with all fields
      const page = await context.wpRequest(`/wp/v2/pages/${id}?context=edit`);

      // Fetch featured image if set
      let featuredImage = null;
      if (page.featured_media && page.featured_media > 0) {
        try {
          const media = await context.wpRequest(`/wp/v2/media/${page.featured_media}`);
          featuredImage = {
            id: media.id,
            url: media.source_url,
            alt: media.alt_text || '',
            title: media.title?.rendered || '',
            width: media.media_details?.width,
            height: media.media_details?.height,
          };
        } catch {
          featuredImage = { id: page.featured_media, error: 'not_accessible' };
        }
      }

      // Fetch author info
      let author = null;
      if (page.author) {
        try {
          const authorData = await context.wpRequest(`/wp/v2/users/${page.author}?_fields=id,name,slug`);
          author = {
            id: authorData.id,
            name: authorData.name,
            slug: authorData.slug,
          };
        } catch {
          author = { id: page.author, error: 'not_accessible' };
        }
      }

      // Parse Gutenberg blocks from raw content
      const blocks: Array<{ type: string; attrs: Record<string, unknown> }> = [];
      const rawContent = page.content?.raw || page.content?.rendered || '';

      // Simple block parser - extracts block comments from content
      const blockRegex = /<!-- wp:([a-z0-9-]+\/)?([a-z0-9-]+)(\s+(\{[^}]*\}))?\s*(\/)?-->/g;
      let match;

      while ((match = blockRegex.exec(rawContent)) !== null) {
        const namespace = match[1] ? match[1].slice(0, -1) : 'core';
        const blockName = match[2];
        const attrsJson = match[4];

        let attrs: Record<string, unknown> = {};
        if (attrsJson) {
          try {
            attrs = JSON.parse(attrsJson);
          } catch {
            // Invalid JSON, skip attrs
          }
        }

        blocks.push({
          type: `${namespace}/${blockName}`,
          attrs,
        });
      }

      // Check for SEO plugins (Yoast or RankMath)
      let seo = null;
      if (page.yoast_head_json) {
        seo = {
          source: 'yoast',
          title: page.yoast_head_json.title,
          description: page.yoast_head_json.description,
          og_title: page.yoast_head_json.og_title,
          og_description: page.yoast_head_json.og_description,
        };
      } else if (page.rank_math) {
        seo = {
          source: 'rankmath',
          title: page.rank_math.title,
          description: page.rank_math.description,
        };
      }

      // Build snapshot
      const snapshot: Record<string, unknown> = {
        id: page.id,
        metadata: {
          title: page.title?.rendered || page.title?.raw || '',
          slug: page.slug,
          status: page.status,
          visibility: page.status === 'private' ? 'private' : 'public',
          template: page.template || '',
          parent: page.parent || 0,
          menu_order: page.menu_order || 0,
          link: page.link,
          modified: page.modified,
          modified_gmt: page.modified_gmt,
        },
        author,
        featured_image: featuredImage,
        blocks: blocks.length > 0 ? blocks : null,
        block_count: blocks.length,
        seo,
        excerpt: page.excerpt?.rendered || '',
      };

      if (includeRawContent) {
        snapshot.raw_content = rawContent;
      }

      return {
        content: [{ type: 'text', text: JSON.stringify(snapshot, null, 2) }],
      };
    },
    category: ToolCategory.CONTENT,
  });

  // ============================================================================
  // POSTS
  // ============================================================================
  toolRegistry.register({
    definition: {
      name: 'wpnav_list_posts',
      description: 'List WordPress blog posts with optional filtering. Returns post ID, title, status, and last modified date.',
      inputSchema: {
        type: 'object',
        properties: {
          page: { type: 'number', description: 'Page number for pagination (default: 1)' },
          per_page: { type: 'number', description: 'Number of posts to return (default: 10, max: 100)' },
          status: { type: 'string', enum: ['publish', 'draft', 'private', 'any'], description: 'Filter by status (default: publish)' },
          search: { type: 'string', description: 'Search term to filter posts by title or content' },
        },
        required: [],
      },
    },
    handler: async (args, context) => {
      const { page, per_page } = validatePagination(args);
      const status = args.status || 'publish';

      const qs = buildQueryString({ page, per_page, status, search: args.search });
      const posts = await context.wpRequest(`/wp/v2/posts?${qs}`);

      const summary = posts.map((p: any) => extractSummary(p, ['id', 'title.rendered', 'status', 'modified', 'link']));

      return {
        content: [{ type: 'text', text: context.clampText(JSON.stringify(summary, null, 2)) }],
      };
    },
    category: ToolCategory.CONTENT,
  });

  toolRegistry.register({
    definition: {
      name: 'wpnav_get_post',
      description: 'Get a single WordPress post by ID. Returns full post content, metadata, categories, and tags.',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'number', description: 'WordPress post ID' },
        },
        required: ['id'],
      },
    },
    handler: async (args, context) => {
      validateRequired(args, ['id']);
      const id = validateId(args.id, 'Post');

      const post = await context.wpRequest(`/wp/v2/posts/${id}`);

      const summary = extractSummary(post, [
        'id', 'title.rendered', 'content.rendered', 'excerpt.rendered',
        'status', 'author', 'modified', 'link', 'categories', 'tags',
      ]);

      return {
        content: [{ type: 'text', text: context.clampText(JSON.stringify(summary, null, 2)) }],
      };
    },
    category: ToolCategory.CONTENT,
  });

  toolRegistry.register({
    definition: {
      name: 'wpnav_update_post',
      description: 'Update a WordPress post. Requires post ID and at least one field to update. Changes are logged in audit trail.',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'number', description: 'WordPress post ID' },
          title: { type: 'string', description: 'New post title' },
          content: { type: 'string', description: 'New post content (HTML).' },
          excerpt: { type: 'string', description: 'Post excerpt' },
          status: { type: 'string', enum: ['publish', 'draft', 'private'], description: 'Post status: publish, draft, private' },
          force: { type: 'boolean', description: 'Skip safety validation', default: false },
        },
        required: ['id'],
      },
    },
    handler: async (args, context) => {
      try {
        validateRequired(args, ['id']);
        const id = validateId(args.id, 'Post');

        const ops: any[] = [];
        if (args.title != null) ops.push({ op: 'replace', path: '/title', value: String(args.title) });
        if (args.content != null) ops.push({ op: 'replace', path: '/content', value: String(args.content) });
        if (args.excerpt != null) ops.push({ op: 'replace', path: '/excerpt', value: String(args.excerpt) });
        if (args.status != null) ops.push({ op: 'replace', path: '/status', value: String(args.status) });

        if (!ops.length) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                error: 'validation_failed',
                code: 'VALIDATION_FAILED',
                message: 'At least one of title, content, excerpt, or status must be provided',
                context: { resource_type: 'post', resource_id: id },
              }, null, 2),
            }],
            isError: true,
          };
        }

        const result = await applyContentChanges(context.wpRequest as any, context.config, {
          postId: id,
          operations: ops,
          force: !!args.force,
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
              context: { resource_type: 'post', resource_id: args.id, suggestion: 'Use wpnav_get_post to verify post exists' },
            }, null, 2),
          }],
          isError: true,
        };
      }
    },
    category: ToolCategory.CONTENT,
  });

  toolRegistry.register({
    definition: {
      name: 'wpnav_create_post',
      description: 'Create a new WordPress blog post. Requires title and optional content. Changes are logged in audit trail.',
      inputSchema: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Post title' },
          content: { type: 'string', description: 'Post content (HTML). Optional.' },
          excerpt: { type: 'string', description: 'Post excerpt. Optional.' },
          status: { type: 'string', enum: ['publish', 'draft', 'private'], description: 'Post status: publish, draft, private (default: draft)', default: 'draft' },
        },
        required: ['title'],
      },
    },
    handler: async (args, context) => {
      try {
        validateRequired(args, ['title']);

        const result = await applyContentCreation(context.wpRequest as any, context.config, {
          postType: 'post',
          title: String(args.title),
          content: args.content ? String(args.content) : undefined,
          excerpt: args.excerpt ? String(args.excerpt) : undefined,
          status: (args.status as 'draft' | 'publish' | 'private') || 'draft',
        });

        return {
          content: [{
            type: 'text',
            text: context.clampText(JSON.stringify({
              success: true,
              post_id: result.apply.post_id,
              title: args.title,
              status: args.status || 'draft',
              plan_id: result.plan.plan_id,
              message: 'Post created successfully',
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
              context: { resource_type: 'post', title: args.title },
            }, null, 2),
          }],
          isError: true,
        };
      }
    },
    category: ToolCategory.CONTENT,
  });

  toolRegistry.register({
    definition: {
      name: 'wpnav_create_post_with_blocks',
      description: 'Create a new post with Gutenberg blocks in a single atomic operation. Safer than creating empty post then adding blocks.',
      inputSchema: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Post title' },
          status: {
            type: 'string',
            enum: ['draft', 'publish', 'private'],
            description: 'Post status (default: draft)',
            default: 'draft',
          },
          blocks: {
            type: 'array',
            description: 'Array of Gutenberg blocks to insert',
            items: {
              type: 'object',
              properties: {
                block_type: { type: 'string', description: 'Gutenberg block type (e.g., "core/paragraph", "core/heading")' },
                attrs: { type: 'object', additionalProperties: true, description: 'Block attributes (e.g., {level: 2, content: "Hello"})' },
              },
              required: ['block_type', 'attrs'],
            },
          },
        },
        required: ['title', 'blocks'],
      },
    },
    handler: async (args, context) => {
      try {
        validateRequired(args, ['title', 'blocks']);

        // Convert blocks to IR format
        const gutenbergBlocks = args.blocks.map((b: any) => ({
          blockName: b.block_type,
          attrs: b.attrs,
          innerBlocks: [],
        }));

        const result = await applyContentCreation(context.wpRequest as any, context.config, {
          postType: 'post',
          title: String(args.title),
          status: (args.status as 'draft' | 'publish' | 'private') || 'draft',
          blocks: gutenbergBlocks,
        });

        return {
          content: [{
            type: 'text',
            text: context.clampText(JSON.stringify({
              success: true,
              post_id: result.apply.post_id,
              title: args.title,
              block_count: args.blocks.length,
              plan_id: result.plan.plan_id,
              message: `Post created with ${args.blocks.length} Gutenberg blocks`,
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
              context: { resource_type: 'post', title: args.title, block_count: args.blocks?.length },
            }, null, 2),
          }],
          isError: true,
        };
      }
    },
    category: ToolCategory.CONTENT,
  });

  toolRegistry.register({
    definition: {
      name: 'wpnav_delete_post',
      description: 'Delete a WordPress post by ID. Changes are logged in audit trail. WARNING: This action cannot be undone (post moves to trash by default).',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'number', description: 'WordPress post ID' },
          force: { type: 'boolean', description: 'Force permanent deletion (skip trash). Default: false', default: false },
        },
        required: ['id'],
      },
    },
    handler: async (args) => {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            error: 'not_supported',
            code: 'NOT_SUPPORTED',
            message: 'Post delete via safe plan/apply is not available in v1.1. Use update operations or wait for v1.2.',
            context: { resource_type: 'post', resource_id: args.id, suggestion: 'Use wpnav_update_post to change status to trash instead' },
          }, null, 2),
        }],
        isError: true,
      };
    },
    category: ToolCategory.CONTENT,
  });

  // ============================================================================
  // MEDIA
  // ============================================================================
  toolRegistry.register({
    definition: {
      name: 'wpnav_list_media',
      description: 'List WordPress media library items. Returns media ID, title, URL, and mime type.',
      inputSchema: {
        type: 'object',
        properties: {
          page: { type: 'number', description: 'Page number for pagination (default: 1)' },
          per_page: { type: 'number', description: 'Number of media items to return (default: 10, max: 100)' },
          media_type: { type: 'string', description: 'Filter by media type: image, video, application, etc.' },
          search: { type: 'string', description: 'Search term to filter media by title or filename' },
        },
        required: [],
      },
    },
    handler: async (args, context) => {
      const { page, per_page } = validatePagination(args);
      const qs = buildQueryString({ page, per_page, media_type: args.media_type, search: args.search });

      const media = await context.wpRequest(`/wp/v2/media?${qs}`);

      const summary = media.map((item: any) => extractSummary(item, ['id', 'title.rendered', 'source_url', 'mime_type', 'modified']));

      return {
        content: [{ type: 'text', text: context.clampText(JSON.stringify(summary, null, 2)) }],
      };
    },
    category: ToolCategory.CONTENT,
  });

  toolRegistry.register({
    definition: {
      name: 'wpnav_get_media',
      description: 'Get a single media item by ID. Returns full metadata including URL, dimensions, and file info.',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'number', description: 'WordPress media ID' },
        },
        required: ['id'],
      },
    },
    handler: async (args, context) => {
      validateRequired(args, ['id']);
      const id = validateId(args.id, 'Media');

      const media = await context.wpRequest(`/wp/v2/media/${id}`);

      const summary = extractSummary(media, [
        'id', 'title.rendered', 'source_url', 'mime_type', 'alt_text',
        'caption.rendered', 'description.rendered', 'media_details',
      ]);

      return {
        content: [{ type: 'text', text: context.clampText(JSON.stringify(summary, null, 2)) }],
      };
    },
    category: ToolCategory.CONTENT,
  });

  toolRegistry.register({
    definition: {
      name: 'wpnav_delete_media',
      description: 'Delete a media item by ID. WARNING: This permanently deletes the file from the server.',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'number', description: 'WordPress media ID' },
          force: { type: 'boolean', description: 'Force permanent deletion. Default: true for media', default: true },
        },
        required: ['id'],
      },
    },
    handler: async (args, context) => {
      try {
        validateRequired(args, ['id']);
        const id = validateId(args.id, 'Media');

        const params = new URLSearchParams();
        if (args.force !== false) {
          params.append('force', 'true');
        }

        const result = await context.wpRequest(`/wp/v2/media/${id}?${params.toString()}`, {
          method: 'DELETE',
        });

        return {
          content: [{
            type: 'text',
            text: context.clampText(JSON.stringify({ id: result.id, message: 'Media item permanently deleted' }, null, 2)),
          }],
        };
      } catch (error: any) {
        const errorMessage = error.message || 'Unknown error';
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              error: 'operation_failed',
              code: 'DELETE_FAILED',
              message: errorMessage,
              context: { resource_type: 'media', resource_id: args.id, suggestion: 'Use wpnav_get_media to verify media exists' },
            }, null, 2),
          }],
          isError: true,
        };
      }
    },
    category: ToolCategory.CONTENT,
  });

  /**
   * Upload Media from URL
   *
   * Downloads an image from a URL and uploads it to WordPress media library.
   * Part of Phase 2: 95% Test Automation Plan
   */
  toolRegistry.register({
    definition: {
      name: 'wpnav_upload_media_from_url',
      description: 'Upload media from URL (server-side download). Downloads an image from a URL and uploads it to WordPress media library without sending binary data over MCP.',
      inputSchema: {
        type: 'object',
        properties: {
          url: { type: 'string', format: 'uri', description: 'Image URL to download and upload' },
          title: { type: 'string', description: 'Media title' },
          alt_text: { type: 'string', description: 'Alt text for accessibility (optional)' },
          caption: { type: 'string', description: 'Media caption (optional)' },
        },
        required: ['url', 'title'],
      },
    },
    handler: async (args, context) => {
      try {
        validateRequired(args, ['url', 'title']);

        // Use the WP Navigator server-side sideload endpoint.
        // This avoids DNS resolution issues when the MCP client can't resolve external domains.
        // WordPress server downloads the URL instead of the local MCP client.
        const sideloadData: Record<string, string> = {
          url: args.url,
          title: args.title,
        };
        if (args.alt_text) sideloadData.alt_text = args.alt_text;
        if (args.caption) sideloadData.caption = args.caption;

        const result = await context.wpRequest('/wpnav/v1/media/sideload', {
          method: 'POST',
          body: JSON.stringify(sideloadData),
        });

        return {
          content: [{
            type: 'text',
            text: context.clampText(JSON.stringify(result, null, 2)),
          }],
        };
      } catch (error: any) {
        const errorMessage = error.message || 'Unknown error';
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              error: 'operation_failed',
              code: 'UPLOAD_FAILED',
              message: errorMessage,
              context: { resource_type: 'media', url: args.url, title: args.title, suggestion: 'Check URL is accessible and returns valid image' },
            }, null, 2),
          }],
          isError: true,
        };
      }
    },
    category: ToolCategory.CONTENT,
  });

  // ============================================================================
  // COMMENTS
  // ============================================================================
  toolRegistry.register({
    definition: {
      name: 'wpnav_list_comments',
      description: 'List WordPress comments with optional filtering. Returns comment ID, author, content, and status.',
      inputSchema: {
        type: 'object',
        properties: {
          page: { type: 'number', description: 'Page number for pagination (default: 1)' },
          per_page: { type: 'number', description: 'Number of comments to return (default: 10, max: 100)' },
          status: { type: 'string', enum: ['approve', 'hold', 'spam', 'trash', 'any'], description: 'Filter by status: approve, hold, spam, trash, any' },
          post: { type: 'number', description: 'Filter by post ID' },
        },
        required: [],
      },
    },
    handler: async (args, context) => {
      const { page, per_page } = validatePagination(args);
      const qs = buildQueryString({ page, per_page, status: args.status, post: args.post });

      const comments = await context.wpRequest(`/wp/v2/comments?${qs}`);

      const summary = comments.map((c: any) => extractSummary(c, ['id', 'author_name', 'content.rendered', 'status', 'post', 'date']));

      return {
        content: [{ type: 'text', text: context.clampText(JSON.stringify(summary, null, 2)) }],
      };
    },
    category: ToolCategory.CONTENT,
  });

  toolRegistry.register({
    definition: {
      name: 'wpnav_get_comment',
      description: 'Get a single comment by ID. Returns full comment details including author info and content.',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'number', description: 'WordPress comment ID' },
        },
        required: ['id'],
      },
    },
    handler: async (args, context) => {
      validateRequired(args, ['id']);
      const id = validateId(args.id, 'Comment');

      const comment = await context.wpRequest(`/wp/v2/comments/${id}`);

      const summary = extractSummary(comment, [
        'id', 'author_name', 'author_email', 'author_url',
        'content.rendered', 'status', 'post', 'parent', 'date',
      ]);

      return {
        content: [{ type: 'text', text: context.clampText(JSON.stringify(summary, null, 2)) }],
      };
    },
    category: ToolCategory.CONTENT,
  });

  toolRegistry.register({
    definition: {
      name: 'wpnav_update_comment',
      description: 'Update a comment. Can change status (approve/hold/spam) or content. Changes are logged in audit trail.',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'number', description: 'WordPress comment ID' },
          status: { type: 'string', enum: ['approve', 'hold', 'spam', 'trash'], description: 'Comment status: approve, hold, spam, trash' },
          content: { type: 'string', description: 'Comment content' },
        },
        required: ['id'],
      },
    },
    handler: async (args, context) => {
      try {
        validateRequired(args, ['id']);
        const id = validateId(args.id, 'Comment');

        const updateData: any = {};
        if (args.status) updateData.status = args.status;
        if (args.content) updateData.content = args.content;

        if (Object.keys(updateData).length === 0) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                error: 'validation_failed',
                code: 'VALIDATION_FAILED',
                message: 'At least one field (status or content) must be provided',
                context: { resource_type: 'comment', resource_id: id },
              }, null, 2),
            }],
            isError: true,
          };
        }

        const result = await context.wpRequest(`/wp/v2/comments/${id}`, {
          method: 'POST',
          body: JSON.stringify(updateData),
        });

        return {
          content: [{
            type: 'text',
            text: context.clampText(JSON.stringify({ id: result.id, status: result.status, message: 'Comment updated successfully' }, null, 2)),
          }],
        };
      } catch (error: any) {
        const errorMessage = error.message || 'Unknown error';
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              error: 'operation_failed',
              code: 'UPDATE_FAILED',
              message: errorMessage,
              context: { resource_type: 'comment', resource_id: args.id, suggestion: 'Use wpnav_get_comment to verify comment exists' },
            }, null, 2),
          }],
          isError: true,
        };
      }
    },
    category: ToolCategory.CONTENT,
  });

  toolRegistry.register({
    definition: {
      name: 'wpnav_delete_comment',
      description: 'Delete a comment by ID. WARNING: This action cannot be undone.',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'number', description: 'WordPress comment ID' },
          force: { type: 'boolean', description: 'Force permanent deletion (skip trash). Default: false', default: false },
        },
        required: ['id'],
      },
    },
    handler: async (args, context) => {
      try {
        validateRequired(args, ['id']);
        const id = validateId(args.id, 'Comment');

        const params = new URLSearchParams();
        if (args.force) {
          params.append('force', 'true');
        }

        const result = await context.wpRequest(`/wp/v2/comments/${id}?${params.toString()}`, {
          method: 'DELETE',
        });

        return {
          content: [{
            type: 'text',
            text: context.clampText(JSON.stringify({
              id: result.id,
              message: args.force ? 'Comment permanently deleted' : 'Comment moved to trash',
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
                resource_type: 'comment',
                resource_id: args.id,
                suggestion: isWritesDisabled ? 'Set WPNAV_ENABLE_WRITES=1 in MCP server config (.mcp.json env section)' : 'Check comment ID exists with wpnav_get_comment',
              },
            }, null, 2),
          }],
          isError: true,
        };
      }
    },
    category: ToolCategory.CONTENT,
  });

  /**
   * Create Comment via REST API
   *
   * Uses WordPress REST API to create comments on posts.
   * Works with any WordPress site (local, Hetzner, production).
   * Part of Phase 1: 95% Test Automation Plan
   */
  toolRegistry.register({
    definition: {
      name: 'wpnav_create_comment',
      description: 'Create a new comment on a post. Uses REST API - works with any WordPress instance.',
      inputSchema: {
        type: 'object',
        properties: {
          post_id: { type: 'number', description: 'WordPress post ID to comment on' },
          content: { type: 'string', description: 'Comment content' },
          author_name: { type: 'string', description: 'Comment author name (default: Test User)' },
          author_email: { type: 'string', description: 'Comment author email (default: test@example.com)' },
          status: {
            type: 'string',
            enum: ['approved', 'hold', 'spam'],
            description: 'Comment status: approved (default), hold, or spam',
            default: 'approved'
          },
        },
        required: ['post_id', 'content'],
      },
    },
    handler: async (args, context) => {
      validateRequired(args, ['post_id', 'content']);
      const postId = validateId(args.post_id, 'Post');

      const authorName = args.author_name || 'Test User';
      const authorEmail = args.author_email || 'test@example.com';
      // Map 'approved' to 'approve' for REST API compatibility
      const status = args.status === 'approved' ? 'approve' : (args.status || 'approve');

      try {
        // Use REST API to create comment
        const result = await context.wpRequest('/wp/v2/comments', {
          method: 'POST',
          body: JSON.stringify({
            post: postId,
            content: args.content,
            author_name: authorName,
            author_email: authorEmail,
            status: status,
          }),
        });

        return {
          content: [{
            type: 'text',
            text: context.clampText(JSON.stringify({
              id: result.id,
              post_id: postId,
              author_name: result.author_name,
              author_email: authorEmail,
              status: result.status,
              message: 'Comment created successfully via REST API',
            }, null, 2)),
          }],
        };
      } catch (error: any) {
        const errorMessage = error.message || 'Unknown error';

        return {
          content: [{
            type: 'text',
            text: context.clampText(JSON.stringify({
              error: 'create_failed',
              code: 'CREATE_FAILED',
              message: `Comment creation failed: ${errorMessage}`,
              context: {
                resource_type: 'comment',
                post_id: postId,
                suggestion: 'Verify the post exists and accepts comments using wpnav_get_post'
              }
            }, null, 2)),
          }],
          isError: true,
        };
      }
    },
    category: ToolCategory.CONTENT,
  });
}
