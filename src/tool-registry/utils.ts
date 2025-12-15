/**
 * Shared Utilities for Tool Registry
 *
 * Common validation and transformation functions used by tool handlers.
 *
 * @package WP_Navigator_Pro
 * @since 1.3.0
 */

/**
 * Validate required fields in arguments
 */
export function validateRequired(args: any, fields: string[]): void {
  const missing: string[] = [];

  for (const field of fields) {
    if (args[field] === undefined || args[field] === null || args[field] === '') {
      missing.push(field);
    }
  }

  if (missing.length > 0) {
    throw new Error(`Missing required fields: ${missing.join(', ')}`);
  }
}

/**
 * Build query string from parameters
 */
export function buildQueryString(params: Record<string, any>): string {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      searchParams.append(key, String(value));
    }
  }

  return searchParams.toString();
}

/**
 * Extract summary fields from WordPress object
 */
export function extractSummary<T extends Record<string, any>>(
  obj: T,
  fields: string[]
): Record<string, any> {
  const summary: Record<string, any> = {};

  for (const field of fields) {
    if (field.includes('.')) {
      // Handle nested fields (e.g., 'title.rendered')
      const parts = field.split('.');
      let value: any = obj;
      for (const part of parts) {
        value = value?.[part];
      }
      summary[field] = value;
    } else {
      summary[field] = obj[field];
    }
  }

  return summary;
}

/**
 * Normalize WordPress status string
 */
export function normalizeStatus(status?: string): string {
  if (!status) {
    return 'publish';
  }

  const normalized = status.toLowerCase();
  const valid = ['publish', 'draft', 'private', 'pending', 'future', 'trash', 'any'];

  if (!valid.includes(normalized)) {
    throw new Error(
      `Invalid status: ${status}. Valid values: ${valid.filter((s) => s !== 'any').join(', ')}`
    );
  }

  return normalized;
}

/**
 * Validate pagination parameters
 */
export function validatePagination(args: { page?: number; per_page?: number }): {
  page: number;
  per_page: number;
} {
  const page = Math.max(1, args.page ?? 1);
  const per_page = Math.min(250, Math.max(1, args.per_page ?? 10));

  return { page, per_page };
}

/**
 * Create error result
 */
export function createErrorResult(error: Error | string): {
  content: Array<{ type: 'text'; text: string }>;
  isError: boolean;
} {
  const message = error instanceof Error ? error.message : error;

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(
          {
            error: true,
            message,
          },
          null,
          2
        ),
      },
    ],
    isError: true,
  };
}

/**
 * Create success result
 */
export function createSuccessResult(
  data: any,
  clampText?: (text: string) => string
): {
  content: Array<{ type: 'text'; text: string }>;
} {
  const text = JSON.stringify(data, null, 2);

  return {
    content: [
      {
        type: 'text',
        text: clampText ? clampText(text) : text,
      },
    ],
  };
}

/**
 * Validate ID parameter
 */
export function validateId(id: any, entityName: string = 'Entity'): number {
  const numId = Number(id);

  if (isNaN(numId) || numId <= 0) {
    throw new Error(`${entityName} ID must be a positive integer`);
  }

  return numId;
}

/**
 * Parse boolean from various input types
 */
export function parseBoolean(value: any): boolean {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const lower = value.toLowerCase();
    return lower === 'true' || lower === '1' || lower === 'yes' || lower === 'on';
  }

  if (typeof value === 'number') {
    return value !== 0;
  }

  return Boolean(value);
}

/**
 * Sanitize user input (basic XSS prevention)
 */
export function sanitizeInput(input: string): string {
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Validate array parameter
 */
export function validateArray(value: any, fieldName: string): string[] {
  if (Array.isArray(value)) {
    return value.map(String);
  }

  if (typeof value === 'string') {
    return value.split(',').map((s) => s.trim());
  }

  throw new Error(`${fieldName} must be an array or comma-separated string`);
}

/**
 * Validate enum value
 */
export function validateEnum<T extends string>(
  value: any,
  validValues: readonly T[],
  fieldName: string,
  defaultValue?: T
): T {
  if (value === undefined || value === null) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new Error(`${fieldName} is required. Valid values: ${validValues.join(', ')}`);
  }

  const strValue = String(value);
  if (!validValues.includes(strValue as T)) {
    throw new Error(`Invalid ${fieldName}: ${strValue}. Valid values: ${validValues.join(', ')}`);
  }

  return strValue as T;
}

/**
 * Build _fields parameter for WordPress REST API
 *
 * @param fields - Optional array of field names to include in response
 * @returns Comma-separated field names or undefined if no fields provided
 */
export function buildFieldsParam(fields?: string[]): string | undefined {
  if (!fields || fields.length === 0) {
    return undefined;
  }
  return fields.join(',');
}
