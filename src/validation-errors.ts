/**
 * Validation Error Formatting
 *
 * Phase B1: User-friendly error messages with file:line:column positions.
 * Provides detailed context for validation failures.
 *
 * @package WP_Navigator_MCP
 * @since 1.2.0
 */

// =============================================================================
// Types
// =============================================================================

/**
 * Position in a source file
 */
export interface SourcePosition {
  /** 1-based line number */
  line: number;
  /** 1-based column number */
  column: number;
  /** 0-based character offset from start of file */
  offset: number;
}

/**
 * A validation error with full context
 */
export interface ValidationError {
  /** Error code for programmatic handling */
  code: string;
  /** Human-readable error message */
  message: string;
  /** File path where error occurred */
  filePath: string;
  /** Position in file (if determinable) */
  position?: SourcePosition;
  /** JSON path to the field (e.g., "brand.palette.primary") */
  fieldPath?: string;
  /** Expected type or format */
  expected?: string;
  /** Actual value that was found */
  actual?: string;
  /** Suggestion for how to fix */
  suggestion?: string;
}

/**
 * Result of locating a JSON key in source
 */
interface KeyLocation {
  /** Position of the key */
  position: SourcePosition;
  /** Position of the value (after the colon) */
  valuePosition: SourcePosition;
}

// =============================================================================
// Position Finding
// =============================================================================

/**
 * Convert a 0-based character offset to line:column position
 *
 * @param source - Source text
 * @param offset - 0-based character offset
 * @returns Line and column (1-based)
 */
export function offsetToPosition(source: string, offset: number): SourcePosition {
  let line = 1;
  let column = 1;
  let currentOffset = 0;

  for (let i = 0; i < offset && i < source.length; i++) {
    if (source[i] === '\n') {
      line++;
      column = 1;
    } else {
      column++;
    }
    currentOffset = i + 1;
  }

  return { line, column, offset: currentOffset };
}

/**
 * Find the position of a JSON key in source content
 *
 * Handles nested paths like "brand.palette.primary" by finding each
 * level of nesting in sequence.
 *
 * @param source - JSON/JSONC source text
 * @param fieldPath - Dot-separated path (e.g., "brand.palette.primary")
 * @returns Key location or undefined if not found
 */
export function findKeyPosition(source: string, fieldPath: string): KeyLocation | undefined {
  const parts = parseFieldPath(fieldPath);
  if (parts.length === 0) return undefined;

  let searchStart = 0;
  let lastKeyPos: KeyLocation | undefined;

  for (const part of parts) {
    const result = findNextKey(source, part, searchStart);
    if (!result) return undefined;

    lastKeyPos = result;
    // Continue searching after this key's value position
    searchStart = result.valuePosition.offset;
  }

  return lastKeyPos;
}

/**
 * Parse a field path into parts, handling array indices
 *
 * Examples:
 *   "brand.palette.primary" => ["brand", "palette", "primary"]
 *   "pages[0].slug" => ["pages", "0", "slug"]
 *   "plugins.akismet.enabled" => ["plugins", "akismet", "enabled"]
 */
function parseFieldPath(fieldPath: string): string[] {
  const parts: string[] = [];
  let current = '';

  for (let i = 0; i < fieldPath.length; i++) {
    const char = fieldPath[i];

    if (char === '.') {
      if (current) {
        parts.push(current);
        current = '';
      }
    } else if (char === '[') {
      if (current) {
        parts.push(current);
        current = '';
      }
      // Find closing bracket
      const closeIdx = fieldPath.indexOf(']', i);
      if (closeIdx > i + 1) {
        parts.push(fieldPath.slice(i + 1, closeIdx));
        i = closeIdx;
      }
    } else if (char !== ']') {
      current += char;
    }
  }

  if (current) {
    parts.push(current);
  }

  return parts;
}

/**
 * Find a specific key in JSON source starting from an offset
 */
function findNextKey(source: string, key: string, startOffset: number): KeyLocation | undefined {
  // Handle array index (numeric key)
  if (/^\d+$/.test(key)) {
    return findArrayIndex(source, parseInt(key, 10), startOffset);
  }

  // Search for "key": pattern
  const keyPattern = `"${key}"`;
  let searchPos = startOffset;

  while (searchPos < source.length) {
    const keyIdx = source.indexOf(keyPattern, searchPos);
    if (keyIdx === -1) return undefined;

    // Find the colon after the key
    let colonIdx = keyIdx + keyPattern.length;
    while (colonIdx < source.length && /\s/.test(source[colonIdx])) {
      colonIdx++;
    }

    if (source[colonIdx] === ':') {
      // Find start of value (skip whitespace after colon)
      let valueIdx = colonIdx + 1;
      while (valueIdx < source.length && /\s/.test(source[valueIdx])) {
        valueIdx++;
      }

      return {
        position: offsetToPosition(source, keyIdx),
        valuePosition: offsetToPosition(source, valueIdx),
      };
    }

    searchPos = keyIdx + 1;
  }

  return undefined;
}

/**
 * Find an array element by index
 */
function findArrayIndex(source: string, index: number, startOffset: number): KeyLocation | undefined {
  // Find opening bracket
  let bracketIdx = source.indexOf('[', startOffset);
  if (bracketIdx === -1) return undefined;

  let depth = 1;
  let elementCount = 0;
  let elementStart = bracketIdx + 1;

  // Skip initial whitespace
  while (elementStart < source.length && /\s/.test(source[elementStart])) {
    elementStart++;
  }

  if (index === 0 && source[elementStart] !== ']') {
    return {
      position: offsetToPosition(source, elementStart),
      valuePosition: offsetToPosition(source, elementStart),
    };
  }

  for (let i = bracketIdx + 1; i < source.length && depth > 0; i++) {
    const char = source[i];

    if (char === '[' || char === '{') {
      depth++;
    } else if (char === ']' || char === '}') {
      depth--;
    } else if (char === ',' && depth === 1) {
      elementCount++;
      if (elementCount === index) {
        // Found the element after this comma
        let valueStart = i + 1;
        while (valueStart < source.length && /\s/.test(source[valueStart])) {
          valueStart++;
        }
        return {
          position: offsetToPosition(source, valueStart),
          valuePosition: offsetToPosition(source, valueStart),
        };
      }
    }
  }

  return undefined;
}

// =============================================================================
// Error Formatting
// =============================================================================

/**
 * Format a validation error as a user-friendly string
 *
 * Example output:
 * ```
 * Error: wpnavigator.jsonc:15:5
 *   brand.palette.primary: Invalid color format
 *   Expected: Hex color (#RRGGBB)
 *   Got: "blue"
 *   Suggestion: Use a hex color like "#1a73e8"
 * ```
 */
export function formatValidationError(error: ValidationError): string {
  const lines: string[] = [];

  // Location line
  if (error.position) {
    lines.push(`Error: ${error.filePath}:${error.position.line}:${error.position.column}`);
  } else {
    lines.push(`Error: ${error.filePath}`);
  }

  // Field path and message
  if (error.fieldPath) {
    lines.push(`  ${error.fieldPath}: ${error.message}`);
  } else {
    lines.push(`  ${error.message}`);
  }

  // Expected value
  if (error.expected) {
    lines.push(`  Expected: ${error.expected}`);
  }

  // Actual value
  if (error.actual !== undefined) {
    lines.push(`  Got: ${error.actual}`);
  }

  // Suggestion
  if (error.suggestion) {
    lines.push(`  Suggestion: ${error.suggestion}`);
  }

  return lines.join('\n');
}

/**
 * Format multiple validation errors
 */
export function formatValidationErrors(errors: ValidationError[]): string {
  return errors.map(formatValidationError).join('\n\n');
}

/**
 * Format a validation error as JSON for structured output
 */
export function formatValidationErrorJson(error: ValidationError): Record<string, unknown> {
  return {
    code: error.code,
    message: error.message,
    file: error.filePath,
    position: error.position
      ? {
          line: error.position.line,
          column: error.position.column,
        }
      : undefined,
    field: error.fieldPath,
    expected: error.expected,
    actual: error.actual,
    suggestion: error.suggestion,
  };
}

// =============================================================================
// Error Creation Helpers
// =============================================================================

/**
 * Known validation error types with templates
 */
export const ValidationErrorTemplates = {
  // Type errors
  INVALID_TYPE: {
    code: 'INVALID_TYPE',
    getMessage: (field: string, expected: string, actual: string) =>
      `Invalid type for ${field}`,
    getSuggestion: (expected: string) => `Provide a value of type ${expected}`,
  },

  // Missing required fields
  MISSING_REQUIRED: {
    code: 'MISSING_REQUIRED',
    getMessage: (field: string) => `Missing required field`,
    getSuggestion: (field: string) => `Add the "${field}" field to your configuration`,
  },

  // Format errors
  INVALID_FORMAT: {
    code: 'INVALID_FORMAT',
    getMessage: (field: string, format: string) => `Invalid format`,
    getSuggestion: (format: string) => `Use the correct format: ${format}`,
  },

  // Value errors
  INVALID_VALUE: {
    code: 'INVALID_VALUE',
    getMessage: (field: string, allowed: string[]) =>
      `Invalid value`,
    getSuggestion: (allowed: string[]) => `Use one of: ${allowed.join(', ')}`,
  },

  // Schema version errors
  VERSION_TOO_OLD: {
    code: 'VERSION_TOO_OLD',
    getMessage: (current: string, minimum: string) =>
      `Schema version ${current} is older than minimum supported ${minimum}`,
    getSuggestion: () => 'Update your manifest to use a newer schema version',
  },

  VERSION_TOO_NEW: {
    code: 'VERSION_TOO_NEW',
    getMessage: (current: string, maximum: string) =>
      `Schema version ${current} is newer than supported ${maximum}`,
    getSuggestion: () => 'Update wp-navigator-mcp to support this schema version',
  },

  // JSON syntax errors
  INVALID_JSON: {
    code: 'INVALID_JSON',
    getMessage: (parseError: string) => `Invalid JSON syntax: ${parseError}`,
    getSuggestion: () => 'Check for missing commas, brackets, or quotes',
  },

  // Environment variable errors
  UNRESOLVED_ENV_VAR: {
    code: 'UNRESOLVED_ENV_VAR',
    getMessage: (varName: string) => `Environment variable ${varName} is not set`,
    getSuggestion: (varName: string) => `Set the ${varName} environment variable or update your config`,
  },

  // Color format errors
  INVALID_COLOR: {
    code: 'INVALID_COLOR',
    getMessage: () => 'Invalid color format',
    expected: 'Hex color (#RRGGBB or #RGB)',
    getSuggestion: () => 'Use a hex color like "#1a73e8" or "#f00"',
  },

  // URL format errors
  INVALID_URL: {
    code: 'INVALID_URL',
    getMessage: () => 'Invalid URL format',
    expected: 'Valid URL (https://example.com)',
    getSuggestion: () => 'Provide a valid URL starting with http:// or https://',
  },
} as const;

/**
 * Create a validation error with position from source
 *
 * @param template - Error template from ValidationErrorTemplates
 * @param filePath - Path to the file
 * @param source - File source content (for position finding)
 * @param fieldPath - Dot-separated path to the field
 * @param options - Additional error options
 */
export function createValidationError(
  code: string,
  message: string,
  filePath: string,
  source: string,
  fieldPath?: string,
  options?: {
    expected?: string;
    actual?: string;
    suggestion?: string;
  }
): ValidationError {
  let position: SourcePosition | undefined;

  if (fieldPath) {
    const keyLoc = findKeyPosition(source, fieldPath);
    if (keyLoc) {
      position = keyLoc.position;
    }
  }

  return {
    code,
    message,
    filePath,
    position,
    fieldPath,
    ...options,
  };
}

/**
 * Parse JSON syntax error to extract position
 *
 * JSON.parse errors typically include "at position N" or "line N column N"
 */
export function parseJsonSyntaxError(
  error: Error,
  source: string
): { message: string; position?: SourcePosition } {
  const message = error.message;

  // Try to extract position from "at position N"
  const posMatch = message.match(/at position (\d+)/i);
  if (posMatch) {
    const offset = parseInt(posMatch[1], 10);
    return {
      message: message.replace(/at position \d+/i, '').trim(),
      position: offsetToPosition(source, offset),
    };
  }

  // Try to extract from "line N column N"
  const lineColMatch = message.match(/line (\d+) column (\d+)/i);
  if (lineColMatch) {
    return {
      message: message.replace(/line \d+ column \d+/i, '').trim(),
      position: {
        line: parseInt(lineColMatch[1], 10),
        column: parseInt(lineColMatch[2], 10),
        offset: 0, // Can't determine offset from line:col alone
      },
    };
  }

  return { message };
}

// =============================================================================
// Validation Helpers
// =============================================================================

/**
 * Validate a hex color value
 */
export function isValidHexColor(value: string): boolean {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value);
}

/**
 * Validate a URL
 */
export function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Validate a semver-like version string
 */
export function isValidVersion(value: string): boolean {
  return /^\d+\.\d+(\.\d+)?$/.test(value);
}

/**
 * Get type name for display
 */
export function getTypeName(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}
