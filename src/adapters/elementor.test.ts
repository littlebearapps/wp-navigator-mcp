/**
 * Tests for Elementor Builder Adapter (Stub)
 *
 * @package WP_Navigator_MCP
 */

import { describe, it, expect } from 'vitest';
import { ElementorAdapter, elementorAdapter } from './elementor.js';
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

describe('ElementorAdapter', () => {
  describe('properties', () => {
    it('should have correct identification', () => {
      const adapter = new ElementorAdapter();
      expect(adapter.name).toBe('elementor');
      expect(adapter.displayName).toBe('Elementor');
      expect(adapter.supported).toBe(false);
    });

    it('should have version info', () => {
      const adapter = new ElementorAdapter();
      expect(adapter.version.adapter).toBe('0.1.0');
      expect(adapter.version.minBuilderVersion).toBe('3.0.0');
    });

    it('should declare limited capabilities', () => {
      const adapter = new ElementorAdapter();
      expect(adapter.capabilities.canExtract).toBe(false);
      expect(adapter.capabilities.canApply).toBe(false);
      expect(adapter.capabilities.canDetect).toBe(true);
      expect(adapter.capabilities.supportedElements).toHaveLength(0);
    });
  });

  describe('detect', () => {
    it('should detect Elementor content by meta', () => {
      const page = createPageData('<div>content</div>', {
        _elementor_edit_mode: 'builder',
      });
      const result = elementorAdapter.detect(page);

      expect(result.detected).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.5);
      expect(result.method).toBe('meta');
    });

    it('should detect Elementor content by CSS classes', () => {
      const content = '<div class="elementor-widget-container">Widget content</div>';
      const page = createPageData(content);
      const result = elementorAdapter.detect(page);

      expect(result.detected).toBe(true);
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should detect Elementor content by data attributes', () => {
      const content = '<div data-elementor-type="wp-page" data-elementor-id="123">content</div>';
      const page = createPageData(content);
      const result = elementorAdapter.detect(page);

      expect(result.detected).toBe(true);
    });

    it('should detect e-con (Elementor Container) classes', () => {
      const content = '<div class="e-con-inner">Container content</div>';
      const page = createPageData(content);
      const result = elementorAdapter.detect(page);

      expect(result.detected).toBe(true);
    });

    it('should not detect non-Elementor content', () => {
      const content = '<p>Plain HTML without Elementor</p>';
      const page = createPageData(content);
      const result = elementorAdapter.detect(page);

      expect(result.detected).toBe(false);
      expect(result.confidence).toBe(0);
    });

    it('should not crash on empty content', () => {
      const page = createPageData('');
      const result = elementorAdapter.detect(page);

      expect(result.detected).toBe(false);
      expect(result.confidence).toBe(0);
    });

    it('should include helpful message when detected', () => {
      const page = createPageData('<div class="elementor-element">content</div>');
      const result = elementorAdapter.detect(page);

      expect(result.details?.message).toContain('coming in v2');
    });
  });

  describe('extractLayout', () => {
    it('should return not supported result', () => {
      const page = createPageData('<div class="elementor-widget">content</div>');
      const result = elementorAdapter.extractLayout(page);

      expect(result.success).toBe(false);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].code).toBe('BUILDER_NOT_SUPPORTED');
      expect(result.warnings[0].message).toContain('Elementor');
      expect(result.warnings[0].message).toContain('v2.0');
    });

    it('should return empty elements array', () => {
      const page = createPageData('<div class="elementor-widget">content</div>');
      const result = elementorAdapter.extractLayout(page);

      expect(result.data.elements).toHaveLength(0);
      expect(result.data.source.builder).toBe('elementor');
    });
  });

  describe('extractLayoutFromContent', () => {
    it('should return not supported result', () => {
      const result = elementorAdapter.extractLayoutFromContent('<div class="elementor">content</div>');

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
      const result = elementorAdapter.applyLayout(layout);

      expect(result.success).toBe(false);
      expect(result.data).toBe('');
      expect(result.warnings[0].code).toBe('BUILDER_NOT_SUPPORTED');
    });
  });
});
