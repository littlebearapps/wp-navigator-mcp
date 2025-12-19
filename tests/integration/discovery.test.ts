/**
 * Discovery Tools Integration Tests
 *
 * Tests wpnav_list_rest_routes, wpnav_list_shortcodes, wpnav_list_block_patterns,
 * and wpnav_list_block_templates with mocked WordPress REST responses.
 *
 * @package WP_Navigator_Pro
 * @since 2.8.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { toolRegistry } from '../../src/tool-registry/index.js';
import { registerRestRoutesTools } from '../../src/tools/discovery/rest-routes.js';
import { registerShortcodesTools } from '../../src/tools/discovery/shortcodes.js';
import { registerBlockPatternsTools } from '../../src/tools/discovery/block-patterns.js';
import { registerBlockTemplatesTools } from '../../src/tools/discovery/block-templates.js';

describe('Discovery Tools Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Register all discovery tools
    registerRestRoutesTools();
    registerShortcodesTools();
    registerBlockPatternsTools();
    registerBlockTemplatesTools();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * Helper to create a mock context with wpRequest
   */
  function createMockContext(response: any) {
    return {
      wpRequest: vi.fn().mockResolvedValue(response),
      clampText: (text: string) => text,
    };
  }

  describe('wpnav_list_rest_routes', () => {
    it('returns all routes without filters', async () => {
      const mockContext = createMockContext({
        routes: [
          { route: '/wp/v2/posts', methods: ['GET', 'POST'] },
          { route: '/wp/v2/pages', methods: ['GET', 'POST'] },
          { route: '/wpnav/v1/introspect', methods: ['GET'] },
        ],
        total: 3,
      });

      const tool = toolRegistry.getTool('wpnav_list_rest_routes');
      expect(tool).toBeDefined();

      const result = await tool!.handler({}, mockContext);

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.routes).toHaveLength(3);
      expect(parsed.total).toBe(3);
    });

    it('filters by namespace', async () => {
      const mockContext = createMockContext({
        routes: [{ route: '/wpnav/v1/introspect', methods: ['GET'] }],
      });

      const tool = toolRegistry.getTool('wpnav_list_rest_routes');
      await tool!.handler({ namespace: 'wpnav/v1' }, mockContext);

      expect(mockContext.wpRequest).toHaveBeenCalledWith(
        expect.stringContaining('namespace=wpnav%2Fv1')
      );
    });

    it('includes methods by default', async () => {
      const mockContext = createMockContext({
        routes: [{ route: '/wp/v2/posts', methods: ['GET', 'POST', 'PUT', 'DELETE'] }],
      });

      const tool = toolRegistry.getTool('wpnav_list_rest_routes');
      const result = await tool!.handler({}, mockContext);

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.routes[0].methods).toContain('GET');
      expect(parsed.routes[0].methods).toContain('POST');
    });

    it('supports include_args flag', async () => {
      const mockContext = createMockContext({
        routes: [
          {
            route: '/wp/v2/posts',
            methods: ['GET'],
            args: { per_page: { type: 'integer', default: 10 } },
          },
        ],
      });

      const tool = toolRegistry.getTool('wpnav_list_rest_routes');
      await tool!.handler({ include_args: true }, mockContext);

      expect(mockContext.wpRequest).toHaveBeenCalledWith(
        expect.stringContaining('include_args=true')
      );
    });
  });

  describe('wpnav_list_shortcodes', () => {
    it('returns all shortcodes', async () => {
      const mockContext = createMockContext({
        shortcodes: [
          { tag: 'gallery', callback: 'gallery_shortcode' },
          { tag: 'caption', callback: 'img_caption_shortcode' },
          { tag: 'woocommerce_cart', callback: 'WC_Shortcodes::cart' },
        ],
        total: 3,
      });

      const tool = toolRegistry.getTool('wpnav_list_shortcodes');
      expect(tool).toBeDefined();

      const result = await tool!.handler({}, mockContext);

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.shortcodes).toHaveLength(3);
    });

    it('searches shortcode names', async () => {
      const mockContext = createMockContext({
        shortcodes: [{ tag: 'gallery', callback: 'gallery_shortcode' }],
      });

      const tool = toolRegistry.getTool('wpnav_list_shortcodes');
      await tool!.handler({ search: 'gallery' }, mockContext);

      expect(mockContext.wpRequest).toHaveBeenCalledWith(expect.stringContaining('search=gallery'));
    });

    it('includes callback info when requested', async () => {
      const mockContext = createMockContext({
        shortcodes: [
          {
            tag: 'gallery',
            callback: 'gallery_shortcode',
            callback_file: '/wp-includes/media.php',
          },
        ],
      });

      const tool = toolRegistry.getTool('wpnav_list_shortcodes');
      await tool!.handler({ include_callback: true }, mockContext);

      expect(mockContext.wpRequest).toHaveBeenCalledWith(
        expect.stringContaining('include_callback=true')
      );
    });
  });

  describe('wpnav_list_block_patterns', () => {
    it('returns all patterns', async () => {
      const mockContext = createMockContext({
        patterns: [
          { name: 'core/text-two-columns', title: 'Two Columns of Text' },
          { name: 'core/query-loop', title: 'Query Loop' },
        ],
        total: 2,
      });

      const tool = toolRegistry.getTool('wpnav_list_block_patterns');
      expect(tool).toBeDefined();

      const result = await tool!.handler({}, mockContext);

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.patterns).toHaveLength(2);
    });

    it('filters by category', async () => {
      const mockContext = createMockContext({
        patterns: [{ name: 'core/header-large', title: 'Large Header' }],
      });

      const tool = toolRegistry.getTool('wpnav_list_block_patterns');
      await tool!.handler({ category: 'header' }, mockContext);

      expect(mockContext.wpRequest).toHaveBeenCalledWith(
        expect.stringContaining('category=header')
      );
    });

    it('searches pattern names and descriptions', async () => {
      const mockContext = createMockContext({
        patterns: [{ name: 'core/gallery', title: 'Gallery' }],
      });

      const tool = toolRegistry.getTool('wpnav_list_block_patterns');
      await tool!.handler({ search: 'gallery' }, mockContext);

      expect(mockContext.wpRequest).toHaveBeenCalledWith(expect.stringContaining('search=gallery'));
    });

    it('includes content when requested', async () => {
      const mockContext = createMockContext({
        patterns: [
          {
            name: 'core/text-two-columns',
            title: 'Two Columns',
            content: '<!-- wp:columns -->...',
          },
        ],
      });

      const tool = toolRegistry.getTool('wpnav_list_block_patterns');
      await tool!.handler({ include_content: true }, mockContext);

      expect(mockContext.wpRequest).toHaveBeenCalledWith(
        expect.stringContaining('include_content=true')
      );
    });
  });

  describe('wpnav_list_block_templates', () => {
    it('returns all templates', async () => {
      const mockContext = createMockContext({
        templates: [
          { id: 'theme//single', slug: 'single', title: 'Single Post' },
          { id: 'theme//archive', slug: 'archive', title: 'Archive' },
        ],
        total: 2,
      });

      const tool = toolRegistry.getTool('wpnav_list_block_templates');
      expect(tool).toBeDefined();

      const result = await tool!.handler({}, mockContext);

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.templates).toHaveLength(2);
    });

    it('filters by type', async () => {
      const mockContext = createMockContext({
        templates: [{ id: 'theme//header', slug: 'header', type: 'wp_template_part' }],
      });

      const tool = toolRegistry.getTool('wpnav_list_block_templates');
      await tool!.handler({ type: 'wp_template_part' }, mockContext);

      expect(mockContext.wpRequest).toHaveBeenCalledWith(
        expect.stringContaining('type=wp_template_part')
      );
    });

    it('filters template parts by area', async () => {
      const mockContext = createMockContext({
        templates: [{ id: 'theme//header', slug: 'header', area: 'header' }],
      });

      const tool = toolRegistry.getTool('wpnav_list_block_templates');
      await tool!.handler({ area: 'header' }, mockContext);

      expect(mockContext.wpRequest).toHaveBeenCalledWith(expect.stringContaining('area=header'));
    });

    it('searches template names', async () => {
      const mockContext = createMockContext({
        templates: [{ id: 'theme//single', slug: 'single', title: 'Single' }],
      });

      const tool = toolRegistry.getTool('wpnav_list_block_templates');
      await tool!.handler({ search: 'single' }, mockContext);

      expect(mockContext.wpRequest).toHaveBeenCalledWith(expect.stringContaining('search=single'));
    });

    it('includes content when requested', async () => {
      const mockContext = createMockContext({
        templates: [
          {
            id: 'theme//single',
            slug: 'single',
            content: '<!-- wp:template-part {"slug":"header"} /-->...',
          },
        ],
      });

      const tool = toolRegistry.getTool('wpnav_list_block_templates');
      await tool!.handler({ include_content: true }, mockContext);

      expect(mockContext.wpRequest).toHaveBeenCalledWith(
        expect.stringContaining('include_content=true')
      );
    });
  });
});
