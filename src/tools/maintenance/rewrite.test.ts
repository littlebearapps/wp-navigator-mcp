import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the tool registry before importing
vi.mock('../../tool-registry/index.js', () => ({
  toolRegistry: {
    register: vi.fn(),
  },
  ToolCategory: {
    MAINTENANCE: 'maintenance',
  },
}));

import { registerRewriteTools } from './rewrite.js';
import { toolRegistry } from '../../tool-registry/index.js';

describe('Rewrite Tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('registerRewriteTools', () => {
    it('registers wpnav_get_rewrite_rules tool', () => {
      registerRewriteTools();

      const calls = vi.mocked(toolRegistry.register).mock.calls;
      const getRewriteRules = calls.find((c) => c[0].definition.name === 'wpnav_get_rewrite_rules');

      expect(getRewriteRules).toBeDefined();
      expect(getRewriteRules![0].category).toBe('maintenance');
    });

    it('registers wpnav_flush_rewrite tool', () => {
      registerRewriteTools();

      const calls = vi.mocked(toolRegistry.register).mock.calls;
      const flushRewrite = calls.find((c) => c[0].definition.name === 'wpnav_flush_rewrite');

      expect(flushRewrite).toBeDefined();
      expect(flushRewrite![0].category).toBe('maintenance');
    });
  });

  describe('wpnav_get_rewrite_rules handler', () => {
    it('calls wpRequest with correct endpoint', async () => {
      registerRewriteTools();

      const calls = vi.mocked(toolRegistry.register).mock.calls;
      const getRewriteRules = calls.find((c) => c[0].definition.name === 'wpnav_get_rewrite_rules');
      const handler = getRewriteRules![0].handler;

      const mockContext = {
        wpRequest: vi.fn().mockResolvedValue({
          rules: [],
          count: 0,
          permalink_structure: '/%postname%/',
        }),
        clampText: (t: string) => t,
        config: {},
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
      };

      await handler({}, mockContext as any);

      expect(mockContext.wpRequest).toHaveBeenCalledWith('/wpnav/v1/rewrite/rules');
    });

    it('returns rewrite rules response', async () => {
      registerRewriteTools();

      const calls = vi.mocked(toolRegistry.register).mock.calls;
      const getRewriteRules = calls.find((c) => c[0].definition.name === 'wpnav_get_rewrite_rules');
      const handler = getRewriteRules![0].handler;

      const mockResponse = {
        rules: [
          { pattern: '^feed/?$', query: 'index.php?&feed=feed' },
          { pattern: '^author/([^/]+)/?$', query: 'index.php?author_name=$matches[1]' },
        ],
        count: 150,
        permalink_structure: '/%postname%/',
        using_permalinks: true,
        using_index_permalinks: false,
        using_mod_rewrite_permalinks: true,
      };

      const mockContext = {
        wpRequest: vi.fn().mockResolvedValue(mockResponse),
        clampText: (t: string) => t,
        config: {},
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
      };

      const result = await handler({}, mockContext as any);

      expect(result.content).toHaveLength(1);
      expect(JSON.parse(result.content[0].text!)).toEqual(mockResponse);
    });
  });

  describe('wpnav_flush_rewrite handler', () => {
    it('calls wpRequest with POST and empty body by default', async () => {
      registerRewriteTools();

      const calls = vi.mocked(toolRegistry.register).mock.calls;
      const flushRewrite = calls.find((c) => c[0].definition.name === 'wpnav_flush_rewrite');
      const handler = flushRewrite![0].handler;

      const mockContext = {
        wpRequest: vi.fn().mockResolvedValue({ success: true }),
        clampText: (t: string) => t,
        config: {},
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
      };

      await handler({}, mockContext as any);

      expect(mockContext.wpRequest).toHaveBeenCalledWith('/wpnav/v1/rewrite/flush', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
    });

    it('includes hard parameter when provided', async () => {
      registerRewriteTools();

      const calls = vi.mocked(toolRegistry.register).mock.calls;
      const flushRewrite = calls.find((c) => c[0].definition.name === 'wpnav_flush_rewrite');
      const handler = flushRewrite![0].handler;

      const mockContext = {
        wpRequest: vi.fn().mockResolvedValue({ success: true }),
        clampText: (t: string) => t,
        config: {},
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
      };

      await handler({ hard: true }, mockContext as any);

      expect(mockContext.wpRequest).toHaveBeenCalledWith('/wpnav/v1/rewrite/flush', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hard: true }),
      });
    });

    it('handles hard=false parameter', async () => {
      registerRewriteTools();

      const calls = vi.mocked(toolRegistry.register).mock.calls;
      const flushRewrite = calls.find((c) => c[0].definition.name === 'wpnav_flush_rewrite');
      const handler = flushRewrite![0].handler;

      const mockContext = {
        wpRequest: vi.fn().mockResolvedValue({ success: true }),
        clampText: (t: string) => t,
        config: {},
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
      };

      await handler({ hard: false }, mockContext as any);

      expect(mockContext.wpRequest).toHaveBeenCalledWith('/wpnav/v1/rewrite/flush', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hard: false }),
      });
    });

    it('returns flush result with rule counts', async () => {
      registerRewriteTools();

      const calls = vi.mocked(toolRegistry.register).mock.calls;
      const flushRewrite = calls.find((c) => c[0].definition.name === 'wpnav_flush_rewrite');
      const handler = flushRewrite![0].handler;

      const mockResponse = {
        success: true,
        message: 'Rewrite rules flushed successfully',
        rules_before: 145,
        rules_after: 150,
        hard: false,
        permalink_structure: '/%postname%/',
      };

      const mockContext = {
        wpRequest: vi.fn().mockResolvedValue(mockResponse),
        clampText: (t: string) => t,
        config: {},
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
      };

      const result = await handler({}, mockContext as any);

      expect(result.content).toHaveLength(1);
      expect(JSON.parse(result.content[0].text!)).toEqual(mockResponse);
    });
  });
});
