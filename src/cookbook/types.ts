/**
 * WP Navigator Cookbook Types
 *
 * TypeScript schema for plugin capability cookbooks.
 * Cookbooks capture plugin metadata (settings pages, shortcodes,
 * blocks, common tasks) to help AI understand plugin capabilities.
 *
 * @package WP_Navigator_MCP
 * @since 2.1.0
 */

/**
 * Current cookbook schema version.
 * Increment when making breaking changes to the schema.
 */
export const COOKBOOK_SCHEMA_VERSION = 1;

/**
 * Plugin identification and version bounds
 */
export interface CookbookPlugin {
  /** Plugin slug (e.g., "woocommerce", "elementor") */
  slug: string;
  /** Human-readable plugin name */
  name: string;
  /** Minimum supported plugin version (semver, e.g., "8.0") */
  min_version?: string;
  /** Maximum supported plugin version (null = no upper bound) */
  max_version?: string;
}

/**
 * Settings field definition
 */
export interface SettingsField {
  /** Field identifier */
  id: string;
  /** Human-readable label */
  label: string;
  /** Field input type */
  type: 'text' | 'select' | 'checkbox' | 'textarea' | 'number' | 'color' | 'radio' | 'other';
  /** Field description/help text */
  description?: string;
  /** Default value */
  default?: string;
  /** Available options for select/radio fields */
  options?: Array<{ value: string; label: string }>;
}

/**
 * Settings section within a page
 */
export interface SettingsSection {
  /** Section identifier */
  id: string;
  /** Section title */
  title: string;
  /** Section description */
  description?: string;
  /** Fields within this section */
  fields?: SettingsField[];
}

/**
 * Plugin settings page
 */
export interface SettingsPage {
  /** Admin URL path (e.g., "/wp-admin/admin.php?page=wc-settings") */
  path: string;
  /** Page title */
  title: string;
  /** Page description */
  description?: string;
  /** Sections on this page */
  sections?: SettingsSection[];
}

/**
 * Shortcode parameter definition
 */
export interface ShortcodeParam {
  /** Parameter name */
  name: string;
  /** Parameter type */
  type: 'string' | 'number' | 'boolean' | 'array';
  /** Whether the parameter is required */
  required?: boolean;
  /** Default value */
  default?: string;
  /** Parameter description */
  description?: string;
  /** Example value */
  example?: string;
}

/**
 * Shortcode definition
 */
export interface Shortcode {
  /** Shortcode tag (e.g., "products", "gallery") */
  tag: string;
  /** What the shortcode does */
  description: string;
  /** Available parameters */
  params?: ShortcodeParam[];
  /** Usage example */
  example?: string;
  /** Output description */
  output?: string;
}

/**
 * Gutenberg block definition
 */
export interface Block {
  /** Block name (e.g., "woocommerce/product-grid") */
  name: string;
  /** Human-readable title */
  title: string;
  /** Block description */
  description?: string;
  /** Block category (e.g., "widgets", "layout") */
  category?: string;
  /** Supported features */
  supports?: string[];
  /** Block keywords for search */
  keywords?: string[];
}

/**
 * REST API endpoint definition
 */
export interface RestEndpoint {
  /** Endpoint route (e.g., "/wc/v3/products") */
  route: string;
  /** Endpoint description */
  description: string;
  /** HTTP methods supported */
  methods: Array<'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'>;
  /** Required capability/permission */
  permission?: string;
  /** Request parameters */
  params?: Array<{
    name: string;
    type: string;
    required?: boolean;
    description?: string;
  }>;
}

/**
 * Common task with step-by-step guide
 */
export interface CommonTask {
  /** Task identifier */
  id: string;
  /** Task title (e.g., "Add products to page") */
  title: string;
  /** Task description */
  description?: string;
  /** Step-by-step instructions */
  steps: string[];
  /** WP Navigator tools useful for this task */
  related_tools?: string[];
  /** Estimated difficulty */
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  /** Relevant documentation URL */
  docs_url?: string;
}

/**
 * Plugin capabilities section
 */
export interface CookbookCapabilities {
  /** Plugin settings pages */
  settings_pages?: SettingsPage[];
  /** Available shortcodes */
  shortcodes?: Shortcode[];
  /** Gutenberg blocks provided */
  blocks?: Block[];
  /** REST API endpoints */
  rest_endpoints?: RestEndpoint[];
  /** Custom post types registered */
  post_types?: Array<{
    slug: string;
    label: string;
    description?: string;
  }>;
  /** Custom taxonomies registered */
  taxonomies?: Array<{
    slug: string;
    label: string;
    object_types?: string[];
  }>;
}

/**
 * Complete cookbook definition
 */
export interface Cookbook {
  /** Schema version (must match COOKBOOK_SCHEMA_VERSION) */
  schema_version: number;
  /** Cookbook content version (semver, e.g., "1.0.0") */
  cookbook_version: string;
  /** Plugin this cookbook describes */
  plugin: CookbookPlugin;
  /** Plugin capabilities */
  capabilities: CookbookCapabilities;
  /** Common tasks and how-to guides */
  common_tasks?: CommonTask[];
  /** Official documentation URL */
  documentation_url?: string;
  /** When this cookbook was last updated (ISO 8601) */
  last_updated?: string;
  /** Cookbook author/maintainer */
  author?: string;
}

/**
 * Result of loading a cookbook
 */
export interface LoadedCookbook extends Cookbook {
  /** Where this cookbook was loaded from */
  source: 'bundled' | 'project';
  /** Full path to the cookbook file */
  sourcePath: string;
}

/**
 * Cookbook load result with potential errors
 */
export interface CookbookLoadResult {
  /** Whether loading succeeded */
  success: boolean;
  /** Loaded cookbook (if successful) */
  cookbook?: LoadedCookbook;
  /** Error message (if failed) */
  error?: string;
  /** File path that was attempted */
  path: string;
}

// =============================================================================
// Cookbook Registry Types (Fast Enumeration)
// =============================================================================

/**
 * Cookbook registry entry (minimal metadata for fast enumeration).
 * Contains pre-computed metadata to avoid parsing each SKILL.md file.
 */
export interface CookbookRegistryEntry {
  /** Plugin slug (e.g., "gutenberg") */
  slug: string;
  /** Filename relative to bundled directory (e.g., "gutenberg.md") */
  file: string;
  /** Human-readable display name */
  name: string;
  /** Short description of the cookbook */
  description: string;
  /** Cookbook content version (semver) */
  version: string;
  /** Minimum supported plugin version */
  min_plugin_version?: string;
  /** Maximum supported plugin version */
  max_plugin_version?: string;
  /** Pre-parsed list of allowed tools */
  allowed_tools?: string[];
}

/**
 * Bundled cookbook registry for fast enumeration.
 * Avoids filesystem scans and full file parsing.
 */
export interface CookbookRegistry {
  /** Registry format version */
  registry_version: 1;
  /** ISO timestamp when registry was generated */
  generated: string;
  /** List of bundled cookbook entries */
  cookbooks: CookbookRegistryEntry[];
}
