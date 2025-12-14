/**
 * Tool Registry Type Definitions
 *
 * Defines the structure for registering and managing MCP tools.
 * Supports both operational tools (wpnav_*) and workflow tools (wp-*).
 *
 * @package WP_Navigator_Pro
 * @since 1.3.0
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';

/**
 * Tool category for organization and discovery
 */
export enum ToolCategory {
  /** Core introspection and help tools */
  CORE = 'core',
  /** Content management (pages, posts, media, comments) */
  CONTENT = 'content',
  /** Taxonomies (categories, tags, custom taxonomies) */
  TAXONOMY = 'taxonomy',
  /** User management */
  USERS = 'users',
  /** Plugin management */
  PLUGINS = 'plugins',
  /** Theme management */
  THEMES = 'themes',
  /** AI workflow tools (v1.1+) */
  WORKFLOWS = 'workflows',
  /** Cookbook guidance (v2.1+) */
  COOKBOOK = 'cookbook',
}

/**
 * Tool handler function signature
 */
export type ToolHandler = (args: any, context: ToolExecutionContext) => Promise<ToolResult>;

/**
 * Execution context passed to tool handlers
 */
export interface ToolExecutionContext {
  /** WordPress REST API request helper */
  wpRequest: (endpoint: string, options?: RequestInit) => Promise<any>;
  /** Configuration object */
  config: any;
  /** Logger instance */
  logger: any;
  /** Output clamping utility */
  clampText: (text: string) => string;
}

/**
 * Tool execution result
 */
export interface ToolResult {
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    uri?: string;
    mimeType?: string;
  }>;
  isError?: boolean;
}

/**
 * Registered tool metadata
 */
export interface RegisteredTool {
  /** Tool definition (schema) */
  definition: Tool;
  /** Tool handler function */
  handler: ToolHandler;
  /** Tool category */
  category: ToolCategory;
  /** Feature flag required to enable (optional) */
  featureFlag?: string;
  /** Aliases for backward compatibility */
  aliases?: string[];
}

/**
 * Tool registry interface
 */
export interface IToolRegistry {
  /**
   * Register a tool
   */
  register(tool: RegisteredTool): void;

  /**
   * Get tool definition by name
   */
  getTool(name: string): RegisteredTool | undefined;

  /**
   * Get all tool definitions (for ListTools response)
   */
  getAllDefinitions(): Tool[];

  /**
   * Get tools by category
   */
  getByCategory(category: ToolCategory): RegisteredTool[];

  /**
   * Check if tool is enabled (feature flag check)
   */
  isEnabled(name: string): boolean;

  /**
   * Execute a tool by name
   */
  execute(name: string, args: any, context: ToolExecutionContext): Promise<ToolResult>;
}
