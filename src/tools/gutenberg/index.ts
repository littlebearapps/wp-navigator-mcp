/**
 * Gutenberg Tools Registration
 *
 * MCP tools for Gutenberg block operations:
 * - Introspect capabilities
 * - List/insert/replace/move/delete blocks
 * - List/get/insert patterns
 *
 * @package WP_Navigator_Pro
 * @since 1.3.0
 */

import { toolRegistry, ToolCategory } from '../../tool-registry/index.js';
import { validateRequired, validateId, extractSummary } from '../../tool-registry/utils.js';
import {
  buildIRNode,
  validatePath,
  parseIRDocument,
  formatIRSummary,
  validateBlockAttributes,
} from './helpers.js';

/**
 * Register all Gutenberg tools
 *
 * Registers 8 tools for Gutenberg block manipulation.
 */
export function registerGutenbergTools() {
  // ============================================================================
  // INTROSPECT
  // ============================================================================
  toolRegistry.register({
    definition: {
      name: 'wpnav_gutenberg_introspect',
      description:
        'Introspect Gutenberg capabilities: available blocks, patterns, and attributes. Use this to discover what blocks you can create.',
      inputSchema: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
    handler: async (args, context) => {
      const result = await context.wpRequest('/wpnav/v1/gutenberg/introspect');

      return {
        content: [{ type: 'text', text: context.clampText(JSON.stringify(result, null, 2)) }],
      };
    },
    category: ToolCategory.CONTENT,
  });

  // ============================================================================
  // LIST BLOCKS
  // ============================================================================
  toolRegistry.register({
    definition: {
      name: 'wpnav_gutenberg_list_blocks',
      description:
        'Get all blocks in a post as Intermediate Representation (IR). Returns block structure with types, attributes, and paths.',
      inputSchema: {
        type: 'object',
        properties: {
          post_id: {
            type: 'number',
            description: 'WordPress post or page ID to load blocks from',
          },
        },
        required: ['post_id'],
      },
    },
    handler: async (args, context) => {
      validateRequired(args, ['post_id']);
      const id = validateId(args.post_id, 'Post');

      const result = await context.wpRequest(`/wpnav/v1/gutenberg/blocks?post_id=${id}`);

      if (!result.success) {
        return {
          content: [
            {
              type: 'text',
              text: context.clampText(JSON.stringify({ error: result.error }, null, 2)),
            },
          ],
          isError: true,
        };
      }

      // Include both full IR and summary
      const summary = formatIRSummary(result.ir_document);

      return {
        content: [
          {
            type: 'text',
            text: context.clampText(
              `${summary}\n\nFull IR Document:\n${JSON.stringify(result.ir_document, null, 2)}`
            ),
          },
        ],
      };
    },
    category: ToolCategory.CONTENT,
  });

  // ============================================================================
  // INSERT BLOCK
  // ============================================================================
  toolRegistry.register({
    definition: {
      name: 'wpnav_gutenberg_insert_block',
      description:
        'Insert a new Gutenberg block at specified path. Path is array of indices (e.g., [0] for first position, [1,0] for first child of second block).',
      inputSchema: {
        type: 'object',
        properties: {
          post_id: {
            type: 'number',
            description: 'Post ID to modify',
          },
          path: {
            type: 'array',
            items: { type: 'number' },
            description:
              'Path array (e.g., [0] = first block, [1, 0] = first child of second block)',
          },
          block_type: {
            type: 'string',
            description: 'Block type (e.g., "core/heading", "core/paragraph", "core/button")',
            enum: [
              'core/paragraph',
              'core/heading',
              'core/button',
              'core/columns',
              'core/column',
              'core/image',
              'core/list',
              'core/quote',
              'core/separator',
              'core/spacer',
            ],
          },
          attrs: {
            type: 'object',
            description:
              'Block attributes (e.g., {level: 2, content: "Hello"} for heading, {content: "Text"} for paragraph)',
            additionalProperties: true,
          },
        },
        required: ['post_id', 'path', 'block_type', 'attrs'],
      },
    },
    handler: async (args, context) => {
      validateRequired(args, ['post_id', 'path', 'block_type', 'attrs']);
      const id = validateId(args.post_id, 'Post');

      if (!validatePath(args.path)) {
        return {
          content: [
            {
              type: 'text',
              text: context.clampText(
                JSON.stringify(
                  {
                    error: 'invalid_path',
                    message: 'Path must be non-empty array of non-negative integers',
                  },
                  null,
                  2
                )
              ),
            },
          ],
          isError: true,
        };
      }

      // Validate block attributes
      try {
        validateBlockAttributes(args.block_type, args.attrs);
      } catch (error: any) {
        return {
          content: [
            {
              type: 'text',
              text: context.clampText(
                JSON.stringify(
                  {
                    error: 'invalid_attributes',
                    message: error.message,
                  },
                  null,
                  2
                )
              ),
            },
          ],
          isError: true,
        };
      }

      // Build IR node
      const block = buildIRNode(args.block_type, args.attrs);

      // Call REST API
      const result = await context.wpRequest('/wpnav/v1/gutenberg/blocks/insert', {
        method: 'POST',
        body: JSON.stringify({
          post_id: id,
          path: args.path,
          block: block,
        }),
      });

      if (!result.success) {
        return {
          content: [
            {
              type: 'text',
              text: context.clampText(JSON.stringify({ error: result.error }, null, 2)),
            },
          ],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: 'text',
            text: context.clampText(
              JSON.stringify(
                {
                  success: true,
                  post_id: id,
                  path: args.path,
                  block_type: args.block_type,
                  message: 'Block inserted successfully',
                },
                null,
                2
              )
            ),
          },
        ],
      };
    },
    category: ToolCategory.CONTENT,
  });

  // ============================================================================
  // REPLACE BLOCK
  // ============================================================================
  toolRegistry.register({
    definition: {
      name: 'wpnav_gutenberg_replace_block',
      description: 'Replace an existing Gutenberg block at specified path with a new block.',
      inputSchema: {
        type: 'object',
        properties: {
          post_id: {
            type: 'number',
            description: 'Post ID to modify',
          },
          path: {
            type: 'array',
            items: { type: 'number' },
            description:
              'Path to block to replace (e.g., [0] = first block, [1, 0] = first child of second block)',
          },
          block_type: {
            type: 'string',
            description: 'New block type (e.g., "core/heading", "core/paragraph")',
            enum: [
              'core/paragraph',
              'core/heading',
              'core/button',
              'core/columns',
              'core/column',
              'core/image',
              'core/list',
              'core/quote',
              'core/separator',
              'core/spacer',
            ],
          },
          attrs: {
            type: 'object',
            description: 'New block attributes',
            additionalProperties: true,
          },
        },
        required: ['post_id', 'path', 'block_type', 'attrs'],
      },
    },
    handler: async (args, context) => {
      validateRequired(args, ['post_id', 'path', 'block_type', 'attrs']);
      const id = validateId(args.post_id, 'Post');

      if (!validatePath(args.path)) {
        return {
          content: [
            {
              type: 'text',
              text: context.clampText(
                JSON.stringify(
                  {
                    error: 'invalid_path',
                    message: 'Path must be non-empty array of non-negative integers',
                  },
                  null,
                  2
                )
              ),
            },
          ],
          isError: true,
        };
      }

      // Validate block attributes
      try {
        validateBlockAttributes(args.block_type, args.attrs);
      } catch (error: any) {
        return {
          content: [
            {
              type: 'text',
              text: context.clampText(
                JSON.stringify(
                  {
                    error: 'invalid_attributes',
                    message: error.message,
                  },
                  null,
                  2
                )
              ),
            },
          ],
          isError: true,
        };
      }

      // Build IR node
      const block = buildIRNode(args.block_type, args.attrs);

      // Call REST API
      const result = await context.wpRequest('/wpnav/v1/gutenberg/blocks/replace', {
        method: 'POST',
        body: JSON.stringify({
          post_id: id,
          path: args.path,
          block: block,
        }),
      });

      if (!result.success) {
        return {
          content: [
            {
              type: 'text',
              text: context.clampText(JSON.stringify({ error: result.error }, null, 2)),
            },
          ],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: 'text',
            text: context.clampText(
              JSON.stringify(
                {
                  success: true,
                  post_id: id,
                  path: args.path,
                  block_type: args.block_type,
                  message: 'Block replaced successfully',
                },
                null,
                2
              )
            ),
          },
        ],
      };
    },
    category: ToolCategory.CONTENT,
  });

  // ============================================================================
  // MOVE BLOCK
  // ============================================================================
  toolRegistry.register({
    definition: {
      name: 'wpnav_gutenberg_move_block',
      description:
        'Move a Gutenberg block from one path to another. Useful for reordering blocks or moving nested blocks.',
      inputSchema: {
        type: 'object',
        properties: {
          post_id: {
            type: 'number',
            description: 'Post ID to modify',
          },
          from_path: {
            type: 'array',
            items: { type: 'number' },
            description: 'Source path (block to move)',
          },
          to_path: {
            type: 'array',
            items: { type: 'number' },
            description: 'Destination path (where to move block)',
          },
        },
        required: ['post_id', 'from_path', 'to_path'],
      },
    },
    handler: async (args, context) => {
      validateRequired(args, ['post_id', 'from_path', 'to_path']);
      const id = validateId(args.post_id, 'Post');

      if (!validatePath(args.from_path)) {
        return {
          content: [
            {
              type: 'text',
              text: context.clampText(
                JSON.stringify(
                  {
                    error: 'invalid_from_path',
                    message: 'from_path must be non-empty array of non-negative integers',
                  },
                  null,
                  2
                )
              ),
            },
          ],
          isError: true,
        };
      }

      if (!validatePath(args.to_path)) {
        return {
          content: [
            {
              type: 'text',
              text: context.clampText(
                JSON.stringify(
                  {
                    error: 'invalid_to_path',
                    message: 'to_path must be non-empty array of non-negative integers',
                  },
                  null,
                  2
                )
              ),
            },
          ],
          isError: true,
        };
      }

      // Call REST API
      const result = await context.wpRequest('/wpnav/v1/gutenberg/blocks/move', {
        method: 'POST',
        body: JSON.stringify({
          post_id: id,
          from_path: args.from_path,
          to_path: args.to_path,
        }),
      });

      if (!result.success) {
        return {
          content: [
            {
              type: 'text',
              text: context.clampText(JSON.stringify({ error: result.error }, null, 2)),
            },
          ],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: 'text',
            text: context.clampText(
              JSON.stringify(
                {
                  success: true,
                  post_id: id,
                  from_path: args.from_path,
                  to_path: args.to_path,
                  message: 'Block moved successfully',
                },
                null,
                2
              )
            ),
          },
        ],
      };
    },
    category: ToolCategory.CONTENT,
  });

  // ============================================================================
  // DELETE BLOCK
  // ============================================================================
  toolRegistry.register({
    definition: {
      name: 'wpnav_gutenberg_delete_block',
      description:
        'Delete a Gutenberg block at specified path. WARNING: This action modifies post content immediately.',
      inputSchema: {
        type: 'object',
        properties: {
          post_id: {
            type: 'number',
            description: 'Post ID to modify',
          },
          path: {
            type: 'array',
            items: { type: 'number' },
            description:
              'Path to block to delete (e.g., [0] = first block, [1, 0] = first child of second block)',
          },
        },
        required: ['post_id', 'path'],
      },
    },
    handler: async (args, context) => {
      validateRequired(args, ['post_id', 'path']);
      const id = validateId(args.post_id, 'Post');

      if (!validatePath(args.path)) {
        return {
          content: [
            {
              type: 'text',
              text: context.clampText(
                JSON.stringify(
                  {
                    error: 'invalid_path',
                    message: 'Path must be non-empty array of non-negative integers',
                  },
                  null,
                  2
                )
              ),
            },
          ],
          isError: true,
        };
      }

      // Call REST API
      const result = await context.wpRequest('/wpnav/v1/gutenberg/blocks/delete', {
        method: 'POST',
        body: JSON.stringify({
          post_id: id,
          path: args.path,
        }),
      });

      if (!result.success) {
        return {
          content: [
            {
              type: 'text',
              text: context.clampText(JSON.stringify({ error: result.error }, null, 2)),
            },
          ],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: 'text',
            text: context.clampText(
              JSON.stringify(
                {
                  success: true,
                  post_id: id,
                  path: args.path,
                  message: 'Block deleted successfully',
                },
                null,
                2
              )
            ),
          },
        ],
      };
    },
    category: ToolCategory.CONTENT,
  });

  // ============================================================================
  // LIST PATTERNS
  // ============================================================================
  toolRegistry.register({
    definition: {
      name: 'wpnav_gutenberg_list_patterns',
      description:
        'List all available Gutenberg block patterns and reusable blocks. Patterns are pre-designed block combinations.',
      inputSchema: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
    handler: async (args, context) => {
      const result = await context.wpRequest('/wpnav/v1/gutenberg/patterns');

      if (!result.success) {
        return {
          content: [
            {
              type: 'text',
              text: context.clampText(JSON.stringify({ error: result.error }, null, 2)),
            },
          ],
          isError: true,
        };
      }

      // Format patterns for display
      const summary = result.patterns.map((p: any) => ({
        id: p.id,
        title: p.title,
        type: p.type,
        categories: p.categories,
      }));

      return {
        content: [
          {
            type: 'text',
            text: context.clampText(
              JSON.stringify(
                {
                  success: true,
                  count: result.patterns.length,
                  patterns: summary,
                },
                null,
                2
              )
            ),
          },
        ],
      };
    },
    category: ToolCategory.CONTENT,
  });

  // ============================================================================
  // INSERT PATTERN
  // ============================================================================
  toolRegistry.register({
    definition: {
      name: 'wpnav_gutenberg_insert_pattern',
      description:
        'Insert a Gutenberg block pattern at specified path. Use wpnav_gutenberg_list_patterns to discover available patterns first.',
      inputSchema: {
        type: 'object',
        properties: {
          post_id: {
            type: 'number',
            description: 'Post ID to modify',
          },
          path: {
            type: 'array',
            items: { type: 'number' },
            description: 'Path where pattern should be inserted (e.g., [0] for first position)',
          },
          pattern_slug: {
            type: 'string',
            description: 'Pattern slug/ID from wpnav_gutenberg_list_patterns',
          },
        },
        required: ['post_id', 'path', 'pattern_slug'],
      },
    },
    handler: async (args, context) => {
      validateRequired(args, ['post_id', 'path', 'pattern_slug']);
      const id = validateId(args.post_id, 'Post');

      if (!validatePath(args.path)) {
        return {
          content: [
            {
              type: 'text',
              text: context.clampText(
                JSON.stringify(
                  {
                    error: 'invalid_path',
                    message: 'Path must be non-empty array of non-negative integers',
                  },
                  null,
                  2
                )
              ),
            },
          ],
          isError: true,
        };
      }

      // Call REST API
      const result = await context.wpRequest('/wpnav/v1/gutenberg/patterns/insert', {
        method: 'POST',
        body: JSON.stringify({
          post_id: id,
          path: args.path,
          pattern_slug: args.pattern_slug,
        }),
      });

      if (!result.success) {
        return {
          content: [
            {
              type: 'text',
              text: context.clampText(JSON.stringify({ error: result.error }, null, 2)),
            },
          ],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: 'text',
            text: context.clampText(
              JSON.stringify(
                {
                  success: true,
                  post_id: id,
                  path: args.path,
                  pattern_slug: args.pattern_slug,
                  message: 'Pattern inserted successfully',
                },
                null,
                2
              )
            ),
          },
        ],
      };
    },
    category: ToolCategory.CONTENT,
  });
}
