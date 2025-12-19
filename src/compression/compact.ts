/**
 * Compact Response Utilities
 *
 * Functions for compacting API responses to reduce token usage.
 *
 * @package WP_Navigator_Pro
 * @since 2.8.0
 */

import type { CompactOptions, CompactedResponse } from './types.js';
import { DEFAULT_COMPACT_OPTIONS } from './types.js';

/**
 * Apply compact mode to an array response.
 *
 * @param data - Array of items to compact
 * @param options - Compact options
 * @returns Compacted response with metadata
 */
export function compactResponse<T extends Record<string, any>>(
  data: T[],
  options: Partial<CompactOptions> = {}
): CompactedResponse<T> {
  const opts: Required<CompactOptions> = { ...DEFAULT_COMPACT_OPTIONS, ...options };

  // If not enabled, return all data with metadata
  if (!opts.enabled) {
    return {
      items: data,
      _compact: {
        compacted: false,
        total_count: data.length,
        returned_count: data.length,
        has_more: false,
      },
    };
  }

  const totalCount = data.length;
  const maxItems = opts.maxItems ?? 5;

  // Truncate to maxItems
  let items = data.slice(0, maxItems);

  // Apply field filtering if specified
  if (opts.fields && opts.fields.length > 0) {
    items = items.map((item) => filterFields(item, opts.fields!));
  }

  const hasMore = totalCount > maxItems;

  // Build response
  const response: CompactedResponse<T> = {
    items,
    _compact: {
      compacted: true,
      total_count: opts.includeFullCount ? totalCount : items.length,
      returned_count: items.length,
      has_more: hasMore,
    },
  };

  // Generate summary if enabled
  if (opts.generateSummary && items.length > 0) {
    response._compact.summary = generateSummary(items, totalCount, hasMore);
  }

  return response;
}

/**
 * Filter object to only include specified fields.
 */
function filterFields<T extends Record<string, any>>(item: T, fields: string[]): T {
  const result: Record<string, any> = {};
  for (const field of fields) {
    if (field in item) {
      result[field] = item[field];
    }
  }
  return result as T;
}

/**
 * Generate AI-friendly summary of compacted data.
 */
function generateSummary<T extends Record<string, any>>(
  items: T[],
  totalCount: number,
  hasMore: boolean
): string {
  const itemType = detectItemType(items[0]);
  const returnedCount = items.length;

  if (hasMore) {
    return `Showing ${returnedCount} of ${totalCount} ${itemType}. Use pagination or increase limit to see more.`;
  }

  return `${totalCount} ${itemType} total.`;
}

/**
 * Detect item type from common WordPress fields.
 */
function detectItemType(item: Record<string, any>): string {
  if ('post_type' in item) {
    return item.post_type === 'page' ? 'pages' : 'posts';
  }
  if ('taxonomy' in item) {
    return item.taxonomy === 'category' ? 'categories' : 'tags';
  }
  if ('plugin' in item || ('status' in item && 'version' in item)) {
    return 'plugins';
  }
  if ('stylesheet' in item || 'theme' in item) {
    return 'themes';
  }
  if ('roles' in item || 'email' in item) {
    return 'users';
  }
  if ('mime_type' in item || 'media_type' in item) {
    return 'media items';
  }
  return 'items';
}

/**
 * Check if compact mode should be applied based on args.
 */
export function shouldCompact(args: Record<string, any>): boolean {
  return args.compact === true;
}

/**
 * Extract compact options from tool arguments.
 */
export function extractCompactOptions(args: Record<string, any>): Partial<CompactOptions> {
  return {
    enabled: args.compact === true,
    maxItems: args.compact_limit ?? args.limit ?? undefined,
    fields: args.fields,
    generateSummary: args.compact_summary !== false,
  };
}
