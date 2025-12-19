/**
 * Core Tools Tests
 *
 * Tests for core MCP tools (introspect, help, site_overview).
 *
 * @package WP_Navigator_MCP
 * @since 2.6.0
 */

import { describe, it, expect, beforeAll, vi } from 'vitest';
import { toolRegistry, ToolCategory } from '../../tool-registry/index.js';
import { registerCoreTools } from './index.js';
import type { ToolExecutionContext } from '../../tool-registry/types.js';

// Register tools once before all tests
beforeAll(() => {
  registerCoreTools();
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

describe('Core Tools Registration', () => {
  it('should register wpnav_introspect tool', () => {
    const tool = toolRegistry.getTool('wpnav_introspect');
    expect(tool).toBeDefined();
    expect(tool?.category).toBe(ToolCategory.CORE);
  });

  it('should register wpnav_help tool', () => {
    const tool = toolRegistry.getTool('wpnav_help');
    expect(tool).toBeDefined();
    expect(tool?.category).toBe(ToolCategory.CORE);
  });

  it('should register wpnav_get_site_overview tool', () => {
    const tool = toolRegistry.getTool('wpnav_get_site_overview');
    expect(tool).toBeDefined();
    expect(tool?.category).toBe(ToolCategory.CORE);
  });

  it('should register wpnav_list_post_types tool', () => {
    const tool = toolRegistry.getTool('wpnav_list_post_types');
    expect(tool).toBeDefined();
    expect(tool?.category).toBe(ToolCategory.CORE);
  });
});

// =============================================================================
// wpnav_introspect Tests
// =============================================================================

describe('wpnav_introspect', () => {
  it('should return introspect data with available_cookbooks', async () => {
    const mockWpRequest = vi.fn().mockImplementation((url: string) => {
      if (url.includes('introspect')) {
        return Promise.resolve({
          plugin: { version: '1.5.0', name: 'WP Navigator Pro' },
          capabilities: ['read', 'write'],
        });
      }
      if (url.includes('plugins')) {
        return Promise.resolve([
          { plugin: 'gutenberg/gutenberg.php', version: '17.0.0', status: 'active' },
        ]);
      }
      return Promise.resolve({});
    });

    const tool = toolRegistry.getTool('wpnav_introspect');
    expect(tool).toBeDefined();

    const result = await tool!.handler({}, createMockContext(mockWpRequest));

    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');

    const data = JSON.parse(result.content[0].text!);

    // Should have original introspect data
    expect(data.plugin).toBeDefined();
    expect(data.plugin.version).toBe('1.5.0');

    // Should have available_cookbooks array
    expect(data.available_cookbooks).toBeInstanceOf(Array);
    expect(data.available_cookbooks.length).toBeGreaterThanOrEqual(2); // gutenberg + elementor
  });

  it('should include slug, description, and detected flag for each cookbook', async () => {
    const mockWpRequest = vi.fn().mockImplementation((url: string) => {
      if (url.includes('introspect')) {
        return Promise.resolve({ plugin: { version: '1.5.0' } });
      }
      if (url.includes('plugins')) {
        return Promise.resolve([]);
      }
      return Promise.resolve({});
    });

    const tool = toolRegistry.getTool('wpnav_introspect');
    const result = await tool!.handler({}, createMockContext(mockWpRequest));
    const data = JSON.parse(result.content[0].text!);

    const gutenberg = data.available_cookbooks.find((c: any) => c.slug === 'gutenberg');
    expect(gutenberg).toBeDefined();
    expect(gutenberg.slug).toBe('gutenberg');
    expect(gutenberg).toHaveProperty('description');
    expect(typeof gutenberg.detected).toBe('boolean');
  });

  it('should set detected=true when plugin is active', async () => {
    const mockWpRequest = vi.fn().mockImplementation((url: string) => {
      if (url.includes('introspect')) {
        return Promise.resolve({ plugin: { version: '1.5.0' } });
      }
      if (url.includes('plugins')) {
        return Promise.resolve([
          { plugin: 'gutenberg/gutenberg.php', version: '17.0.0', status: 'active' },
        ]);
      }
      return Promise.resolve({});
    });

    const tool = toolRegistry.getTool('wpnav_introspect');
    const result = await tool!.handler({}, createMockContext(mockWpRequest));
    const data = JSON.parse(result.content[0].text!);

    const gutenberg = data.available_cookbooks.find((c: any) => c.slug === 'gutenberg');
    expect(gutenberg).toBeDefined();
    expect(gutenberg.detected).toBe(true);
  });

  it('should set detected=false when plugin is not active', async () => {
    const mockWpRequest = vi.fn().mockImplementation((url: string) => {
      if (url.includes('introspect')) {
        return Promise.resolve({ plugin: { version: '1.5.0' } });
      }
      if (url.includes('plugins')) {
        return Promise.resolve([
          { plugin: 'gutenberg/gutenberg.php', version: '17.0.0', status: 'active' },
        ]);
      }
      return Promise.resolve({});
    });

    const tool = toolRegistry.getTool('wpnav_introspect');
    const result = await tool!.handler({}, createMockContext(mockWpRequest));
    const data = JSON.parse(result.content[0].text!);

    // Elementor is not in the active plugins list
    const elementor = data.available_cookbooks.find((c: any) => c.slug === 'elementor');
    expect(elementor).toBeDefined();
    expect(elementor.detected).toBe(false);
  });

  it('should handle plugins fetch failure gracefully', async () => {
    const mockWpRequest = vi.fn().mockImplementation((url: string) => {
      if (url.includes('introspect')) {
        return Promise.resolve({ plugin: { version: '1.5.0' } });
      }
      if (url.includes('plugins')) {
        return Promise.reject(new Error('Connection failed'));
      }
      return Promise.resolve({});
    });

    const tool = toolRegistry.getTool('wpnav_introspect');
    const result = await tool!.handler({}, createMockContext(mockWpRequest));

    // Should not error
    expect(result.isError).toBeFalsy();

    const data = JSON.parse(result.content[0].text!);

    // Should still have introspect data
    expect(data.plugin.version).toBe('1.5.0');

    // Should have cookbooks, all with detected=false
    expect(data.available_cookbooks).toBeInstanceOf(Array);
    const allNotDetected = data.available_cookbooks.every((c: any) => c.detected === false);
    expect(allNotDetected).toBe(true);
  });

  it('should work with both bundled and project cookbooks', async () => {
    const mockWpRequest = vi.fn().mockImplementation((url: string) => {
      if (url.includes('introspect')) {
        return Promise.resolve({ plugin: { version: '1.5.0' } });
      }
      if (url.includes('plugins')) {
        return Promise.resolve([]);
      }
      return Promise.resolve({});
    });

    const tool = toolRegistry.getTool('wpnav_introspect');
    const result = await tool!.handler({}, createMockContext(mockWpRequest));
    const data = JSON.parse(result.content[0].text!);

    // Should have bundled cookbooks
    const slugs = data.available_cookbooks.map((c: any) => c.slug);
    expect(slugs).toContain('gutenberg');
    expect(slugs).toContain('elementor');
  });

  // =========================================================================
  // Roles Discovery Tests (task-86.11)
  // =========================================================================

  it('should include roles.available array in response', async () => {
    const mockWpRequest = vi.fn().mockImplementation((url: string) => {
      if (url.includes('introspect')) {
        return Promise.resolve({ plugin: { version: '1.5.0' } });
      }
      if (url.includes('plugins')) {
        return Promise.resolve([]);
      }
      if (url.includes('users/me')) {
        return Promise.resolve({ id: 1, roles: ['administrator'] });
      }
      return Promise.resolve({});
    });

    const tool = toolRegistry.getTool('wpnav_introspect');
    const result = await tool!.handler({}, createMockContext(mockWpRequest));
    const data = JSON.parse(result.content[0].text!);

    // Should have roles object
    expect(data.roles).toBeDefined();
    expect(data.roles.available).toBeInstanceOf(Array);
    expect(data.roles.available.length).toBeGreaterThanOrEqual(4);

    // Should include bundled roles
    expect(data.roles.available).toContain('content-editor');
    expect(data.roles.available).toContain('developer');
    expect(data.roles.available).toContain('seo-specialist');
    expect(data.roles.available).toContain('site-admin');
  });

  it('should include roles.recommended string in response', async () => {
    const mockWpRequest = vi.fn().mockImplementation((url: string) => {
      if (url.includes('introspect')) {
        return Promise.resolve({ plugin: { version: '1.5.0' } });
      }
      if (url.includes('plugins')) {
        return Promise.resolve([]);
      }
      if (url.includes('users/me')) {
        return Promise.resolve({ id: 1, roles: ['editor'] });
      }
      return Promise.resolve({});
    });

    const tool = toolRegistry.getTool('wpnav_introspect');
    const result = await tool!.handler({}, createMockContext(mockWpRequest));
    const data = JSON.parse(result.content[0].text!);

    expect(data.roles.recommended).toBeDefined();
    expect(typeof data.roles.recommended).toBe('string');
  });

  it('should recommend site-admin for administrator users', async () => {
    const mockWpRequest = vi.fn().mockImplementation((url: string) => {
      if (url.includes('introspect')) {
        return Promise.resolve({ plugin: { version: '1.5.0' } });
      }
      if (url.includes('plugins')) {
        return Promise.resolve([]);
      }
      if (url.includes('users/me')) {
        return Promise.resolve({ id: 1, roles: ['administrator'] });
      }
      return Promise.resolve({});
    });

    const tool = toolRegistry.getTool('wpnav_introspect');
    const result = await tool!.handler({}, createMockContext(mockWpRequest));
    const data = JSON.parse(result.content[0].text!);

    expect(data.roles.recommended).toBe('site-admin');
  });

  it('should recommend content-editor for editor users', async () => {
    const mockWpRequest = vi.fn().mockImplementation((url: string) => {
      if (url.includes('introspect')) {
        return Promise.resolve({ plugin: { version: '1.5.0' } });
      }
      if (url.includes('plugins')) {
        return Promise.resolve([]);
      }
      if (url.includes('users/me')) {
        return Promise.resolve({ id: 1, roles: ['editor'] });
      }
      return Promise.resolve({});
    });

    const tool = toolRegistry.getTool('wpnav_introspect');
    const result = await tool!.handler({}, createMockContext(mockWpRequest));
    const data = JSON.parse(result.content[0].text!);

    expect(data.roles.recommended).toBe('content-editor');
  });

  it('should recommend content-editor for author users', async () => {
    const mockWpRequest = vi.fn().mockImplementation((url: string) => {
      if (url.includes('introspect')) {
        return Promise.resolve({ plugin: { version: '1.5.0' } });
      }
      if (url.includes('plugins')) {
        return Promise.resolve([]);
      }
      if (url.includes('users/me')) {
        return Promise.resolve({ id: 1, roles: ['author'] });
      }
      return Promise.resolve({});
    });

    const tool = toolRegistry.getTool('wpnav_introspect');
    const result = await tool!.handler({}, createMockContext(mockWpRequest));
    const data = JSON.parse(result.content[0].text!);

    expect(data.roles.recommended).toBe('content-editor');
  });

  it('should default to content-editor when user fetch fails', async () => {
    const mockWpRequest = vi.fn().mockImplementation((url: string) => {
      if (url.includes('introspect')) {
        return Promise.resolve({ plugin: { version: '1.5.0' } });
      }
      if (url.includes('plugins')) {
        return Promise.resolve([]);
      }
      if (url.includes('users/me')) {
        return Promise.reject(new Error('Unauthorized'));
      }
      return Promise.resolve({});
    });

    const tool = toolRegistry.getTool('wpnav_introspect');
    const result = await tool!.handler({}, createMockContext(mockWpRequest));
    const data = JSON.parse(result.content[0].text!);

    // Should still have roles and default to content-editor
    expect(data.roles).toBeDefined();
    expect(data.roles.recommended).toBe('content-editor');
  });

  it('should include roles.count for quick reference', async () => {
    const mockWpRequest = vi.fn().mockImplementation((url: string) => {
      if (url.includes('introspect')) {
        return Promise.resolve({ plugin: { version: '1.5.0' } });
      }
      if (url.includes('plugins')) {
        return Promise.resolve([]);
      }
      if (url.includes('users/me')) {
        return Promise.resolve({ id: 1, roles: ['administrator'] });
      }
      return Promise.resolve({});
    });

    const tool = toolRegistry.getTool('wpnav_introspect');
    const result = await tool!.handler({}, createMockContext(mockWpRequest));
    const data = JSON.parse(result.content[0].text!);

    expect(data.roles.count).toBeDefined();
    expect(typeof data.roles.count).toBe('number');
    expect(data.roles.count).toBe(data.roles.available.length);
    expect(data.roles.count).toBeGreaterThanOrEqual(4);
  });
});

// =============================================================================
// wpnav_help Tests
// =============================================================================

describe('wpnav_help', () => {
  it('should return help text with quickstart info', async () => {
    const tool = toolRegistry.getTool('wpnav_help');
    expect(tool).toBeDefined();

    const result = await tool!.handler({}, createMockContext());

    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');

    const text = result.content[0].text!;
    expect(text).toContain('WP Navigator MCP');
    expect(text).toContain('Connected');
    expect(text).toContain('Quick Start');
  });
});

// =============================================================================
// wpnav_list_post_types Tests (task-86.2)
// =============================================================================

describe('wpnav_list_post_types', () => {
  it('should return array of post types from /wp/v2/types', async () => {
    const mockWpRequest = vi.fn().mockImplementation((url: string) => {
      if (url === '/wp/v2/types') {
        return Promise.resolve({
          post: {
            name: 'Posts',
            slug: 'post',
            description: 'Standard blog posts',
            hierarchical: false,
            rest_base: 'posts',
            rest_namespace: 'wp/v2',
          },
          page: {
            name: 'Pages',
            slug: 'page',
            description: 'Static pages',
            hierarchical: true,
            rest_base: 'pages',
            rest_namespace: 'wp/v2',
          },
          attachment: {
            name: 'Media',
            slug: 'attachment',
            description: '',
            hierarchical: false,
            rest_base: 'media',
            rest_namespace: 'wp/v2',
          },
        });
      }
      return Promise.resolve({});
    });

    const tool = toolRegistry.getTool('wpnav_list_post_types');
    expect(tool).toBeDefined();

    const result = await tool!.handler({}, createMockContext(mockWpRequest));

    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');

    const data = JSON.parse(result.content[0].text!);

    // Should be an array
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBe(3);

    // Should contain post type
    const postType = data.find((t: any) => t.slug === 'post');
    expect(postType).toBeDefined();
    expect(postType.name).toBe('Posts');
    expect(postType.hierarchical).toBe(false);
    expect(postType.rest_base).toBe('posts');

    // Should contain page type
    const pageType = data.find((t: any) => t.slug === 'page');
    expect(pageType).toBeDefined();
    expect(pageType.name).toBe('Pages');
    expect(pageType.hierarchical).toBe(true);
  });

  it('should include custom post types like products', async () => {
    const mockWpRequest = vi.fn().mockImplementation((url: string) => {
      if (url === '/wp/v2/types') {
        return Promise.resolve({
          post: { name: 'Posts', hierarchical: false, rest_base: 'posts' },
          page: { name: 'Pages', hierarchical: true, rest_base: 'pages' },
          product: {
            name: 'Products',
            slug: 'product',
            description: 'WooCommerce products',
            hierarchical: false,
            rest_base: 'products',
            rest_namespace: 'wc/v3',
          },
        });
      }
      return Promise.resolve({});
    });

    const tool = toolRegistry.getTool('wpnav_list_post_types');
    const result = await tool!.handler({}, createMockContext(mockWpRequest));
    const data = JSON.parse(result.content[0].text!);

    // Should contain custom product type
    const productType = data.find((t: any) => t.slug === 'product');
    expect(productType).toBeDefined();
    expect(productType.name).toBe('Products');
    expect(productType.rest_namespace).toBe('wc/v3');
  });

  it('should handle missing fields gracefully', async () => {
    const mockWpRequest = vi.fn().mockImplementation((url: string) => {
      if (url === '/wp/v2/types') {
        return Promise.resolve({
          post: {
            name: 'Posts',
            // Missing: description, hierarchical, rest_base, rest_namespace
          },
        });
      }
      return Promise.resolve({});
    });

    const tool = toolRegistry.getTool('wpnav_list_post_types');
    const result = await tool!.handler({}, createMockContext(mockWpRequest));
    const data = JSON.parse(result.content[0].text!);

    const postType = data.find((t: any) => t.slug === 'post');
    expect(postType).toBeDefined();
    expect(postType.description).toBeNull();
    expect(postType.hierarchical).toBe(false);
    expect(postType.rest_base).toBe('post'); // Falls back to slug
    expect(postType.rest_namespace).toBe('wp/v2'); // Default
  });

  it('supports summary_only parameter', async () => {
    const mockWpRequest = vi.fn().mockResolvedValue({
      post: { name: 'Posts', hierarchical: false, rest_base: 'posts' },
      page: { name: 'Pages', hierarchical: true, rest_base: 'pages' },
    });

    const tool = toolRegistry.getTool('wpnav_list_post_types');
    const result = await tool!.handler({ summary_only: true }, createMockContext(mockWpRequest));

    const data = JSON.parse(result.content[0].text!);
    expect(data).toHaveProperty('ai_summary');
    expect(typeof data.ai_summary).toBe('string');
    expect(data).toHaveProperty('full_count', 2);
    expect(data._meta.summary_only).toBe(true);
  });
});
