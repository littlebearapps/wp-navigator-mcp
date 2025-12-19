/**
 * Role Tools Tests
 *
 * Tests for role MCP tools.
 *
 * @package WP_Navigator_MCP
 * @since 2.6.0
 */

import { describe, it, expect, beforeAll, vi } from 'vitest';
import { toolRegistry, ToolCategory } from '../../tool-registry/index.js';
import { registerRoleTools } from './index.js';
import type { ToolExecutionContext } from '../../tool-registry/types.js';

// Register tools once before all tests
beforeAll(() => {
  // Register fresh
  registerRoleTools();
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

describe('Role Tools Registration', () => {
  it('should register wpnav_list_roles tool', () => {
    const tool = toolRegistry.getTool('wpnav_list_roles');
    expect(tool).toBeDefined();
    expect(tool?.category).toBe(ToolCategory.ROLES);
  });

  it('should register wpnav_load_role tool', () => {
    const tool = toolRegistry.getTool('wpnav_load_role');
    expect(tool).toBeDefined();
    expect(tool?.category).toBe(ToolCategory.ROLES);
  });
});

// =============================================================================
// wpnav_list_roles Tests
// =============================================================================

describe('wpnav_list_roles', () => {
  it('should return list of bundled roles', async () => {
    const tool = toolRegistry.getTool('wpnav_list_roles');
    expect(tool).toBeDefined();

    const result = await tool!.handler({}, createMockContext());

    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');

    const data = JSON.parse(result.content[0].text!);
    expect(data.total).toBeGreaterThanOrEqual(4); // 4 bundled roles
    expect(data.roles).toBeInstanceOf(Array);
    expect(data.sources).toHaveProperty('bundled');
    expect(data.sources).toHaveProperty('global');
    expect(data.sources).toHaveProperty('project');

    // Check for bundled roles
    const slugs = data.roles.map((r: any) => r.slug);
    expect(slugs).toContain('content-editor');
    expect(slugs).toContain('developer');
    expect(slugs).toContain('seo-specialist');
    expect(slugs).toContain('site-admin');
  });

  it('should include role metadata', async () => {
    const tool = toolRegistry.getTool('wpnav_list_roles');
    const result = await tool!.handler({}, createMockContext());
    const data = JSON.parse(result.content[0].text!);

    const developer = data.roles.find((r: any) => r.slug === 'developer');
    expect(developer).toBeDefined();
    expect(developer.source).toBe('bundled');
    expect(developer.description).toBeTruthy();
    expect(developer.focus_areas).toBeInstanceOf(Array);
    expect(developer.avoid).toBeInstanceOf(Array);
  });

  it('should include tool counts', async () => {
    const tool = toolRegistry.getTool('wpnav_list_roles');
    const result = await tool!.handler({}, createMockContext());
    const data = JSON.parse(result.content[0].text!);

    // Content editor has allowed tools and denied tools
    const contentEditor = data.roles.find((r: any) => r.slug === 'content-editor');
    expect(contentEditor).toBeDefined();
    expect(contentEditor.tools_allowed_count).toBeGreaterThan(0);
    expect(contentEditor.tools_denied_count).toBeGreaterThan(0);
  });

  it('should show source location for each role', async () => {
    const tool = toolRegistry.getTool('wpnav_list_roles');
    const result = await tool!.handler({}, createMockContext());
    const data = JSON.parse(result.content[0].text!);

    // All bundled roles should have source: 'bundled'
    const bundledRoles = data.roles.filter((r: any) => r.source === 'bundled');
    expect(bundledRoles.length).toBeGreaterThanOrEqual(4);
  });

  it('supports summary_only parameter', async () => {
    const tool = toolRegistry.getTool('wpnav_list_roles');
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
// wpnav_load_role Tests
// =============================================================================

describe('wpnav_load_role', () => {
  it('should return full role content for valid slug', async () => {
    const tool = toolRegistry.getTool('wpnav_load_role');
    expect(tool).toBeDefined();

    const result = await tool!.handler({ slug: 'developer' }, createMockContext());

    expect(result.isError).toBeFalsy();
    expect(result.content).toHaveLength(1);

    const data = JSON.parse(result.content[0].text!);
    expect(data.slug).toBe('developer');
    expect(data.name).toBe('developer');
    expect(data.description).toBeTruthy();
    expect(data.context).toBeTruthy();
    expect(data.focus_areas).toBeInstanceOf(Array);
    expect(data.avoid).toBeInstanceOf(Array);
    expect(data.tools).toBeDefined();
    expect(data.tools.allowed).toBeInstanceOf(Array);
    expect(data.tools.denied).toBeInstanceOf(Array);
  });

  it('should return error for invalid slug', async () => {
    const tool = toolRegistry.getTool('wpnav_load_role');
    const result = await tool!.handler({ slug: 'nonexistent-role' }, createMockContext());

    expect(result.isError).toBe(true);

    const data = JSON.parse(result.content[0].text!);
    expect(data.error).toContain('Role not found');
    expect(data.available).toBeInstanceOf(Array);
    expect(data.hint).toBeDefined();
  });

  it('should return error for missing slug parameter', async () => {
    const tool = toolRegistry.getTool('wpnav_load_role');
    const result = await tool!.handler({}, createMockContext());

    expect(result.isError).toBe(true);

    const data = JSON.parse(result.content[0].text!);
    expect(data.error).toContain('Missing required parameter');
  });

  it('should return content-editor role', async () => {
    const tool = toolRegistry.getTool('wpnav_load_role');
    const result = await tool!.handler({ slug: 'content-editor' }, createMockContext());

    expect(result.isError).toBeFalsy();

    const data = JSON.parse(result.content[0].text!);
    expect(data.slug).toBe('content-editor');
    expect(data.tools.allowed.length).toBeGreaterThan(0);
    expect(data.tools.denied.length).toBeGreaterThan(0);
  });

  it('should return site-admin role with full access', async () => {
    const tool = toolRegistry.getTool('wpnav_load_role');
    const result = await tool!.handler({ slug: 'site-admin' }, createMockContext());

    expect(result.isError).toBeFalsy();

    const data = JSON.parse(result.content[0].text!);
    expect(data.slug).toBe('site-admin');
    // Site admin typically has no denied tools
    expect(data.tools.denied).toBeInstanceOf(Array);
  });

  it('should include source and version fields', async () => {
    const tool = toolRegistry.getTool('wpnav_load_role');
    const result = await tool!.handler({ slug: 'developer' }, createMockContext());

    const data = JSON.parse(result.content[0].text!);
    expect(data.source).toBe('bundled');
    expect(data.schema_version).toBeDefined();
  });
});
