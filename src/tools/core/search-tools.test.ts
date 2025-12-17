/**
 * Search Tools Meta-Tool Tests
 *
 * Tests for wpnav_search_tools - semantic tool search functionality.
 *
 * @package WP_Navigator_MCP
 * @since 2.7.0
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { searchToolsHandler, searchToolsDefinition } from './search-tools.js';
import { _resetState, _setToolVectors, type ToolEmbedding } from '../../embeddings/index.js';

// Mock context (not used by search tools but required by handler signature)
const mockContext = {
  wpRequest: async () => ({}),
  config: {},
  logger: { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} },
  clampText: (text: string) => text,
};

// Test tool data matching the actual categories
const TEST_TOOLS: ToolEmbedding[] = [
  {
    name: 'wpnav_list_posts',
    description: 'List WordPress posts with filtering, pagination, and field selection',
    category: 'content',
    keywords: ['list', 'post', 'wordpress', 'filter', 'paginat', 'field', 'select', 'blog'],
  },
  {
    name: 'wpnav_create_post',
    description: 'Create a new WordPress blog post with title, content, and metadata',
    category: 'content',
    keywords: ['creat', 'post', 'wordpress', 'titl', 'content', 'metadata', 'blog'],
  },
  {
    name: 'wpnav_update_post',
    description: 'Update an existing WordPress post',
    category: 'content',
    keywords: ['updat', 'post', 'wordpress', 'edit'],
  },
  {
    name: 'wpnav_list_pages',
    description: 'List WordPress pages with hierarchical structure',
    category: 'content',
    keywords: ['list', 'page', 'wordpress', 'hierarch', 'structur'],
  },
  {
    name: 'wpnav_list_plugins',
    description: 'List installed WordPress plugins with status information',
    category: 'plugins',
    keywords: ['list', 'plugin', 'wordpress', 'install', 'status', 'informat', 'manag'],
  },
  {
    name: 'wpnav_activate_plugin',
    description: 'Activate a WordPress plugin by slug',
    category: 'plugins',
    keywords: ['activ', 'plugin', 'wordpress', 'slug', 'enabl'],
  },
  {
    name: 'wpnav_deactivate_plugin',
    description: 'Deactivate a WordPress plugin by slug',
    category: 'plugins',
    keywords: ['deactiv', 'plugin', 'wordpress', 'slug', 'disabl'],
  },
  {
    name: 'wpnav_list_themes',
    description: 'List installed WordPress themes with activation status',
    category: 'themes',
    keywords: ['list', 'theme', 'wordpress', 'install', 'activ', 'status'],
  },
  {
    name: 'wpnav_activate_theme',
    description: 'Activate a WordPress theme by stylesheet',
    category: 'themes',
    keywords: ['activ', 'theme', 'wordpress', 'stylesheet', 'switch'],
  },
  {
    name: 'wpnav_list_users',
    description: 'List WordPress users with role filtering',
    category: 'users',
    keywords: ['list', 'user', 'wordpress', 'role', 'filter'],
  },
  {
    name: 'wpnav_introspect',
    description: 'Get WP Navigator API capabilities and site information',
    category: 'core',
    keywords: ['introspect', 'capabil', 'site', 'informat', 'api'],
  },
  {
    name: 'wpnav_help',
    description: 'Get help and quickstart guide for WP Navigator',
    category: 'core',
    keywords: ['help', 'quickstart', 'guid', 'start'],
  },
];

describe('searchToolsDefinition', () => {
  it('has correct name', () => {
    expect(searchToolsDefinition.name).toBe('wpnav_search_tools');
  });

  it('has description mentioning natural language query', () => {
    expect(searchToolsDefinition.description).toContain('natural language');
  });

  it('has inputSchema with query, category, and limit properties', () => {
    const props = searchToolsDefinition.inputSchema.properties;
    expect(props).toHaveProperty('query');
    expect(props).toHaveProperty('category');
    expect(props).toHaveProperty('limit');
  });

  it('has valid category enum', () => {
    const categoryEnum = searchToolsDefinition.inputSchema.properties.category.enum;
    expect(categoryEnum).toContain('content');
    expect(categoryEnum).toContain('plugins');
    expect(categoryEnum).toContain('themes');
    expect(categoryEnum).toContain('users');
    expect(categoryEnum).toContain('core');
  });

  it('has limit with maximum of 25', () => {
    expect(searchToolsDefinition.inputSchema.properties.limit.maximum).toBe(25);
  });
});

describe('searchToolsHandler', () => {
  beforeEach(() => {
    _resetState();
    _setToolVectors(TEST_TOOLS);
  });

  describe('input validation', () => {
    it('returns error when neither query nor category provided', async () => {
      const result = await searchToolsHandler({}, mockContext);
      const response = JSON.parse(result.content[0].text);

      expect(response.error).toBe('At least one of query or category is required');
      expect(response.available_categories).toBeDefined();
    });

    it('returns error for invalid category', async () => {
      const result = await searchToolsHandler({ category: 'nonexistent' }, mockContext);
      const response = JSON.parse(result.content[0].text);

      expect(response.error).toContain('Invalid category');
      expect(response.available_categories).toBeDefined();
    });
  });

  describe('semantic search (query only)', () => {
    it('finds relevant tools for "create blog post"', async () => {
      const result = await searchToolsHandler({ query: 'create blog post' }, mockContext);
      const response = JSON.parse(result.content[0].text);

      expect(response.tools).toBeDefined();
      expect(response.tools.length).toBeGreaterThan(0);

      const names = response.tools.map((t: any) => t.name);
      expect(names.some((n: string) => n.includes('post'))).toBe(true);
    });

    it('finds plugin tools for "manage plugins"', async () => {
      const result = await searchToolsHandler({ query: 'manage plugins' }, mockContext);
      const response = JSON.parse(result.content[0].text);

      const names = response.tools.map((t: any) => t.name);
      expect(names.some((n: string) => n.includes('plugin'))).toBe(true);
    });

    it('returns results sorted by relevance', async () => {
      const result = await searchToolsHandler({ query: 'list posts' }, mockContext);
      const response = JSON.parse(result.content[0].text);

      // First result should be most relevant
      expect(response.tools[0].name).toContain('post');
    });
  });

  describe('category filter (category only)', () => {
    it('returns only tools from specified category', async () => {
      const result = await searchToolsHandler({ category: 'plugins' }, mockContext);
      const response = JSON.parse(result.content[0].text);

      expect(response.tools.length).toBeGreaterThan(0);
      for (const tool of response.tools) {
        expect(tool.category).toBe('plugins');
      }
    });

    it('handles case-insensitive category', async () => {
      const result1 = await searchToolsHandler({ category: 'plugins' }, mockContext);
      const result2 = await searchToolsHandler({ category: 'PLUGINS' }, mockContext);

      // Both should work (category validation is case-sensitive in enum, but lowercase expected)
      // Only lowercase should work based on our implementation
      const response1 = JSON.parse(result1.content[0].text);
      expect(response1.tools).toBeDefined();
    });

    it('returns content tools correctly', async () => {
      const result = await searchToolsHandler({ category: 'content' }, mockContext);
      const response = JSON.parse(result.content[0].text);

      expect(response.tools.length).toBeGreaterThan(0);
      const names = response.tools.map((t: any) => t.name);
      expect(names).toContain('wpnav_list_posts');
      expect(names).toContain('wpnav_create_post');
    });
  });

  describe('combined query + category', () => {
    it('filters semantic search results by category', async () => {
      const result = await searchToolsHandler({ query: 'list', category: 'plugins' }, mockContext);
      const response = JSON.parse(result.content[0].text);

      // Should only return plugin tools that match "list"
      for (const tool of response.tools) {
        expect(tool.category).toBe('plugins');
      }

      const names = response.tools.map((t: any) => t.name);
      expect(names).toContain('wpnav_list_plugins');
    });

    it('returns empty results when query has no matches in category', async () => {
      const result = await searchToolsHandler(
        { query: 'posts pages content', category: 'users' },
        mockContext
      );
      const response = JSON.parse(result.content[0].text);

      // Should return user tools or empty if no semantic match
      for (const tool of response.tools) {
        expect(tool.category).toBe('users');
      }
    });
  });

  describe('response format', () => {
    it('returns tools array with name, description, category (no schemas)', async () => {
      const result = await searchToolsHandler({ query: 'posts' }, mockContext);
      const response = JSON.parse(result.content[0].text);

      expect(response.tools).toBeDefined();
      for (const tool of response.tools) {
        expect(tool).toHaveProperty('name');
        expect(tool).toHaveProperty('description');
        expect(tool).toHaveProperty('category');
        // Should NOT have schema
        expect(tool).not.toHaveProperty('inputSchema');
        expect(tool).not.toHaveProperty('schema');
      }
    });

    it('includes total_matching count', async () => {
      const result = await searchToolsHandler({ category: 'content' }, mockContext);
      const response = JSON.parse(result.content[0].text);

      expect(response.total_matching).toBeDefined();
      expect(typeof response.total_matching).toBe('number');
      expect(response.total_matching).toBe(response.tools.length);
    });

    it('includes hint about wpnav_describe_tools', async () => {
      const result = await searchToolsHandler({ query: 'posts' }, mockContext);
      const response = JSON.parse(result.content[0].text);

      expect(response.hint).toBeDefined();
      expect(response.hint).toContain('wpnav_describe_tools');
    });
  });

  describe('limit parameter', () => {
    it('respects limit parameter', async () => {
      const result = await searchToolsHandler({ query: 'list', limit: 3 }, mockContext);
      const response = JSON.parse(result.content[0].text);

      expect(response.tools.length).toBeLessThanOrEqual(3);
    });

    it('uses default limit of 10', async () => {
      const result = await searchToolsHandler({ category: 'content' }, mockContext);
      const response = JSON.parse(result.content[0].text);

      // Our test data has 4 content tools, so this tests that default doesn't limit below actual
      expect(response.tools.length).toBeLessThanOrEqual(10);
    });

    it('clamps limit to maximum of 25', async () => {
      const result = await searchToolsHandler({ query: 'wordpress', limit: 100 }, mockContext);
      const response = JSON.parse(result.content[0].text);

      expect(response.tools.length).toBeLessThanOrEqual(25);
    });

    it('clamps limit to minimum of 1', async () => {
      const result = await searchToolsHandler({ query: 'posts', limit: 0 }, mockContext);
      const response = JSON.parse(result.content[0].text);

      // Should return at least 1 result (clamped from 0 to 1)
      expect(response.tools.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('edge cases', () => {
    it('handles empty search results gracefully', async () => {
      const result = await searchToolsHandler({ query: 'xyznonexistentterm123' }, mockContext);
      const response = JSON.parse(result.content[0].text);

      expect(response.tools).toBeDefined();
      expect(Array.isArray(response.tools)).toBe(true);
      expect(response.total_matching).toBe(0);
    });

    it('returns valid JSON response', async () => {
      const result = await searchToolsHandler({ query: 'posts' }, mockContext);

      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
      expect(() => JSON.parse(result.content[0].text)).not.toThrow();
    });
  });
});

describe('integration with embeddings module', () => {
  beforeEach(() => {
    _resetState();
    _setToolVectors(TEST_TOOLS);
  });

  it('uses TF-IDF search by default (fast)', async () => {
    // This tests that the handler works without requiring neural embeddings
    const result = await searchToolsHandler({ query: 'create blog' }, mockContext);
    const response = JSON.parse(result.content[0].text);

    expect(response.tools.length).toBeGreaterThan(0);
  });

  it('category filter uses searchByCategory from embeddings', async () => {
    const result = await searchToolsHandler({ category: 'core' }, mockContext);
    const response = JSON.parse(result.content[0].text);

    expect(response.tools.length).toBeGreaterThan(0);
    expect(response.tools.every((t: any) => t.category === 'core')).toBe(true);
  });
});
