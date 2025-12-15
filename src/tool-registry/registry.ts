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

/**
 * Tool registry implementation
 */
export class ToolRegistry implements IToolRegistry {
  private tools: Map<string, RegisteredTool> = new Map();
  private featureFlags: Map<string, boolean> = new Map();

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
   * Get tool by name (or alias)
   */
  getTool(name: string): RegisteredTool | undefined {
    return this.tools.get(name);
  }

  /**
   * Get all tool definitions (for ListTools response)
   * Filters out disabled tools and removes duplicates (aliases)
   */
  getAllDefinitions(): Tool[] {
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
   */
  isEnabled(name: string): boolean {
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
