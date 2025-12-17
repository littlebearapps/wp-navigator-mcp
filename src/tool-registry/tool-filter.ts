/**
 * Tool Filter Module
 *
 * Compiles manifest configuration into an efficient tool filter.
 * Supports:
 * - Category bindings: "content:*", "core:*"
 * - Wildcard patterns: "wpnav_list_*", "wpnav_get_*"
 * - Explicit tool names: "wpnav_list_posts"
 * - Per-tool overrides
 * - Role-based restrictions
 *
 * @package WP_Navigator_MCP
 * @since 2.7.0
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { RegisteredTool, ToolCategory } from './types.js';
import {
  CompiledToolFilter,
  ToolFilterOptions,
  CATEGORY_STRING_TO_ENUM,
  VALID_CATEGORIES,
} from './filter-types.js';
import { ManifestTools, ManifestRoleOverrides, ToolCategoryString } from '../manifest.js';
import { LoadedRole } from '../roles/types.js';

/**
 * Tool Filter Implementation
 *
 * Compiles filter options into an efficient lookup structure.
 * The filter chain order is:
 * 1. Feature flags (existing behavior)
 * 2. Manifest category filtering (enabled/disabled)
 * 3. Manifest per-tool overrides
 * 4. Role tool restrictions (allowed/denied)
 * 5. Role config overrides (tools_allow/tools_deny)
 */
export class ToolFilter implements CompiledToolFilter {
  public readonly enabledTools: Set<string>;
  public readonly warnings: string[];
  private readonly allTools: Map<string, RegisteredTool>;
  private readonly toolDefinitions: Map<string, Tool>;

  constructor(options: ToolFilterOptions) {
    this.allTools = options.allTools;
    this.warnings = [];
    this.toolDefinitions = new Map();

    // Cache tool definitions for getEnabledDefinitions()
    for (const [name, tool] of this.allTools) {
      if (!this.toolDefinitions.has(tool.definition.name)) {
        this.toolDefinitions.set(tool.definition.name, tool.definition);
      }
    }

    this.enabledTools = this.compile(options);
  }

  /**
   * Check if a specific tool is enabled
   */
  isEnabled(toolName: string): boolean {
    // Resolve alias to primary name if needed
    const tool = this.allTools.get(toolName);
    if (!tool) {
      return false;
    }
    return this.enabledTools.has(tool.definition.name);
  }

  /**
   * Get all enabled tool definitions
   */
  getEnabledDefinitions(): Tool[] {
    const definitions: Tool[] = [];
    for (const toolName of this.enabledTools) {
      const def = this.toolDefinitions.get(toolName);
      if (def) {
        definitions.push(def);
      }
    }
    return definitions;
  }

  /**
   * Compile filter from options (called once at construction)
   */
  private compile(options: ToolFilterOptions): Set<string> {
    const { manifestTools, featureFlags, activeRole, roleOverrides } = options;

    // Start with all unique tool names (primary names only, no aliases)
    let enabled = this.getAllPrimaryToolNames();

    // Step 1: Apply feature flags (existing behavior)
    enabled = this.applyFeatureFlags(enabled, featureFlags);

    // Step 2: Apply manifest category filtering
    if (manifestTools) {
      enabled = this.applyManifestCategories(enabled, manifestTools);
    }

    // Step 3: Apply manifest per-tool overrides
    if (manifestTools?.overrides) {
      enabled = this.applyManifestOverrides(enabled, manifestTools.overrides);
    }

    // Step 4: Apply role restrictions (if role active)
    if (activeRole?.tools) {
      enabled = this.applyRoleRestrictions(enabled, activeRole);
    }

    // Step 5: Apply role overrides from config
    if (roleOverrides) {
      enabled = this.applyRoleOverrides(enabled, roleOverrides);
    }

    return enabled;
  }

  /**
   * Get all primary tool names (no aliases)
   */
  private getAllPrimaryToolNames(): Set<string> {
    const names = new Set<string>();
    for (const tool of this.allTools.values()) {
      names.add(tool.definition.name);
    }
    return names;
  }

  /**
   * Get tools by category
   */
  private getToolsByCategory(category: ToolCategory): string[] {
    const tools: string[] = [];
    const seen = new Set<string>();

    for (const tool of this.allTools.values()) {
      if (tool.category === category && !seen.has(tool.definition.name)) {
        seen.add(tool.definition.name);
        tools.push(tool.definition.name);
      }
    }

    return tools;
  }

  /**
   * Match tool names against a pattern
   * Supports: exact match, wildcards (*), category bindings (category:*)
   */
  private matchPattern(pattern: string): string[] {
    // Category binding: "content:*" or "core:*"
    if (pattern.endsWith(':*')) {
      const categoryStr = pattern.slice(0, -2);
      const category = CATEGORY_STRING_TO_ENUM[categoryStr];

      if (!category) {
        this.warnings.push(`Unknown category in pattern: "${pattern}"`);
        return [];
      }

      return this.getToolsByCategory(category);
    }

    // Wildcard: "wpnav_list_*" or "wpnav_*_posts"
    if (pattern.includes('*')) {
      // Escape regex special chars except *, then replace * with .*
      const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
      const regexStr = '^' + escaped.replace(/\*/g, '.*') + '$';
      const regex = new RegExp(regexStr);

      const matched: string[] = [];
      for (const name of this.getAllPrimaryToolNames()) {
        if (regex.test(name)) {
          matched.push(name);
        }
      }

      if (matched.length === 0) {
        this.warnings.push(`Pattern matched no tools: "${pattern}"`);
      }

      return matched;
    }

    // Exact match
    const tool = this.allTools.get(pattern);
    if (tool) {
      return [tool.definition.name];
    }

    // Invalid pattern - add warning
    this.warnings.push(`Unknown tool: "${pattern}"`);
    return [];
  }

  /**
   * Apply feature flags (existing behavior)
   * Tools with a featureFlag requirement are disabled unless the flag is explicitly true
   */
  private applyFeatureFlags(
    enabled: Set<string>,
    featureFlags?: Map<string, boolean>
  ): Set<string> {
    const flags = featureFlags ?? new Map<string, boolean>();
    const result = new Set<string>();

    for (const toolName of enabled) {
      const tool = this.allTools.get(toolName);
      if (!tool) continue;

      // If no feature flag required, tool is enabled
      if (!tool.featureFlag) {
        result.add(toolName);
        continue;
      }

      // Check feature flag state - must be explicitly true
      if (flags.get(tool.featureFlag) === true) {
        result.add(toolName);
      }
    }

    return result;
  }

  /**
   * Apply manifest category filtering (enabled/disabled categories)
   */
  private applyManifestCategories(enabled: Set<string>, manifestTools: ManifestTools): Set<string> {
    const { enabled: enabledCategories, disabled: disabledCategories } = manifestTools;

    // If no categories specified, all tools remain enabled
    if (!enabledCategories?.length && !disabledCategories?.length) {
      return enabled;
    }

    let result = new Set(enabled);

    // If enabled categories specified, start with only those
    if (enabledCategories && enabledCategories.length > 0) {
      result = new Set<string>();

      for (const categoryStr of enabledCategories) {
        if (!this.isValidCategory(categoryStr)) {
          this.warnings.push(`Unknown category: "${categoryStr}"`);
          continue;
        }

        const category = CATEGORY_STRING_TO_ENUM[categoryStr];
        const categoryTools = this.getToolsByCategory(category);

        for (const toolName of categoryTools) {
          // Only add if it was originally enabled (passed feature flags)
          if (enabled.has(toolName)) {
            result.add(toolName);
          }
        }
      }
    }

    // Apply disabled categories (removes from result)
    if (disabledCategories && disabledCategories.length > 0) {
      for (const categoryStr of disabledCategories) {
        if (!this.isValidCategory(categoryStr)) {
          this.warnings.push(`Unknown category: "${categoryStr}"`);
          continue;
        }

        const category = CATEGORY_STRING_TO_ENUM[categoryStr];
        const categoryTools = this.getToolsByCategory(category);

        for (const toolName of categoryTools) {
          result.delete(toolName);
        }
      }
    }

    return result;
  }

  /**
   * Apply manifest per-tool overrides
   */
  private applyManifestOverrides(
    enabled: Set<string>,
    overrides: Record<string, boolean>
  ): Set<string> {
    const result = new Set(enabled);

    for (const [pattern, allow] of Object.entries(overrides)) {
      const matchedTools = this.matchPattern(pattern);

      for (const toolName of matchedTools) {
        if (allow) {
          result.add(toolName);
        } else {
          result.delete(toolName);
        }
      }
    }

    return result;
  }

  /**
   * Apply role tool restrictions (allowed/denied lists)
   */
  private applyRoleRestrictions(enabled: Set<string>, role: LoadedRole): Set<string> {
    let result = new Set(enabled);
    const { allowed, denied } = role.tools || {};

    // If role has an allowed list, intersect with it
    // (role can only further restrict, not expand beyond current enabled set)
    if (allowed && allowed.length > 0) {
      const allowedSet = new Set<string>();

      for (const pattern of allowed) {
        const matchedTools = this.matchPattern(pattern);
        for (const toolName of matchedTools) {
          // Only allow if it was already enabled
          if (result.has(toolName)) {
            allowedSet.add(toolName);
          }
        }
      }

      result = allowedSet;
    }

    // Apply denied list (removes from result)
    if (denied && denied.length > 0) {
      for (const pattern of denied) {
        const matchedTools = this.matchPattern(pattern);
        for (const toolName of matchedTools) {
          result.delete(toolName);
        }
      }
    }

    return result;
  }

  /**
   * Apply role overrides from config (tools_allow/tools_deny)
   */
  private applyRoleOverrides(enabled: Set<string>, overrides: ManifestRoleOverrides): Set<string> {
    const result = new Set(enabled);
    const { tools_allow, tools_deny } = overrides;

    // Apply tools_allow (extends role's allowed list)
    if (tools_allow && tools_allow.length > 0) {
      for (const pattern of tools_allow) {
        const matchedTools = this.matchPattern(pattern);
        for (const toolName of matchedTools) {
          result.add(toolName);
        }
      }
    }

    // Apply tools_deny (further restricts)
    if (tools_deny && tools_deny.length > 0) {
      for (const pattern of tools_deny) {
        const matchedTools = this.matchPattern(pattern);
        for (const toolName of matchedTools) {
          result.delete(toolName);
        }
      }
    }

    return result;
  }

  /**
   * Check if a string is a valid category
   */
  private isValidCategory(value: string): value is ToolCategoryString {
    return VALID_CATEGORIES.includes(value);
  }
}

/**
 * Create a compiled tool filter from options
 *
 * @example
 * ```typescript
 * const filter = createToolFilter({
 *   manifestTools: { enabled: ['content', 'core'], disabled: ['users'] },
 *   allTools: toolRegistry.getAllTools(),
 *   featureFlags: toolRegistry.getFeatureFlags(),
 * });
 *
 * if (filter.isEnabled('wpnav_list_posts')) {
 *   // Tool is available
 * }
 * ```
 */
export function createToolFilter(options: ToolFilterOptions): CompiledToolFilter {
  return new ToolFilter(options);
}
