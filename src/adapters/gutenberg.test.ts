/**
 * Tests for Gutenberg Builder Adapter
 *
 * @package WP_Navigator_MCP
 */

import { describe, it, expect } from 'vitest';
import { GutenbergAdapter, gutenbergAdapter } from './gutenberg.js';
import type { PageData } from './types.js';
import type { NeutralLayout } from '../layout/types.js';

/**
 * Create mock page data for testing
 */
function createPageData(content: string): PageData {
  return {
    id: 1,
    slug: 'test-page',
    title: { rendered: 'Test Page' },
    content: { rendered: content, raw: content },
    status: 'publish',
  };
}

describe('GutenbergAdapter', () => {
  describe('properties', () => {
    it('should have correct identification', () => {
      const adapter = new GutenbergAdapter();
      expect(adapter.name).toBe('gutenberg');
      expect(adapter.displayName).toBe('Gutenberg (Block Editor)');
      expect(adapter.supported).toBe(true);
    });

    it('should have version info', () => {
      const adapter = new GutenbergAdapter();
      expect(adapter.version.adapter).toBe('1.0.0');
      expect(adapter.version.minBuilderVersion).toBe('5.0.0');
    });

    it('should declare capabilities', () => {
      const adapter = new GutenbergAdapter();
      expect(adapter.capabilities.canExtract).toBe(true);
      expect(adapter.capabilities.canApply).toBe(true);
      expect(adapter.capabilities.canDetect).toBe(true);
      expect(adapter.capabilities.supportsNesting).toBe(true);
      expect(adapter.capabilities.supportedElements).toContain('paragraph');
      expect(adapter.capabilities.supportedElements).toContain('heading');
      expect(adapter.capabilities.supportedElements).toContain('image');
    });
  });

  describe('detect', () => {
    it('should detect Gutenberg content', () => {
      const content = `<!-- wp:paragraph -->
<p>Hello World</p>
<!-- /wp:paragraph -->`;
      const page = createPageData(content);
      const result = gutenbergAdapter.detect(page);

      expect(result.detected).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.5);
      expect(result.method).toBe('content');
    });

    it('should detect self-closing blocks', () => {
      const content = `<!-- wp:separator /-->`;
      const page = createPageData(content);
      const result = gutenbergAdapter.detect(page);

      expect(result.detected).toBe(true);
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should not detect non-Gutenberg content', () => {
      const content = '<p>Plain HTML without blocks</p>';
      const page = createPageData(content);
      const result = gutenbergAdapter.detect(page);

      expect(result.detected).toBe(false);
      expect(result.confidence).toBe(0);
    });

    it('should increase confidence with more blocks', () => {
      const fewBlocks = `<!-- wp:paragraph --><p>One</p><!-- /wp:paragraph -->`;
      const manyBlocks = `
<!-- wp:paragraph --><p>One</p><!-- /wp:paragraph -->
<!-- wp:paragraph --><p>Two</p><!-- /wp:paragraph -->
<!-- wp:paragraph --><p>Three</p><!-- /wp:paragraph -->
<!-- wp:paragraph --><p>Four</p><!-- /wp:paragraph -->
<!-- wp:paragraph --><p>Five</p><!-- /wp:paragraph -->
<!-- wp:paragraph --><p>Six</p><!-- /wp:paragraph -->
`;
      const fewResult = gutenbergAdapter.detect(createPageData(fewBlocks));
      const manyResult = gutenbergAdapter.detect(createPageData(manyBlocks));

      expect(manyResult.confidence).toBeGreaterThan(fewResult.confidence);
    });
  });

  describe('extractLayout', () => {
    it('should extract simple paragraph', () => {
      const content = `<!-- wp:paragraph -->
<p>Hello World</p>
<!-- /wp:paragraph -->`;
      const result = gutenbergAdapter.extractLayout(createPageData(content));

      expect(result.success).toBe(true);
      expect(result.data.elements).toHaveLength(1);
      expect(result.data.elements[0].type).toBe('paragraph');
      expect((result.data.elements[0] as any).content).toContain('Hello World');
    });

    it('should extract heading with level', () => {
      const content = `<!-- wp:heading {"level":2} -->
<h2>My Heading</h2>
<!-- /wp:heading -->`;
      const result = gutenbergAdapter.extractLayout(createPageData(content));

      expect(result.success).toBe(true);
      const heading = result.data.elements[0] as any;
      expect(heading.type).toBe('heading');
      expect(heading.attrs.level).toBe(2);
      expect(heading.content).toBe('My Heading');
    });

    it('should extract image with attributes', () => {
      const content = `<!-- wp:image {"id":123,"sizeSlug":"large"} -->
<figure class="wp-block-image size-large">
<img src="https://example.com/image.jpg" alt="Test image" class="wp-image-123"/>
</figure>
<!-- /wp:image -->`;
      const result = gutenbergAdapter.extractLayout(createPageData(content));

      expect(result.success).toBe(true);
      const image = result.data.elements[0] as any;
      expect(image.type).toBe('image');
      expect(image.attrs.mediaId).toBe(123);
      expect(image.attrs.sizeSlug).toBe('large');
    });

    it('should extract button', () => {
      const content = `<!-- wp:button {"url":"https://example.com"} -->
<div class="wp-block-button"><a class="wp-block-button__link" href="https://example.com">Click Me</a></div>
<!-- /wp:button -->`;
      const result = gutenbergAdapter.extractLayout(createPageData(content));

      expect(result.success).toBe(true);
      const button = result.data.elements[0] as any;
      expect(button.type).toBe('button');
      expect(button.attrs.url).toBe('https://example.com');
      expect(button.content).toBe('Click Me');
    });

    it('should extract columns with nested content', () => {
      const content = `<!-- wp:columns -->
<div class="wp-block-columns">
<!-- wp:column {"width":"50%"} -->
<div class="wp-block-column" style="flex-basis:50%">
<!-- wp:paragraph -->
<p>Left</p>
<!-- /wp:paragraph -->
</div>
<!-- /wp:column -->
<!-- wp:column {"width":"50%"} -->
<div class="wp-block-column" style="flex-basis:50%">
<!-- wp:paragraph -->
<p>Right</p>
<!-- /wp:paragraph -->
</div>
<!-- /wp:column -->
</div>
<!-- /wp:columns -->`;
      const result = gutenbergAdapter.extractLayout(createPageData(content));

      expect(result.success).toBe(true);
      const row = result.data.elements[0] as any;
      expect(row.type).toBe('row');
      expect(row.children).toHaveLength(2);
      expect(row.children[0].type).toBe('column');
      expect(row.children[0].attrs.width).toBe('50%');
      expect(row.children[0].children[0].type).toBe('paragraph');
    });

    it('should extract self-closing blocks', () => {
      const content = `<!-- wp:separator {"className":"is-style-wide"} /-->`;
      const result = gutenbergAdapter.extractLayout(createPageData(content));

      expect(result.success).toBe(true);
      const separator = result.data.elements[0] as any;
      expect(separator.type).toBe('separator');
      expect(separator.attrs.style).toBe('wide');
    });

    it('should extract spacer', () => {
      const content = `<!-- wp:spacer {"height":"50px"} /-->`;
      const result = gutenbergAdapter.extractLayout(createPageData(content));

      expect(result.success).toBe(true);
      const spacer = result.data.elements[0] as any;
      expect(spacer.type).toBe('spacer');
      expect(spacer.attrs.height).toBe('50px');
    });

    it('should handle unknown blocks', () => {
      const content = `<!-- wp:custom/unknown-block {"data":"test"} -->
<div>Custom content</div>
<!-- /wp:custom/unknown-block -->`;
      const result = gutenbergAdapter.extractLayout(createPageData(content));

      expect(result.success).toBe(true);
      expect(result.data.elements[0].type).toBe('unknown');
      expect(result.unsupportedElements).toContain('custom/unknown-block');
    });

    it('should preserve builder data when requested', () => {
      const content = `<!-- wp:paragraph {"dropCap":true} -->
<p>Test</p>
<!-- /wp:paragraph -->`;
      const result = gutenbergAdapter.extractLayout(createPageData(content), {
        preserveBuilderData: true,
      });

      expect(result.success).toBe(true);
      const para = result.data.elements[0] as any;
      expect(para.attrs._builderData).toBeDefined();
      expect(para.attrs._builderData.blockName).toBe('core/paragraph');
    });

    it('should return conversion stats', () => {
      const content = `<!-- wp:heading {"level":1} -->
<h1>Title</h1>
<!-- /wp:heading -->
<!-- wp:paragraph -->
<p>Content</p>
<!-- /wp:paragraph -->`;
      const result = gutenbergAdapter.extractLayout(createPageData(content));

      expect(result.stats).toBeDefined();
      expect(result.stats!.totalElements).toBe(2);
      expect(result.stats!.convertedElements).toBe(2);
      expect(result.stats!.processingTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('extractLayoutFromContent', () => {
    it('should extract from raw content string', () => {
      const content = `<!-- wp:paragraph --><p>Test</p><!-- /wp:paragraph -->`;
      const result = gutenbergAdapter.extractLayoutFromContent(content);

      expect(result.success).toBe(true);
      expect(result.data.elements).toHaveLength(1);
    });
  });

  describe('applyLayout', () => {
    it('should generate paragraph block', () => {
      const layout: NeutralLayout = {
        layout_version: '1.0',
        source: { builder: 'gutenberg' },
        elements: [{ type: 'paragraph', attrs: {}, content: '<p>Hello World</p>' }],
      };
      const result = gutenbergAdapter.applyLayout(layout);

      expect(result.success).toBe(true);
      expect(result.data).toContain('<!-- wp:paragraph -->');
      expect(result.data).toContain('Hello World');
      expect(result.data).toContain('<!-- /wp:paragraph -->');
    });

    it('should generate heading block with level', () => {
      const layout: NeutralLayout = {
        layout_version: '1.0',
        source: { builder: 'gutenberg' },
        elements: [{ type: 'heading', attrs: { level: 2 }, content: 'My Heading' }],
      };
      const result = gutenbergAdapter.applyLayout(layout);

      expect(result.success).toBe(true);
      expect(result.data).toContain('<!-- wp:heading {"level":2} -->');
      expect(result.data).toContain('<h2>My Heading</h2>');
    });

    it('should generate image block', () => {
      const layout: NeutralLayout = {
        layout_version: '1.0',
        source: { builder: 'gutenberg' },
        elements: [
          {
            type: 'image',
            attrs: {
              src: 'https://example.com/image.jpg',
              alt: 'Test',
              mediaId: 123,
            },
          },
        ],
      };
      const result = gutenbergAdapter.applyLayout(layout);

      expect(result.success).toBe(true);
      expect(result.data).toContain('<!-- wp:image');
      expect(result.data).toContain('"url":"https://example.com/image.jpg"');
      expect(result.data).toContain('"id":123');
    });

    it('should generate button block', () => {
      const layout: NeutralLayout = {
        layout_version: '1.0',
        source: { builder: 'gutenberg' },
        elements: [
          {
            type: 'button',
            attrs: { url: 'https://example.com' },
            content: 'Click Me',
          },
        ],
      };
      const result = gutenbergAdapter.applyLayout(layout);

      expect(result.success).toBe(true);
      expect(result.data).toContain('<!-- wp:button');
      expect(result.data).toContain('"url":"https://example.com"');
      expect(result.data).toContain('Click Me');
    });

    it('should generate separator block', () => {
      const layout: NeutralLayout = {
        layout_version: '1.0',
        source: { builder: 'gutenberg' },
        elements: [{ type: 'separator', attrs: { style: 'wide' } }],
      };
      const result = gutenbergAdapter.applyLayout(layout);

      expect(result.success).toBe(true);
      expect(result.data).toContain('<!-- wp:separator');
      expect(result.data).toContain('is-style-wide');
    });

    it('should generate spacer block', () => {
      const layout: NeutralLayout = {
        layout_version: '1.0',
        source: { builder: 'gutenberg' },
        elements: [{ type: 'spacer', attrs: { height: '50px' } }],
      };
      const result = gutenbergAdapter.applyLayout(layout);

      expect(result.success).toBe(true);
      expect(result.data).toContain('<!-- wp:spacer');
      expect(result.data).toContain('"height":"50px"');
    });

    it('should generate columns with nested content', () => {
      const layout: NeutralLayout = {
        layout_version: '1.0',
        source: { builder: 'gutenberg' },
        elements: [
          {
            type: 'row',
            attrs: {},
            children: [
              {
                type: 'column',
                attrs: { width: '50%' },
                children: [{ type: 'paragraph', attrs: {}, content: 'Left' }],
              },
              {
                type: 'column',
                attrs: { width: '50%' },
                children: [{ type: 'paragraph', attrs: {}, content: 'Right' }],
              },
            ],
          },
        ],
      };
      const result = gutenbergAdapter.applyLayout(layout);

      expect(result.success).toBe(true);
      expect(result.data).toContain('<!-- wp:columns -->');
      expect(result.data).toContain('<!-- wp:column');
      expect(result.data).toContain('Left');
      expect(result.data).toContain('Right');
    });

    it('should return conversion stats', () => {
      const layout: NeutralLayout = {
        layout_version: '1.0',
        source: { builder: 'gutenberg' },
        elements: [
          { type: 'paragraph', attrs: {}, content: 'One' },
          { type: 'paragraph', attrs: {}, content: 'Two' },
        ],
      };
      const result = gutenbergAdapter.applyLayout(layout);

      expect(result.stats).toBeDefined();
      expect(result.stats!.totalElements).toBe(2);
      expect(result.stats!.convertedElements).toBe(2);
    });
  });

  describe('round-trip conversion', () => {
    it('should preserve content through extract→apply cycle', () => {
      const originalContent = `<!-- wp:heading {"level":1} -->
<h1>Welcome</h1>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>This is a test paragraph with some content.</p>
<!-- /wp:paragraph -->`;

      // Extract to neutral
      const extractResult = gutenbergAdapter.extractLayout(createPageData(originalContent));
      expect(extractResult.success).toBe(true);

      // Apply back to Gutenberg
      const applyResult = gutenbergAdapter.applyLayout(extractResult.data);
      expect(applyResult.success).toBe(true);

      // Verify key content preserved
      expect(applyResult.data).toContain('Welcome');
      expect(applyResult.data).toContain('test paragraph');
      expect(applyResult.data).toContain('<!-- wp:heading');
      expect(applyResult.data).toContain('<!-- wp:paragraph');
    });

    it('should preserve nested structure through round-trip', () => {
      const originalContent = `<!-- wp:columns -->
<div class="wp-block-columns">
<!-- wp:column {"width":"66.66%"} -->
<div class="wp-block-column">
<!-- wp:heading {"level":2} -->
<h2>Left Column</h2>
<!-- /wp:heading -->
</div>
<!-- /wp:column -->
<!-- wp:column {"width":"33.33%"} -->
<div class="wp-block-column">
<!-- wp:paragraph -->
<p>Right content</p>
<!-- /wp:paragraph -->
</div>
<!-- /wp:column -->
</div>
<!-- /wp:columns -->`;

      const extractResult = gutenbergAdapter.extractLayout(createPageData(originalContent));
      const applyResult = gutenbergAdapter.applyLayout(extractResult.data);

      expect(applyResult.data).toContain('<!-- wp:columns');
      expect(applyResult.data).toContain('<!-- wp:column');
      expect(applyResult.data).toContain('Left Column');
      expect(applyResult.data).toContain('Right content');
    });
  });
});

describe('gutenbergAdapter singleton', () => {
  it('should be an instance of GutenbergAdapter', () => {
    expect(gutenbergAdapter).toBeInstanceOf(GutenbergAdapter);
  });

  it('should have expected properties', () => {
    expect(gutenbergAdapter.name).toBe('gutenberg');
    expect(gutenbergAdapter.supported).toBe(true);
  });
});
