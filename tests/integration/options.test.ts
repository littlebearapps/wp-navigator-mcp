/**
 * Options Tools Integration Tests
 *
 * Tests wpnav_get_option and wpnav_set_option with mocked WordPress REST responses.
 *
 * @package WP_Navigator_Pro
 * @since 2.8.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Don't mock the registry - test through actual registration
import { toolRegistry } from '../../src/tool-registry/index.js';
import { registerOptionsTools } from '../../src/tools/settings/options.js';

describe('Options Tools Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Register tools fresh for each test
    registerOptionsTools();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * Helper to create a mock context with wpRequest
   */
  function createMockContext(responses: any[]) {
    let callIndex = 0;
    return {
      wpRequest: vi.fn().mockImplementation(() => {
        const response = responses[callIndex];
        callIndex++;
        return Promise.resolve(response);
      }),
      clampText: (text: string) => text,
    };
  }

  describe('wpnav_get_option', () => {
    it('returns option value when exists', async () => {
      const mockContext = createMockContext([
        { name: 'blogname', value: 'My WordPress Site', autoload: 'yes' },
      ]);

      const tool = toolRegistry.getTool('wpnav_get_option');
      expect(tool).toBeDefined();

      const result = await tool!.handler({ name: 'blogname' }, mockContext);

      expect(result.content[0].type).toBe('text');
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.value).toBe('My WordPress Site');
    });

    it('passes default parameter when provided', async () => {
      const mockContext = createMockContext([
        { name: 'missing_option', value: 'fallback-value', exists: false },
      ]);

      const tool = toolRegistry.getTool('wpnav_get_option');
      await tool!.handler({ name: 'missing_option', default: 'fallback-value' }, mockContext);

      expect(mockContext.wpRequest).toHaveBeenCalledWith(expect.stringContaining('default='));
    });

    it('requires name parameter', async () => {
      const mockContext = createMockContext([]);
      const tool = toolRegistry.getTool('wpnav_get_option');

      await expect(tool!.handler({}, mockContext)).rejects.toThrow();
    });
  });

  describe('wpnav_set_option', () => {
    it('allows options with detected plugin prefix', async () => {
      const mockContext = createMockContext([
        // First call: introspect for allowed prefixes
        { detected_plugins: [{ slug: 'woocommerce/woocommerce' }] },
        // Second call: set option
        { success: true, name: 'woocommerce_currency', value: 'USD' },
      ]);

      const tool = toolRegistry.getTool('wpnav_set_option');
      const result = await tool!.handler(
        { name: 'woocommerce_currency', value: 'USD' },
        mockContext
      );

      expect(result.isError).toBeFalsy();
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.success).toBe(true);
    });

    it('blocks core WordPress options', async () => {
      const mockContext = createMockContext([
        { detected_plugins: [{ slug: 'woocommerce/woocommerce' }] },
      ]);

      const tool = toolRegistry.getTool('wpnav_set_option');
      const result = await tool!.handler(
        { name: 'siteurl', value: 'https://malicious.com' },
        mockContext
      );

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('OPTION_NOT_ALLOWED');
    });

    it('blocks options not matching any plugin prefix', async () => {
      const mockContext = createMockContext([
        { detected_plugins: [{ slug: 'woocommerce/woocommerce' }] },
      ]);

      const tool = toolRegistry.getTool('wpnav_set_option');
      const result = await tool!.handler({ name: 'random_option', value: 'test' }, mockContext);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('OPTION_NOT_ALLOWED');
      expect(result.content[0].text).toContain('allowed_prefixes');
    });

    it('handles hyphenated plugin slugs', async () => {
      const mockContext = createMockContext([
        { detected_plugins: [{ slug: 'yoast-seo/yoast.php' }] },
        { success: true },
      ]);

      const tool = toolRegistry.getTool('wpnav_set_option');
      const result = await tool!.handler(
        { name: 'yoast_seo_setting', value: 'enabled' },
        mockContext
      );

      expect(result.isError).toBeFalsy();
    });

    it('supports autoload parameter', async () => {
      const mockContext = createMockContext([
        { detected_plugins: [{ slug: 'elementor/elementor.php' }] },
        { success: true },
      ]);

      const tool = toolRegistry.getTool('wpnav_set_option');
      await tool!.handler({ name: 'elementor_settings', value: {}, autoload: false }, mockContext);

      // Check that POST body includes autoload
      const postCall = mockContext.wpRequest.mock.calls[1];
      expect(postCall[1].body).toContain('"autoload":false');
    });

    it('requires name and value parameters', async () => {
      const mockContext = createMockContext([]);
      const tool = toolRegistry.getTool('wpnav_set_option');

      await expect(tool!.handler({ name: 'test' }, mockContext)).rejects.toThrow();
      await expect(tool!.handler({ value: 'test' }, mockContext)).rejects.toThrow();
    });
  });
});
