/**
 * Tool Registry Implementation
 *
 * Central registry for managing MCP tools.
 * Supports dynamic registration, feature flags, and aliases.
 *
 * @package WP_Navigator_Pro
 * @since 1.3.0
 */

import {
  IToolRegistry,
  RegisteredTool,
  ToolCategory,
  ToolExecutionContext,
  ToolResult,
} from './types.js';
import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { CompiledToolFilter, ToolFilterOptions } from './filter-types.js';
import { createToolFilter } from './tool-filter.js';

/**
 * Tool registry implementation
 */
export class ToolRegistry implements IToolRegistry {
  private tools: Map<string, RegisteredTool> = new Map();
  private featureFlags: Map<string, boolean> = new Map();
  private toolFilter: CompiledToolFilter | null = null;
  private filterOptions: ToolFilterOptions | null = null;

  /**
   * Register a tool
   */
  register(tool: RegisteredTool): void {
    // Register primary name
    this.tools.set(tool.definition.name, tool);

    // Register aliases
    if (tool.aliases) {
      for (const alias of tool.aliases) {
        this.tools.set(alias, tool);
      }
    }
  }

  /**
   * Set feature flag state
   */
  setFeatureFlag(flag: string, enabled: boolean): void {
    this.featureFlags.set(flag, enabled);
  }

  /**
   * Apply a compiled tool filter
   * Call this after loading manifest and resolving role
   * @since 2.7.0
   */
  applyFilter(filter: CompiledToolFilter, options?: ToolFilterOptions): void {
    this.toolFilter = filter;
    if (options) {
      this.filterOptions = options;
    }
  }

  /**
   * Recompute the tool filter with updated options
   * Used for dynamic role switching via wpnav_load_role
   * @since 2.7.0
   */
  recomputeFilter(optionsUpdate: Partial<ToolFilterOptions>): CompiledToolFilter | null {
    if (!this.filterOptions) {
      return null;
    }

    // Merge updated options
    const newOptions: ToolFilterOptions = {
      ...this.filterOptions,
      ...optionsUpdate,
      allTools: this.tools, // Always use current tools
      featureFlags: this.featureFlags, // Always use current feature flags
    };

    // Create and apply new filter
    const newFilter = createToolFilter(newOptions);
    this.applyFilter(newFilter, newOptions);

    return newFilter;
  }

  /**
   * Clear the tool filter (resets to feature-flag-only filtering)
   * @since 2.7.0
   */
  clearFilter(): void {
    this.toolFilter = null;
    this.filterOptions = null;
  }

  /**
   * Get all registered tools (for filter compilation)
   * @since 2.7.0
   */
  getAllTools(): Map<string, RegisteredTool> {
    return this.tools;
  }

  /**
   * Get feature flags map (for filter compilation)
   * @since 2.7.0
   */
  getFeatureFlags(): Map<string, boolean> {
    return this.featureFlags;
  }

  /**
   * Get tool by name (or alias)
   */
  getTool(name: string): RegisteredTool | undefined {
    return this.tools.get(name);
  }

  /**
   * Get all tool definitions (for ListTools response)
   * Filters out disabled tools and removes duplicates (aliases)
   * @since 2.7.0 - Uses compiled filter when available
   */
  getAllDefinitions(): Tool[] {
    // Use compiled filter if available (v2.7.0+)
    if (this.toolFilter) {
      return this.toolFilter.getEnabledDefinitions();
    }

    // Fallback to existing behavior (feature flags only)
    const seen = new Set<string>();
    const definitions: Tool[] = [];

    for (const [name, tool] of this.tools.entries()) {
      // Skip if this is an alias (already added primary name)
      if (seen.has(tool.definition.name)) {
        continue;
      }

      // Skip if tool is disabled by feature flag
      if (!this.isEnabled(name)) {
        continue;
      }

      seen.add(tool.definition.name);
      definitions.push(tool.definition);
    }

    return definitions;
  }

  /**
   * Get tools by category
   */
  getByCategory(category: ToolCategory): RegisteredTool[] {
    const tools: RegisteredTool[] = [];
    const seen = new Set<string>();

    for (const tool of this.tools.values()) {
      // Skip duplicates (aliases)
      if (seen.has(tool.definition.name)) {
        continue;
      }

      if (tool.category === category) {
        seen.add(tool.definition.name);
        tools.push(tool);
      }
    }

    return tools;
  }

  /**
   * Check if tool is enabled
   * @since 2.7.0 - Uses compiled filter when available
   */
  isEnabled(name: string): boolean {
    // Use compiled filter if available (v2.7.0+)
    if (this.toolFilter) {
      return this.toolFilter.isEnabled(name);
    }

    // Fallback to existing behavior (feature flags only)
    const tool = this.getTool(name);
    if (!tool) {
      return false;
    }

    // If no feature flag, tool is always enabled
    if (!tool.featureFlag) {
      return true;
    }

    // Check feature flag state
    return this.featureFlags.get(tool.featureFlag) ?? false;
  }

  /**
   * Execute a tool by name
   */
  async execute(name: string, args: any, context: ToolExecutionContext): Promise<ToolResult> {
    const tool = this.getTool(name);
    if (!tool) {
      throw new Error(`Tool not found: ${name}`);
    }

    // Check if tool is enabled
    if (!this.isEnabled(name)) {
      throw new Error(
        `Tool is disabled: ${name}${tool.featureFlag ? ` (requires feature flag: ${tool.featureFlag})` : ''}`
      );
    }

    // Execute tool handler
    return await tool.handler(args, context);
  }

  /**
   * Get registry statistics (for debugging)
   */
  getStats(): {
    totalTools: number;
    byCategory: Record<ToolCategory, number>;
    enabledTools: number;
    disabledTools: number;
  } {
    const seen = new Set<string>();
    const byCategory: Record<ToolCategory, number> = {
      [ToolCategory.CORE]: 0,
      [ToolCategory.CONTENT]: 0,
      [ToolCategory.TAXONOMY]: 0,
      [ToolCategory.USERS]: 0,
      [ToolCategory.PLUGINS]: 0,
      [ToolCategory.THEMES]: 0,
      [ToolCategory.WORKFLOWS]: 0,
      [ToolCategory.COOKBOOK]: 0,
      [ToolCategory.ROLES]: 0,
      [ToolCategory.BATCH]: 0,
      [ToolCategory.SETTINGS]: 0,
      [ToolCategory.ANALYTICS]: 0,
      [ToolCategory.DISCOVERY]: 0,
      [ToolCategory.MAINTENANCE]: 0,
      [ToolCategory.AUTH]: 0,
    };

    let enabledTools = 0;
    let disabledTools = 0;

    for (const [name, tool] of this.tools.entries()) {
      // Skip duplicates (aliases)
      if (seen.has(tool.definition.name)) {
        continue;
      }

      seen.add(tool.definition.name);
      byCategory[tool.category]++;

      if (this.isEnabled(name)) {
        enabledTools++;
      } else {
        disabledTools++;
      }
    }

    return {
      totalTools: seen.size,
      byCategory,
      enabledTools,
      disabledTools,
    };
  }
}

/**
 * Global registry instance
 */
export const toolRegistry = new ToolRegistry();
