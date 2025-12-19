import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the tool registry before importing
vi.mock('../../tool-registry/index.js', () => ({
  toolRegistry: {
    register: vi.fn(),
  },
  ToolCategory: {
    ANALYTICS: 'analytics',
  },
}));

import { registerStatisticsTools } from './statistics.js';
import { toolRegistry } from '../../tool-registry/index.js';

describe('Statistics Tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('registerStatisticsTools', () => {
    it('registers wpnav_site_statistics tool', () => {
      registerStatisticsTools();

      const calls = vi.mocked(toolRegistry.register).mock.calls;
      const siteStatistics = calls.find((c) => c[0].definition.name === 'wpnav_site_statistics');

      expect(siteStatistics).toBeDefined();
      expect(siteStatistics![0].category).toBe('analytics');
    });

    it('has correct input schema with no required properties', () => {
      registerStatisticsTools();

      const calls = vi.mocked(toolRegistry.register).mock.calls;
      const siteStatistics = calls.find((c) => c[0].definition.name === 'wpnav_site_statistics');

      const schema = siteStatistics![0].definition.inputSchema;
      expect(schema.type).toBe('object');
      expect(schema.required).toEqual([]);
    });
  });

  describe('wpnav_site_statistics handler', () => {
    it('calls wpRequest with correct endpoint', async () => {
      registerStatisticsTools();

      const calls = vi.mocked(toolRegistry.register).mock.calls;
      const siteStatistics = calls.find((c) => c[0].definition.name === 'wpnav_site_statistics');
      const handler = siteStatistics![0].handler;

      const mockContext = {
        wpRequest: vi.fn().mockResolvedValue({
          posts: { total: 42, published: 35, draft: 7 },
          pages: { total: 10, published: 8, draft: 2 },
        }),
        clampText: (t: string) => t,
        config: {},
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
      };

      await handler({}, mockContext as any);

      expect(mockContext.wpRequest).toHaveBeenCalledWith('/wpnav/v1/statistics');
    });

    it('returns formatted JSON result', async () => {
      registerStatisticsTools();

      const calls = vi.mocked(toolRegistry.register).mock.calls;
      const siteStatistics = calls.find((c) => c[0].definition.name === 'wpnav_site_statistics');
      const handler = siteStatistics![0].handler;

      const mockResponse = {
        posts: { total: 42, published: 35, draft: 7 },
        pages: { total: 10, published: 8, draft: 2 },
        users: { total: 5, by_role: { administrator: 1, editor: 2, subscriber: 2 } },
        comments: { total: 150, approved: 120, pending: 30 },
        media: { total: 200, images: 150, videos: 20, documents: 30 },
        terms: { categories: 15, tags: 50 },
      };

      const mockContext = {
        wpRequest: vi.fn().mockResolvedValue(mockResponse),
        clampText: (t: string) => t,
        config: {},
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
      };

      const result = await handler({}, mockContext as any);

      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
      expect(JSON.parse(result.content[0].text!)).toEqual(mockResponse);
    });

    it('uses clampText for output', async () => {
      registerStatisticsTools();

      const calls = vi.mocked(toolRegistry.register).mock.calls;
      const siteStatistics = calls.find((c) => c[0].definition.name === 'wpnav_site_statistics');
      const handler = siteStatistics![0].handler;

      const mockContext = {
        wpRequest: vi.fn().mockResolvedValue({ posts: { total: 1 } }),
        clampText: vi.fn().mockReturnValue('clamped'),
        config: {},
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
      };

      const result = await handler({}, mockContext as any);

      expect(mockContext.clampText).toHaveBeenCalled();
      expect(result.content[0].text).toBe('clamped');
    });
  });
});
