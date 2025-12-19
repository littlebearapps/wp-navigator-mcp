/**
 * Smart Content Truncation
 *
 * Auto-truncates long content fields while preserving word boundaries
 * and providing metadata about the full content size.
 *
 * @package WP_Navigator_Pro
 * @since 2.8.0
 */

/**
 * Truncation options
 */
export interface TruncationOptions {
  /** Maximum characters to keep (default: 500) */
  maxLength?: number;
  /** Suffix to append when truncated (default: '[...truncated, N chars]') */
  suffix?: boolean;
  /** Preserve word boundaries (default: true) */
  preserveWords?: boolean;
}

/**
 * Truncation result with metadata
 */
export interface TruncationResult {
  /** Truncated or original content */
  content: string;
  /** Original content length */
  content_length: number;
  /** Whether content was truncated */
  content_truncated: boolean;
}

/**
 * Default truncation options
 */
const DEFAULT_OPTIONS: Required<TruncationOptions> = {
  maxLength: 500,
  suffix: true,
  preserveWords: true,
};

/**
 * Truncate content with smart word boundary detection.
 *
 * @param content - Original content string
 * @param options - Truncation options
 * @returns Truncation result with metadata
 */
export function truncateContent(
  content: string | null | undefined,
  options: TruncationOptions = {}
): TruncationResult {
  // Handle null/undefined
  if (content == null) {
    return {
      content: '',
      content_length: 0,
      content_truncated: false,
    };
  }

  const opts = { ...DEFAULT_OPTIONS, ...options };
  const originalLength = content.length;

  // No truncation needed
  if (originalLength <= opts.maxLength) {
    return {
      content,
      content_length: originalLength,
      content_truncated: false,
    };
  }

  let truncated = content.slice(0, opts.maxLength);

  // Preserve word boundaries by finding last space
  if (opts.preserveWords) {
    const lastSpace = truncated.lastIndexOf(' ');
    if (lastSpace > opts.maxLength * 0.7) {
      // Only break at word if not too far back
      truncated = truncated.slice(0, lastSpace);
    }
  }

  // Ensure we don't cut in the middle of a UTF-8 character
  truncated = ensureValidUtf8(truncated);

  // Add suffix with original length info
  if (opts.suffix) {
    truncated = `${truncated.trimEnd()}...[truncated, ${originalLength} chars]`;
  }

  return {
    content: truncated,
    content_length: originalLength,
    content_truncated: true,
  };
}

/**
 * Ensure string doesn't end with a partial UTF-8 character.
 * Handles surrogate pairs for characters outside BMP.
 */
function ensureValidUtf8(str: string): string {
  if (str.length === 0) return str;

  const lastChar = str.charCodeAt(str.length - 1);

  // Check if last character is a high surrogate (incomplete pair)
  if (lastChar >= 0xd800 && lastChar <= 0xdbff) {
    return str.slice(0, -1);
  }

  return str;
}

/**
 * Apply truncation to an object's content fields.
 *
 * @param obj - Object with potential content fields
 * @param options - Truncation options
 * @returns Object with truncated content fields and metadata
 */
export function truncateObjectContent<T extends Record<string, any>>(
  obj: T,
  options: TruncationOptions = {}
): T & { content_length?: number; content_truncated?: boolean } {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  // Check for content field (raw or rendered)
  const contentField = (obj as any).content?.rendered ?? (obj as any).content;

  if (typeof contentField !== 'string') {
    return obj;
  }

  const result = truncateContent(contentField, options);
  const newObj: any = { ...obj };

  // Update content field
  if ((obj as any).content?.rendered !== undefined) {
    newObj.content = { ...(obj as any).content, rendered: result.content };
  } else {
    newObj.content = result.content;
  }

  // Add metadata
  newObj.content_length = result.content_length;
  newObj.content_truncated = result.content_truncated;

  return newObj;
}

/**
 * Apply truncation to an array of objects.
 *
 * @param items - Array of objects with potential content fields
 * @param options - Truncation options
 * @returns Array with truncated content fields
 */
export function truncateArrayContent<T extends Record<string, any>>(
  items: T[],
  options: TruncationOptions = {}
): Array<T & { content_length?: number; content_truncated?: boolean }> {
  return items.map((item) => truncateObjectContent(item, options));
}
