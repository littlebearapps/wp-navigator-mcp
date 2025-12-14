/**
 * WP Navigator Cookbook Validation
 *
 * Validation logic for cookbook schema.
 * Validates required fields and schema version compatibility.
 *
 * @package WP_Navigator_MCP
 * @since 2.1.0
 */

import {
  COOKBOOK_SCHEMA_VERSION,
  type Cookbook,
  type CookbookPlugin,
  type CookbookCapabilities,
  type SettingsPage,
  type SettingsSection,
  type SettingsField,
  type Shortcode,
  type ShortcodeParam,
  type Block,
  type RestEndpoint,
  type CommonTask,
} from './types.js';

// =============================================================================
// Error Classes
// =============================================================================

/**
 * Error thrown when cookbook validation fails
 */
export class CookbookValidationError extends Error {
  public readonly filePath: string;
  public readonly field?: string;

  constructor(message: string, filePath: string, field?: string) {
    super(message);
    this.name = 'CookbookValidationError';
    this.filePath = filePath;
    this.field = field;
  }
}

/**
 * Error thrown when cookbook schema version is incompatible
 */
export class CookbookSchemaVersionError extends Error {
  public readonly filePath: string;
  public readonly suggestion: string;

  constructor(message: string, filePath: string, suggestion: string) {
    super(message);
    this.name = 'CookbookSchemaVersionError';
    this.filePath = filePath;
    this.suggestion = suggestion;
  }
}

// =============================================================================
// Validation Helpers
// =============================================================================

/**
 * Validate plugin slug format (lowercase, alphanumeric with hyphens)
 */
function isValidPluginSlug(slug: string): boolean {
  return /^[a-z][a-z0-9-]*[a-z0-9]$/.test(slug) || /^[a-z]$/.test(slug);
}

/**
 * Validate semver version string (loose validation)
 */
function isValidVersion(version: string): boolean {
  // Accept common version formats: "1.0", "1.0.0", "8.0", etc.
  return /^\d+(\.\d+)*$/.test(version);
}

/**
 * Validate HTTP methods array
 */
function isValidHttpMethods(methods: unknown): methods is Array<'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'> {
  if (!Array.isArray(methods)) return false;
  const validMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
  return methods.every((m) => validMethods.includes(m));
}

// =============================================================================
// Field Validators
// =============================================================================

/**
 * Validate a settings field
 */
function validateSettingsField(field: unknown, filePath: string, prefix: string): SettingsField {
  if (!field || typeof field !== 'object') {
    throw new CookbookValidationError(`${prefix} must be an object`, filePath, prefix);
  }

  const f = field as Record<string, unknown>;

  if (!f.id || typeof f.id !== 'string') {
    throw new CookbookValidationError(`${prefix}.id is required (string)`, filePath, `${prefix}.id`);
  }

  if (!f.label || typeof f.label !== 'string') {
    throw new CookbookValidationError(`${prefix}.label is required (string)`, filePath, `${prefix}.label`);
  }

  const validTypes = ['text', 'select', 'checkbox', 'textarea', 'number', 'color', 'radio', 'other'];
  if (!f.type || typeof f.type !== 'string' || !validTypes.includes(f.type)) {
    throw new CookbookValidationError(
      `${prefix}.type must be one of: ${validTypes.join(', ')}`,
      filePath,
      `${prefix}.type`
    );
  }

  if (f.description !== undefined && typeof f.description !== 'string') {
    throw new CookbookValidationError(`${prefix}.description must be a string`, filePath, `${prefix}.description`);
  }

  if (f.default !== undefined && typeof f.default !== 'string') {
    throw new CookbookValidationError(`${prefix}.default must be a string`, filePath, `${prefix}.default`);
  }

  return f as unknown as SettingsField;
}

/**
 * Validate a settings section
 */
function validateSettingsSection(section: unknown, filePath: string, prefix: string): SettingsSection {
  if (!section || typeof section !== 'object') {
    throw new CookbookValidationError(`${prefix} must be an object`, filePath, prefix);
  }

  const s = section as Record<string, unknown>;

  if (!s.id || typeof s.id !== 'string') {
    throw new CookbookValidationError(`${prefix}.id is required (string)`, filePath, `${prefix}.id`);
  }

  if (!s.title || typeof s.title !== 'string') {
    throw new CookbookValidationError(`${prefix}.title is required (string)`, filePath, `${prefix}.title`);
  }

  if (s.description !== undefined && typeof s.description !== 'string') {
    throw new CookbookValidationError(`${prefix}.description must be a string`, filePath, `${prefix}.description`);
  }

  if (s.fields !== undefined) {
    if (!Array.isArray(s.fields)) {
      throw new CookbookValidationError(`${prefix}.fields must be an array`, filePath, `${prefix}.fields`);
    }
    for (let i = 0; i < s.fields.length; i++) {
      validateSettingsField(s.fields[i], filePath, `${prefix}.fields[${i}]`);
    }
  }

  return s as unknown as SettingsSection;
}

/**
 * Validate a settings page
 */
function validateSettingsPage(page: unknown, filePath: string, prefix: string): SettingsPage {
  if (!page || typeof page !== 'object') {
    throw new CookbookValidationError(`${prefix} must be an object`, filePath, prefix);
  }

  const p = page as Record<string, unknown>;

  if (!p.path || typeof p.path !== 'string') {
    throw new CookbookValidationError(`${prefix}.path is required (string)`, filePath, `${prefix}.path`);
  }

  if (!p.title || typeof p.title !== 'string') {
    throw new CookbookValidationError(`${prefix}.title is required (string)`, filePath, `${prefix}.title`);
  }

  if (p.description !== undefined && typeof p.description !== 'string') {
    throw new CookbookValidationError(`${prefix}.description must be a string`, filePath, `${prefix}.description`);
  }

  if (p.sections !== undefined) {
    if (!Array.isArray(p.sections)) {
      throw new CookbookValidationError(`${prefix}.sections must be an array`, filePath, `${prefix}.sections`);
    }
    for (let i = 0; i < p.sections.length; i++) {
      validateSettingsSection(p.sections[i], filePath, `${prefix}.sections[${i}]`);
    }
  }

  return p as unknown as SettingsPage;
}

/**
 * Validate a shortcode parameter
 */
function validateShortcodeParam(param: unknown, filePath: string, prefix: string): ShortcodeParam {
  if (!param || typeof param !== 'object') {
    throw new CookbookValidationError(`${prefix} must be an object`, filePath, prefix);
  }

  const p = param as Record<string, unknown>;

  if (!p.name || typeof p.name !== 'string') {
    throw new CookbookValidationError(`${prefix}.name is required (string)`, filePath, `${prefix}.name`);
  }

  const validTypes = ['string', 'number', 'boolean', 'array'];
  if (!p.type || typeof p.type !== 'string' || !validTypes.includes(p.type)) {
    throw new CookbookValidationError(
      `${prefix}.type must be one of: ${validTypes.join(', ')}`,
      filePath,
      `${prefix}.type`
    );
  }

  if (p.required !== undefined && typeof p.required !== 'boolean') {
    throw new CookbookValidationError(`${prefix}.required must be a boolean`, filePath, `${prefix}.required`);
  }

  if (p.default !== undefined && typeof p.default !== 'string') {
    throw new CookbookValidationError(`${prefix}.default must be a string`, filePath, `${prefix}.default`);
  }

  if (p.description !== undefined && typeof p.description !== 'string') {
    throw new CookbookValidationError(`${prefix}.description must be a string`, filePath, `${prefix}.description`);
  }

  return p as unknown as ShortcodeParam;
}

/**
 * Validate a shortcode
 */
function validateShortcode(shortcode: unknown, filePath: string, prefix: string): Shortcode {
  if (!shortcode || typeof shortcode !== 'object') {
    throw new CookbookValidationError(`${prefix} must be an object`, filePath, prefix);
  }

  const s = shortcode as Record<string, unknown>;

  if (!s.tag || typeof s.tag !== 'string') {
    throw new CookbookValidationError(`${prefix}.tag is required (string)`, filePath, `${prefix}.tag`);
  }

  if (!s.description || typeof s.description !== 'string') {
    throw new CookbookValidationError(`${prefix}.description is required (string)`, filePath, `${prefix}.description`);
  }

  if (s.params !== undefined) {
    if (!Array.isArray(s.params)) {
      throw new CookbookValidationError(`${prefix}.params must be an array`, filePath, `${prefix}.params`);
    }
    for (let i = 0; i < s.params.length; i++) {
      validateShortcodeParam(s.params[i], filePath, `${prefix}.params[${i}]`);
    }
  }

  if (s.example !== undefined && typeof s.example !== 'string') {
    throw new CookbookValidationError(`${prefix}.example must be a string`, filePath, `${prefix}.example`);
  }

  return s as unknown as Shortcode;
}

/**
 * Validate a block
 */
function validateBlock(block: unknown, filePath: string, prefix: string): Block {
  if (!block || typeof block !== 'object') {
    throw new CookbookValidationError(`${prefix} must be an object`, filePath, prefix);
  }

  const b = block as Record<string, unknown>;

  if (!b.name || typeof b.name !== 'string') {
    throw new CookbookValidationError(`${prefix}.name is required (string)`, filePath, `${prefix}.name`);
  }

  if (!b.title || typeof b.title !== 'string') {
    throw new CookbookValidationError(`${prefix}.title is required (string)`, filePath, `${prefix}.title`);
  }

  if (b.description !== undefined && typeof b.description !== 'string') {
    throw new CookbookValidationError(`${prefix}.description must be a string`, filePath, `${prefix}.description`);
  }

  if (b.category !== undefined && typeof b.category !== 'string') {
    throw new CookbookValidationError(`${prefix}.category must be a string`, filePath, `${prefix}.category`);
  }

  if (b.supports !== undefined) {
    if (!Array.isArray(b.supports) || !b.supports.every((s) => typeof s === 'string')) {
      throw new CookbookValidationError(`${prefix}.supports must be an array of strings`, filePath, `${prefix}.supports`);
    }
  }

  if (b.keywords !== undefined) {
    if (!Array.isArray(b.keywords) || !b.keywords.every((k) => typeof k === 'string')) {
      throw new CookbookValidationError(`${prefix}.keywords must be an array of strings`, filePath, `${prefix}.keywords`);
    }
  }

  return b as unknown as Block;
}

/**
 * Validate a REST endpoint
 */
function validateRestEndpoint(endpoint: unknown, filePath: string, prefix: string): RestEndpoint {
  if (!endpoint || typeof endpoint !== 'object') {
    throw new CookbookValidationError(`${prefix} must be an object`, filePath, prefix);
  }

  const e = endpoint as Record<string, unknown>;

  if (!e.route || typeof e.route !== 'string') {
    throw new CookbookValidationError(`${prefix}.route is required (string)`, filePath, `${prefix}.route`);
  }

  if (!e.description || typeof e.description !== 'string') {
    throw new CookbookValidationError(`${prefix}.description is required (string)`, filePath, `${prefix}.description`);
  }

  if (!e.methods || !isValidHttpMethods(e.methods)) {
    throw new CookbookValidationError(
      `${prefix}.methods must be an array of HTTP methods (GET, POST, PUT, PATCH, DELETE)`,
      filePath,
      `${prefix}.methods`
    );
  }

  if (e.permission !== undefined && typeof e.permission !== 'string') {
    throw new CookbookValidationError(`${prefix}.permission must be a string`, filePath, `${prefix}.permission`);
  }

  return e as unknown as RestEndpoint;
}

/**
 * Validate a common task
 */
function validateCommonTask(task: unknown, filePath: string, prefix: string): CommonTask {
  if (!task || typeof task !== 'object') {
    throw new CookbookValidationError(`${prefix} must be an object`, filePath, prefix);
  }

  const t = task as Record<string, unknown>;

  if (!t.id || typeof t.id !== 'string') {
    throw new CookbookValidationError(`${prefix}.id is required (string)`, filePath, `${prefix}.id`);
  }

  if (!t.title || typeof t.title !== 'string') {
    throw new CookbookValidationError(`${prefix}.title is required (string)`, filePath, `${prefix}.title`);
  }

  if (t.description !== undefined && typeof t.description !== 'string') {
    throw new CookbookValidationError(`${prefix}.description must be a string`, filePath, `${prefix}.description`);
  }

  if (!t.steps || !Array.isArray(t.steps)) {
    throw new CookbookValidationError(`${prefix}.steps is required (array of strings)`, filePath, `${prefix}.steps`);
  }
  for (let i = 0; i < t.steps.length; i++) {
    if (typeof t.steps[i] !== 'string') {
      throw new CookbookValidationError(`${prefix}.steps[${i}] must be a string`, filePath, `${prefix}.steps[${i}]`);
    }
  }

  if (t.related_tools !== undefined) {
    if (!Array.isArray(t.related_tools) || !t.related_tools.every((r) => typeof r === 'string')) {
      throw new CookbookValidationError(
        `${prefix}.related_tools must be an array of strings`,
        filePath,
        `${prefix}.related_tools`
      );
    }
  }

  const validDifficulties = ['beginner', 'intermediate', 'advanced'];
  if (t.difficulty !== undefined && (typeof t.difficulty !== 'string' || !validDifficulties.includes(t.difficulty))) {
    throw new CookbookValidationError(
      `${prefix}.difficulty must be one of: ${validDifficulties.join(', ')}`,
      filePath,
      `${prefix}.difficulty`
    );
  }

  return t as unknown as CommonTask;
}

/**
 * Validate capabilities section
 */
function validateCapabilities(caps: unknown, filePath: string): CookbookCapabilities {
  if (!caps || typeof caps !== 'object') {
    throw new CookbookValidationError('capabilities must be an object', filePath, 'capabilities');
  }

  const c = caps as Record<string, unknown>;

  // Validate settings_pages
  if (c.settings_pages !== undefined) {
    if (!Array.isArray(c.settings_pages)) {
      throw new CookbookValidationError(
        'capabilities.settings_pages must be an array',
        filePath,
        'capabilities.settings_pages'
      );
    }
    for (let i = 0; i < c.settings_pages.length; i++) {
      validateSettingsPage(c.settings_pages[i], filePath, `capabilities.settings_pages[${i}]`);
    }
  }

  // Validate shortcodes
  if (c.shortcodes !== undefined) {
    if (!Array.isArray(c.shortcodes)) {
      throw new CookbookValidationError('capabilities.shortcodes must be an array', filePath, 'capabilities.shortcodes');
    }
    for (let i = 0; i < c.shortcodes.length; i++) {
      validateShortcode(c.shortcodes[i], filePath, `capabilities.shortcodes[${i}]`);
    }
  }

  // Validate blocks
  if (c.blocks !== undefined) {
    if (!Array.isArray(c.blocks)) {
      throw new CookbookValidationError('capabilities.blocks must be an array', filePath, 'capabilities.blocks');
    }
    for (let i = 0; i < c.blocks.length; i++) {
      validateBlock(c.blocks[i], filePath, `capabilities.blocks[${i}]`);
    }
  }

  // Validate rest_endpoints
  if (c.rest_endpoints !== undefined) {
    if (!Array.isArray(c.rest_endpoints)) {
      throw new CookbookValidationError(
        'capabilities.rest_endpoints must be an array',
        filePath,
        'capabilities.rest_endpoints'
      );
    }
    for (let i = 0; i < c.rest_endpoints.length; i++) {
      validateRestEndpoint(c.rest_endpoints[i], filePath, `capabilities.rest_endpoints[${i}]`);
    }
  }

  // Validate post_types
  if (c.post_types !== undefined) {
    if (!Array.isArray(c.post_types)) {
      throw new CookbookValidationError('capabilities.post_types must be an array', filePath, 'capabilities.post_types');
    }
    for (let i = 0; i < c.post_types.length; i++) {
      const pt = c.post_types[i] as Record<string, unknown>;
      if (!pt.slug || typeof pt.slug !== 'string') {
        throw new CookbookValidationError(
          `capabilities.post_types[${i}].slug is required (string)`,
          filePath,
          `capabilities.post_types[${i}].slug`
        );
      }
      if (!pt.label || typeof pt.label !== 'string') {
        throw new CookbookValidationError(
          `capabilities.post_types[${i}].label is required (string)`,
          filePath,
          `capabilities.post_types[${i}].label`
        );
      }
    }
  }

  // Validate taxonomies
  if (c.taxonomies !== undefined) {
    if (!Array.isArray(c.taxonomies)) {
      throw new CookbookValidationError('capabilities.taxonomies must be an array', filePath, 'capabilities.taxonomies');
    }
    for (let i = 0; i < c.taxonomies.length; i++) {
      const tax = c.taxonomies[i] as Record<string, unknown>;
      if (!tax.slug || typeof tax.slug !== 'string') {
        throw new CookbookValidationError(
          `capabilities.taxonomies[${i}].slug is required (string)`,
          filePath,
          `capabilities.taxonomies[${i}].slug`
        );
      }
      if (!tax.label || typeof tax.label !== 'string') {
        throw new CookbookValidationError(
          `capabilities.taxonomies[${i}].label is required (string)`,
          filePath,
          `capabilities.taxonomies[${i}].label`
        );
      }
    }
  }

  return c as unknown as CookbookCapabilities;
}

/**
 * Validate plugin section
 */
function validatePlugin(plugin: unknown, filePath: string): CookbookPlugin {
  if (!plugin || typeof plugin !== 'object') {
    throw new CookbookValidationError('plugin is required (object)', filePath, 'plugin');
  }

  const p = plugin as Record<string, unknown>;

  if (!p.slug || typeof p.slug !== 'string') {
    throw new CookbookValidationError('plugin.slug is required (string)', filePath, 'plugin.slug');
  }

  if (!isValidPluginSlug(p.slug)) {
    throw new CookbookValidationError(
      `Invalid plugin slug "${p.slug}": must be lowercase with hyphens (e.g., "woocommerce")`,
      filePath,
      'plugin.slug'
    );
  }

  if (!p.name || typeof p.name !== 'string') {
    throw new CookbookValidationError('plugin.name is required (string)', filePath, 'plugin.name');
  }

  if (p.min_version !== undefined) {
    if (typeof p.min_version !== 'string' || !isValidVersion(p.min_version)) {
      throw new CookbookValidationError(
        'plugin.min_version must be a valid version string (e.g., "8.0")',
        filePath,
        'plugin.min_version'
      );
    }
  }

  if (p.max_version !== undefined) {
    if (typeof p.max_version !== 'string' || !isValidVersion(p.max_version)) {
      throw new CookbookValidationError(
        'plugin.max_version must be a valid version string (e.g., "9.0")',
        filePath,
        'plugin.max_version'
      );
    }
  }

  return p as unknown as CookbookPlugin;
}

// =============================================================================
// Main Validation Function
// =============================================================================

/**
 * Validate a parsed cookbook object
 *
 * @param data - Parsed YAML/JSON data
 * @param filePath - Path to the cookbook file (for error messages)
 * @returns Validated Cookbook object
 * @throws CookbookValidationError if validation fails
 * @throws CookbookSchemaVersionError if schema version is incompatible
 */
export function validateCookbook(data: unknown, filePath: string): Cookbook {
  if (!data || typeof data !== 'object') {
    throw new CookbookValidationError('Cookbook must be a YAML/JSON object', filePath);
  }

  const obj = data as Record<string, unknown>;

  // Validate schema_version (required)
  if (obj.schema_version === undefined) {
    throw new CookbookValidationError(
      'Missing schema_version field',
      filePath,
      'schema_version'
    );
  }

  if (typeof obj.schema_version !== 'number' || !Number.isInteger(obj.schema_version)) {
    throw new CookbookSchemaVersionError(
      `Invalid schema_version: expected integer, got ${typeof obj.schema_version}`,
      filePath,
      `Set "schema_version: ${COOKBOOK_SCHEMA_VERSION}" (must be an integer).`
    );
  }

  if (obj.schema_version > COOKBOOK_SCHEMA_VERSION) {
    throw new CookbookSchemaVersionError(
      `Unsupported cookbook schema_version: ${obj.schema_version}`,
      filePath,
      `This version of wpnav only understands cookbook schema_version ${COOKBOOK_SCHEMA_VERSION}.\n\nUpgrade wpnav to use this cookbook.`
    );
  }

  // Validate cookbook_version (required)
  if (!obj.cookbook_version || typeof obj.cookbook_version !== 'string') {
    throw new CookbookValidationError(
      'Missing or invalid cookbook_version field (required string, e.g., "1.0.0")',
      filePath,
      'cookbook_version'
    );
  }

  if (!isValidVersion(obj.cookbook_version)) {
    throw new CookbookValidationError(
      `Invalid cookbook_version "${obj.cookbook_version}": must be semver format (e.g., "1.0.0")`,
      filePath,
      'cookbook_version'
    );
  }

  // Validate plugin (required)
  const plugin = validatePlugin(obj.plugin, filePath);

  // Validate capabilities (required)
  if (obj.capabilities === undefined) {
    throw new CookbookValidationError('Missing capabilities field (required object)', filePath, 'capabilities');
  }
  const capabilities = validateCapabilities(obj.capabilities, filePath);

  // Validate common_tasks (optional)
  if (obj.common_tasks !== undefined) {
    if (!Array.isArray(obj.common_tasks)) {
      throw new CookbookValidationError('common_tasks must be an array', filePath, 'common_tasks');
    }
    for (let i = 0; i < obj.common_tasks.length; i++) {
      validateCommonTask(obj.common_tasks[i], filePath, `common_tasks[${i}]`);
    }
  }

  // Validate optional string fields
  if (obj.documentation_url !== undefined && typeof obj.documentation_url !== 'string') {
    throw new CookbookValidationError('documentation_url must be a string', filePath, 'documentation_url');
  }

  if (obj.last_updated !== undefined && typeof obj.last_updated !== 'string') {
    throw new CookbookValidationError('last_updated must be a string (ISO 8601 date)', filePath, 'last_updated');
  }

  if (obj.author !== undefined && typeof obj.author !== 'string') {
    throw new CookbookValidationError('author must be a string', filePath, 'author');
  }

  return obj as unknown as Cookbook;
}
