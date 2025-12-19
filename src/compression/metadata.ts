/**
 * Response Metadata
 *
 * Generates _meta block for all tool responses to provide
 * AI agents with context about the response.
 *
 * @package WP_Navigator_Pro
 * @since 2.8.0
 */

import type { ResponseHints } from './hints.js';

/**
 * Response metadata schema
 */
export interface ResponseMeta {
  /** Approximate tokens in response */
  token_estimate: number;
  /** Items in this response */
  items_returned: number;
  /** Total items available (from API) */
  items_available: number;
  /** Compression level applied */
  compression: 'none' | 'compact' | 'full';
  /** Fields that were truncated */
  truncated_fields: string[];
  /** Whether response was cached */
  cached: boolean;
  /** API response time in milliseconds */
  response_time_ms: number;
  /** Tool chaining hints for AI agents */
  _hints?: ResponseHints;
}

/**
 * Options for generating metadata
 */
export interface MetadataOptions {
  /** Start time for response timing */
  startTime?: number;
  /** Total items available (from API headers or response) */
  totalAvailable?: number;
  /** Compression mode used */
  compression?: 'none' | 'compact' | 'full';
  /** List of truncated field names */
  truncatedFields?: string[];
  /** Whether from cache */
  cached?: boolean;
  /** Tool chaining hints for AI agents */
  hints?: ResponseHints;
}

/**
 * Estimate token count from string content.
 * Uses approximation: ~4 characters per token for English text.
 *
 * @param content - String or object to estimate
 * @returns Approximate token count
 */
export function estimateTokens(content: unknown): number {
  const text = typeof content === 'string' ? content : JSON.stringify(content);
  // Average ~4 chars per token, round up
  return Math.ceil(text.length / 4);
}

/**
 * Count items in response data.
 *
 * @param data - Response data (array or object)
 * @returns Number of items
 */
export function countItems(data: unknown): number {
  if (Array.isArray(data)) {
    return data.length;
  }
  if (data && typeof data === 'object') {
    // Check for common list response patterns
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.items)) return obj.items.length;
    if (Array.isArray(obj.data)) return obj.data.length;
    if (Array.isArray(obj.posts)) return obj.posts.length;
    if (Array.isArray(obj.pages)) return obj.pages.length;
    if (Array.isArray(obj.results)) return obj.results.length;
    // Single item response
    return 1;
  }
  return 0;
}

/**
 * Generate response metadata.
 *
 * @param data - Response data
 * @param options - Metadata options
 * @returns ResponseMeta object
 */
export function generateMeta(data: unknown, options: MetadataOptions = {}): ResponseMeta {
  const itemsReturned = countItems(data);
  const endTime = Date.now();
  const responseTime = options.startTime ? endTime - options.startTime : 0;

  const meta: ResponseMeta = {
    token_estimate: estimateTokens(data),
    items_returned: itemsReturned,
    items_available: options.totalAvailable ?? itemsReturned,
    compression: options.compression ?? 'none',
    truncated_fields: options.truncatedFields ?? [],
    cached: options.cached ?? false,
    response_time_ms: responseTime,
  };

  if (options.hints) {
    meta._hints = options.hints;
  }

  return meta;
}

/**
 * Wrap response data with metadata.
 *
 * @param data - Response data
 * @param options - Metadata options
 * @returns Object with data and _meta
 */
export function wrapWithMeta<T>(
  data: T,
  options: MetadataOptions = {}
): { data: T; _meta: ResponseMeta } {
  return {
    data,
    _meta: generateMeta(data, options),
  };
}

/**
 * Options for addMetadata helper.
 *
 * This provides a simpler interface for attaching hints
 * while delegating to the full metadata generator.
 */
export interface AddMetadataOptions {
  truncated?: boolean;
  compact?: boolean;
  delta?: boolean;
  hints?: ResponseHints;
}

/**
 * Backwards-compatible helper for attaching _meta to tool responses.
 *
 * Currently only the `hints` option is wired through to the
 * metadata generator; other flags are reserved for future
 * compression integrations.
 */
export function addMetadata<T>(
  data: T,
  options: AddMetadataOptions = {}
): { data: T; _meta: ResponseMeta } {
  const metaOptions: MetadataOptions = {};

  if (options.hints) {
    metaOptions.hints = options.hints;
  }

  return wrapWithMeta(data, metaOptions);
}
