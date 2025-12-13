/**
 * Tests for WPBakery Builder Adapter (Stub)
 *
 * @package WP_Navigator_MCP
 */

import { describe, it, expect } from 'vitest';
import { WPBakeryAdapter, wpbakeryAdapter } from './wpbakery.js';
import type { PageData } from './types.js';

/**
 * Create mock page data for testing
 */
function createPageData(content: string, meta?: Record<string, unknown>): PageData {
  return {
    id: 1,
    slug: 'test-page',
    title: { rendered: 'Test Page' },
    content: { rendered: content, raw: content },
    status: 'publish',
    meta,
  };
}

describe('WPBakeryAdapter', () => {
  describe('properties', () => {
    it('should have correct identification', () => {
      const adapter = new WPBakeryAdapter();
      expect(adapter.name).toBe('wpbakery');
      expect(adapter.displayName).toBe('WPBakery Page Builder');
      expect(adapter.supported).toBe(false);
    });

    it('should have version info', () => {
      const adapter = new WPBakeryAdapter();
      expect(adapter.version.adapter).toBe('0.1.0');
      expect(adapter.version.minBuilderVersion).toBe('6.0.0');
    });

    it('should declare limited capabilities', () => {
      const adapter = new WPBakeryAdapter();
      expect(adapter.capabilities.canExtract).toBe(false);
      expect(adapter.capabilities.canApply).toBe(false);
      expect(adapter.capabilities.canDetect).toBe(true);
      expect(adapter.capabilities.supportedElements).toHaveLength(0);
    });
  });

  describe('detect', () => {
    it('should detect WPBakery content by shortcodes', () => {
      const content = '[vc_row][vc_column][vc_column_text]Hello[/vc_column_text][/vc_column][/vc_row]';
      const page = createPageData(content);
      const result = wpbakeryAdapter.detect(page);

      expect(result.detected).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.5);
      expect(result.method).toBe('shortcode');
    });

    it('should detect WPBakery content by meta', () => {
      const page = createPageData('<div>content</div>', {
        _wpb_vc_js_status: 'true',
      });
      const result = wpbakeryAdapter.detect(page);

      expect(result.detected).toBe(true);
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should detect WPBakery content by CSS classes', () => {
      const content = '<div class="vc_row wpb_row">Row content</div>';
      const page = createPageData(content);
      const result = wpbakeryAdapter.detect(page);

      expect(result.detected).toBe(true);
    });

    it('should detect WPBakery content by data attributes combined with classes', () => {
      // Data attributes alone don't trigger detection - they add confidence when other markers present
      const content = '<div class="vc_row" data-vc-full-width="true">Full width content</div>';
      const page = createPageData(content);
      const result = wpbakeryAdapter.detect(page);

      expect(result.detected).toBe(true);
      expect(result.details?.hasWPBakeryData).toBe(true);
    });

    it('should detect vc_column shortcode', () => {
      const content = '[vc_column width="1/2"]content[/vc_column]';
      const page = createPageData(content);
      const result = wpbakeryAdapter.detect(page);

      expect(result.detected).toBe(true);
      expect(result.method).toBe('shortcode');
    });

    it('should not detect non-WPBakery content', () => {
      const content = '<p>Plain HTML without WPBakery</p>';
      const page = createPageData(content);
      const result = wpbakeryAdapter.detect(page);

      expect(result.detected).toBe(false);
      expect(result.confidence).toBe(0);
    });

    it('should not crash on empty content', () => {
      const page = createPageData('');
      const result = wpbakeryAdapter.detect(page);

      expect(result.detected).toBe(false);
      expect(result.confidence).toBe(0);
    });

    it('should include helpful message when detected', () => {
      const content = '[vc_row][/vc_row]';
      const page = createPageData(content);
      const result = wpbakeryAdapter.detect(page);

      expect(result.details?.message).toContain('coming in v2');
    });
  });

  describe('extractLayout', () => {
    it('should return not supported result', () => {
      const content = '[vc_row][vc_column]content[/vc_column][/vc_row]';
      const page = createPageData(content);
      const result = wpbakeryAdapter.extractLayout(page);

      expect(result.success).toBe(false);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].code).toBe('BUILDER_NOT_SUPPORTED');
      expect(result.warnings[0].message).toContain('WPBakery');
      expect(result.warnings[0].message).toContain('v2.0');
    });

    it('should return empty elements array', () => {
      const content = '[vc_row][/vc_row]';
      const page = createPageData(content);
      const result = wpbakeryAdapter.extractLayout(page);

      expect(result.data.elements).toHaveLength(0);
      expect(result.data.source.builder).toBe('wpbakery');
    });
  });

  describe('extractLayoutFromContent', () => {
    it('should return not supported result', () => {
      const result = wpbakeryAdapter.extractLayoutFromContent('[vc_row][/vc_row]');

      expect(result.success).toBe(false);
      expect(result.warnings[0].code).toBe('BUILDER_NOT_SUPPORTED');
    });
  });

  describe('applyLayout', () => {
    it('should return not supported result', () => {
      const layout = {
        layout_version: '1.0' as const,
        source: { builder: 'gutenberg', formatVersion: '1.0' },
        elements: [],
      };
      const result = wpbakeryAdapter.applyLayout(layout);

      expect(result.success).toBe(false);
      expect(result.data).toBe('');
      expect(result.warnings[0].code).toBe('BUILDER_NOT_SUPPORTED');
    });
  });
});
