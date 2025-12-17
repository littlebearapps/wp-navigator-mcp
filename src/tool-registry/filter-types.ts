/**
 * Tool Filter Type Definitions
 *
 * Types for config-driven tool filtering based on manifest and roles.
 *
 * @package WP_Navigator_MCP
 * @since 2.7.0
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { RegisteredTool, ToolCategory } from './types.js';
import { ManifestTools, ManifestRoleOverrides } from '../manifest.js';
import { LoadedRole } from '../roles/types.js';

/**
 * Result of compiling a tool filter
 */
export interface ToolFilterResult {
  /** Set of enabled tool names */
  enabledTools: Set<string>;
  /** Warnings for invalid patterns/tool names */
  warnings: string[];
}

/**
 * Single step in the filter chain (for debugging/logging)
 */
export interface FilterStep {
  /** Source of this filter step */
  source:
    | 'feature-flag'
    | 'manifest-enabled'
    | 'manifest-disabled'
    | 'manifest-override'
    | 'role-allowed'
    | 'role-denied'
    | 'role-override';
  /** Action taken */
  action: 'allow' | 'deny';
  /** Pattern or tool name that matched */
  pattern: string;
  /** Tools affected by this step */
  matchedTools: string[];
}

/**
 * Compiled tool filter (cached for performance)
 */
export interface CompiledToolFilter {
  /** Pre-computed set of enabled tool names */
  readonly enabledTools: Set<string>;
  /** Warnings generated during compilation */
  readonly warnings: string[];
  /** Check if a specific tool is enabled */
  isEnabled(toolName: string): boolean;
  /** Get all enabled tool definitions */
  getEnabledDefinitions(): Tool[];
}

/**
 * Options for creating a tool filter
 */
export interface ToolFilterOptions {
  /** Manifest tools config (from wpnavigator.jsonc) */
  manifestTools?: ManifestTools;
  /** All registered tools (from registry) */
  allTools: Map<string, RegisteredTool>;
  /** Feature flags (from config) */
  featureFlags?: Map<string, boolean>;
  /** Active role (resolved from config or runtime) */
  activeRole?: LoadedRole | null;
  /** Role overrides from manifest */
  roleOverrides?: ManifestRoleOverrides;
}

/**
 * Category string to ToolCategory enum mapping
 */
export const CATEGORY_STRING_TO_ENUM: Record<string, ToolCategory> = {
  core: ToolCategory.CORE,
  content: ToolCategory.CONTENT,
  taxonomy: ToolCategory.TAXONOMY,
  users: ToolCategory.USERS,
  plugins: ToolCategory.PLUGINS,
  themes: ToolCategory.THEMES,
  workflows: ToolCategory.WORKFLOWS,
  cookbook: ToolCategory.COOKBOOK,
  roles: ToolCategory.ROLES,
  batch: ToolCategory.BATCH,
};

/**
 * All valid category strings
 */
export const VALID_CATEGORIES = Object.keys(CATEGORY_STRING_TO_ENUM);
