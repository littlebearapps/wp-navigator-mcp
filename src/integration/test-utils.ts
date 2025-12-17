/**
 * Integration Test Utilities
 *
 * Shared helpers for MCP protocol integration tests.
 *
 * @package WP_Navigator_MCP
 * @since 2.7.0
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';

/**
 * Estimate token count for a JSON object.
 *
 * Uses rough approximation: 4 characters per token (common for GPT-style tokenizers).
 * This is intentionally conservative for testing purposes.
 *
 * @param obj - Object to count tokens for
 * @returns Estimated token count
 */
export function estimateTokens(obj: unknown): number {
  const json = JSON.stringify(obj);
  return Math.ceil(json.length / 4);
}

/**
 * Expected meta-tools that should be exposed via MCP ListTools
 */
export const EXPECTED_META_TOOLS = [
  'wpnav_introspect',
  'wpnav_search_tools',
  'wpnav_describe_tools',
  'wpnav_execute',
  'wpnav_context',
] as const;

/**
 * Token budget for initial tool load
 */
export const TOKEN_BUDGET = 1000;

/**
 * Mock WordPress introspect response
 */
export function createMockIntrospectResponse(): object {
  return {
    site: {
      name: 'Test Site',
      url: 'https://test.example.com',
      admin_email: 'admin@example.com',
    },
    plugin: {
      version: '1.6.0',
      edition: 'pro',
      features: ['gutenberg', 'media', 'users'],
    },
    wordpress: {
      version: '6.4.2',
      multisite: false,
    },
    available_cookbooks: ['gutenberg', 'elementor'],
    available_roles: ['content-editor', 'developer', 'site-admin'],
  };
}

/**
 * Mock WordPress posts response
 */
export function createMockPostsResponse(count = 5): object[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    title: { rendered: `Test Post ${i + 1}` },
    status: 'publish',
    date: '2024-01-01T00:00:00',
    link: `https://test.example.com/post-${i + 1}`,
  }));
}

/**
 * Mock WordPress pages response
 */
export function createMockPagesResponse(count = 3): object[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 100,
    title: { rendered: `Test Page ${i + 1}` },
    status: 'publish',
    date: '2024-01-01T00:00:00',
    link: `https://test.example.com/page-${i + 1}`,
  }));
}

/**
 * Validate that a tool response has the expected structure
 */
export function validateToolResponse(response: unknown): {
  valid: boolean;
  error?: string;
} {
  if (!response || typeof response !== 'object') {
    return { valid: false, error: 'Response is not an object' };
  }

  const r = response as Record<string, unknown>;
  if (!Array.isArray(r.content)) {
    return { valid: false, error: 'Response missing content array' };
  }

  if (r.content.length === 0) {
    return { valid: false, error: 'Response content is empty' };
  }

  const firstContent = r.content[0] as Record<string, unknown>;
  if (firstContent.type !== 'text') {
    return { valid: false, error: 'First content item is not text type' };
  }

  if (typeof firstContent.text !== 'string') {
    return { valid: false, error: 'Content text is not a string' };
  }

  return { valid: true };
}

/**
 * Parse JSON from tool response content
 */
export function parseToolResponseJson<T = unknown>(response: {
  content: Array<{ type: string; text: string }>;
}): T {
  const text = response.content[0]?.text;
  if (!text) {
    throw new Error('No text content in response');
  }
  return JSON.parse(text) as T;
}

/**
 * Validate tools list response from MCP server
 */
export function validateToolsList(tools: Tool[]): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Check count
  if (tools.length !== EXPECTED_META_TOOLS.length) {
    errors.push(`Expected ${EXPECTED_META_TOOLS.length} tools, got ${tools.length}`);
  }

  // Check all expected tools present
  const toolNames = tools.map((t) => t.name);
  for (const expected of EXPECTED_META_TOOLS) {
    if (!toolNames.includes(expected)) {
      errors.push(`Missing expected tool: ${expected}`);
    }
  }

  // Check each tool has required fields
  for (const tool of tools) {
    if (!tool.name) {
      errors.push('Tool missing name');
    }
    if (!tool.description) {
      errors.push(`Tool ${tool.name} missing description`);
    }
    if (!tool.inputSchema) {
      errors.push(`Tool ${tool.name} missing inputSchema`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Error codes returned by wpnav_execute and other tools
 */
export const ERROR_CODES = {
  DIRECT_CALL_NOT_ALLOWED: 'DIRECT_CALL_NOT_ALLOWED',
  TOOL_NOT_FOUND: 'TOOL_NOT_FOUND',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  EXECUTION_FAILED: 'EXECUTION_FAILED',
  WRITES_DISABLED: 'WRITES_DISABLED',
  TOOL_DISABLED: 'TOOL_DISABLED',
} as const;

/**
 * Available tool categories for testing
 */
export const TOOL_CATEGORIES = [
  'core',
  'content',
  'taxonomy',
  'users',
  'plugins',
  'themes',
  'gutenberg',
  'batch',
  'cookbook',
  'roles',
] as const;
