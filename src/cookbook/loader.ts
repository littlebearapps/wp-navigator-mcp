/**
 * WP Navigator Cookbook Loader
 *
 * Discovers and loads cookbook files from multiple sources:
 * 1. Bundled cookbooks (package defaults)
 * 2. Project cookbooks (./cookbooks/)
 *
 * Unlike roles, cookbooks do NOT merge - project cookbooks
 * completely override bundled ones for the same plugin.
 *
 * @package WP_Navigator_MCP
 * @since 2.1.0
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { parse as yamlParse } from 'yaml';
import {
  validateCookbook,
  CookbookValidationError,
  CookbookSchemaVersionError,
} from './validation.js';
import { parseSkillMd, extractPluginSlug, SkillParseError } from './skill-parser.js';
import { COOKBOOK_SCHEMA_VERSION } from './types.js';
import type {
  Cookbook,
  LoadedCookbook,
  CookbookLoadResult,
  CookbookRegistry,
  CookbookRegistryEntry,
} from './types.js';
import type { SkillCookbook } from './skill-types.js';

// Re-export error classes
export { CookbookValidationError, CookbookSchemaVersionError, SkillParseError };

// =============================================================================
// YAML Parser
// =============================================================================

/**
 * Parse a YAML string into an object.
 */
function parseYaml(content: string): Record<string, unknown> {
  const result = yamlParse(content);
  return result ?? {};
}

// =============================================================================
// SKILL.md to Cookbook Conversion
// =============================================================================

/**
 * Convert a SKILL.md cookbook to the standard Cookbook format.
 *
 * SKILL.md is a markdown-first format with minimal structured data.
 * We create a minimal Cookbook that satisfies the schema while
 * preserving the markdown body for AI consumption.
 *
 * @param skill - Parsed SKILL.md cookbook
 * @returns Cookbook compatible with the validation schema
 */
function skillToCookbook(skill: SkillCookbook): Cookbook {
  const fm = skill.frontmatter;
  const pluginSlug = extractPluginSlug(fm.name);

  return {
    schema_version: COOKBOOK_SCHEMA_VERSION,
    cookbook_version: fm.version || '1.0.0',
    plugin: {
      slug: pluginSlug,
      name: pluginSlug.charAt(0).toUpperCase() + pluginSlug.slice(1).replace(/-/g, ' '),
      min_version: fm['min-plugin-version'],
      max_version: fm['max-plugin-version'],
    },
    capabilities: {
      // SKILL.md doesn't define structured capabilities
      // The markdown body contains the guidance
    },
    // Store the markdown body in documentation_url for now
    // Future: Add a dedicated field for skill body
    documentation_url: undefined,
    last_updated: new Date().toISOString().split('T')[0],
    author: 'WP Navigator',
  };
}

/**
 * Extended LoadedCookbook with SKILL.md body
 */
export interface LoadedSkillCookbook extends LoadedCookbook {
  /** SKILL.md markdown body (guidance content) */
  skillBody?: string;
  /** Original SKILL.md frontmatter */
  skillFrontmatter?: SkillCookbook['frontmatter'];
  /** Allowed tools from SKILL.md */
  allowedTools?: string[];
}

// =============================================================================
// Path Utilities
// =============================================================================

/**
 * Get the path to bundled cookbooks directory.
 * Handles both development (src/) and installed (dist/) contexts.
 */
function getBundledCookbooksPath(): string {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  // In dist: dist/cookbook/loader.js
  // Bundled cookbooks are at: src/cookbook/bundled/
  return path.join(__dirname, '..', '..', 'src', 'cookbook', 'bundled');
}

// =============================================================================
// Registry Loading (Fast Enumeration)
// =============================================================================

/**
 * Load the bundled cookbook registry for fast enumeration.
 * Returns null if registry doesn't exist (triggers fallback to directory scan).
 */
function loadBundledRegistry(): CookbookRegistry | null {
  const bundledPath = getBundledCookbooksPath();
  const registryPath = path.join(bundledPath, 'registry.json');

  if (!fs.existsSync(registryPath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(registryPath, 'utf8');
    return JSON.parse(content) as CookbookRegistry;
  } catch {
    return null;
  }
}

/**
 * List bundled cookbook slugs using registry (fast path).
 * Returns null if registry unavailable (triggers fallback).
 */
export function listBundledFromRegistry(): string[] | null {
  const registry = loadBundledRegistry();
  if (!registry) return null;
  return registry.cookbooks.map((c) => c.slug);
}

/**
 * Get registry entry for a specific cookbook.
 * Returns null if not in registry.
 *
 * @param slug - Plugin slug to look up
 * @returns CookbookRegistryEntry if found, null otherwise
 */
export function getRegistryEntry(slug: string): CookbookRegistryEntry | null {
  const registry = loadBundledRegistry();
  if (!registry) return null;
  return registry.cookbooks.find((c) => c.slug === slug) || null;
}

/**
 * Get the full bundled registry.
 * Returns null if registry doesn't exist.
 */
export function getBundledRegistry(): CookbookRegistry | null {
  return loadBundledRegistry();
}

// =============================================================================
// Single File Loading
// =============================================================================

/**
 * Load a cookbook from a file path.
 *
 * Supports:
 * - .json, .jsonc - Structured JSON cookbook
 * - .yaml, .yml - Structured YAML cookbook
 * - .md - SKILL.md format (YAML frontmatter + Markdown body)
 *
 * @param filePath - Absolute path to the cookbook file
 * @param source - Source type ('bundled' or 'project')
 * @returns CookbookLoadResult with success status and cookbook or error
 */
export function loadCookbook(filePath: string, source: 'bundled' | 'project'): CookbookLoadResult {
  const ext = path.extname(filePath).toLowerCase();

  // Read file
  let content: string;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    return {
      success: false,
      error: `Failed to read file: ${error instanceof Error ? error.message : String(error)}`,
      path: filePath,
    };
  }

  // Handle SKILL.md format
  if (ext === '.md') {
    const result = parseSkillMd(content);
    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to parse SKILL.md',
        path: filePath,
      };
    }

    const skill = result.cookbook!;
    const cookbook = skillToCookbook(skill);
    const allowedToolsStr = skill.frontmatter['allowed-tools'];
    const allowedTools = allowedToolsStr
      ? allowedToolsStr
          .split(',')
          .map((t) => t.trim())
          .filter((t) => t.length > 0)
      : [];

    const loadedCookbook: LoadedSkillCookbook = {
      ...cookbook,
      source,
      sourcePath: filePath,
      skillBody: skill.body,
      skillFrontmatter: skill.frontmatter,
      allowedTools,
    };

    return {
      success: true,
      cookbook: loadedCookbook,
      path: filePath,
    };
  }

  // Parse based on extension (JSON/YAML)
  let parsed: unknown;
  try {
    if (ext === '.json' || ext === '.jsonc') {
      // Strip JSONC comments before parsing
      const jsonContent = content.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
      parsed = JSON.parse(jsonContent);
    } else if (ext === '.yaml' || ext === '.yml') {
      parsed = parseYaml(content);
    } else {
      return {
        success: false,
        error: `Unsupported file extension: ${ext} (use .yaml, .yml, .json, .jsonc, or .md)`,
        path: filePath,
      };
    }
  } catch (error) {
    return {
      success: false,
      error: `Failed to parse ${ext}: ${error instanceof Error ? error.message : String(error)}`,
      path: filePath,
    };
  }

  // Validate
  try {
    const cookbook = validateCookbook(parsed, filePath);
    const loadedCookbook: LoadedCookbook = {
      ...cookbook,
      source,
      sourcePath: filePath,
    };
    return {
      success: true,
      cookbook: loadedCookbook,
      path: filePath,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      path: filePath,
    };
  }
}

// =============================================================================
// Directory Loading
// =============================================================================

/**
 * Load all cookbooks from a directory.
 *
 * @param directory - Path to directory containing cookbook files
 * @param source - Source type for all cookbooks in this directory
 * @returns Array of CookbookLoadResult (success or failure for each file)
 */
export function loadCookbooksFromDirectory(
  directory: string,
  source: 'bundled' | 'project'
): CookbookLoadResult[] {
  if (!fs.existsSync(directory)) {
    return [];
  }

  let entries: string[];
  try {
    entries = fs.readdirSync(directory);
  } catch {
    return [];
  }

  const cookbookFiles = entries.filter((f) => /\.(yaml|yml|json|jsonc|md)$/i.test(f));

  return cookbookFiles.map((file) => loadCookbook(path.join(directory, file), source));
}

// =============================================================================
// Cookbook Discovery
// =============================================================================

/**
 * Options for cookbook discovery.
 */
export interface CookbookDiscoveryOptions {
  /** Project directory to search for cookbooks/ folder. Defaults to cwd. */
  projectDir?: string;
  /** Include bundled cookbooks. Defaults to true. */
  includeBundled?: boolean;
}

/**
 * Result of cookbook discovery.
 */
export interface DiscoveredCookbooks {
  /** Map of plugin slug to cookbook definition */
  cookbooks: Map<string, LoadedCookbook>;
  /** Which plugin slugs came from each source */
  sources: {
    project: string[];
    bundled: string[];
  };
  /** Failed cookbook loads */
  errors: CookbookLoadResult[];
}

/**
 * Discover cookbooks from all sources.
 *
 * Loading order:
 * 1. Bundled cookbooks (package defaults)
 * 2. Project cookbooks (./cookbooks/) - completely override bundled
 *
 * Unlike roles, cookbooks do NOT merge. Project cookbooks replace
 * bundled ones entirely for the same plugin.
 *
 * @param options - Discovery options
 * @returns DiscoveredCookbooks with cookbooks and source tracking
 */
export function discoverCookbooks(options: CookbookDiscoveryOptions = {}): DiscoveredCookbooks {
  const { projectDir = process.cwd(), includeBundled = true } = options;

  const cookbooks = new Map<string, LoadedCookbook>();
  const sources: DiscoveredCookbooks['sources'] = { project: [], bundled: [] };
  const errors: CookbookLoadResult[] = [];

  // Load bundled first (lower priority)
  if (includeBundled) {
    const bundledPath = getBundledCookbooksPath();
    const registry = loadBundledRegistry();

    if (registry) {
      // Fast path: use registry to load only listed files
      for (const entry of registry.cookbooks) {
        const filePath = path.join(bundledPath, entry.file);
        const result = loadCookbook(filePath, 'bundled');
        if (result.success && result.cookbook) {
          cookbooks.set(result.cookbook.plugin.slug, result.cookbook);
          sources.bundled.push(result.cookbook.plugin.slug);
        } else {
          errors.push(result);
        }
      }
    } else {
      // Fallback: scan directory (backwards compatible)
      const bundledResults = loadCookbooksFromDirectory(bundledPath, 'bundled');
      for (const result of bundledResults) {
        if (result.success && result.cookbook) {
          cookbooks.set(result.cookbook.plugin.slug, result.cookbook);
          sources.bundled.push(result.cookbook.plugin.slug);
        } else {
          errors.push(result);
        }
      }
    }
  }

  // Load project (higher priority - replaces bundled)
  const projectCookbooksPath = path.join(projectDir, 'cookbooks');
  const projectResults = loadCookbooksFromDirectory(projectCookbooksPath, 'project');
  for (const result of projectResults) {
    if (result.success && result.cookbook) {
      const slug = result.cookbook.plugin.slug;
      // Project completely replaces bundled (no merge)
      cookbooks.set(slug, result.cookbook);
      sources.project.push(slug);
      // Remove from bundled list if it was there
      const bundledIndex = sources.bundled.indexOf(slug);
      if (bundledIndex !== -1) {
        sources.bundled.splice(bundledIndex, 1);
      }
    } else {
      errors.push(result);
    }
  }

  return { cookbooks, sources, errors };
}

// =============================================================================
// Convenience Functions
// =============================================================================

/**
 * List all available cookbook plugin slugs (sorted alphabetically).
 *
 * @param options - Discovery options
 * @returns Sorted array of plugin slugs
 */
export function listAvailableCookbooks(options?: CookbookDiscoveryOptions): string[] {
  const { cookbooks } = discoverCookbooks(options);
  return Array.from(cookbooks.keys()).sort();
}

/**
 * Get a specific cookbook by plugin slug.
 *
 * @param pluginSlug - Plugin slug to retrieve cookbook for
 * @param options - Discovery options
 * @returns LoadedCookbook if found, null otherwise
 */
export function getCookbook(
  pluginSlug: string,
  options?: CookbookDiscoveryOptions
): LoadedCookbook | null {
  const { cookbooks } = discoverCookbooks(options);
  return cookbooks.get(pluginSlug) || null;
}

/**
 * Get the path to the bundled cookbooks directory.
 * Exported for testing purposes.
 */
export function getBundledPath(): string {
  return getBundledCookbooksPath();
}

/**
 * Check if a cookbook exists for a specific plugin.
 *
 * @param pluginSlug - Plugin slug to check
 * @param options - Discovery options
 * @returns true if cookbook exists
 */
export function hasCookbook(pluginSlug: string, options?: CookbookDiscoveryOptions): boolean {
  return getCookbook(pluginSlug, options) !== null;
}
