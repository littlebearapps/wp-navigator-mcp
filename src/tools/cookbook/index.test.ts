/**
 * Cookbook Tools Tests
 *
 * Tests for cookbook MCP tools.
 *
 * @package WP_Navigator_MCP
 * @since 2.1.0
 */

import { describe, it, expect, beforeAll, vi } from 'vitest';
import { toolRegistry, ToolCategory } from '../../tool-registry/index.js';
import { registerCookbookTools } from './index.js';
import type { ToolExecutionContext } from '../../tool-registry/types.js';

// Register tools once before all tests
beforeAll(() => {
  // Clear registry and register fresh
  registerCookbookTools();
});

// =============================================================================
// Mock Context
// =============================================================================

const createMockContext = (wpRequestMock?: any): ToolExecutionContext => ({
  wpRequest: wpRequestMock || vi.fn(),
  config: {
    baseUrl: 'https://test.local',
    restApi: 'https://test.local/wp-json',
    wpnavBase: 'https://test.local/wp-json/wpnav/v1',
    wpnavIntrospect: 'https://test.local/wp-json/wpnav/v1/introspect',
    toggles: {
      enableWrites: false,
      toolTimeoutMs: 60000,
    },
  },
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  clampText: (text: string) => text,
});

// =============================================================================
// Tool Registration Tests
// =============================================================================

describe('Cookbook Tools Registration', () => {
  it('should register wpnav_list_cookbooks tool', () => {
    const tool = toolRegistry.getTool('wpnav_list_cookbooks');
    expect(tool).toBeDefined();
    expect(tool?.category).toBe(ToolCategory.COOKBOOK);
  });

  it('should register wpnav_load_cookbook tool', () => {
    const tool = toolRegistry.getTool('wpnav_load_cookbook');
    expect(tool).toBeDefined();
    expect(tool?.category).toBe(ToolCategory.COOKBOOK);
  });

  it('should register wpnav_match_cookbooks tool', () => {
    const tool = toolRegistry.getTool('wpnav_match_cookbooks');
    expect(tool).toBeDefined();
    expect(tool?.category).toBe(ToolCategory.COOKBOOK);
  });
});

// =============================================================================
// wpnav_list_cookbooks Tests
// =============================================================================

describe('wpnav_list_cookbooks', () => {
  it('should return list of bundled cookbooks', async () => {
    const tool = toolRegistry.getTool('wpnav_list_cookbooks');
    expect(tool).toBeDefined();

    const result = await tool!.handler({}, createMockContext());

    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');

    const data = JSON.parse(result.content[0].text!);
    expect(data.total).toBeGreaterThanOrEqual(2); // gutenberg + elementor
    expect(data.cookbooks).toBeInstanceOf(Array);
    expect(data.sources).toHaveProperty('bundled');
    expect(data.sources).toHaveProperty('project');

    // Check for bundled cookbooks
    const slugs = data.cookbooks.map((c: any) => c.slug);
    expect(slugs).toContain('gutenberg');
    expect(slugs).toContain('elementor');
  });

  it('should include cookbook metadata', async () => {
    const tool = toolRegistry.getTool('wpnav_list_cookbooks');
    const result = await tool!.handler({}, createMockContext());
    const data = JSON.parse(result.content[0].text!);

    const gutenberg = data.cookbooks.find((c: any) => c.slug === 'gutenberg');
    expect(gutenberg).toBeDefined();
    expect(gutenberg.source).toBe('bundled');
    expect(gutenberg.has_skill_body).toBe(true);
    expect(gutenberg.allowed_tools_count).toBeGreaterThan(0);
  });

  it('should include description and requires_wpnav_pro fields', async () => {
    const tool = toolRegistry.getTool('wpnav_list_cookbooks');
    const result = await tool!.handler({}, createMockContext());
    const data = JSON.parse(result.content[0].text!);

    // Gutenberg should have description but not requires_wpnav_pro
    const gutenberg = data.cookbooks.find((c: any) => c.slug === 'gutenberg');
    expect(gutenberg).toBeDefined();
    expect(gutenberg.description).toBeTruthy();
    expect(gutenberg.description).toContain('Block Editor');
    expect(gutenberg.requires_wpnav_pro).toBeNull();

    // Elementor has requires-wpnav-pro in its frontmatter
    const elementor = data.cookbooks.find((c: any) => c.slug === 'elementor');
    expect(elementor).toBeDefined();
    expect(elementor.description).toBeTruthy();
    // Elementor requires wpnav-pro according to the SKILL.md file
    expect(elementor.requires_wpnav_pro).toBeDefined();
  });

  it('supports summary_only parameter', async () => {
    const tool = toolRegistry.getTool('wpnav_list_cookbooks');
    expect(tool).toBeDefined();

    const props = tool!.definition.inputSchema.properties as any;
    expect(props).toHaveProperty('summary_only');
    expect(props.summary_only.type).toBe('boolean');
    expect(props.summary_only.default).toBe(false);

    const result = await tool!.handler({ summary_only: true }, createMockContext());
    const data = JSON.parse(result.content[0].text!);

    expect(data).toHaveProperty('ai_summary');
    expect(typeof data.ai_summary).toBe('string');
    expect(data).toHaveProperty('full_count');
    expect(data._meta.summary_only).toBe(true);
  });
});

// =============================================================================
// wpnav_load_cookbook Tests
// =============================================================================

describe('wpnav_load_cookbook', () => {
  it('should return full cookbook content for valid slug', async () => {
    const tool = toolRegistry.getTool('wpnav_load_cookbook');
    expect(tool).toBeDefined();

    const result = await tool!.handler({ slug: 'gutenberg' }, createMockContext());

    expect(result.isError).toBeFalsy();
    expect(result.content).toHaveLength(1);

    const data = JSON.parse(result.content[0].text!);
    expect(data.slug).toBe('gutenberg');
    expect(data.name).toBeDefined();
    expect(data.skill_body).toBeTruthy();
    expect(data.allowed_tools).toBeInstanceOf(Array);
    expect(data.allowed_tools.length).toBeGreaterThan(0);
  });

  it('should return error for invalid slug', async () => {
    const tool = toolRegistry.getTool('wpnav_load_cookbook');
    const result = await tool!.handler({ slug: 'nonexistent-plugin' }, createMockContext());

    expect(result.isError).toBe(true);

    const data = JSON.parse(result.content[0].text!);
    expect(data.error).toContain('Cookbook not found');
    expect(data.hint).toBeDefined();
  });

  it('should return error for missing slug parameter', async () => {
    const tool = toolRegistry.getTool('wpnav_load_cookbook');
    const result = await tool!.handler({}, createMockContext());

    expect(result.isError).toBe(true);

    const data = JSON.parse(result.content[0].text!);
    expect(data.error).toContain('Missing required parameter');
  });

  it('should return elementor cookbook', async () => {
    const tool = toolRegistry.getTool('wpnav_load_cookbook');
    const result = await tool!.handler({ slug: 'elementor' }, createMockContext());

    expect(result.isError).toBeFalsy();

    const data = JSON.parse(result.content[0].text!);
    expect(data.slug).toBe('elementor');
    expect(data.plugin.min_version).toBeDefined();
    expect(data.skill_body).toBeTruthy();
  });
});

// =============================================================================
// wpnav_match_cookbooks Tests
// =============================================================================

describe('wpnav_match_cookbooks', () => {
  it('should match provided plugins to cookbooks', async () => {
    const tool = toolRegistry.getTool('wpnav_match_cookbooks');
    expect(tool).toBeDefined();

    const plugins = [
      { slug: 'gutenberg', version: '17.0.0' },
      { slug: 'elementor', version: '3.21.0' },
      { slug: 'woocommerce', version: '8.0.0' }, // No cookbook for this
    ];

    const result = await tool!.handler({ plugins }, createMockContext());

    expect(result.isError).toBeFalsy();

    const data = JSON.parse(result.content[0].text!);
    expect(data.total_plugins).toBe(3);
    expect(data.matched_cookbooks).toBe(2);
    expect(data.matches).toHaveLength(2);
    expect(data.unmatched_plugins).toContain('woocommerce');

    // Check matched cookbook details
    const gutenbergMatch = data.matches.find((m: any) => m.plugin.slug === 'gutenberg');
    expect(gutenbergMatch).toBeDefined();
    expect(gutenbergMatch.compatible).toBe(true);
    expect(gutenbergMatch.has_skill_body).toBe(true);
    expect(gutenbergMatch.allowed_tools).toBeInstanceOf(Array);
  });

  it('should mark incompatible versions', async () => {
    const tool = toolRegistry.getTool('wpnav_match_cookbooks');

    const plugins = [
      { slug: 'elementor', version: '2.0.0' }, // Below min version
    ];

    const result = await tool!.handler({ plugins }, createMockContext());
    const data = JSON.parse(result.content[0].text!);

    expect(data.matches).toHaveLength(1);
    expect(data.matches[0].compatible).toBe(false);
    expect(data.matches[0].reason).toBeTruthy();
  });

  it('should fetch plugins from WordPress when not provided', async () => {
    const mockWpRequest = vi.fn().mockResolvedValue([
      {
        plugin: 'gutenberg/gutenberg.php',
        version: '17.0.0',
        status: 'active',
        name: 'Gutenberg',
      },
    ]);

    const tool = toolRegistry.getTool('wpnav_match_cookbooks');
    const result = await tool!.handler({}, createMockContext(mockWpRequest));

    expect(mockWpRequest).toHaveBeenCalledWith('/wp/v2/plugins?status=active');

    const data = JSON.parse(result.content[0].text!);
    expect(data.total_plugins).toBe(1);
  });

  it('should handle WordPress API errors gracefully', async () => {
    const mockWpRequest = vi.fn().mockRejectedValue(new Error('Connection failed'));

    const tool = toolRegistry.getTool('wpnav_match_cookbooks');
    const result = await tool!.handler({}, createMockContext(mockWpRequest));

    expect(result.isError).toBe(true);

    const data = JSON.parse(result.content[0].text!);
    expect(data.error).toContain('Failed to fetch plugins');
    expect(data.hint).toBeDefined();
  });

  it('should return available cookbooks info', async () => {
    const tool = toolRegistry.getTool('wpnav_match_cookbooks');
    const result = await tool!.handler({ plugins: [] }, createMockContext());

    const data = JSON.parse(result.content[0].text!);
    expect(data.available_cookbooks).toBeDefined();
    expect(data.available_cookbooks.bundled).toContain('gutenberg');
    expect(data.available_cookbooks.bundled).toContain('elementor');
  });
});
