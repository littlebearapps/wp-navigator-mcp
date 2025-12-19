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

import { registerShortcodesTools } from './shortcodes.js';
import { toolRegistry } from '../../tool-registry/index.js';

describe('Shortcodes Tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('registerShortcodesTools', () => {
    it('registers wpnav_list_shortcodes tool', () => {
      registerShortcodesTools();

      const calls = vi.mocked(toolRegistry.register).mock.calls;
      const shortcodes = calls.find((c) => c[0].definition.name === 'wpnav_list_shortcodes');

      expect(shortcodes).toBeDefined();
      expect(shortcodes![0].category).toBe('discovery');
    });

    it('has correct input schema', () => {
      registerShortcodesTools();

      const calls = vi.mocked(toolRegistry.register).mock.calls;
      const shortcodes = calls.find((c) => c[0].definition.name === 'wpnav_list_shortcodes');
      const schema = shortcodes![0].definition.inputSchema;

      expect(schema.properties).toHaveProperty('search');
      expect(schema.properties).toHaveProperty('include_callback');
    });
  });

  describe('wpnav_list_shortcodes handler', () => {
    it('calls wpRequest with correct endpoint', async () => {
      registerShortcodesTools();

      const calls = vi.mocked(toolRegistry.register).mock.calls;
      const shortcodes = calls.find((c) => c[0].definition.name === 'wpnav_list_shortcodes');
      const handler = shortcodes![0].handler;

      const mockContext = {
        wpRequest: vi.fn().mockResolvedValue({
          shortcodes: [{ tag: 'gallery', callback: 'gallery_shortcode' }],
          total: 1,
        }),
        clampText: (t: string) => t,
        config: {},
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
      };

      await handler({}, mockContext as any);

      expect(mockContext.wpRequest).toHaveBeenCalledWith('/wpnav/v1/discovery/shortcodes');
    });

    it('passes search parameter correctly', async () => {
      registerShortcodesTools();

      const calls = vi.mocked(toolRegistry.register).mock.calls;
      const shortcodes = calls.find((c) => c[0].definition.name === 'wpnav_list_shortcodes');
      const handler = shortcodes![0].handler;

      const mockContext = {
        wpRequest: vi.fn().mockResolvedValue({ shortcodes: [], total: 0 }),
        clampText: (t: string) => t,
        config: {},
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
      };

      await handler({ search: 'gallery' }, mockContext as any);

      const calledUrl = mockContext.wpRequest.mock.calls[0][0];
      expect(calledUrl).toContain('search=gallery');
    });

    it('passes include_callback parameter correctly', async () => {
      registerShortcodesTools();

      const calls = vi.mocked(toolRegistry.register).mock.calls;
      const shortcodes = calls.find((c) => c[0].definition.name === 'wpnav_list_shortcodes');
      const handler = shortcodes![0].handler;

      const mockContext = {
        wpRequest: vi.fn().mockResolvedValue({ shortcodes: [], total: 0 }),
        clampText: (t: string) => t,
        config: {},
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
      };

      await handler({ include_callback: true }, mockContext as any);

      const calledUrl = mockContext.wpRequest.mock.calls[0][0];
      expect(calledUrl).toContain('include_callback=true');
    });
  });
});
