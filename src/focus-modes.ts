/**
 * Focus Modes Module
 *
 * Provides preset configurations for token reduction via pre-filtered tool sets.
 * Focus modes dramatically reduce token usage by limiting the tools exposed to AI agents.
 *
 * Built-in modes:
 * - `content-editing`: ~14 essential content tools (~500 tokens)
 * - `full-admin`: All tools (~19,500 tokens)
 * - `read-only`: Only read operations (~300 tokens)
 * - `custom`: User-defined via manifest tools section
 *
 * @package WP_Navigator_MCP
 * @since 2.7.0
 */

import {
  AIFocusMode,
  ManifestTools,
  ToolCategoryString,
  WPNavManifestV2,
  isManifestV2,
  getManifestTools,
} from './manifest.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Focus mode preset definition
 */
export interface FocusModePreset {
  /** Preset identifier */
  name: AIFocusMode;
  /** Human-readable description */
  description: string;
  /** Estimated token usage */
  tokenEstimate: string;
  /** Tool configuration to apply */
  tools: ManifestTools;
}

/**
 * Result of focus mode resolution
 */
export interface ResolvedFocusMode {
  /** The resolved focus mode */
  mode: AIFocusMode;
  /** Tool configuration to apply */
  tools: ManifestTools;
  /** Description for display */
  description: string;
  /** Source of resolution (preset or custom) */
  source: 'preset' | 'custom' | 'manifest';
}

// =============================================================================
// Focus Mode Presets
// =============================================================================

/**
 * Content-editing preset: Essential tools for content creation and management
 *
 * Includes ~14 tools for:
 * - Core introspection and site overview
 * - Posts and pages CRUD
 * - Categories and tags (read)
 * - Media list and upload
 */
const CONTENT_EDITING_PRESET: FocusModePreset = {
  name: 'content-editing',
  description: 'Essential tools for content creation and management',
  tokenEstimate: '~500 tokens',
  tools: {
    enabled: [],
    disabled: [],
    overrides: {
      // Core tools
      wpnav_introspect: true,
      wpnav_get_site_overview: true,
      wpnav_help: true,

      // Content: Posts
      wpnav_list_posts: true,
      wpnav_get_post: true,
      wpnav_create_post_with_blocks: true,
      wpnav_update_post: true,

      // Content: Pages
      wpnav_list_pages: true,
      wpnav_get_page: true,
      wpnav_create_page: true,
      wpnav_update_page: true,
      wpnav_snapshot_page: true,

      // Taxonomy (read-only for content workflow)
      wpnav_list_categories: true,
      wpnav_list_tags: true,

      // Media (full access per user decision)
      wpnav_list_media: true,
      wpnav_upload_media_from_url: true,
    },
  },
};

/**
 * Full-admin preset: All available tools
 *
 * No restrictions - all tools enabled
 */
const FULL_ADMIN_PRESET: FocusModePreset = {
  name: 'full-admin',
  description: 'Full administrative access to all WordPress tools',
  tokenEstimate: '~19,500 tokens',
  tools: {
    // Empty means no filtering - all tools enabled
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
  },
};

/**
 * Read-only preset: Only read operations allowed
 *
 * Includes all wpnav_list_* and wpnav_get_* tools
 */
const READ_ONLY_PRESET: FocusModePreset = {
  name: 'read-only',
  description: 'Read-only access for auditing and exploration',
  tokenEstimate: '~300 tokens',
  tools: {
    enabled: ['core'],
    disabled: [],
    overrides: {
      // Core tools
      wpnav_introspect: true,
      wpnav_get_site_overview: true,
      wpnav_help: true,

      // List operations (read-only)
      'wpnav_list_*': true,
      'wpnav_get_*': true,
      wpnav_snapshot_page: true,

      // Explicitly disable all write operations
      'wpnav_create_*': false,
      'wpnav_update_*': false,
      'wpnav_delete_*': false,
      'wpnav_activate_*': false,
      'wpnav_deactivate_*': false,
      'wpnav_batch_*': false,
    },
  },
};

/**
 * Custom preset: User-defined via manifest
 *
 * This is a placeholder - custom mode uses manifest tools section directly
 */
const CUSTOM_PRESET: FocusModePreset = {
  name: 'custom',
  description: 'Custom tool configuration from manifest',
  tokenEstimate: 'varies',
  tools: {
    enabled: [],
    disabled: [],
    overrides: {},
  },
};

/**
 * Map of all focus mode presets
 */
export const FOCUS_MODE_PRESETS: Record<AIFocusMode, FocusModePreset> = {
  'content-editing': CONTENT_EDITING_PRESET,
  'full-admin': FULL_ADMIN_PRESET,
  'read-only': READ_ONLY_PRESET,
  custom: CUSTOM_PRESET,
};

// =============================================================================
// Resolution Functions
// =============================================================================

/**
 * Resolve a focus mode to its tool configuration
 *
 * For built-in presets, returns the preset's tool config.
 * For 'custom' mode, returns the manifest's tools section.
 *
 * @param mode - Focus mode to resolve
 * @param manifest - Optional manifest for custom mode
 * @returns Resolved focus mode with tool configuration
 */
export function resolveFocusMode(mode: AIFocusMode, manifest?: WPNavManifestV2): ResolvedFocusMode {
  // Custom mode uses manifest tools section
  if (mode === 'custom') {
    const manifestTools = manifest ? getManifestTools(manifest) : {};
    return {
      mode: 'custom',
      tools: manifestTools,
      description: CUSTOM_PRESET.description,
      source: 'manifest',
    };
  }

  // Built-in preset
  const preset = FOCUS_MODE_PRESETS[mode];
  return {
    mode,
    tools: preset.tools,
    description: preset.description,
    source: 'preset',
  };
}

/**
 * Get the focus mode from a manifest, with fallback to default
 *
 * @param manifest - Manifest to read focus mode from
 * @returns The focus mode, defaulting to 'content-editing'
 */
export function getFocusMode(manifest?: WPNavManifestV2): AIFocusMode {
  if (manifest && isManifestV2(manifest) && manifest.ai?.focus) {
    return manifest.ai.focus;
  }
  return 'content-editing'; // Default
}

/**
 * Get the preset definition for a focus mode
 *
 * @param mode - Focus mode to get preset for
 * @returns Preset definition
 */
export function getFocusModePreset(mode: AIFocusMode): FocusModePreset {
  return FOCUS_MODE_PRESETS[mode];
}

/**
 * List all available focus modes with descriptions
 *
 * @returns Array of focus mode metadata
 */
export function listFocusModes(): Array<{
  name: AIFocusMode;
  description: string;
  tokenEstimate: string;
}> {
  return Object.values(FOCUS_MODE_PRESETS).map((preset) => ({
    name: preset.name,
    description: preset.description,
    tokenEstimate: preset.tokenEstimate,
  }));
}

/**
 * Merge focus mode tools with manifest tools
 *
 * Focus mode tools are the base, manifest tools extend/override.
 * This allows users to use a preset as a starting point and customize.
 *
 * @param focusMode - Resolved focus mode
 * @param manifestTools - Tools from manifest
 * @returns Merged tool configuration
 */
export function mergeFocusModeWithManifest(
  focusMode: ResolvedFocusMode,
  manifestTools?: ManifestTools
): ManifestTools {
  if (!manifestTools || focusMode.source === 'manifest') {
    // Custom mode or no manifest tools - use focus mode tools directly
    return focusMode.tools;
  }

  // For presets, manifest tools extend the preset
  // Manifest enabled/disabled categories are additive
  // Manifest overrides take precedence
  const merged: ManifestTools = {
    enabled: [...(focusMode.tools.enabled || []), ...(manifestTools.enabled || [])].filter(
      (v, i, a) => a.indexOf(v) === i
    ) as ToolCategoryString[],
    disabled: [...(focusMode.tools.disabled || []), ...(manifestTools.disabled || [])].filter(
      (v, i, a) => a.indexOf(v) === i
    ) as ToolCategoryString[],
    overrides: {
      ...focusMode.tools.overrides,
      ...manifestTools.overrides, // Manifest overrides win
    },
    cookbooks: manifestTools.cookbooks || focusMode.tools.cookbooks,
  };

  return merged;
}

/**
 * Count enabled tools for a focus mode
 *
 * Note: This is an estimate based on overrides. Actual count depends on
 * registered tools at runtime.
 *
 * @param mode - Focus mode to count tools for
 * @returns Estimated tool count
 */
export function estimateToolCount(mode: AIFocusMode): number {
  const preset = FOCUS_MODE_PRESETS[mode];

  if (mode === 'full-admin') {
    return 75; // All tools
  }

  if (mode === 'custom') {
    return -1; // Unknown
  }

  // Count explicit true overrides
  const overrides = preset.tools.overrides || {};
  let count = 0;
  for (const [key, value] of Object.entries(overrides)) {
    if (value === true && !key.includes('*')) {
      count++;
    }
  }

  return count;
}
