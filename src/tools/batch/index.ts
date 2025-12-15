/**
 * Batch Operations Tools
 *
 * Tools for performing batch get, update, and delete operations
 * across multiple WordPress content types in a single call.
 *
 * @package WP_Navigator_Pro
 * @since 2.6.0
 */

import { toolRegistry } from '../../tool-registry/registry.js';
import { ToolCategory } from '../../tool-registry/types.js';
import { validateRequired, validateId, validateEnum } from '../../tool-registry/utils.js';
import {
  BATCH_CONTENT_TYPES,
  CONTENT_TYPE_ENDPOINTS,
  MAX_BATCH_SIZE,
  BatchContentType,
  BatchItemResult,
  BatchResponse,
  BatchUpdateItem,
  mapHttpErrorToCode,
} from './types.js';

/**
 * Register all batch operation tools
 */
export function registerBatchTools() {
  // ============================================
  // wpnav_batch_get - Fetch multiple items by ID
  // ============================================
  toolRegistry.register({
    definition: {
      name: 'wpnav_batch_get',
      description: `Fetch multiple WordPress items by ID in a single call. Supports ${BATCH_CONTENT_TYPES.join(', ')}. Returns per-item success/error status. Max ${MAX_BATCH_SIZE} items per request.`,
      inputSchema: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: [...BATCH_CONTENT_TYPES],
            description: 'Content type to fetch',
          },
          ids: {
            type: 'array',
            items: { type: 'number' },
            description: `Array of WordPress IDs to fetch (max ${MAX_BATCH_SIZE})`,
            maxItems: MAX_BATCH_SIZE,
          },
          fields: {
            type: 'array',
            items: { type: 'string' },
            description:
              'Optional: Fields to return (e.g., ["id", "title", "status"]). Reduces response size.',
          },
        },
        required: ['type', 'ids'],
      },
    },
    handler: async (args, context) => {
      validateRequired(args, ['type', 'ids']);

      const contentType = validateEnum(args.type, BATCH_CONTENT_TYPES, 'type') as BatchContentType;

      // Validate and limit IDs
      if (!Array.isArray(args.ids) || args.ids.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  error: 'validation_failed',
                  code: 'INVALID_IDS',
                  message: 'ids must be a non-empty array of numbers',
                },
                null,
                2
              ),
            },
          ],
          isError: true,
        };
      }

      const ids = args.ids.slice(0, MAX_BATCH_SIZE).map((id: any) => validateId(id, 'Item'));
      const endpoint = CONTENT_TYPE_ENDPOINTS[contentType];

      // Build _fields parameter if specified
      const fieldsParam = args.fields?.length ? `_fields=${args.fields.join(',')}` : '';

      // Execute parallel requests
      const results: BatchItemResult[] = await Promise.all(
        ids.map(async (id: number) => {
          try {
            const url = fieldsParam ? `${endpoint}/${id}?${fieldsParam}` : `${endpoint}/${id}`;
            const data = await context.wpRequest(url);
            return { id, success: true, data };
          } catch (error: any) {
            return {
              id,
              success: false,
              error: mapHttpErrorToCode(error),
            };
          }
        })
      );

      const succeeded = results.filter((r) => r.success).length;

      const response: BatchResponse = {
        operation: 'get',
        type: contentType,
        total_requested: ids.length,
        succeeded,
        failed: ids.length - succeeded,
        results,
      };

      return {
        content: [{ type: 'text', text: context.clampText(JSON.stringify(response, null, 2)) }],
      };
    },
    category: ToolCategory.BATCH,
  });

  // ============================================
  // wpnav_batch_update - Update multiple items
  // ============================================
  toolRegistry.register({
    definition: {
      name: 'wpnav_batch_update',
      description: `Update multiple WordPress items in a single call. Supports ${BATCH_CONTENT_TYPES.join(', ')}. Requires WPNAV_ENABLE_WRITES=1. Max ${MAX_BATCH_SIZE} items per request.`,
      inputSchema: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: [...BATCH_CONTENT_TYPES],
            description: 'Content type to update',
          },
          updates: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'number', description: 'WordPress ID' },
                data: {
                  type: 'object',
                  additionalProperties: true,
                  description: 'Fields to update',
                },
              },
              required: ['id', 'data'],
            },
            description: `Array of updates (max ${MAX_BATCH_SIZE})`,
            maxItems: MAX_BATCH_SIZE,
          },
        },
        required: ['type', 'updates'],
      },
    },
    handler: async (args, context) => {
      validateRequired(args, ['type', 'updates']);

      const contentType = validateEnum(args.type, BATCH_CONTENT_TYPES, 'type') as BatchContentType;

      // Validate updates array
      if (!Array.isArray(args.updates) || args.updates.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  error: 'validation_failed',
                  code: 'INVALID_UPDATES',
                  message: 'updates must be a non-empty array of {id, data} objects',
                },
                null,
                2
              ),
            },
          ],
          isError: true,
        };
      }

      const updates: BatchUpdateItem[] = args.updates.slice(0, MAX_BATCH_SIZE).map((u: any) => ({
        id: validateId(u.id, 'Item'),
        data: u.data || {},
      }));

      const endpoint = CONTENT_TYPE_ENDPOINTS[contentType];

      // Execute updates (sequentially to respect concurrency guard)
      const results: BatchItemResult[] = [];

      for (const update of updates) {
        try {
          const data = await context.wpRequest(`${endpoint}/${update.id}`, {
            method: 'POST',
            body: JSON.stringify(update.data),
          });
          results.push({ id: update.id, success: true, data });
        } catch (error: any) {
          results.push({
            id: update.id,
            success: false,
            error: mapHttpErrorToCode(error),
          });
        }
      }

      const succeeded = results.filter((r) => r.success).length;

      const response: BatchResponse = {
        operation: 'update',
        type: contentType,
        total_requested: updates.length,
        succeeded,
        failed: updates.length - succeeded,
        results,
      };

      return {
        content: [{ type: 'text', text: context.clampText(JSON.stringify(response, null, 2)) }],
        isError: succeeded === 0 && updates.length > 0,
      };
    },
    category: ToolCategory.BATCH,
  });

  // ============================================
  // wpnav_batch_delete - Delete multiple items
  // ============================================
  toolRegistry.register({
    definition: {
      name: 'wpnav_batch_delete',
      description: `DELETE multiple WordPress items in a single call. HIGH RISK: Requires confirm_destructive=true and WPNAV_ENABLE_WRITES=1. Supports ${BATCH_CONTENT_TYPES.join(', ')}. Max ${MAX_BATCH_SIZE} items.`,
      inputSchema: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: [...BATCH_CONTENT_TYPES],
            description: 'Content type to delete',
          },
          ids: {
            type: 'array',
            items: { type: 'number' },
            description: `Array of WordPress IDs to delete (max ${MAX_BATCH_SIZE})`,
            maxItems: MAX_BATCH_SIZE,
          },
          force: {
            type: 'boolean',
            description: 'Force permanent deletion (skip trash). Default: false',
            default: false,
          },
          reassign: {
            type: 'number',
            description: 'For users only: User ID to reassign content to before deletion',
          },
          confirm_destructive: {
            type: 'boolean',
            description: 'REQUIRED: Must be true to confirm this destructive batch operation',
          },
        },
        required: ['type', 'ids', 'confirm_destructive'],
      },
    },
    handler: async (args, context) => {
      validateRequired(args, ['type', 'ids', 'confirm_destructive']);

      // Safety guard: require explicit confirmation
      if (args.confirm_destructive !== true) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  error: 'confirmation_required',
                  code: 'CONFIRM_DESTRUCTIVE_REQUIRED',
                  message:
                    'Batch delete requires confirm_destructive=true. This operation CANNOT be undone if force=true.',
                  hint: 'Set confirm_destructive: true to proceed with deletion',
                },
                null,
                2
              ),
            },
          ],
          isError: true,
        };
      }

      const contentType = validateEnum(args.type, BATCH_CONTENT_TYPES, 'type') as BatchContentType;

      // Validate IDs
      if (!Array.isArray(args.ids) || args.ids.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  error: 'validation_failed',
                  code: 'INVALID_IDS',
                  message: 'ids must be a non-empty array of numbers',
                },
                null,
                2
              ),
            },
          ],
          isError: true,
        };
      }

      const ids = args.ids.slice(0, MAX_BATCH_SIZE).map((id: any) => validateId(id, 'Item'));
      const endpoint = CONTENT_TYPE_ENDPOINTS[contentType];
      const force = args.force === true;

      // Build query params
      const params = new URLSearchParams();
      params.append('force', String(force));

      // For users, require reassign parameter
      if (contentType === 'users') {
        if (!args.reassign) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    error: 'validation_failed',
                    code: 'REASSIGN_REQUIRED',
                    message:
                      'Deleting users requires a reassign parameter to transfer their content',
                    hint: 'Provide reassign: <user_id> to reassign posts/pages to another user',
                  },
                  null,
                  2
                ),
              },
            ],
            isError: true,
          };
        }
        params.append('reassign', String(args.reassign));
      }

      const queryString = params.toString();

      // Execute deletes (sequentially to respect concurrency guard)
      const results: BatchItemResult[] = [];

      for (const id of ids) {
        try {
          const data = await context.wpRequest(`${endpoint}/${id}?${queryString}`, {
            method: 'DELETE',
          });
          results.push({ id, success: true, data });
        } catch (error: any) {
          results.push({
            id,
            success: false,
            error: mapHttpErrorToCode(error),
          });
        }
      }

      const succeeded = results.filter((r) => r.success).length;

      const response: BatchResponse = {
        operation: 'delete',
        type: contentType,
        total_requested: ids.length,
        succeeded,
        failed: ids.length - succeeded,
        results,
      };

      return {
        content: [{ type: 'text', text: context.clampText(JSON.stringify(response, null, 2)) }],
        isError: succeeded === 0 && ids.length > 0,
      };
    },
    category: ToolCategory.BATCH,
  });
}
