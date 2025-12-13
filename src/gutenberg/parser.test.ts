/**
 * Tests for Gutenberg Block Parser
 *
 * @package WP_Navigator_MCP
 */

import { describe, it, expect } from 'vitest';
import {
  parseGutenbergBlocks,
  serializeBlocks,
  isReusableBlock,
  getReusableBlockRef,
  flattenBlocks,
  countBlocks,
  getBlockTypes,
} from './parser.js';

describe('parseGutenbergBlocks', () => {
  describe('basic blocks', () => {
    it('should parse a simple paragraph block', () => {
      const content = `<!-- wp:paragraph -->
<p>Hello World</p>
<!-- /wp:paragraph -->`;

      const blocks = parseGutenbergBlocks(content);

      expect(blocks).toHaveLength(1);
      expect(blocks[0].blockName).toBe('core/paragraph');
      expect(blocks[0].attrs).toEqual({});
      expect(blocks[0].innerBlocks).toHaveLength(0);
      expect(blocks[0].innerHTML).toContain('Hello World');
    });

    it('should parse a heading block with attributes', () => {
      const content = `<!-- wp:heading {"level":2,"textAlign":"center"} -->
<h2 class="has-text-align-center">My Heading</h2>
<!-- /wp:heading -->`;

      const blocks = parseGutenbergBlocks(content);

      expect(blocks).toHaveLength(1);
      expect(blocks[0].blockName).toBe('core/heading');
      expect(blocks[0].attrs).toEqual({ level: 2, textAlign: 'center' });
    });

    it('should parse a self-closing block', () => {
      const content = `<!-- wp:separator {"className":"is-style-wide"} /-->`;

      const blocks = parseGutenbergBlocks(content);

      expect(blocks).toHaveLength(1);
      expect(blocks[0].blockName).toBe('core/separator');
      expect(blocks[0].attrs).toEqual({ className: 'is-style-wide' });
      expect(blocks[0].innerHTML).toBe('');
      expect(blocks[0].innerBlocks).toHaveLength(0);
    });

    it('should parse a spacer block (self-closing)', () => {
      const content = `<!-- wp:spacer {"height":"50px"} /-->`;

      const blocks = parseGutenbergBlocks(content);

      expect(blocks).toHaveLength(1);
      expect(blocks[0].blockName).toBe('core/spacer');
      expect(blocks[0].attrs).toEqual({ height: '50px' });
    });
  });

  describe('namespaced blocks', () => {
    it('should parse ACF block', () => {
      const content = `<!-- wp:acf/testimonial {"id":"block_123","data":{"author":"John"}} -->
<div class="testimonial">Great product!</div>
<!-- /wp:acf/testimonial -->`;

      const blocks = parseGutenbergBlocks(content);

      expect(blocks).toHaveLength(1);
      expect(blocks[0].blockName).toBe('acf/testimonial');
      expect(blocks[0].attrs.id).toBe('block_123');
      expect(blocks[0].attrs.data).toEqual({ author: 'John' });
    });

    it('should parse WooCommerce block', () => {
      const content = `<!-- wp:woocommerce/product-grid {"columns":3,"rows":2} /-->`;

      const blocks = parseGutenbergBlocks(content);

      expect(blocks).toHaveLength(1);
      expect(blocks[0].blockName).toBe('woocommerce/product-grid');
      expect(blocks[0].attrs).toEqual({ columns: 3, rows: 2 });
    });
  });

  describe('nested blocks (innerBlocks)', () => {
    it('should parse columns with nested column blocks', () => {
      const content = `<!-- wp:columns -->
<div class="wp-block-columns">
<!-- wp:column {"width":"66.66%"} -->
<div class="wp-block-column" style="flex-basis:66.66%">
<!-- wp:paragraph -->
<p>Left column content</p>
<!-- /wp:paragraph -->
</div>
<!-- /wp:column -->
<!-- wp:column {"width":"33.33%"} -->
<div class="wp-block-column" style="flex-basis:33.33%">
<!-- wp:paragraph -->
<p>Right column content</p>
<!-- /wp:paragraph -->
</div>
<!-- /wp:column -->
</div>
<!-- /wp:columns -->`;

      const blocks = parseGutenbergBlocks(content);

      expect(blocks).toHaveLength(1);
      expect(blocks[0].blockName).toBe('core/columns');
      expect(blocks[0].innerBlocks).toHaveLength(2);

      // First column
      expect(blocks[0].innerBlocks[0].blockName).toBe('core/column');
      expect(blocks[0].innerBlocks[0].attrs.width).toBe('66.66%');
      expect(blocks[0].innerBlocks[0].innerBlocks).toHaveLength(1);
      expect(blocks[0].innerBlocks[0].innerBlocks[0].blockName).toBe('core/paragraph');

      // Second column
      expect(blocks[0].innerBlocks[1].blockName).toBe('core/column');
      expect(blocks[0].innerBlocks[1].attrs.width).toBe('33.33%');
    });

    it('should parse group block with nested content', () => {
      const content = `<!-- wp:group {"backgroundColor":"pale-cyan-blue"} -->
<div class="wp-block-group has-pale-cyan-blue-background-color has-background">
<!-- wp:heading -->
<h2>Group Title</h2>
<!-- /wp:heading -->
<!-- wp:paragraph -->
<p>Group content</p>
<!-- /wp:paragraph -->
</div>
<!-- /wp:group -->`;

      const blocks = parseGutenbergBlocks(content);

      expect(blocks).toHaveLength(1);
      expect(blocks[0].blockName).toBe('core/group');
      expect(blocks[0].innerBlocks).toHaveLength(2);
      expect(blocks[0].innerBlocks[0].blockName).toBe('core/heading');
      expect(blocks[0].innerBlocks[1].blockName).toBe('core/paragraph');
    });

    it('should handle deeply nested blocks', () => {
      const content = `<!-- wp:group -->
<div class="wp-block-group">
<!-- wp:columns -->
<div class="wp-block-columns">
<!-- wp:column -->
<div class="wp-block-column">
<!-- wp:group -->
<div class="wp-block-group">
<!-- wp:paragraph -->
<p>Deep content</p>
<!-- /wp:paragraph -->
</div>
<!-- /wp:group -->
</div>
<!-- /wp:column -->
</div>
<!-- /wp:columns -->
</div>
<!-- /wp:group -->`;

      const blocks = parseGutenbergBlocks(content);

      expect(blocks).toHaveLength(1);
      expect(blocks[0].blockName).toBe('core/group');

      const columns = blocks[0].innerBlocks[0];
      expect(columns.blockName).toBe('core/columns');

      const column = columns.innerBlocks[0];
      expect(column.blockName).toBe('core/column');

      const innerGroup = column.innerBlocks[0];
      expect(innerGroup.blockName).toBe('core/group');

      const paragraph = innerGroup.innerBlocks[0];
      expect(paragraph.blockName).toBe('core/paragraph');
    });
  });

  describe('reusable blocks', () => {
    it('should parse reusable block reference', () => {
      const content = `<!-- wp:block {"ref":1234} /-->`;

      const blocks = parseGutenbergBlocks(content);

      expect(blocks).toHaveLength(1);
      expect(blocks[0].blockName).toBe('core/block');
      expect(blocks[0].attrs.ref).toBe(1234);
      expect(isReusableBlock(blocks[0])).toBe(true);
      expect(getReusableBlockRef(blocks[0])).toBe(1234);
    });

    it('should identify non-reusable blocks correctly', () => {
      const content = `<!-- wp:paragraph -->
<p>Regular paragraph</p>
<!-- /wp:paragraph -->`;

      const blocks = parseGutenbergBlocks(content);

      expect(isReusableBlock(blocks[0])).toBe(false);
      expect(getReusableBlockRef(blocks[0])).toBeNull();
    });
  });

  describe('multiple blocks', () => {
    it('should parse multiple top-level blocks', () => {
      const content = `<!-- wp:heading {"level":1} -->
<h1>Title</h1>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>First paragraph</p>
<!-- /wp:paragraph -->

<!-- wp:paragraph -->
<p>Second paragraph</p>
<!-- /wp:paragraph -->

<!-- wp:image {"id":123} -->
<figure class="wp-block-image"><img src="image.jpg" alt=""/></figure>
<!-- /wp:image -->`;

      const blocks = parseGutenbergBlocks(content);

      expect(blocks).toHaveLength(4);
      expect(blocks[0].blockName).toBe('core/heading');
      expect(blocks[1].blockName).toBe('core/paragraph');
      expect(blocks[2].blockName).toBe('core/paragraph');
      expect(blocks[3].blockName).toBe('core/image');
    });
  });

  describe('edge cases', () => {
    it('should handle empty content', () => {
      expect(parseGutenbergBlocks('')).toEqual([]);
    });

    it('should handle null/undefined content', () => {
      expect(parseGutenbergBlocks(null as any)).toEqual([]);
      expect(parseGutenbergBlocks(undefined as any)).toEqual([]);
    });

    it('should handle content with no blocks', () => {
      const content = '<p>Plain HTML without Gutenberg blocks</p>';
      expect(parseGutenbergBlocks(content)).toEqual([]);
    });

    it('should handle malformed JSON in attributes', () => {
      const content = `<!-- wp:paragraph {"invalid":} -->
<p>Test</p>
<!-- /wp:paragraph -->`;

      const blocks = parseGutenbergBlocks(content);

      expect(blocks).toHaveLength(1);
      expect(blocks[0].attrs).toEqual({});
    });

    it('should handle block with no attributes', () => {
      const content = `<!-- wp:paragraph -->
<p>No attrs</p>
<!-- /wp:paragraph -->`;

      const blocks = parseGutenbergBlocks(content);

      expect(blocks).toHaveLength(1);
      expect(blocks[0].attrs).toEqual({});
    });
  });

  describe('complex blocks', () => {
    it('should parse image block with all attributes', () => {
      const content = `<!-- wp:image {"id":123,"sizeSlug":"large","linkDestination":"media","align":"center","className":"custom-class"} -->
<figure class="wp-block-image aligncenter size-large custom-class">
<a href="https://example.com/image.jpg">
<img src="https://example.com/image-1024x768.jpg" alt="Alt text" class="wp-image-123"/>
</a>
<figcaption>Image caption</figcaption>
</figure>
<!-- /wp:image -->`;

      const blocks = parseGutenbergBlocks(content);

      expect(blocks).toHaveLength(1);
      expect(blocks[0].blockName).toBe('core/image');
      expect(blocks[0].attrs).toEqual({
        id: 123,
        sizeSlug: 'large',
        linkDestination: 'media',
        align: 'center',
        className: 'custom-class',
      });
    });

    it('should parse buttons block with inner button blocks', () => {
      const content = `<!-- wp:buttons -->
<div class="wp-block-buttons">
<!-- wp:button {"backgroundColor":"primary"} -->
<div class="wp-block-button"><a class="wp-block-button__link has-primary-background-color has-background">Click Me</a></div>
<!-- /wp:button -->
<!-- wp:button {"backgroundColor":"secondary"} -->
<div class="wp-block-button"><a class="wp-block-button__link has-secondary-background-color has-background">Another</a></div>
<!-- /wp:button -->
</div>
<!-- /wp:buttons -->`;

      const blocks = parseGutenbergBlocks(content);

      expect(blocks).toHaveLength(1);
      expect(blocks[0].blockName).toBe('core/buttons');
      expect(blocks[0].innerBlocks).toHaveLength(2);
      expect(blocks[0].innerBlocks[0].blockName).toBe('core/button');
      expect(blocks[0].innerBlocks[0].attrs.backgroundColor).toBe('primary');
    });
  });
});

describe('serializeBlocks', () => {
  it('should serialize a simple paragraph', () => {
    const blocks = [{
      blockName: 'core/paragraph',
      attrs: {},
      innerBlocks: [],
      innerHTML: '<p>Hello World</p>',
      innerContent: ['<p>Hello World</p>'],
    }];

    const result = serializeBlocks(blocks);

    expect(result).toContain('<!-- wp:paragraph -->');
    expect(result).toContain('<p>Hello World</p>');
    expect(result).toContain('<!-- /wp:paragraph -->');
  });

  it('should serialize block with attributes', () => {
    const blocks = [{
      blockName: 'core/heading',
      attrs: { level: 2 },
      innerBlocks: [],
      innerHTML: '<h2>Title</h2>',
      innerContent: ['<h2>Title</h2>'],
    }];

    const result = serializeBlocks(blocks);

    expect(result).toContain('<!-- wp:heading {"level":2} -->');
  });

  it('should serialize self-closing block', () => {
    const blocks = [{
      blockName: 'core/separator',
      attrs: { className: 'is-style-wide' },
      innerBlocks: [],
      innerHTML: '',
      innerContent: [],
    }];

    const result = serializeBlocks(blocks);

    expect(result).toBe('<!-- wp:separator {"className":"is-style-wide"} /-->');
  });
});

describe('utility functions', () => {
  describe('flattenBlocks', () => {
    it('should flatten nested blocks', () => {
      const blocks = [{
        blockName: 'core/group',
        attrs: {},
        innerBlocks: [{
          blockName: 'core/paragraph',
          attrs: {},
          innerBlocks: [],
          innerHTML: '<p>Test</p>',
          innerContent: ['<p>Test</p>'],
        }],
        innerHTML: '',
        innerContent: [],
      }];

      const flat = flattenBlocks(blocks);

      expect(flat).toHaveLength(2);
      expect(flat[0].blockName).toBe('core/group');
      expect(flat[1].blockName).toBe('core/paragraph');
    });
  });

  describe('countBlocks', () => {
    it('should count all blocks including nested', () => {
      const blocks = [{
        blockName: 'core/columns',
        attrs: {},
        innerBlocks: [
          {
            blockName: 'core/column',
            attrs: {},
            innerBlocks: [{
              blockName: 'core/paragraph',
              attrs: {},
              innerBlocks: [],
              innerHTML: '',
              innerContent: [],
            }],
            innerHTML: '',
            innerContent: [],
          },
          {
            blockName: 'core/column',
            attrs: {},
            innerBlocks: [{
              blockName: 'core/paragraph',
              attrs: {},
              innerBlocks: [],
              innerHTML: '',
              innerContent: [],
            }],
            innerHTML: '',
            innerContent: [],
          },
        ],
        innerHTML: '',
        innerContent: [],
      }];

      expect(countBlocks(blocks)).toBe(5); // columns + 2 columns + 2 paragraphs
    });
  });

  describe('getBlockTypes', () => {
    it('should return unique block types', () => {
      const blocks = [
        { blockName: 'core/paragraph', attrs: {}, innerBlocks: [], innerHTML: '', innerContent: [] },
        { blockName: 'core/heading', attrs: {}, innerBlocks: [], innerHTML: '', innerContent: [] },
        { blockName: 'core/paragraph', attrs: {}, innerBlocks: [], innerHTML: '', innerContent: [] },
        { blockName: 'core/image', attrs: {}, innerBlocks: [], innerHTML: '', innerContent: [] },
      ];

      const types = getBlockTypes(blocks);

      expect(types).toEqual(['core/heading', 'core/image', 'core/paragraph']);
    });
  });
});
