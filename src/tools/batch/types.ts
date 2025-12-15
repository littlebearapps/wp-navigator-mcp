/**
 * Batch Operations Type Definitions
 *
 * Types for batch get, update, and delete operations across content types.
 *
 * @package WP_Navigator_Pro
 * @since 2.6.0
 */

/**
 * Supported content types for batch operations
 */
export const BATCH_CONTENT_TYPES = [
  'posts',
  'pages',
  'media',
  'comments',
  'categories',
  'tags',
  'users',
] as const;

export type BatchContentType = (typeof BATCH_CONTENT_TYPES)[number];

/**
 * Maps content type to WordPress REST API endpoint
 */
export const CONTENT_TYPE_ENDPOINTS: Record<BatchContentType, string> = {
  posts: '/wp/v2/posts',
  pages: '/wp/v2/pages',
  media: '/wp/v2/media',
  comments: '/wp/v2/comments',
  categories: '/wp/v2/categories',
  tags: '/wp/v2/tags',
  users: '/wp/v2/users',
};

/**
 * Maximum items allowed in a single batch operation
 */
export const MAX_BATCH_SIZE = 10;

/**
 * Result for a single item in batch operation
 */
export interface BatchItemResult {
  id: number;
  success: boolean;
  data?: any;
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Aggregate batch response
 */
export interface BatchResponse {
  operation: 'get' | 'update' | 'delete';
  type: BatchContentType;
  total_requested: number;
  succeeded: number;
  failed: number;
  results: BatchItemResult[];
}

/**
 * Update item for batch update operations
 */
export interface BatchUpdateItem {
  id: number;
  data: Record<string, any>;
}

/**
 * Map HTTP errors to error codes
 */
export function mapHttpErrorToCode(error: any): { code: string; message: string } {
  const message = error?.message || String(error);

  if (message.includes('404') || message.includes('not found')) {
    return { code: 'NOT_FOUND', message: 'Resource not found' };
  }
  if (message.includes('401') || message.includes('Unauthorized')) {
    return { code: 'UNAUTHORIZED', message: 'Authentication failed' };
  }
  if (message.includes('403') || message.includes('Forbidden')) {
    return { code: 'FORBIDDEN', message: 'Permission denied' };
  }
  if (message.includes('429') || message.includes('rate limit')) {
    return { code: 'RATE_LIMITED', message: 'Too many requests' };
  }
  if (message.includes('WRITES_DISABLED')) {
    return { code: 'WRITES_DISABLED', message };
  }
  if (message.includes('5')) {
    return { code: 'SERVER_ERROR', message: 'WordPress server error' };
  }

  return { code: 'OPERATION_FAILED', message };
}
