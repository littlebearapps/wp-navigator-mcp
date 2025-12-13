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
 * - schema_version: 1 = initial release
 * Used for compatibility checking and fail-fast validation
 */
export const CURRENT_SCHEMA_VERSION = 1;

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
    throw new ManifestValidationError(
      'Missing or invalid meta section',
      filePath,
      'meta'
    );
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
      throw new ManifestValidationError(
        'pages must be an array',
        filePath,
        'pages'
      );
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

  return manifest as WPNavManifest;
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
  manifest?: WPNavManifest;
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
