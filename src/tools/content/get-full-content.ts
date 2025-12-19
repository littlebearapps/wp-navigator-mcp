/**
 * wpnav_get_full_content tool
 *
 * Fetch full untruncated content for a specific post, page, or media item.
 * Use after seeing truncated content in list/get responses.
 *
 * @package WP_Navigator_Pro
 * @since 2.8.0
 */

import { toolRegistry, ToolCategory } from '../../tool-registry/index.js';
import { validateRequired, validateId } from '../../tool-registry/utils.js';
import { estimateTokens } from '../../compression/index.js';

/**
 * Supported content types
 */
const CONTENT_TYPES = ['post', 'page', 'media'] as const;
type ContentType = (typeof CONTENT_TYPES)[number];

/**
 * Field options per content type
 */
const FIELD_OPTIONS: Record<ContentType, string[]> = {
  post: ['content', 'excerpt'],
  page: ['content', 'excerpt'],
  media: ['description', 'caption', 'alt_text'],
};

/**
 * REST endpoint mapping
 */
const TYPE_ENDPOINTS: Record<ContentType, string> = {
  post: 'wp/v2/posts',
  page: 'wp/v2/pages',
  media: 'wp/v2/media',
};

/**
 * Get full content response interface
 */
interface FullContentResponse {
  id: number;
  type: ContentType;
  field: string;
  full_content: string;
  content_length: number;
  _meta: {
    token_estimate: number;
  };
}

toolRegistry.register({
  definition: {
    name: 'wpnav_get_full_content',
    description:
      'Fetch full untruncated content for a specific post, page, or media item. Use after seeing truncated content in list/get responses.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'number',
          description: 'Post/page/media ID',
        },
        type: {
          type: 'string',
          enum: CONTENT_TYPES,
          description: 'Content type (post, page, or media)',
        },
        field: {
          type: 'string',
          description:
            'Field to fetch. For posts/pages: content, excerpt. For media: description, caption, alt_text. Defaults to content/description.',
        },
      },
      required: ['id', 'type'],
    },
  },
  handler: async (args, context) => {
    // Validate required fields
    validateRequired(args, ['id', 'type']);
    validateId(args.id, 'id');

    const id = args.id as number;
    const type = args.type as ContentType;

    // Validate content type
    if (!CONTENT_TYPES.includes(type)) {
      throw new Error(`Invalid content type: ${type}. Must be one of: ${CONTENT_TYPES.join(', ')}`);
    }

    // Determine field to fetch
    const validFields = FIELD_OPTIONS[type];
    const defaultField = type === 'media' ? 'description' : 'content';
    const field = (args.field as string) || defaultField;

    if (!validFields.includes(field)) {
      throw new Error(
        `Invalid field '${field}' for type '${type}'. Valid fields: ${validFields.join(', ')}`
      );
    }

    // Fetch from WordPress
    const endpoint = TYPE_ENDPOINTS[type];
    const data = await context.wpRequest(`${endpoint}/${id}`, {
      method: 'GET',
    });

    // Extract the requested field content
    let fullContent = '';
    if (type === 'media') {
      switch (field) {
        case 'description':
          fullContent = data.description?.rendered || '';
          break;
        case 'caption':
          fullContent = data.caption?.rendered || '';
          break;
        case 'alt_text':
          fullContent = data.alt_text || '';
          break;
      }
    } else {
      switch (field) {
        case 'content':
          fullContent = data.content?.rendered || '';
          break;
        case 'excerpt':
          fullContent = data.excerpt?.rendered || '';
          break;
      }
    }

    const response: FullContentResponse = {
      id,
      type,
      field,
      full_content: fullContent,
      content_length: fullContent.length,
      _meta: {
        token_estimate: estimateTokens(fullContent),
      },
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response, null, 2),
        },
      ],
    };
  },
  category: ToolCategory.CONTENT,
});
