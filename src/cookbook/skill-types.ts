/**
 * WP Navigator SKILL.md Types
 *
 * TypeScript types for SKILL.md format cookbooks.
 * SKILL.md combines YAML frontmatter with Markdown body for
 * human-readable, AI-optimized guidance documents.
 *
 * @package WP_Navigator_MCP
 * @since 2.1.0
 */

/**
 * SKILL.md frontmatter fields (YAML between --- delimiters)
 *
 * Based on Claude Code Skills specification:
 * - name: Cookbook identifier (lowercase, hyphens)
 * - description: When to use this cookbook
 * - allowed-tools: Comma-separated list of relevant tools
 * - version: Cookbook version (semver)
 * - min-plugin-version: Minimum plugin version supported
 * - max-plugin-version: Maximum plugin version supported
 * - requires-wpnav-pro: Minimum WP Navigator Pro version
 */
export interface SkillFrontmatter {
  /** Cookbook identifier (lowercase, hyphens, max 64 chars) */
  name: string;
  /** When to use this cookbook (max 1024 chars) */
  description: string;
  /** Comma-separated list of relevant tools */
  'allowed-tools'?: string;
  /** Cookbook version (semver) */
  version?: string;
  /** Minimum plugin version supported */
  'min-plugin-version'?: string;
  /** Maximum plugin version supported */
  'max-plugin-version'?: string;
  /** Minimum WP Navigator Pro version required */
  'requires-wpnav-pro'?: string;
}

/**
 * Parsed SKILL.md document combining frontmatter and body
 */
export interface SkillCookbook {
  /** Parsed frontmatter fields */
  frontmatter: SkillFrontmatter;
  /** Markdown body content (everything after second ---) */
  body: string;
  /** Raw frontmatter string for debugging */
  rawFrontmatter: string;
}

/**
 * Result of parsing a SKILL.md file
 */
export interface SkillParseResult {
  /** Whether parsing succeeded */
  success: boolean;
  /** Parsed cookbook (if successful) */
  cookbook?: SkillCookbook;
  /** Error message (if failed) */
  error?: string;
}

/**
 * Validation options for SKILL.md frontmatter
 */
export interface SkillValidationOptions {
  /** Require version field */
  requireVersion?: boolean;
  /** Require min-plugin-version field */
  requireMinPluginVersion?: boolean;
}
