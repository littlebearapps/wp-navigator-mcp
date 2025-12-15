/**
 * WP Navigator Cookbook Module
 *
 * Plugin capability cookbooks for AI assistants.
 * Cookbooks capture plugin metadata (settings pages, shortcodes,
 * blocks, common tasks) to help AI understand plugin capabilities.
 *
 * Supports two formats:
 * 1. Structured (JSON/YAML) - Schema-validated plugin metadata
 * 2. SKILL.md - Markdown with YAML frontmatter for AI guidance
 *
 * Cookbooks are loaded from two sources (in priority order):
 * 1. Bundled cookbooks (package defaults)
 * 2. Project cookbooks (./cookbooks/)
 *
 * Project cookbooks completely replace bundled ones (no merge).
 *
 * @package WP_Navigator_MCP
 * @since 2.1.0
 */

// Type definitions (structured format)
export {
  COOKBOOK_SCHEMA_VERSION,
  type CookbookPlugin,
  type SettingsField,
  type SettingsSection,
  type SettingsPage,
  type ShortcodeParam,
  type Shortcode,
  type Block,
  type RestEndpoint,
  type CommonTask,
  type CookbookCapabilities,
  type Cookbook,
  type LoadedCookbook,
  type CookbookLoadResult,
  type CookbookRegistryEntry,
  type CookbookRegistry,
} from './types.js';

// SKILL.md types
export {
  type SkillFrontmatter,
  type SkillCookbook,
  type SkillParseResult,
  type SkillValidationOptions,
} from './skill-types.js';

// SKILL.md parser
export {
  parseSkillMd,
  parseSkillMdOrThrow,
  extractPluginSlug,
  getAllowedTools,
  SkillParseError,
} from './skill-parser.js';

// Validation
export {
  validateCookbook,
  CookbookValidationError,
  CookbookSchemaVersionError,
} from './validation.js';

// Loading and discovery
export {
  loadCookbook,
  loadCookbooksFromDirectory,
  discoverCookbooks,
  listAvailableCookbooks,
  getCookbook,
  hasCookbook,
  getBundledPath,
  // Registry functions (fast enumeration)
  listBundledFromRegistry,
  getRegistryEntry,
  getBundledRegistry,
  type CookbookDiscoveryOptions,
  type DiscoveredCookbooks,
  type LoadedSkillCookbook,
} from './loader.js';

// Version matching
export {
  isVersionCompatible,
  matchCookbooksToPlugins,
  type PluginInfo,
  type CookbookMatch,
} from './version-matcher.js';
