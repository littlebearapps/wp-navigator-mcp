/**
 * WP Navigator SKILL.md Parser
 *
 * Parses SKILL.md format files (YAML frontmatter + Markdown body).
 * This is the format specified in WPNAV-COOKBOOKS-ARCHITECTURE.md
 * for cookbook files that provide AI guidance.
 *
 * @package WP_Navigator_MCP
 * @since 2.1.0
 */

import { parse as yamlParse } from 'yaml';
import type { SkillFrontmatter, SkillCookbook, SkillParseResult, SkillValidationOptions } from './skill-types.js';

// =============================================================================
// Constants
// =============================================================================

/** Maximum length for name field */
const MAX_NAME_LENGTH = 64;

/** Maximum length for description field */
const MAX_DESCRIPTION_LENGTH = 1024;

/** Regex for valid name format (lowercase, hyphens, alphanumeric) */
const NAME_PATTERN = /^[a-z][a-z0-9-]*(-cookbook)?$/;

/** Regex for semver-like version */
const VERSION_PATTERN = /^\d+(\.\d+)*$/;

// =============================================================================
// Error Class
// =============================================================================

/**
 * Error thrown when SKILL.md parsing fails
 */
export class SkillParseError extends Error {
  public readonly field?: string;

  constructor(message: string, field?: string) {
    super(message);
    this.name = 'SkillParseError';
    this.field = field;
  }
}

// =============================================================================
// Frontmatter Extraction
// =============================================================================

/**
 * Extract frontmatter and body from SKILL.md content.
 *
 * @param content - Raw file content
 * @returns Object with rawFrontmatter and body, or error
 */
function extractFrontmatter(content: string): { rawFrontmatter: string; body: string } | { error: string } {
  const trimmed = content.trim();

  // Must start with ---
  if (!trimmed.startsWith('---')) {
    return { error: 'SKILL.md must start with --- (YAML frontmatter delimiter)' };
  }

  // Find the closing ---
  const secondDelimiter = trimmed.indexOf('---', 3);
  if (secondDelimiter === -1) {
    return { error: 'Missing closing --- delimiter for YAML frontmatter' };
  }

  // Extract frontmatter (between first and second ---)
  const rawFrontmatter = trimmed.slice(3, secondDelimiter).trim();

  // Extract body (everything after second --- and newline)
  let body = trimmed.slice(secondDelimiter + 3).trim();

  return { rawFrontmatter, body };
}

// =============================================================================
// Frontmatter Validation
// =============================================================================

/**
 * Validate parsed frontmatter fields.
 *
 * @param data - Parsed YAML object
 * @param options - Validation options
 * @returns Validated SkillFrontmatter
 * @throws SkillParseError if validation fails
 */
function validateFrontmatter(
  data: Record<string, unknown>,
  options: SkillValidationOptions = {}
): SkillFrontmatter {
  // Required: name
  if (!data.name || typeof data.name !== 'string') {
    throw new SkillParseError('Missing required field: name', 'name');
  }

  const name = data.name.trim();
  if (name.length === 0) {
    throw new SkillParseError('name cannot be empty', 'name');
  }
  if (name.length > MAX_NAME_LENGTH) {
    throw new SkillParseError(`name exceeds ${MAX_NAME_LENGTH} characters`, 'name');
  }
  if (!NAME_PATTERN.test(name)) {
    throw new SkillParseError(
      'name must be lowercase with hyphens (e.g., "gutenberg-cookbook")',
      'name'
    );
  }

  // Required: description
  if (!data.description || typeof data.description !== 'string') {
    throw new SkillParseError('Missing required field: description', 'description');
  }

  const description = data.description.trim();
  if (description.length === 0) {
    throw new SkillParseError('description cannot be empty', 'description');
  }
  if (description.length > MAX_DESCRIPTION_LENGTH) {
    throw new SkillParseError(`description exceeds ${MAX_DESCRIPTION_LENGTH} characters`, 'description');
  }

  // Optional: allowed-tools
  if (data['allowed-tools'] !== undefined && typeof data['allowed-tools'] !== 'string') {
    throw new SkillParseError('allowed-tools must be a string', 'allowed-tools');
  }

  // Optional: version
  if (data.version !== undefined) {
    if (typeof data.version !== 'string') {
      throw new SkillParseError('version must be a string', 'version');
    }
    if (!VERSION_PATTERN.test(data.version)) {
      throw new SkillParseError('version must be semver format (e.g., "1.0.0")', 'version');
    }
  } else if (options.requireVersion) {
    throw new SkillParseError('Missing required field: version', 'version');
  }

  // Optional: min-plugin-version
  if (data['min-plugin-version'] !== undefined) {
    if (typeof data['min-plugin-version'] !== 'string') {
      throw new SkillParseError('min-plugin-version must be a string', 'min-plugin-version');
    }
    if (!VERSION_PATTERN.test(data['min-plugin-version'])) {
      throw new SkillParseError('min-plugin-version must be semver format', 'min-plugin-version');
    }
  } else if (options.requireMinPluginVersion) {
    throw new SkillParseError('Missing required field: min-plugin-version', 'min-plugin-version');
  }

  // Optional: max-plugin-version
  if (data['max-plugin-version'] !== undefined) {
    if (typeof data['max-plugin-version'] !== 'string') {
      throw new SkillParseError('max-plugin-version must be a string', 'max-plugin-version');
    }
    if (!VERSION_PATTERN.test(data['max-plugin-version'])) {
      throw new SkillParseError('max-plugin-version must be semver format', 'max-plugin-version');
    }
  }

  // Optional: requires-wpnav-pro
  if (data['requires-wpnav-pro'] !== undefined) {
    if (typeof data['requires-wpnav-pro'] !== 'string') {
      throw new SkillParseError('requires-wpnav-pro must be a string', 'requires-wpnav-pro');
    }
    if (!VERSION_PATTERN.test(data['requires-wpnav-pro'])) {
      throw new SkillParseError('requires-wpnav-pro must be semver format', 'requires-wpnav-pro');
    }
  }

  return {
    name,
    description,
    'allowed-tools': data['allowed-tools'] as string | undefined,
    version: data.version as string | undefined,
    'min-plugin-version': data['min-plugin-version'] as string | undefined,
    'max-plugin-version': data['max-plugin-version'] as string | undefined,
    'requires-wpnav-pro': data['requires-wpnav-pro'] as string | undefined,
  };
}

// =============================================================================
// Main Parser
// =============================================================================

/**
 * Parse a SKILL.md file content.
 *
 * @param content - Raw file content
 * @param options - Validation options
 * @returns SkillParseResult with success status and parsed cookbook or error
 */
export function parseSkillMd(
  content: string,
  options: SkillValidationOptions = {}
): SkillParseResult {
  // Extract frontmatter and body
  const extracted = extractFrontmatter(content);
  if ('error' in extracted) {
    return { success: false, error: extracted.error };
  }

  const { rawFrontmatter, body } = extracted;

  // Parse YAML frontmatter
  let parsedYaml: Record<string, unknown>;
  try {
    const result = yamlParse(rawFrontmatter);
    if (!result || typeof result !== 'object') {
      return { success: false, error: 'Frontmatter must be a YAML object' };
    }
    parsedYaml = result as Record<string, unknown>;
  } catch (error) {
    return {
      success: false,
      error: `Failed to parse YAML frontmatter: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  // Validate frontmatter
  let frontmatter: SkillFrontmatter;
  try {
    frontmatter = validateFrontmatter(parsedYaml, options);
  } catch (error) {
    if (error instanceof SkillParseError) {
      return { success: false, error: error.message };
    }
    return { success: false, error: String(error) };
  }

  return {
    success: true,
    cookbook: {
      frontmatter,
      body,
      rawFrontmatter,
    },
  };
}

/**
 * Parse a SKILL.md file content, throwing on error.
 *
 * @param content - Raw file content
 * @param options - Validation options
 * @returns Parsed SkillCookbook
 * @throws SkillParseError if parsing fails
 */
export function parseSkillMdOrThrow(
  content: string,
  options: SkillValidationOptions = {}
): SkillCookbook {
  const result = parseSkillMd(content, options);
  if (!result.success) {
    throw new SkillParseError(result.error || 'Unknown parsing error');
  }
  return result.cookbook!;
}

/**
 * Extract the plugin slug from a SKILL.md name.
 *
 * Converts "elementor-cookbook" -> "elementor"
 * Converts "gutenberg-cookbook" -> "gutenberg"
 * Converts "woocommerce" -> "woocommerce"
 *
 * @param name - The name field from frontmatter
 * @returns Plugin slug
 */
export function extractPluginSlug(name: string): string {
  return name.replace(/-cookbook$/, '');
}

/**
 * Get allowed tools as an array from the comma-separated string.
 *
 * @param cookbook - Parsed SKILL.md cookbook
 * @returns Array of tool names
 */
export function getAllowedTools(cookbook: SkillCookbook): string[] {
  const tools = cookbook.frontmatter['allowed-tools'];
  if (!tools) {
    return [];
  }
  return tools.split(',').map((t) => t.trim()).filter((t) => t.length > 0);
}
