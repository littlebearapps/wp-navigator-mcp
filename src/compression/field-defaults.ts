/**
 * Smart Field Defaults
 *
 * Defines optimal default field sets for each tool type,
 * optimized for AI agent decision-making with minimal tokens.
 *
 * @package WP_Navigator_Pro
 * @since 2.8.0
 */

/**
 * Field set types
 */
export type FieldSetType = 'list' | 'get' | 'search';

/**
 * Default field configuration
 */
export interface FieldDefaults {
  /** Fields for list operations (scanning, overview) */
  list: string[];
  /** Fields for get operations (detailed view) */
  get: string[];
  /** Fields for search operations (relevance) */
  search: string[];
}

/**
 * Default fields per resource type
 */
export const DEFAULT_FIELDS: Record<string, FieldDefaults> = {
  // Content types
  posts: {
    list: ['id', 'title', 'status', 'date', 'excerpt', 'categories'],
    get: ['id', 'title', 'status', 'date', 'content', 'excerpt', 'categories', 'tags', 'author'],
    search: ['id', 'title', 'type', 'excerpt'],
  },
  pages: {
    list: ['id', 'title', 'status', 'date', 'parent', 'menu_order'],
    get: ['id', 'title', 'status', 'date', 'content', 'parent', 'menu_order', 'template'],
    search: ['id', 'title', 'type', 'excerpt'],
  },
  media: {
    list: ['id', 'title', 'mime_type', 'date', 'source_url'],
    get: ['id', 'title', 'mime_type', 'date', 'source_url', 'alt_text', 'caption', 'description'],
    search: ['id', 'title', 'mime_type', 'source_url'],
  },
  comments: {
    list: ['id', 'post', 'author_name', 'date', 'status'],
    get: ['id', 'post', 'author_name', 'author_email', 'date', 'status', 'content'],
    search: ['id', 'post', 'author_name', 'content'],
  },

  // Taxonomy types
  categories: {
    list: ['id', 'name', 'slug', 'count', 'parent'],
    get: ['id', 'name', 'slug', 'description', 'count', 'parent'],
    search: ['id', 'name', 'slug', 'count'],
  },
  tags: {
    list: ['id', 'name', 'slug', 'count'],
    get: ['id', 'name', 'slug', 'description', 'count'],
    search: ['id', 'name', 'slug', 'count'],
  },

  // System types
  plugins: {
    list: ['plugin', 'name', 'status', 'version', 'update_available'],
    get: ['plugin', 'name', 'status', 'version', 'description', 'author', 'update_available'],
    search: ['plugin', 'name', 'status', 'version'],
  },
  themes: {
    list: ['stylesheet', 'name', 'status', 'version'],
    get: ['stylesheet', 'name', 'status', 'version', 'description', 'author', 'template'],
    search: ['stylesheet', 'name', 'version'],
  },
  users: {
    list: ['id', 'name', 'email', 'roles'],
    get: ['id', 'name', 'email', 'roles', 'registered_date', 'description'],
    search: ['id', 'name', 'email', 'roles'],
  },

  // Block types
  block_patterns: {
    list: ['name', 'title', 'categories'],
    get: ['name', 'title', 'description', 'categories', 'content'],
    search: ['name', 'title', 'categories'],
  },
  block_templates: {
    list: ['id', 'slug', 'title', 'type'],
    get: ['id', 'slug', 'title', 'type', 'description', 'content'],
    search: ['id', 'slug', 'title'],
  },
};

/**
 * Get default fields for a resource and operation type.
 *
 * @param resource - Resource type (e.g., 'posts', 'pages', 'plugins')
 * @param operation - Operation type ('list', 'get', 'search')
 * @returns Array of field names, or undefined if no defaults defined
 */
export function getDefaultFields(resource: string, operation: FieldSetType): string[] | undefined {
  const resourceDefaults = DEFAULT_FIELDS[resource];
  if (!resourceDefaults) {
    return undefined;
  }
  return resourceDefaults[operation];
}

/**
 * Apply field defaults to a request if no explicit fields specified.
 *
 * @param resource - Resource type
 * @param operation - Operation type
 * @param explicitFields - Fields explicitly requested by caller
 * @returns Fields to use (explicit or defaults)
 */
export function applyFieldDefaults(
  resource: string,
  operation: FieldSetType,
  explicitFields?: string[]
): string[] | undefined {
  // If explicit fields provided, use them
  if (explicitFields && explicitFields.length > 0) {
    return explicitFields;
  }

  // Otherwise return defaults (may be undefined)
  return getDefaultFields(resource, operation);
}

/**
 * Filter an object to only include specified fields.
 *
 * @param data - Object to filter
 * @param fields - Fields to include
 * @returns Filtered object with only specified fields
 */
export function filterFields<T extends Record<string, unknown>>(
  data: T,
  fields: string[]
): Partial<T> {
  const result: Partial<T> = {};
  for (const field of fields) {
    if (field in data) {
      result[field as keyof T] = data[field as keyof T];
    }
  }
  return result;
}

/**
 * Filter an array of objects to only include specified fields.
 *
 * @param items - Array of objects to filter
 * @param fields - Fields to include
 * @returns Array of filtered objects
 */
export function filterArrayFields<T extends Record<string, unknown>>(
  items: T[],
  fields: string[]
): Partial<T>[] {
  return items.map((item) => filterFields(item, fields));
}

/**
 * Get all supported resource types.
 *
 * @returns Array of resource type names
 */
export function getSupportedResources(): string[] {
  return Object.keys(DEFAULT_FIELDS);
}
