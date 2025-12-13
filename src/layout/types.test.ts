/**
 * Tests for Neutral Layout Model
 *
 * @package WP_Navigator_MCP
 */

import { describe, it, expect } from 'vitest';
import {
  LAYOUT_VERSION,
  hasTextContent,
  hasChildren,
  isStructuralElement,
  isContentElement,
  isMediaElement,
  isNeutralLayout,
  createEmptyLayout,
  createHeading,
  createParagraph,
  createImage,
  createButton,
  createSection,
  createColumn,
  createRow,
  type LayoutElement,
  type NeutralLayout,
} from './types.js';

describe('LAYOUT_VERSION', () => {
  it('should be a valid version string', () => {
    expect(LAYOUT_VERSION).toBe('1.0');
  });
});

describe('Factory Functions', () => {
  describe('createEmptyLayout', () => {
    it('should create a valid empty layout', () => {
      const layout = createEmptyLayout('gutenberg');
      expect(layout.layout_version).toBe(LAYOUT_VERSION);
      expect(layout.source.builder).toBe('gutenberg');
      expect(layout.elements).toEqual([]);
    });

    it('should default to unknown builder', () => {
      const layout = createEmptyLayout();
      expect(layout.source.builder).toBe('unknown');
    });
  });

  describe('createHeading', () => {
    it('should create heading with level and content', () => {
      const heading = createHeading(2, 'About Us');
      expect(heading.type).toBe('heading');
      expect(heading.attrs.level).toBe(2);
      expect(heading.content).toBe('About Us');
    });

    it('should merge additional attributes', () => {
      const heading = createHeading(1, 'Title', {
        className: 'hero-title',
        typography: { color: '#333' },
      });
      expect(heading.attrs.level).toBe(1);
      expect(heading.attrs.className).toBe('hero-title');
      expect(heading.attrs.typography?.color).toBe('#333');
    });
  });

  describe('createParagraph', () => {
    it('should create paragraph with content', () => {
      const para = createParagraph('Lorem ipsum dolor sit amet.');
      expect(para.type).toBe('paragraph');
      expect(para.content).toBe('Lorem ipsum dolor sit amet.');
      expect(para.attrs).toEqual({});
    });

    it('should accept attributes', () => {
      const para = createParagraph('Content', { className: 'intro' });
      expect(para.attrs.className).toBe('intro');
    });
  });

  describe('createImage', () => {
    it('should create image with src', () => {
      const img = createImage('https://example.com/image.jpg');
      expect(img.type).toBe('image');
      expect(img.attrs.src).toBe('https://example.com/image.jpg');
    });

    it('should accept additional attributes', () => {
      const img = createImage('https://example.com/image.jpg', {
        alt: 'A beautiful sunset',
        width: 800,
        height: 600,
        caption: 'Sunset over mountains',
      });
      expect(img.attrs.alt).toBe('A beautiful sunset');
      expect(img.attrs.width).toBe(800);
      expect(img.attrs.height).toBe(600);
      expect(img.attrs.caption).toBe('Sunset over mountains');
    });
  });

  describe('createButton', () => {
    it('should create button with content', () => {
      const btn = createButton('Click Me');
      expect(btn.type).toBe('button');
      expect(btn.content).toBe('Click Me');
    });

    it('should accept URL and variant', () => {
      const btn = createButton('Learn More', {
        url: 'https://example.com',
        variant: 'primary',
        target: '_blank',
      });
      expect(btn.attrs.url).toBe('https://example.com');
      expect(btn.attrs.variant).toBe('primary');
      expect(btn.attrs.target).toBe('_blank');
    });
  });

  describe('createSection', () => {
    it('should create section with children', () => {
      const children = [
        createHeading(2, 'Section Title'),
        createParagraph('Section content.'),
      ];
      const section = createSection(children);
      expect(section.type).toBe('section');
      expect(section.children).toHaveLength(2);
    });

    it('should accept attributes', () => {
      const section = createSection([], {
        fullWidth: true,
        background: { color: '#f5f5f5' },
      });
      expect(section.attrs.fullWidth).toBe(true);
      expect(section.attrs.background?.color).toBe('#f5f5f5');
    });
  });

  describe('createColumn', () => {
    it('should create column with children', () => {
      const col = createColumn([createParagraph('Column content')]);
      expect(col.type).toBe('column');
      expect(col.children).toHaveLength(1);
    });

    it('should accept width attribute', () => {
      const col = createColumn([], { width: '50%' });
      expect(col.attrs.width).toBe('50%');
    });
  });

  describe('createRow', () => {
    it('should create row with columns', () => {
      const columns = [
        createColumn([createParagraph('Left')], { width: '50%' }),
        createColumn([createParagraph('Right')], { width: '50%' }),
      ];
      const row = createRow(columns);
      expect(row.type).toBe('row');
      expect(row.children).toHaveLength(2);
    });
  });
});

describe('Type Guards', () => {
  describe('hasTextContent', () => {
    it('should return true for text elements', () => {
      expect(hasTextContent(createParagraph('Test'))).toBe(true);
      expect(hasTextContent(createHeading(1, 'Title'))).toBe(true);
      expect(hasTextContent(createButton('Click'))).toBe(true);
    });

    it('should return false for non-text elements', () => {
      expect(hasTextContent(createImage('test.jpg'))).toBe(false);
      expect(hasTextContent(createSection([]))).toBe(false);
    });
  });

  describe('hasChildren', () => {
    it('should return true for elements with children', () => {
      const section = createSection([createParagraph('Test')]);
      expect(hasChildren(section)).toBe(true);
    });

    it('should return false for elements without children', () => {
      expect(hasChildren(createParagraph('Test'))).toBe(false);
      expect(hasChildren(createSection([]))).toBe(false);
    });
  });

  describe('isStructuralElement', () => {
    it('should identify structural elements', () => {
      expect(isStructuralElement(createSection([]))).toBe(true);
      expect(isStructuralElement(createColumn([]))).toBe(true);
      expect(isStructuralElement(createRow([]))).toBe(true);
    });

    it('should reject non-structural elements', () => {
      expect(isStructuralElement(createParagraph('Test'))).toBe(false);
      expect(isStructuralElement(createImage('test.jpg'))).toBe(false);
    });
  });

  describe('isContentElement', () => {
    it('should identify content elements', () => {
      expect(isContentElement(createParagraph('Test'))).toBe(true);
      expect(isContentElement(createHeading(1, 'Title'))).toBe(true);
    });

    it('should reject non-content elements', () => {
      expect(isContentElement(createImage('test.jpg'))).toBe(false);
      expect(isContentElement(createSection([]))).toBe(false);
    });
  });

  describe('isMediaElement', () => {
    it('should identify media elements', () => {
      expect(isMediaElement(createImage('test.jpg'))).toBe(true);
    });

    it('should reject non-media elements', () => {
      expect(isMediaElement(createParagraph('Test'))).toBe(false);
      expect(isMediaElement(createSection([]))).toBe(false);
    });
  });

  describe('isNeutralLayout', () => {
    it('should validate correct layout', () => {
      const layout = createEmptyLayout('gutenberg');
      expect(isNeutralLayout(layout)).toBe(true);
    });

    it('should reject invalid values', () => {
      expect(isNeutralLayout(null)).toBe(false);
      expect(isNeutralLayout(undefined)).toBe(false);
      expect(isNeutralLayout({})).toBe(false);
      expect(isNeutralLayout({ layout_version: '1.0' })).toBe(false);
    });
  });
});

describe('Complex Layout Structures', () => {
  it('should support nested layouts', () => {
    const layout: NeutralLayout = {
      layout_version: LAYOUT_VERSION,
      source: { builder: 'gutenberg' },
      elements: [
        createSection([
          createHeading(1, 'Welcome'),
          createRow([
            createColumn([
              createParagraph('Left column content'),
              createButton('Learn More', { url: '/about' }),
            ], { width: '66.66%' }),
            createColumn([
              createImage('sidebar.jpg', { alt: 'Sidebar image' }),
            ], { width: '33.33%' }),
          ]),
        ], {
          fullWidth: true,
          background: { color: '#ffffff' },
        }),
      ],
    };

    expect(isNeutralLayout(layout)).toBe(true);
    expect(layout.elements).toHaveLength(1);

    const section = layout.elements[0];
    expect(section.type).toBe('section');
    expect(section.children).toHaveLength(2);

    const heading = section.children![0] as { type: 'heading'; content: string };
    expect(heading.type).toBe('heading');
    expect(heading.content).toBe('Welcome');

    const row = section.children![1] as { type: 'row'; children: LayoutElement[] };
    expect(row.type).toBe('row');
    expect(row.children).toHaveLength(2);
  });

  it('should support styling attributes', () => {
    const section = createSection([
      createHeading(2, 'Styled Section'),
    ], {
      padding: { top: '40px', bottom: '40px' },
      background: {
        color: '#f0f0f0',
        gradient: 'linear-gradient(180deg, #fff 0%, #f0f0f0 100%)',
      },
      border: {
        radius: '8px',
      },
    });

    expect(section.attrs.padding).toEqual({ top: '40px', bottom: '40px' });
    expect(section.attrs.background?.gradient).toContain('linear-gradient');
    expect(section.attrs.border?.radius).toBe('8px');
  });

  it('should support responsive attributes', () => {
    const para = createParagraph('Responsive text', {
      typography: { fontSize: '18px' },
      responsive: {
        tablet: { typography: { fontSize: '16px' } },
        mobile: { typography: { fontSize: '14px' } },
      },
    });

    expect(para.attrs.typography?.fontSize).toBe('18px');
    expect(para.attrs.responsive?.tablet?.typography?.fontSize).toBe('16px');
    expect(para.attrs.responsive?.mobile?.typography?.fontSize).toBe('14px');
  });

  it('should preserve builder-specific data', () => {
    const layout: NeutralLayout = {
      layout_version: LAYOUT_VERSION,
      source: {
        builder: 'elementor',
        builderVersion: '3.18.0',
        formatVersion: '2.0',
      },
      elements: [
        {
          type: 'section',
          attrs: {
            _builderData: {
              elementor_id: 'abc123',
              custom_css: '.selector { color: red; }',
            },
          },
          children: [],
        },
      ],
      _builderMetadata: {
        elementor_page_settings: {
          template: 'elementor_header_footer',
        },
      },
    };

    expect(layout.source.builderVersion).toBe('3.18.0');
    expect(layout._builderMetadata?.elementor_page_settings).toBeDefined();

    const section = layout.elements[0];
    expect(section.attrs._builderData?.elementor_id).toBe('abc123');
  });
});

describe('Element Types Coverage', () => {
  it('should support all structural types', () => {
    const structuralElements: LayoutElement[] = [
      { type: 'section', attrs: {}, children: [] },
      { type: 'container', attrs: {}, children: [] },
      { type: 'row', attrs: {}, children: [] },
      { type: 'column', attrs: {}, children: [] },
      { type: 'group', attrs: {}, children: [] },
    ];

    structuralElements.forEach((el) => {
      expect(isStructuralElement(el)).toBe(true);
    });
  });

  it('should support all content types', () => {
    const contentElements: LayoutElement[] = [
      { type: 'heading', attrs: { level: 1 }, content: 'H1' },
      { type: 'paragraph', attrs: {}, content: 'Para' },
      { type: 'text', attrs: {}, content: 'Text' },
      { type: 'list', attrs: {}, content: '<li>Item</li>' },
      { type: 'quote', attrs: {}, content: 'Quote' },
      { type: 'code', attrs: {}, content: 'const x = 1;' },
    ];

    contentElements.forEach((el) => {
      expect(isContentElement(el)).toBe(true);
      expect(hasTextContent(el)).toBe(true);
    });
  });

  it('should support all media types', () => {
    const mediaElements: LayoutElement[] = [
      { type: 'image', attrs: { src: 'test.jpg' } },
      { type: 'video', attrs: {} },
      { type: 'audio', attrs: {} },
      { type: 'gallery', attrs: {} },
      { type: 'embed', attrs: { url: 'https://youtube.com/watch?v=123' } },
    ];

    mediaElements.forEach((el) => {
      expect(isMediaElement(el)).toBe(true);
    });
  });

  it('should support special types', () => {
    const specialElements: LayoutElement[] = [
      { type: 'separator', attrs: { style: 'wide' } },
      { type: 'spacer', attrs: { height: '50px' } },
      { type: 'html', attrs: { html: '<div>Custom</div>' } },
      { type: 'shortcode', attrs: { shortcode: '[contact-form-7 id="123"]', tag: 'contact-form-7' } },
      { type: 'unknown', attrs: {} },
    ];

    specialElements.forEach((el) => {
      expect(el.type).toBeDefined();
    });
  });
});
