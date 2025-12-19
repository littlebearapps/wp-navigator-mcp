/**
 * Compression Module Types
 *
 * Defines types for compact mode response optimization.
 *
 * @package WP_Navigator_Pro
 * @since 2.8.0
 */

/**
 * Options for compact response mode
 */
export interface CompactOptions {
  /** Whether compact mode is enabled */
  enabled: boolean;

  /** Maximum number of items to return in lists (default: 5) */
  maxItems?: number;

  /** Include total count even when truncating (default: true) */
  includeFullCount?: boolean;

  /** Generate AI-friendly summary (default: true) */
  generateSummary?: boolean;

  /** Fields to include (if specified, only these fields returned) */
  fields?: string[];
}

/**
 * Compacted response wrapper
 */
export interface CompactedResponse<T> {
  /** The actual data items (may be truncated) */
  items: T[];

  /** Compact mode metadata */
  _compact: {
    /** Whether response was compacted */
    compacted: boolean;

    /** Total count before compaction */
    total_count: number;

    /** Number of items returned */
    returned_count: number;

    /** Whether more items exist */
    has_more: boolean;

    /** AI-friendly summary (if enabled) */
    summary?: string;
  };
}

/**
 * Default compact options
 */
export const DEFAULT_COMPACT_OPTIONS: Required<CompactOptions> = {
  enabled: false,
  maxItems: 5,
  includeFullCount: true,
  generateSummary: true,
  fields: [],
};
