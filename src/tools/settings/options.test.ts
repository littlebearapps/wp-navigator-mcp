import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the tool registry before importing
vi.mock('../../tool-registry/index.js', () => ({
  toolRegistry: {
    register: vi.fn(),
  },
  ToolCategory: {
    SETTINGS: 'settings',
  },
}));

import { registerOptionsTools } from './options.js';
import { toolRegistry } from '../../tool-registry/index.js';

describe('Options Tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('registerOptionsTools', () => {
    it('registers wpnav_get_option tool', () => {
      registerOptionsTools();

      const calls = vi.mocked(toolRegistry.register).mock.calls;
      const getOption = calls.find((c) => c[0].definition.name === 'wpnav_get_option');

      expect(getOption).toBeDefined();
      expect(getOption![0].category).toBe('settings');
    });

    it('registers wpnav_set_option tool', () => {
      registerOptionsTools();

      const calls = vi.mocked(toolRegistry.register).mock.calls;
      const setOption = calls.find((c) => c[0].definition.name === 'wpnav_set_option');

      expect(setOption).toBeDefined();
      expect(setOption![0].category).toBe('settings');
    });
  });

  describe('wpnav_get_option handler', () => {
    it('calls wpRequest with correct endpoint', async () => {
      registerOptionsTools();

      const calls = vi.mocked(toolRegistry.register).mock.calls;
      const getOption = calls.find((c) => c[0].definition.name === 'wpnav_get_option');
      const handler = getOption![0].handler;

      const mockContext = {
        wpRequest: vi.fn().mockResolvedValue({ name: 'blogname', value: 'My Site' }),
        clampText: (t: string) => t,
        config: {},
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
      };

      await handler({ name: 'blogname' }, mockContext as any);

      expect(mockContext.wpRequest).toHaveBeenCalledWith('/wpnav/v1/options?name=blogname');
    });
  });

  describe('wpnav_set_option handler', () => {
    it('blocks options not matching allowed prefixes', async () => {
      registerOptionsTools();

      const calls = vi.mocked(toolRegistry.register).mock.calls;
      const setOption = calls.find((c) => c[0].definition.name === 'wpnav_set_option');
      const handler = setOption![0].handler;

      const mockContext = {
        wpRequest: vi.fn().mockResolvedValue({
          detected_plugins: [{ slug: 'woocommerce/woocommerce' }],
        }),
        clampText: (t: string) => t,
        config: {},
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
      };

      const result = await handler({ name: 'blogname', value: 'Hacked' }, mockContext as any);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('OPTION_NOT_ALLOWED');
    });

    it('allows options matching detected plugin prefixes', async () => {
      registerOptionsTools();

      const calls = vi.mocked(toolRegistry.register).mock.calls;
      const setOption = calls.find((c) => c[0].definition.name === 'wpnav_set_option');
      const handler = setOption![0].handler;

      const mockContext = {
        wpRequest: vi
          .fn()
          .mockResolvedValueOnce({ detected_plugins: [{ slug: 'woocommerce/woocommerce' }] })
          .mockResolvedValueOnce({ success: true }),
        clampText: (t: string) => t,
        config: {},
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
      };

      const result = await handler(
        { name: 'woocommerce_currency', value: 'USD' },
        mockContext as any
      );

      expect(result.isError).toBeFalsy();
      expect(mockContext.wpRequest).toHaveBeenCalledTimes(2);
    });
  });
});
