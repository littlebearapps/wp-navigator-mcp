import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the tool registry before importing
vi.mock('../../tool-registry/index.js', () => ({
  toolRegistry: {
    register: vi.fn(),
  },
  ToolCategory: {
    DISCOVERY: 'discovery',
  },
}));

import { registerBlockPatternsTools } from './block-patterns.js';
import { toolRegistry } from '../../tool-registry/index.js';

describe('Block Patterns Tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('registerBlockPatternsTools', () => {
    it('registers wpnav_list_block_patterns tool', () => {
      registerBlockPatternsTools();

      const calls = vi.mocked(toolRegistry.register).mock.calls;
      const patterns = calls.find((c) => c[0].definition.name === 'wpnav_list_block_patterns');

      expect(patterns).toBeDefined();
      expect(patterns![0].category).toBe('discovery');
    });

    it('has correct input schema', () => {
      registerBlockPatternsTools();

      const calls = vi.mocked(toolRegistry.register).mock.calls;
      const patterns = calls.find((c) => c[0].definition.name === 'wpnav_list_block_patterns');
      const schema = patterns![0].definition.inputSchema;

      expect(schema.properties).toHaveProperty('category');
      expect(schema.properties).toHaveProperty('search');
      expect(schema.properties).toHaveProperty('include_content');
    });
  });

  describe('wpnav_list_block_patterns handler', () => {
    it('calls wpRequest with correct endpoint', async () => {
      registerBlockPatternsTools();

      const calls = vi.mocked(toolRegistry.register).mock.calls;
      const patterns = calls.find((c) => c[0].definition.name === 'wpnav_list_block_patterns');
      const handler = patterns![0].handler;

      const mockContext = {
        wpRequest: vi.fn().mockResolvedValue({
          patterns: [{ name: 'core/query', title: 'Query Loop' }],
          total: 1,
        }),
        clampText: (t: string) => t,
        config: {},
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
      };

      await handler({}, mockContext as any);

      expect(mockContext.wpRequest).toHaveBeenCalledWith('/wpnav/v1/discovery/patterns');
    });

    it('passes category filter correctly', async () => {
      registerBlockPatternsTools();

      const calls = vi.mocked(toolRegistry.register).mock.calls;
      const patterns = calls.find((c) => c[0].definition.name === 'wpnav_list_block_patterns');
      const handler = patterns![0].handler;

      const mockContext = {
        wpRequest: vi.fn().mockResolvedValue({ patterns: [], total: 0 }),
        clampText: (t: string) => t,
        config: {},
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
      };

      await handler({ category: 'header', search: 'hero' }, mockContext as any);

      const calledUrl = mockContext.wpRequest.mock.calls[0][0];
      expect(calledUrl).toContain('category=header');
      expect(calledUrl).toContain('search=hero');
    });

    it('passes include_content parameter correctly', async () => {
      registerBlockPatternsTools();

      const calls = vi.mocked(toolRegistry.register).mock.calls;
      const patterns = calls.find((c) => c[0].definition.name === 'wpnav_list_block_patterns');
      const handler = patterns![0].handler;

      const mockContext = {
        wpRequest: vi.fn().mockResolvedValue({ patterns: [], total: 0 }),
        clampText: (t: string) => t,
        config: {},
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
      };

      await handler({ include_content: true }, mockContext as any);

      const calledUrl = mockContext.wpRequest.mock.calls[0][0];
      expect(calledUrl).toContain('include_content=true');
    });
  });
});
