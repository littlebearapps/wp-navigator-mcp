/**
 * Compact List Response Helper
 *
 * Standardized compact mode for list tools.
 *
 * @package WP_Navigator_Pro
 * @since 2.8.0
 */

import { estimateTokens } from './metadata.js';
import { generateSummary, type SummaryContentType } from './summarizer.js';

/**
 * Compact list response interface
 */
export interface CompactListResponse<T> {
  ai_summary: string;
  items: T[];
  full_count: number;
  has_more: boolean;
  _meta: {
    compact: true;
    token_estimate: number;
  };
}

/**
 * Summary-only list response interface
 *
 * Used when tools return only an AI-focused summary without
 * the individual items payload to minimize token usage.
 */
export interface SummaryOnlyListResponse {
  ai_summary: string;
  full_count: number;
  _meta: {
    compact: true;
    summary_only: true;
    token_estimate: number;
  };
}

/**
 * Default number of items in compact mode
 */
const DEFAULT_TOP_COUNT = 5;

/**
 * Generate AI summary for a list of items.
 *
 * @param entityType - Type of entity (posts, pages, plugins, etc.)
 * @param items - Full list of items
 * @param context - Additional context for summary
 * @returns Summary string
 */
export function generateListSummary(
  entityType: string,
  items: unknown[],
  context?: Record<string, unknown>
): string {
  const count = items.length;
  if (count === 0) {
    return `No ${entityType} found.`;
  }

  const contextParts: string[] = [];
  if (context?.status) {
    contextParts.push(`status: ${context.status}`);
  }
  if (context?.category) {
    contextParts.push(`category: ${context.category}`);
  }

  const contextStr = contextParts.length > 0 ? ` (${contextParts.join(', ')})` : '';
  return `Found ${count} ${entityType}${contextStr}. Showing top ${Math.min(count, DEFAULT_TOP_COUNT)}.`;
}

/**
 * Select top items from a list.
 *
 * @param items - Full list of items
 * @param count - Number of items to select (default: 5)
 * @returns Top items
 */
export function selectTopItems<T>(items: T[], count = DEFAULT_TOP_COUNT): T[] {
  return items.slice(0, count);
}

/**
 * Create a compact list response.
 *
 * @param entityType - Type of entity for summary
 * @param items - Full list of items
 * @param topCount - Number of top items (default: 5)
 * @param context - Additional context for summary
 * @returns Compact response object
 */
export function createCompactListResponse<T>(
  entityType: string,
  items: T[],
  topCount = DEFAULT_TOP_COUNT,
  context?: Record<string, unknown>
): CompactListResponse<T> {
  const topItems = selectTopItems(items, topCount);
  const summary = generateListSummary(entityType, items, context);
  const responseText = JSON.stringify({ ai_summary: summary, items: topItems });

  return {
    ai_summary: summary,
    items: topItems,
    full_count: items.length,
    has_more: items.length > topCount,
    _meta: {
      compact: true,
      token_estimate: estimateTokens(responseText),
    },
  };
}

/**
 * Create a summary-only list response.
 *
 * Intended for `summary_only` parameters on list tools where
 * callers want high-level insight without the item list.
 */
export function createSummaryOnlyListResponse<T>(
  contentType: SummaryContentType,
  items: T[]
): SummaryOnlyListResponse {
  const ai_summary = generateSummary(items as any, { contentType });
  const responseText = JSON.stringify({ ai_summary });

  return {
    ai_summary,
    full_count: items.length,
    _meta: {
      compact: true,
      summary_only: true,
      token_estimate: estimateTokens(responseText),
    },
  };
}
