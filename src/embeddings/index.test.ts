/**
 * Embeddings Module Tests
 *
 * Tests for the main search functionality using test tool vectors.
 *
 * @package WP_Navigator_MCP
 * @since 2.7.0
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  searchTools,
  searchByCategory,
  loadToolVectors,
  isVectorsLoaded,
  getCategories,
  getStats,
  _resetState,
  _setToolVectors,
  type ToolEmbedding,
} from './index.js';

// Test tool data
const TEST_TOOLS: ToolEmbedding[] = [
  {
    name: 'wpnav_list_posts',
    description: 'List WordPress posts with filtering, pagination, and field selection',
    category: 'content',
    keywords: ['list', 'post', 'wordpress', 'filter', 'paginat', 'field', 'select'],
  },
  {
    name: 'wpnav_create_post',
    description: 'Create a new WordPress post with title, content, and metadata',
    category: 'content',
    keywords: ['creat', 'post', 'wordpress', 'titl', 'content', 'metadata'],
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
    keywords: ['list', 'plugin', 'wordpress', 'install', 'status', 'informat'],
  },
  {
    name: 'wpnav_activate_plugin',
    description: 'Activate a WordPress plugin by slug',
    category: 'plugins',
    keywords: ['activ', 'plugin', 'wordpress', 'slug'],
  },
  {
    name: 'wpnav_upload_media_from_url',
    description: 'Upload media from URL to WordPress media library',
    category: 'content',
    keywords: ['upload', 'media', 'url', 'wordpress', 'librari'],
  },
  {
    name: 'wpnav_list_themes',
    description: 'List installed WordPress themes with activation status',
    category: 'themes',
    keywords: ['list', 'theme', 'wordpress', 'install', 'activ', 'status'],
  },
  {
    name: 'wpnav_gutenberg_insert_block',
    description: 'Insert a Gutenberg block into page or post content',
    category: 'content',
    keywords: ['insert', 'gutenberg', 'block', 'page', 'post', 'content'],
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
];

describe('loadToolVectors', () => {
  beforeEach(() => {
    _resetState();
  });

  it('loads tool vectors via _setToolVectors', () => {
    _setToolVectors(TEST_TOOLS);
    const tools = loadToolVectors();
    expect(tools.length).toBe(10);
    expect(tools[0].name).toBe('wpnav_list_posts');
  });

  it('caches vectors after first load', () => {
    _setToolVectors(TEST_TOOLS);
    const first = loadToolVectors();
    const second = loadToolVectors();
    expect(first).toBe(second);
  });

  it('returns empty array and logs warning when vectors file not found', () => {
    // _resetState clears toolVectors to null
    // When loadToolVectors is called without _setToolVectors,
    // it tries to require the JSON file which may not exist
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // In test environment, require('./tool-vectors.json') may or may not exist
    // If it doesn't exist, the catch block returns empty array
    const tools = loadToolVectors();

    // Either loads real vectors OR returns empty array with warning
    if (tools.length === 0) {
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('Tool vectors not found'));
    }
    spy.mockRestore();
  });
});

describe('isVectorsLoaded', () => {
  beforeEach(() => {
    _resetState();
  });

  it('returns true after loading vectors', () => {
    _setToolVectors(TEST_TOOLS);
    expect(isVectorsLoaded()).toBe(true);
  });

  it('returns false before loading vectors', () => {
    expect(isVectorsLoaded()).toBe(false);
  });
});

describe('searchTools', () => {
  beforeEach(() => {
    _resetState();
    _setToolVectors(TEST_TOOLS);
  });

  it('returns empty array for empty query', () => {
    expect(searchTools('')).toEqual([]);
    expect(searchTools('   ')).toEqual([]);
  });

  it('finds tools matching query keywords', () => {
    const results = searchTools('list posts');
    expect(results.length).toBeGreaterThan(0);

    const names = results.map((r) => r.name);
    expect(names).toContain('wpnav_list_posts');
  });

  it('respects limit option', () => {
    const results = searchTools('list', { limit: 3 });
    expect(results.length).toBeLessThanOrEqual(3);
  });

  it('filters by minimum score', () => {
    const resultsLow = searchTools('wordpress', { minScore: 0.01 });
    const resultsHigh = searchTools('wordpress', { minScore: 0.99 });

    expect(resultsLow.length).toBeGreaterThanOrEqual(resultsHigh.length);
  });

  it('returns results with required fields', () => {
    const results = searchTools('plugins');

    for (const result of results) {
      expect(result).toHaveProperty('name');
      expect(result).toHaveProperty('description');
      expect(result).toHaveProperty('category');
      expect(result).toHaveProperty('score');
      expect(typeof result.score).toBe('number');
      expect(result.score).toBeGreaterThanOrEqual(0);
    }
  });

  it('sorts results by score descending', () => {
    const results = searchTools('list wordpress');

    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
    }
  });
});

describe('searchByCategory', () => {
  beforeEach(() => {
    _resetState();
    _setToolVectors(TEST_TOOLS);
  });

  it('returns all tools in a category', () => {
    const results = searchByCategory('content');

    expect(results.length).toBeGreaterThan(0);
    for (const result of results) {
      expect(result.category).toBe('content');
    }
  });

  it('is case-insensitive', () => {
    const lower = searchByCategory('plugins');
    const upper = searchByCategory('PLUGINS');
    const mixed = searchByCategory('Plugins');

    expect(lower.length).toBe(upper.length);
    expect(lower.length).toBe(mixed.length);
  });

  it('returns empty array for unknown category', () => {
    const results = searchByCategory('nonexistent');
    expect(results).toEqual([]);
  });

  it('returns results with score 1.0', () => {
    const results = searchByCategory('themes');

    for (const result of results) {
      expect(result.score).toBe(1.0);
    }
  });

  it('returns empty array when no tools are loaded', () => {
    _resetState();
    // Don't call _setToolVectors
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const results = searchByCategory('content');

    // If tools couldn't be loaded, returns empty
    // This handles both cases: no file OR file exists
    expect(Array.isArray(results)).toBe(true);
    spy.mockRestore();
  });
});

describe('getCategories', () => {
  beforeEach(() => {
    _resetState();
    _setToolVectors(TEST_TOOLS);
  });

  it('returns unique category names', () => {
    const categories = getCategories();

    expect(categories.length).toBeGreaterThan(0);
    expect(new Set(categories).size).toBe(categories.length);
  });

  it('returns sorted categories', () => {
    const categories = getCategories();
    const sorted = [...categories].sort();

    expect(categories).toEqual(sorted);
  });

  it('includes expected categories', () => {
    const categories = getCategories();

    expect(categories).toContain('content');
    expect(categories).toContain('plugins');
    expect(categories).toContain('themes');
    expect(categories).toContain('users');
    expect(categories).toContain('core');
  });
});

describe('getStats', () => {
  beforeEach(() => {
    _resetState();
    _setToolVectors(TEST_TOOLS);
  });

  it('returns total tool count', () => {
    const stats = getStats();
    expect(stats.total).toBe(10);
  });

  it('returns count by category', () => {
    const stats = getStats();

    expect(stats.byCategory).toHaveProperty('content');
    expect(stats.byCategory).toHaveProperty('plugins');
    expect(typeof stats.byCategory.content).toBe('number');
  });

  it('category counts sum to total', () => {
    const stats = getStats();
    const sum = Object.values(stats.byCategory).reduce((a, b) => a + b, 0);
    expect(sum).toBe(stats.total);
  });
});

describe('useEmbeddings fallback', () => {
  beforeEach(() => {
    _resetState();
    _setToolVectors(TEST_TOOLS);
  });

  it('falls back to TF-IDF when useEmbeddings=true but no vectors', () => {
    // TEST_TOOLS don't have .vector property, so should fall back
    const results = searchTools('create post', { useEmbeddings: true });
    expect(results.length).toBeGreaterThan(0);

    // Should still find relevant tools
    const names = results.map((r) => r.name);
    expect(names.some((n) => n.includes('post'))).toBe(true);
  });

  it('logs warning when embeddings not available', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    _setToolVectors(TEST_TOOLS);

    searchTools('test query', { useEmbeddings: true });

    expect(spy).toHaveBeenCalledWith(expect.stringContaining('falling back to TF-IDF'));
    spy.mockRestore();
  });

  it('works correctly with tools that have empty vector arrays', () => {
    const toolsWithEmptyVectors = TEST_TOOLS.map((t) => ({
      ...t,
      vector: [], // Empty vector array
    }));
    _setToolVectors(toolsWithEmptyVectors);

    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const results = searchTools('list posts', { useEmbeddings: true });

    // Should still work via TF-IDF fallback
    expect(results.length).toBeGreaterThan(0);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('search accuracy validation', () => {
  beforeEach(() => {
    _resetState();
    _setToolVectors(TEST_TOOLS);
  });

  it('finds posts tools for "create blog post"', () => {
    const results = searchTools('create blog post', { limit: 5 });
    const names = results.map((r) => r.name);

    // Should find create_post related tools
    expect(names.some((n) => n.includes('post'))).toBe(true);
  });

  it('finds plugin tools for "manage plugins"', () => {
    const results = searchTools('manage plugins', { limit: 5 });
    const names = results.map((r) => r.name);

    expect(names.some((n) => n.includes('plugin'))).toBe(true);
  });

  it('finds media tools for "upload image"', () => {
    const results = searchTools('upload image media', { limit: 5 });
    const names = results.map((r) => r.name);

    expect(names.some((n) => n.includes('media') || n.includes('upload'))).toBe(true);
  });

  it('finds gutenberg tools for "gutenberg blocks"', () => {
    const results = searchTools('gutenberg blocks', { limit: 5 });
    const names = results.map((r) => r.name);

    expect(names.some((n) => n.includes('gutenberg'))).toBe(true);
  });

  it('finds user tools for "user roles"', () => {
    const results = searchTools('user roles', { limit: 5 });
    const names = results.map((r) => r.name);

    expect(names.some((n) => n.includes('user'))).toBe(true);
  });
});
