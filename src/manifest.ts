/**
 * WP Navigator Manifest Schema and Loader
 *
 * Phase B1: wpnavigator.jsonc manifest for site configuration.
 * Supports JSONC (JSON with comments) for documentation.
 *
 * @package WP_Navigator_MCP
 * @since 1.1.0
 */

import * as fs from 'fs';
import * as path from 'path';

// =============================================================================
// Schema Version
// =============================================================================

/**
 * Current schema version (integer)
 * - schema_version: 1 = initial release (v2.0-v2.6)
 * - schema_version: 2 = v2.7.0 with tools/roles/ai sections
 * Used for compatibility checking and fail-fast validation
 */
export const CURRENT_SCHEMA_VERSION = 2;

/**
 * Current manifest schema version (semver string - legacy)
 * @deprecated Use CURRENT_SCHEMA_VERSION instead
 */
export const MANIFEST_SCHEMA_VERSION = '1.0';

/**
 * Minimum supported manifest version for backwards compatibility (legacy)
 * @deprecated Use CURRENT_SCHEMA_VERSION instead
 */
export const MIN_MANIFEST_VERSION = '1.0';

// =============================================================================
// Schema Types
// =============================================================================

/**
 * Site metadata
 */
export interface ManifestMeta {
  /** Site name for display and identification */
  name: string;
  /** Site description */
  description?: string;
  /** Site URL (informational, config has authoritative URL) */
  url?: string;
  /** Additional metadata tags */
  tags?: string[];
}

/**
 * Color palette configuration
 */
export interface BrandPalette {
  /** Primary brand color (hex) */
  primary?: string;
  /** Secondary brand color (hex) */
  secondary?: string;
  /** Accent color for CTAs and highlights (hex) */
  accent?: string;
  /** Neutral color for text and backgrounds (hex) */
  neutral?: string;
  /** Additional named colors */
  [key: string]: string | undefined;
}

/**
 * Typography configuration
 */
export interface BrandFonts {
  /** Heading font family */
  heading?: string;
  /** Body text font family */
  body?: string;
  /** Monospace font family */
  mono?: string;
  /** Font fallback stack */
  fallback?: string;
}

/**
 * Layout configuration
 */
export interface BrandLayout {
  /** Container max width (e.g., "1200px", "80rem") */
  containerWidth?: string;
  /** Spacing density: compact, comfortable, spacious */
  spacing?: 'compact' | 'comfortable' | 'spacious';
  /** Border radius style: none, subtle, rounded, pill */
  borderRadius?: 'none' | 'subtle' | 'rounded' | 'pill';
}

/**
 * Voice and tone guidance for AI content generation
 */
export interface BrandVoice {
  /** Overall tone: professional, casual, friendly, technical, etc. */
  tone?: string;
  /** Target audience description */
  audience?: string;
  /** Key brand values or personality traits */
  values?: string[];
  /** Words/phrases to avoid */
  avoid?: string[];
}

/**
 * Brand configuration section
 * All fields optional with sensible defaults
 */
export interface ManifestBrand {
  /** Color palette */
  palette?: BrandPalette;
  /** Typography settings */
  fonts?: BrandFonts;
  /** Layout preferences */
  layout?: BrandLayout;
  /** Voice and tone guidance */
  voice?: BrandVoice;
}

/**
 * Page definition in manifest
 */
export interface ManifestPage {
  /** URL slug (e.g., "about", "contact") */
  slug: string;
  /** Page title */
  title: string;
  /** Path to template/snapshot file (Phase B2) */
  template?: string;
  /** Target publish status */
  status?: 'publish' | 'draft' | 'private' | 'pending';
  /** Parent page slug for hierarchical pages */
  parent?: string;
  /** Menu order for sorting */
  menu_order?: number;
  /** SEO meta description */
  meta_description?: string;
  /** Additional page metadata (extensible for B2) */
  [key: string]: unknown;
}

/**
 * Plugin configuration in manifest
 */
export interface ManifestPlugin {
  /** Whether plugin should be active */
  enabled: boolean;
  /** Plugin-specific settings to apply */
  settings?: Record<string, unknown>;
  /** Default values for plugin options */
  defaults?: Record<string, unknown>;
  /** Required plugin version (semver range) */
  version?: string;
}

/**
 * Plugins section - keyed by plugin slug
 */
export interface ManifestPlugins {
  [pluginSlug: string]: ManifestPlugin;
}

/**
 * Backup reminder frequency options
 */
export type BackupReminderFrequency = 'first_sync_only' | 'always' | 'daily' | 'never';

/**
 * Backup reminder configuration
 */
export interface BackupReminders {
  /** Enable backup reminders (default: true) */
  enabled?: boolean;
  /** Show reminder before sync operations (default: true) */
  before_sync?: boolean;
  /** How often to show reminders (default: 'first_sync_only') */
  frequency?: BackupReminderFrequency;
}

/**
 * Safety block for manifest operations
 * Controls what sync/apply operations are allowed
 */
export interface ManifestSafety {
  /** Allow creating new pages from manifest */
  allow_create_pages?: boolean;
  /** Allow updating existing pages */
  allow_update_pages?: boolean;
  /** Allow deleting pages not in manifest */
  allow_delete_pages?: boolean;
  /** Allow plugin activation/deactivation */
  allow_plugin_changes?: boolean;
  /** Allow theme changes */
  allow_theme_changes?: boolean;
  /** Require confirmation for destructive operations (default: true) */
  require_confirmation?: boolean;
  /** Require confirmation specifically for sync operations (default: true) */
  require_sync_confirmation?: boolean;
  /** Whether user has acknowledged first sync warning (default: false) */
  first_sync_acknowledged?: boolean;
  /** Backup reminder configuration */
  backup_reminders?: BackupReminders;
}

/**
 * Root wpnavigator.jsonc manifest schema
 */
export interface WPNavManifest {
  /** Schema version as integer (required, currently 1) */
  schema_version: number;
  /**
   * Schema version for compatibility checking (required)
   * @deprecated Use schema_version instead. Will be removed in v2.0.
   */
  manifest_version: string;
  /** Site metadata */
  meta: ManifestMeta;
  /** Brand configuration */
  brand?: ManifestBrand;
  /** Page definitions */
  pages?: ManifestPage[];
  /** Plugin configurations */
  plugins?: ManifestPlugins;
  /** Safety constraints for sync operations */
  safety?: ManifestSafety;
}

// =============================================================================
// Schema Version 2 Types (v2.7.0+)
// =============================================================================

/**
 * Valid tool category strings (matches ToolCategory enum values)
 */
export type ToolCategoryString =
  | 'core'
  | 'content'
  | 'taxonomy'
  | 'users'
  | 'plugins'
  | 'themes'
  | 'workflows'
  | 'cookbook'
  | 'roles'
  | 'batch';

/**
 * Cookbook binding configuration
 */
export interface ManifestCookbookBinding {
  /** Cookbooks to explicitly load */
  load?: string[];
  /** Auto-detect cookbooks based on active plugins (default: true) */
  auto_detect?: boolean;
  /** Path to project-local cookbooks directory */
  project_path?: string;
}

/**
 * Tools section for Schema v2
 * Controls which tools are available to the AI
 */
export interface ManifestTools {
  /** Tool categories to enable (default: all) */
  enabled?: ToolCategoryString[];
  /** Tool categories to disable (overrides enabled) */
  disabled?: ToolCategoryString[];
  /** Individual tool overrides: { "wpnav_delete_post": false } */
  overrides?: Record<string, boolean>;
  /** Cookbook configuration */
  cookbooks?: ManifestCookbookBinding;
}

/**
 * Role override configuration
 */
export interface ManifestRoleOverrides {
  /** Additional tools to allow beyond role defaults */
  tools_allow?: string[];
  /** Tools to deny even if role allows them */
  tools_deny?: string[];
}

/**
 * Roles section for Schema v2
 * Controls AI persona and tool access
 */
export interface ManifestRoles {
  /** Active role name (e.g., 'content-editor', 'developer') */
  active?: string;
  /** Auto-detect appropriate role based on user capabilities (default: true) */
  auto_detect?: boolean;
  /** Path to project-local roles directory */
  project_path?: string;
  /** Role-specific overrides */
  overrides?: ManifestRoleOverrides;
}

/**
 * AI focus modes for token reduction
 */
export type AIFocusMode = 'content-editing' | 'full-admin' | 'read-only' | 'custom';

/**
 * AI configuration section for Schema v2
 * Controls AI behavior and context
 */
export interface ManifestAI {
  /** Focus mode for token reduction (default: 'content-editing') */
  focus?: AIFocusMode;
  /** Custom AI instructions to include in context */
  instructions?: string;
  /** Path to sample prompts directory */
  prompts_path?: string;
  /** Auto-detected active plugins (read-only, populated by introspect) */
  detected_plugins?: string[];
  /** Detected page builder (read-only, populated by introspect) */
  page_builder?: string;
  /** Recommended cookbooks based on detected plugins (read-only) */
  recommended_cookbooks?: string[];
  /** Recommended role based on user capabilities (read-only) */
  recommended_role?: string;
}

/**
 * Safety mode presets for Schema v2
 */
export type SafetyMode = 'yolo' | 'normal' | 'cautious';

/**
 * Operation types that can be controlled
 */
export type OperationType = 'create' | 'update' | 'delete' | 'activate' | 'deactivate' | 'batch';

/**
 * Enhanced safety settings for Schema v2
 * Extends ManifestSafety with new fields
 */
export interface ManifestSafetyV2 extends ManifestSafety {
  /** Safety preset mode (default: 'cautious') */
  mode?: SafetyMode;
  /** Maximum items in batch operations (default: 10) */
  max_batch_size?: number;
  /** Operations to allow (default: ['create', 'update']) */
  allowed_operations?: OperationType[];
  /** Operations to block (overrides allowed, default: ['delete']) */
  blocked_operations?: OperationType[];
}

/**
 * Environment-specific configuration override
 * Can override any top-level manifest section
 */
export interface ManifestEnvironmentOverride {
  /** Override tools configuration */
  tools?: ManifestTools;
  /** Override roles configuration */
  roles?: ManifestRoles;
  /** Override AI configuration */
  ai?: ManifestAI;
  /** Override safety configuration */
  safety?: ManifestSafetyV2;
}

/**
 * Environment overrides section for Schema v2
 * Keys are environment names (e.g., 'local', 'staging', 'production')
 */
export interface ManifestEnvironments {
  [envName: string]: ManifestEnvironmentOverride;
}

/**
 * Schema v2 manifest (v2.7.0+)
 * Extends v1 with tools, roles, ai, and env sections
 */
export interface WPNavManifestV2 extends Omit<WPNavManifest, 'safety'> {
  /** Schema version (must be 2 for v2 features) */
  schema_version: 2;
  /** Optional JSON Schema URL for IDE support */
  $schema?: string;
  /** Tool access configuration */
  tools?: ManifestTools;
  /** Role configuration */
  roles?: ManifestRoles;
  /** AI behavior configuration */
  ai?: ManifestAI;
  /** Enhanced safety settings (v2) */
  safety?: ManifestSafetyV2;
  /** Environment-specific overrides */
  env?: ManifestEnvironments;
}

/**
 * Runtime manifest type that can be either v1 or v2
 */
export type WPNavManifestRuntime = WPNavManifest | WPNavManifestV2;

// =============================================================================
// Schema v2 Type Guards
// =============================================================================

/**
 * Check if a manifest is Schema v2
 */
export function isManifestV2(manifest: WPNavManifestRuntime): manifest is WPNavManifestV2 {
  return manifest.schema_version >= 2;
}

/**
 * Check if a value is a valid tool category string
 */
export function isToolCategoryString(value: unknown): value is ToolCategoryString {
  const validCategories: ToolCategoryString[] = [
    'core',
    'content',
    'taxonomy',
    'users',
    'plugins',
    'themes',
    'workflows',
    'cookbook',
    'roles',
    'batch',
  ];
  return typeof value === 'string' && validCategories.includes(value as ToolCategoryString);
}

/**
 * Check if a value is a valid AI focus mode
 */
export function isAIFocusMode(value: unknown): value is AIFocusMode {
  const validModes: AIFocusMode[] = ['content-editing', 'full-admin', 'read-only', 'custom'];
  return typeof value === 'string' && validModes.includes(value as AIFocusMode);
}

/**
 * Check if a value is a valid safety mode
 */
export function isSafetyMode(value: unknown): value is SafetyMode {
  const validModes: SafetyMode[] = ['yolo', 'normal', 'cautious'];
  return typeof value === 'string' && validModes.includes(value as SafetyMode);
}

/**
 * Check if a value is a valid operation type
 */
export function isOperationType(value: unknown): value is OperationType {
  const validTypes: OperationType[] = [
    'create',
    'update',
    'delete',
    'activate',
    'deactivate',
    'batch',
  ];
  return typeof value === 'string' && validTypes.includes(value as OperationType);
}

// =============================================================================
// JSONC Parser
// =============================================================================

/**
 * Strip comments from JSONC content
 *
 * Supports:
 *   - Single-line comments: // comment
 *   - Multi-line comments: /* comment * /
 *
 * Preserves strings containing comment-like sequences
 */
export function stripJsonComments(jsonc: string): string {
  let result = '';
  let i = 0;
  let inString = false;
  let stringChar = '';

  while (i < jsonc.length) {
    const char = jsonc[i];
    const nextChar = jsonc[i + 1];

    // Handle string boundaries
    if (!inString && (char === '"' || char === "'")) {
      inString = true;
      stringChar = char;
      result += char;
      i++;
      continue;
    }

    if (inString) {
      // Check for escape sequences
      if (char === '\\' && i + 1 < jsonc.length) {
        result += char + jsonc[i + 1];
        i += 2;
        continue;
      }
      // Check for string end
      if (char === stringChar) {
        inString = false;
        stringChar = '';
      }
      result += char;
      i++;
      continue;
    }

    // Handle single-line comments
    if (char === '/' && nextChar === '/') {
      // Skip until end of line
      while (i < jsonc.length && jsonc[i] !== '\n') {
        i++;
      }
      continue;
    }

    // Handle multi-line comments
    if (char === '/' && nextChar === '*') {
      i += 2; // Skip /*
      // Find closing */
      while (i < jsonc.length - 1) {
        if (jsonc[i] === '*' && jsonc[i + 1] === '/') {
          i += 2; // Skip */
          break;
        }
        i++;
      }
      continue;
    }

    result += char;
    i++;
  }

  return result;
}

/**
 * Parse JSONC content (JSON with comments)
 *
 * @param content - JSONC string content
 * @returns Parsed JSON object
 * @throws Error if JSON is invalid after stripping comments
 */
export function parseJsonc<T = unknown>(content: string): T {
  const stripped = stripJsonComments(content);
  return JSON.parse(stripped) as T;
}

// =============================================================================
// Manifest Validation
// =============================================================================

/**
 * Error thrown when manifest validation fails
 */
export class ManifestValidationError extends Error {
  constructor(
    message: string,
    public readonly path?: string,
    public readonly field?: string
  ) {
    super(message);
    this.name = 'ManifestValidationError';
  }
}

/**
 * Check if a version string is valid semver-like (major.minor or major.minor.patch)
 */
function isValidVersion(version: string): boolean {
  return /^\d+\.\d+(\.\d+)?$/.test(version);
}

/**
 * Compare two version strings
 * Returns: -1 if a < b, 0 if a == b, 1 if a > b
 */
function compareVersions(a: string, b: string): number {
  const aParts = a.split('.').map(Number);
  const bParts = b.split('.').map(Number);

  for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
    const aVal = aParts[i] ?? 0;
    const bVal = bParts[i] ?? 0;
    if (aVal < bVal) return -1;
    if (aVal > bVal) return 1;
  }
  return 0;
}

/**
 * Error class for unsupported schema version
 * Use exit code 2 for schema version errors (vs exit code 1 for other errors)
 */
export class SchemaVersionError extends ManifestValidationError {
  /** Exit code for schema version errors */
  readonly exitCode = 2;
  /** Instructions for how to fix the error */
  readonly upgradeInstructions: string;

  constructor(message: string, filePath: string, instructions: string) {
    super(message, filePath, 'schema_version');
    this.name = 'SchemaVersionError';
    this.upgradeInstructions = instructions;
  }
}

/**
 * Validate manifest structure and version compatibility
 */
export function validateManifest(manifest: unknown, filePath: string): WPNavManifest {
  if (!manifest || typeof manifest !== 'object') {
    throw new ManifestValidationError('Manifest must be a JSON object', filePath);
  }

  const obj = manifest as Record<string, unknown>;

  // Validate schema_version (required, integer)
  if (obj.schema_version === undefined) {
    throw new SchemaVersionError(
      'schema_version is missing',
      filePath,
      'Add "schema_version": 1 to your manifest file.'
    );
  }

  if (typeof obj.schema_version !== 'number' || !Number.isInteger(obj.schema_version)) {
    throw new SchemaVersionError(
      `Invalid schema_version: expected integer, got ${typeof obj.schema_version}`,
      filePath,
      'Set "schema_version": 1 (must be an integer, not a string).'
    );
  }

  if (obj.schema_version > CURRENT_SCHEMA_VERSION) {
    throw new SchemaVersionError(
      `Unsupported manifest schema_version: ${obj.schema_version}`,
      filePath,
      `This version of wpnav only understands schema_version ${CURRENT_SCHEMA_VERSION}.\n\nTo fix this:\n• Update the wpnav CLI to the latest version, or\n• Downgrade your manifest schema to ${CURRENT_SCHEMA_VERSION} (if safe and intentional).`
    );
  }

  if (obj.schema_version < 1) {
    throw new SchemaVersionError(
      `Invalid schema_version: ${obj.schema_version} (must be >= 1)`,
      filePath,
      'Set "schema_version": 1 (minimum supported version).'
    );
  }

  // Validate manifest_version (required, for backwards compatibility)
  if (!obj.manifest_version || typeof obj.manifest_version !== 'string') {
    throw new ManifestValidationError(
      'Missing or invalid manifest_version (expected string like "1.0")',
      filePath,
      'manifest_version'
    );
  }

  if (!isValidVersion(obj.manifest_version)) {
    throw new ManifestValidationError(
      `Invalid manifest_version format: "${obj.manifest_version}" (expected "major.minor" like "1.0")`,
      filePath,
      'manifest_version'
    );
  }

  // Check version compatibility (legacy manifest_version checks)
  if (compareVersions(obj.manifest_version, MIN_MANIFEST_VERSION) < 0) {
    throw new ManifestValidationError(
      `Manifest version ${obj.manifest_version} is older than minimum supported ${MIN_MANIFEST_VERSION}`,
      filePath,
      'manifest_version'
    );
  }

  if (compareVersions(obj.manifest_version, MANIFEST_SCHEMA_VERSION) > 0) {
    throw new ManifestValidationError(
      `Manifest version ${obj.manifest_version} is newer than supported ${MANIFEST_SCHEMA_VERSION}. Please update wp-navigator-mcp.`,
      filePath,
      'manifest_version'
    );
  }

  // Validate meta (required)
  if (!obj.meta || typeof obj.meta !== 'object') {
    throw new ManifestValidationError('Missing or invalid meta section', filePath, 'meta');
  }

  const meta = obj.meta as Record<string, unknown>;
  if (!meta.name || typeof meta.name !== 'string') {
    throw new ManifestValidationError(
      'Missing or invalid meta.name (required string)',
      filePath,
      'meta.name'
    );
  }

  // Validate pages array if present
  if (obj.pages !== undefined) {
    if (!Array.isArray(obj.pages)) {
      throw new ManifestValidationError('pages must be an array', filePath, 'pages');
    }

    for (let i = 0; i < obj.pages.length; i++) {
      const page = obj.pages[i] as Record<string, unknown>;
      if (!page.slug || typeof page.slug !== 'string') {
        throw new ManifestValidationError(
          `pages[${i}] missing required slug field`,
          filePath,
          `pages[${i}].slug`
        );
      }
      if (!page.title || typeof page.title !== 'string') {
        throw new ManifestValidationError(
          `pages[${i}] missing required title field`,
          filePath,
          `pages[${i}].title`
        );
      }
    }
  }

  // Validate plugins object if present
  if (obj.plugins !== undefined) {
    if (typeof obj.plugins !== 'object' || Array.isArray(obj.plugins)) {
      throw new ManifestValidationError(
        'plugins must be an object keyed by plugin slug',
        filePath,
        'plugins'
      );
    }

    const plugins = obj.plugins as Record<string, unknown>;
    for (const [slug, config] of Object.entries(plugins)) {
      if (!config || typeof config !== 'object') {
        throw new ManifestValidationError(
          `plugins.${slug} must be an object`,
          filePath,
          `plugins.${slug}`
        );
      }
      const pluginConfig = config as Record<string, unknown>;
      if (typeof pluginConfig.enabled !== 'boolean') {
        throw new ManifestValidationError(
          `plugins.${slug}.enabled must be a boolean`,
          filePath,
          `plugins.${slug}.enabled`
        );
      }
    }
  }

  // Validate safety.backup_reminders.frequency if present
  if (obj.safety !== undefined && typeof obj.safety === 'object') {
    const safety = obj.safety as Record<string, unknown>;
    if (safety.backup_reminders !== undefined && typeof safety.backup_reminders === 'object') {
      const reminders = safety.backup_reminders as Record<string, unknown>;
      if (reminders.frequency !== undefined) {
        const validFrequencies = ['first_sync_only', 'always', 'daily', 'never'];
        if (!validFrequencies.includes(reminders.frequency as string)) {
          throw new ManifestValidationError(
            `Invalid backup_reminders.frequency: "${reminders.frequency}". Must be one of: ${validFrequencies.join(', ')}`,
            filePath,
            'safety.backup_reminders.frequency'
          );
        }
      }
    }
  }

  // Schema v2 validation
  if (obj.schema_version >= 2) {
    validateManifestV2Sections(obj, filePath);
  }

  return manifest as WPNavManifestRuntime;
}

// =============================================================================
// Schema v2 Section Validators
// =============================================================================

/**
 * Valid tool category strings for validation
 */
const VALID_TOOL_CATEGORIES: ToolCategoryString[] = [
  'core',
  'content',
  'taxonomy',
  'users',
  'plugins',
  'themes',
  'workflows',
  'cookbook',
  'roles',
  'batch',
];

/**
 * Validate v2-specific sections (tools, roles, ai, safety v2, env)
 */
function validateManifestV2Sections(obj: Record<string, unknown>, filePath: string): void {
  // Validate tools section
  if (obj.tools !== undefined) {
    validateToolsSection(obj.tools, filePath);
  }

  // Validate roles section
  if (obj.roles !== undefined) {
    validateRolesSection(obj.roles, filePath);
  }

  // Validate ai section
  if (obj.ai !== undefined) {
    validateAISection(obj.ai, filePath);
  }

  // Validate v2 safety fields
  if (obj.safety !== undefined) {
    validateSafetyV2Section(obj.safety, filePath);
  }

  // Validate env section
  if (obj.env !== undefined) {
    validateEnvSection(obj.env, filePath);
  }
}

/**
 * Validate tools section
 */
function validateToolsSection(tools: unknown, filePath: string): void {
  if (typeof tools !== 'object' || tools === null) {
    throw new ManifestValidationError('tools must be an object', filePath, 'tools');
  }

  const toolsObj = tools as Record<string, unknown>;

  // Validate enabled array
  if (toolsObj.enabled !== undefined) {
    if (!Array.isArray(toolsObj.enabled)) {
      throw new ManifestValidationError(
        'tools.enabled must be an array',
        filePath,
        'tools.enabled'
      );
    }
    for (const category of toolsObj.enabled) {
      if (!VALID_TOOL_CATEGORIES.includes(category as ToolCategoryString)) {
        throw new ManifestValidationError(
          `Invalid tool category in tools.enabled: "${category}". Valid categories: ${VALID_TOOL_CATEGORIES.join(', ')}`,
          filePath,
          'tools.enabled'
        );
      }
    }
  }

  // Validate disabled array
  if (toolsObj.disabled !== undefined) {
    if (!Array.isArray(toolsObj.disabled)) {
      throw new ManifestValidationError(
        'tools.disabled must be an array',
        filePath,
        'tools.disabled'
      );
    }
    for (const category of toolsObj.disabled) {
      if (!VALID_TOOL_CATEGORIES.includes(category as ToolCategoryString)) {
        throw new ManifestValidationError(
          `Invalid tool category in tools.disabled: "${category}". Valid categories: ${VALID_TOOL_CATEGORIES.join(', ')}`,
          filePath,
          'tools.disabled'
        );
      }
    }
  }

  // Validate overrides object
  if (toolsObj.overrides !== undefined) {
    if (typeof toolsObj.overrides !== 'object' || Array.isArray(toolsObj.overrides)) {
      throw new ManifestValidationError(
        'tools.overrides must be an object',
        filePath,
        'tools.overrides'
      );
    }
    const overrides = toolsObj.overrides as Record<string, unknown>;
    for (const [toolName, enabled] of Object.entries(overrides)) {
      if (typeof enabled !== 'boolean') {
        throw new ManifestValidationError(
          `tools.overrides.${toolName} must be a boolean`,
          filePath,
          `tools.overrides.${toolName}`
        );
      }
    }
  }

  // Validate cookbooks object
  if (toolsObj.cookbooks !== undefined) {
    validateCookbooksSection(toolsObj.cookbooks, filePath);
  }
}

/**
 * Validate cookbooks binding section
 */
function validateCookbooksSection(cookbooks: unknown, filePath: string): void {
  if (typeof cookbooks !== 'object' || cookbooks === null) {
    throw new ManifestValidationError(
      'tools.cookbooks must be an object',
      filePath,
      'tools.cookbooks'
    );
  }

  const cookbooksObj = cookbooks as Record<string, unknown>;

  if (cookbooksObj.load !== undefined && !Array.isArray(cookbooksObj.load)) {
    throw new ManifestValidationError(
      'tools.cookbooks.load must be an array',
      filePath,
      'tools.cookbooks.load'
    );
  }

  if (cookbooksObj.auto_detect !== undefined && typeof cookbooksObj.auto_detect !== 'boolean') {
    throw new ManifestValidationError(
      'tools.cookbooks.auto_detect must be a boolean',
      filePath,
      'tools.cookbooks.auto_detect'
    );
  }

  if (cookbooksObj.project_path !== undefined && typeof cookbooksObj.project_path !== 'string') {
    throw new ManifestValidationError(
      'tools.cookbooks.project_path must be a string',
      filePath,
      'tools.cookbooks.project_path'
    );
  }
}

/**
 * Validate roles section
 */
function validateRolesSection(roles: unknown, filePath: string): void {
  if (typeof roles !== 'object' || roles === null) {
    throw new ManifestValidationError('roles must be an object', filePath, 'roles');
  }

  const rolesObj = roles as Record<string, unknown>;

  if (rolesObj.active !== undefined && typeof rolesObj.active !== 'string') {
    throw new ManifestValidationError('roles.active must be a string', filePath, 'roles.active');
  }

  if (rolesObj.auto_detect !== undefined && typeof rolesObj.auto_detect !== 'boolean') {
    throw new ManifestValidationError(
      'roles.auto_detect must be a boolean',
      filePath,
      'roles.auto_detect'
    );
  }

  if (rolesObj.project_path !== undefined && typeof rolesObj.project_path !== 'string') {
    throw new ManifestValidationError(
      'roles.project_path must be a string',
      filePath,
      'roles.project_path'
    );
  }

  // Validate overrides
  if (rolesObj.overrides !== undefined) {
    if (typeof rolesObj.overrides !== 'object' || Array.isArray(rolesObj.overrides)) {
      throw new ManifestValidationError(
        'roles.overrides must be an object',
        filePath,
        'roles.overrides'
      );
    }
    const overrides = rolesObj.overrides as Record<string, unknown>;

    if (overrides.tools_allow !== undefined && !Array.isArray(overrides.tools_allow)) {
      throw new ManifestValidationError(
        'roles.overrides.tools_allow must be an array',
        filePath,
        'roles.overrides.tools_allow'
      );
    }

    if (overrides.tools_deny !== undefined && !Array.isArray(overrides.tools_deny)) {
      throw new ManifestValidationError(
        'roles.overrides.tools_deny must be an array',
        filePath,
        'roles.overrides.tools_deny'
      );
    }
  }
}

/**
 * Valid AI focus modes for validation
 */
const VALID_AI_FOCUS_MODES: AIFocusMode[] = [
  'content-editing',
  'full-admin',
  'read-only',
  'custom',
];

/**
 * Validate ai section
 */
function validateAISection(ai: unknown, filePath: string): void {
  if (typeof ai !== 'object' || ai === null) {
    throw new ManifestValidationError('ai must be an object', filePath, 'ai');
  }

  const aiObj = ai as Record<string, unknown>;

  if (aiObj.focus !== undefined) {
    if (!VALID_AI_FOCUS_MODES.includes(aiObj.focus as AIFocusMode)) {
      throw new ManifestValidationError(
        `Invalid ai.focus: "${aiObj.focus}". Valid modes: ${VALID_AI_FOCUS_MODES.join(', ')}`,
        filePath,
        'ai.focus'
      );
    }
  }

  if (aiObj.instructions !== undefined && typeof aiObj.instructions !== 'string') {
    throw new ManifestValidationError(
      'ai.instructions must be a string',
      filePath,
      'ai.instructions'
    );
  }

  if (aiObj.prompts_path !== undefined && typeof aiObj.prompts_path !== 'string') {
    throw new ManifestValidationError(
      'ai.prompts_path must be a string',
      filePath,
      'ai.prompts_path'
    );
  }
}

/**
 * Valid safety modes for validation
 */
const VALID_SAFETY_MODES: SafetyMode[] = ['yolo', 'normal', 'cautious'];

/**
 * Valid operation types for validation
 */
const VALID_OPERATION_TYPES: OperationType[] = [
  'create',
  'update',
  'delete',
  'activate',
  'deactivate',
  'batch',
];

/**
 * Validate v2 safety section fields
 */
function validateSafetyV2Section(safety: unknown, filePath: string): void {
  if (typeof safety !== 'object' || safety === null) {
    return; // Already validated in v1
  }

  const safetyObj = safety as Record<string, unknown>;

  // Validate mode
  if (safetyObj.mode !== undefined) {
    if (!VALID_SAFETY_MODES.includes(safetyObj.mode as SafetyMode)) {
      throw new ManifestValidationError(
        `Invalid safety.mode: "${safetyObj.mode}". Valid modes: ${VALID_SAFETY_MODES.join(', ')}`,
        filePath,
        'safety.mode'
      );
    }
  }

  // Validate max_batch_size
  if (safetyObj.max_batch_size !== undefined) {
    if (typeof safetyObj.max_batch_size !== 'number' || safetyObj.max_batch_size < 1) {
      throw new ManifestValidationError(
        'safety.max_batch_size must be a positive number',
        filePath,
        'safety.max_batch_size'
      );
    }
  }

  // Validate allowed_operations
  if (safetyObj.allowed_operations !== undefined) {
    if (!Array.isArray(safetyObj.allowed_operations)) {
      throw new ManifestValidationError(
        'safety.allowed_operations must be an array',
        filePath,
        'safety.allowed_operations'
      );
    }
    for (const op of safetyObj.allowed_operations) {
      if (!VALID_OPERATION_TYPES.includes(op as OperationType)) {
        throw new ManifestValidationError(
          `Invalid operation in safety.allowed_operations: "${op}". Valid types: ${VALID_OPERATION_TYPES.join(', ')}`,
          filePath,
          'safety.allowed_operations'
        );
      }
    }
  }

  // Validate blocked_operations
  if (safetyObj.blocked_operations !== undefined) {
    if (!Array.isArray(safetyObj.blocked_operations)) {
      throw new ManifestValidationError(
        'safety.blocked_operations must be an array',
        filePath,
        'safety.blocked_operations'
      );
    }
    for (const op of safetyObj.blocked_operations) {
      if (!VALID_OPERATION_TYPES.includes(op as OperationType)) {
        throw new ManifestValidationError(
          `Invalid operation in safety.blocked_operations: "${op}". Valid types: ${VALID_OPERATION_TYPES.join(', ')}`,
          filePath,
          'safety.blocked_operations'
        );
      }
    }
  }
}

/**
 * Validate env section (environment overrides)
 */
function validateEnvSection(env: unknown, filePath: string): void {
  if (typeof env !== 'object' || env === null || Array.isArray(env)) {
    throw new ManifestValidationError('env must be an object', filePath, 'env');
  }

  const envObj = env as Record<string, unknown>;

  for (const [envName, override] of Object.entries(envObj)) {
    if (typeof override !== 'object' || override === null) {
      throw new ManifestValidationError(
        `env.${envName} must be an object`,
        filePath,
        `env.${envName}`
      );
    }

    const overrideObj = override as Record<string, unknown>;

    // Validate override sections
    if (overrideObj.tools !== undefined) {
      validateToolsSection(overrideObj.tools, filePath);
    }
    if (overrideObj.roles !== undefined) {
      validateRolesSection(overrideObj.roles, filePath);
    }
    if (overrideObj.ai !== undefined) {
      validateAISection(overrideObj.ai, filePath);
    }
    if (overrideObj.safety !== undefined) {
      validateSafetyV2Section(overrideObj.safety, filePath);
    }
  }
}

// =============================================================================
// Manifest Loading
// =============================================================================

/** Manifest file names to search for (in priority order) */
const MANIFEST_FILE_NAMES = ['wpnavigator.jsonc', 'wpnavigator.json', '.wpnavigator.jsonc'];

/**
 * Result of manifest loading
 */
export interface LoadManifestResult {
  /** Whether manifest was found and loaded */
  found: boolean;
  /** Loaded manifest (if found) */
  manifest?: WPNavManifestRuntime;
  /** Path to the manifest file (if found) */
  path?: string;
  /** Error message (if validation failed) */
  error?: string;
  /** Error details */
  errorDetails?: {
    field?: string;
  };
}

/**
 * Load wpnavigator.jsonc from project root
 *
 * @param projectRoot - Directory to search (defaults to cwd)
 * @returns Loading result with manifest or error
 */
export function loadManifest(projectRoot?: string): LoadManifestResult {
  const searchDir = projectRoot ? path.resolve(projectRoot) : process.cwd();

  // Search for manifest file
  let manifestPath: string | undefined;
  for (const fileName of MANIFEST_FILE_NAMES) {
    const candidatePath = path.join(searchDir, fileName);
    if (fs.existsSync(candidatePath)) {
      manifestPath = candidatePath;
      break;
    }
  }

  // Not found - this is OK, manifest is optional
  if (!manifestPath) {
    return { found: false };
  }

  // Read file
  let content: string;
  try {
    content = fs.readFileSync(manifestPath, 'utf8');
  } catch (error) {
    return {
      found: true,
      path: manifestPath,
      error: `Failed to read manifest: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  // Parse JSONC
  let parsed: unknown;
  try {
    parsed = parseJsonc(content);
  } catch (error) {
    return {
      found: true,
      path: manifestPath,
      error: `Invalid JSON in manifest: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  // Validate
  try {
    const manifest = validateManifest(parsed, manifestPath);
    return {
      found: true,
      manifest,
      path: manifestPath,
    };
  } catch (error) {
    if (error instanceof ManifestValidationError) {
      return {
        found: true,
        path: manifestPath,
        error: error.message,
        errorDetails: {
          field: error.field,
        },
      };
    }
    return {
      found: true,
      path: manifestPath,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// =============================================================================
// Default Values
// =============================================================================

/** Default brand palette */
export const DEFAULT_BRAND_PALETTE: Required<BrandPalette> = {
  primary: '#1a73e8',
  secondary: '#4285f4',
  accent: '#ea4335',
  neutral: '#5f6368',
};

/** Default brand fonts */
export const DEFAULT_BRAND_FONTS: Required<BrandFonts> = {
  heading: 'Inter',
  body: 'Open Sans',
  mono: 'Fira Code',
  fallback: 'system-ui, -apple-system, sans-serif',
};

/** Default brand layout */
export const DEFAULT_BRAND_LAYOUT: Required<BrandLayout> = {
  containerWidth: '1200px',
  spacing: 'comfortable',
  borderRadius: 'subtle',
};

/** Default backup reminder settings */
export const DEFAULT_BACKUP_REMINDERS: Required<BackupReminders> = {
  enabled: true,
  before_sync: true,
  frequency: 'first_sync_only',
};

/** Default safety settings */
export const DEFAULT_MANIFEST_SAFETY: Required<ManifestSafety> = {
  allow_create_pages: true,
  allow_update_pages: true,
  allow_delete_pages: false,
  allow_plugin_changes: false,
  allow_theme_changes: false,
  require_confirmation: true,
  require_sync_confirmation: true,
  first_sync_acknowledged: false,
  backup_reminders: DEFAULT_BACKUP_REMINDERS,
};

/**
 * Get brand palette with defaults applied
 */
export function getBrandPalette(brand?: ManifestBrand): Required<BrandPalette> {
  return {
    ...DEFAULT_BRAND_PALETTE,
    ...brand?.palette,
  };
}

/**
 * Get brand fonts with defaults applied
 */
export function getBrandFonts(brand?: ManifestBrand): Required<BrandFonts> {
  return {
    ...DEFAULT_BRAND_FONTS,
    ...brand?.fonts,
  };
}

/**
 * Get brand layout with defaults applied
 */
export function getBrandLayout(brand?: ManifestBrand): Required<BrandLayout> {
  return {
    ...DEFAULT_BRAND_LAYOUT,
    ...brand?.layout,
  };
}

/**
 * Get safety settings with defaults applied
 */
export function getManifestSafety(manifest?: WPNavManifest): Required<ManifestSafety> {
  const baseSafety = {
    ...DEFAULT_MANIFEST_SAFETY,
    ...manifest?.safety,
  };

  // Deep merge backup_reminders
  if (manifest?.safety?.backup_reminders) {
    baseSafety.backup_reminders = {
      ...DEFAULT_BACKUP_REMINDERS,
      ...manifest.safety.backup_reminders,
    };
  }

  return baseSafety;
}

/**
 * Get backup reminder settings with defaults applied
 */
export function getBackupReminders(manifest?: WPNavManifest): Required<BackupReminders> {
  return {
    ...DEFAULT_BACKUP_REMINDERS,
    ...manifest?.safety?.backup_reminders,
  };
}

// =============================================================================
// Schema v2 Default Values
// =============================================================================

/** Default cookbook binding configuration */
export const DEFAULT_COOKBOOK_BINDING: Required<ManifestCookbookBinding> = {
  load: [],
  auto_detect: true,
  project_path: './cookbooks',
};

/** Default tools configuration */
export const DEFAULT_MANIFEST_TOOLS: Required<ManifestTools> = {
  enabled: [
    'core',
    'content',
    'taxonomy',
    'users',
    'plugins',
    'themes',
    'workflows',
    'cookbook',
    'roles',
    'batch',
  ],
  disabled: [],
  overrides: {},
  cookbooks: DEFAULT_COOKBOOK_BINDING,
};

/** Default role overrides */
export const DEFAULT_ROLE_OVERRIDES: Required<ManifestRoleOverrides> = {
  tools_allow: [],
  tools_deny: [],
};

/** Default roles configuration */
export const DEFAULT_MANIFEST_ROLES: Required<ManifestRoles> = {
  active: '',
  auto_detect: true,
  project_path: './roles',
  overrides: DEFAULT_ROLE_OVERRIDES,
};

/** Default AI configuration */
export const DEFAULT_MANIFEST_AI: Required<ManifestAI> = {
  focus: 'content-editing',
  instructions: '',
  prompts_path: './sample-prompts',
  detected_plugins: [],
  page_builder: '',
  recommended_cookbooks: [],
  recommended_role: '',
};

/** Default v2 safety settings */
export const DEFAULT_MANIFEST_SAFETY_V2: Required<ManifestSafetyV2> = {
  ...DEFAULT_MANIFEST_SAFETY,
  mode: 'cautious',
  max_batch_size: 10,
  allowed_operations: ['create', 'update'],
  blocked_operations: ['delete'],
};

// =============================================================================
// Schema v2 Getters
// =============================================================================

/**
 * Get tools configuration with defaults applied
 */
export function getManifestTools(manifest?: WPNavManifestRuntime): Required<ManifestTools> {
  if (!manifest || !isManifestV2(manifest)) {
    return DEFAULT_MANIFEST_TOOLS;
  }

  const baseTools = {
    ...DEFAULT_MANIFEST_TOOLS,
    ...manifest.tools,
  };

  // Deep merge cookbooks
  if (manifest.tools?.cookbooks) {
    baseTools.cookbooks = {
      ...DEFAULT_COOKBOOK_BINDING,
      ...manifest.tools.cookbooks,
    };
  }

  return baseTools;
}

/**
 * Get roles configuration with defaults applied
 */
export function getManifestRoles(manifest?: WPNavManifestRuntime): Required<ManifestRoles> {
  if (!manifest || !isManifestV2(manifest)) {
    return DEFAULT_MANIFEST_ROLES;
  }

  const baseRoles = {
    ...DEFAULT_MANIFEST_ROLES,
    ...manifest.roles,
  };

  // Deep merge overrides
  if (manifest.roles?.overrides) {
    baseRoles.overrides = {
      ...DEFAULT_ROLE_OVERRIDES,
      ...manifest.roles.overrides,
    };
  }

  return baseRoles;
}

/**
 * Get AI configuration with defaults applied
 */
export function getManifestAI(manifest?: WPNavManifestRuntime): Required<ManifestAI> {
  if (!manifest || !isManifestV2(manifest)) {
    return DEFAULT_MANIFEST_AI;
  }

  return {
    ...DEFAULT_MANIFEST_AI,
    ...manifest.ai,
  };
}

/**
 * Get v2 safety settings with defaults applied
 */
export function getManifestSafetyV2(manifest?: WPNavManifestRuntime): Required<ManifestSafetyV2> {
  if (!manifest || !isManifestV2(manifest)) {
    return DEFAULT_MANIFEST_SAFETY_V2;
  }

  const baseSafety = {
    ...DEFAULT_MANIFEST_SAFETY_V2,
    ...manifest.safety,
  };

  // Deep merge backup_reminders
  if (manifest.safety?.backup_reminders) {
    baseSafety.backup_reminders = {
      ...DEFAULT_BACKUP_REMINDERS,
      ...manifest.safety.backup_reminders,
    };
  }

  return baseSafety;
}

/**
 * Upgrade a v1 manifest to v2 format (non-destructive)
 * Returns a new object with v2 defaults applied
 */
export function asManifestV2(manifest: WPNavManifestRuntime): WPNavManifestV2 {
  if (isManifestV2(manifest)) {
    return manifest;
  }

  // Create v2 from v1 with defaults
  return {
    ...manifest,
    schema_version: 2,
    tools: DEFAULT_MANIFEST_TOOLS,
    roles: DEFAULT_MANIFEST_ROLES,
    ai: DEFAULT_MANIFEST_AI,
    safety: {
      ...DEFAULT_MANIFEST_SAFETY_V2,
      ...manifest.safety,
    },
  };
}
