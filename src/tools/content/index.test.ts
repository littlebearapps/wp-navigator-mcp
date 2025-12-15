/**
 * Content Tools Tests
 *
 * Tests for content MCP tools (wpnav_search).
 *
 * @package WP_Navigator_MCP
 * @since 2.6.0
 */

import { describe, it, expect, beforeAll, vi } from 'vitest';
import { toolRegistry, ToolCategory } from '../../tool-registry/index.js';
import { registerContentTools } from './index.js';
import type { ToolExecutionContext } from '../../tool-registry/types.js';

// Register tools once before all tests
beforeAll(() => {
  registerContentTools();
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
// wpnav_search Tests (task-86.3)
// =============================================================================

describe('wpnav_search', () => {
  it('should register wpnav_search tool', () => {
    const tool = toolRegistry.getTool('wpnav_search');
    expect(tool).toBeDefined();
    expect(tool?.category).toBe(ToolCategory.CONTENT);
  });

  it('should search posts, pages, and media by default', async () => {
    const mockWpRequest = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/wp/v2/posts?search=')) {
        return Promise.resolve([
          {
            id: 1,
            title: { rendered: 'Test Post' },
            link: 'https://test.local/post/1',
            modified: '2024-01-01',
          },
          {
            id: 2,
            title: { rendered: 'Another Test' },
            link: 'https://test.local/post/2',
            modified: '2024-01-02',
          },
        ]);
      }
      if (url.includes('/wp/v2/pages?search=')) {
        return Promise.resolve([
          {
            id: 10,
            title: { rendered: 'Test Page' },
            link: 'https://test.local/page/10',
            modified: '2024-01-01',
          },
        ]);
      }
      if (url.includes('/wp/v2/media?search=')) {
        return Promise.resolve([]);
      }
      return Promise.resolve([]);
    });

    const tool = toolRegistry.getTool('wpnav_search');
    expect(tool).toBeDefined();

    const result = await tool!.handler({ query: 'test' }, createMockContext(mockWpRequest));

    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');

    const data = JSON.parse(result.content[0].text!);

    expect(data.query).toBe('test');
    expect(data.total_results).toBe(3); // 2 posts + 1 page + 0 media
    expect(data.results.posts.count).toBe(2);
    expect(data.results.pages.count).toBe(1);
    expect(data.results.media.count).toBe(0);
  });

  it('should search only specified types', async () => {
    const mockWpRequest = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/wp/v2/users?search=')) {
        return Promise.resolve([{ id: 1, name: 'Admin', slug: 'admin' }]);
      }
      return Promise.resolve([]);
    });

    const tool = toolRegistry.getTool('wpnav_search');
    const result = await tool!.handler(
      { query: 'admin', types: ['users'] },
      createMockContext(mockWpRequest)
    );

    const data = JSON.parse(result.content[0].text!);

    expect(data.total_results).toBe(1);
    expect(data.results.users).toBeDefined();
    expect(data.results.users.count).toBe(1);
    expect(data.results.users.items[0].name).toBe('Admin');
    // Should not have posts, pages, media
    expect(data.results.posts).toBeUndefined();
    expect(data.results.pages).toBeUndefined();
    expect(data.results.media).toBeUndefined();
  });

  it('should respect per_page limit', async () => {
    const mockWpRequest = vi.fn().mockImplementation((url: string) => {
      // Verify per_page is in the URL
      expect(url).toContain('per_page=10');
      return Promise.resolve([]);
    });

    const tool = toolRegistry.getTool('wpnav_search');
    await tool!.handler({ query: 'test', per_page: 10 }, createMockContext(mockWpRequest));

    expect(mockWpRequest).toHaveBeenCalled();
  });

  it('should cap per_page at 20', async () => {
    const mockWpRequest = vi.fn().mockImplementation((url: string) => {
      // Should cap at 20 even if 100 requested
      expect(url).toContain('per_page=20');
      return Promise.resolve([]);
    });

    const tool = toolRegistry.getTool('wpnav_search');
    await tool!.handler({ query: 'test', per_page: 100 }, createMockContext(mockWpRequest));

    expect(mockWpRequest).toHaveBeenCalled();
  });

  it('should handle API errors gracefully', async () => {
    const mockWpRequest = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/wp/v2/posts')) {
        return Promise.reject(new Error('Connection failed'));
      }
      if (url.includes('/wp/v2/pages')) {
        return Promise.resolve([
          {
            id: 10,
            title: { rendered: 'Working Page' },
            link: 'https://test.local/page/10',
            modified: '2024-01-01',
          },
        ]);
      }
      return Promise.resolve([]);
    });

    const tool = toolRegistry.getTool('wpnav_search');
    const result = await tool!.handler({ query: 'test' }, createMockContext(mockWpRequest));

    // Should not error, should return empty for failed endpoint
    expect(result.isError).toBeFalsy();

    const data = JSON.parse(result.content[0].text!);
    expect(data.results.posts.count).toBe(0); // Failed endpoint returns empty
    expect(data.results.pages.count).toBe(1); // Working endpoint returns results
  });

  it('should require query parameter', async () => {
    const tool = toolRegistry.getTool('wpnav_search');

    await expect(tool!.handler({}, createMockContext())).rejects.toThrow(
      'Missing required fields: query'
    );
  });

  it('should encode query parameter for URL safety', async () => {
    const mockWpRequest = vi.fn().mockImplementation((url: string) => {
      // Should have encoded the space
      expect(url).toContain('search=hello%20world');
      return Promise.resolve([]);
    });

    const tool = toolRegistry.getTool('wpnav_search');
    await tool!.handler({ query: 'hello world' }, createMockContext(mockWpRequest));

    expect(mockWpRequest).toHaveBeenCalled();
  });

  it('should extract correct fields for content vs users', async () => {
    const mockWpRequest = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/wp/v2/posts')) {
        return Promise.resolve([
          {
            id: 1,
            title: { rendered: 'Post Title' },
            link: 'https://test.local/post/1',
            modified: '2024-01-01',
            content: { rendered: '<p>Should not be included</p>' },
          },
        ]);
      }
      if (url.includes('/wp/v2/users')) {
        return Promise.resolve([
          {
            id: 1,
            name: 'User Name',
            slug: 'user-name',
            email: 'user@test.local', // Should not be included
          },
        ]);
      }
      return Promise.resolve([]);
    });

    const tool = toolRegistry.getTool('wpnav_search');
    const result = await tool!.handler(
      { query: 'test', types: ['posts', 'users'] },
      createMockContext(mockWpRequest)
    );

    const data = JSON.parse(result.content[0].text!);

    // Posts should have content fields
    const post = data.results.posts.items[0];
    expect(post.id).toBe(1);
    expect(post['title.rendered']).toBe('Post Title');
    expect(post.link).toBe('https://test.local/post/1');
    expect(post['content.rendered']).toBeUndefined(); // Not extracted

    // Users should have user fields
    const user = data.results.users.items[0];
    expect(user.id).toBe(1);
    expect(user.name).toBe('User Name');
    expect(user.slug).toBe('user-name');
    expect(user.email).toBeUndefined(); // Not extracted
  });
});
