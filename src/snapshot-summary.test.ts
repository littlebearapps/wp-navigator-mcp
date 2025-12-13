/**
 * Tests for Snapshot Summary Generator
 *
 * @package WP_Navigator_MCP
 */

import { describe, it, expect } from 'vitest';
import { summarizePageContent, isFirstSnapshot, getFirstSnapshotMessage } from './snapshot-summary.js';
import type { PageSnapshot, BlockSnapshot } from './snapshots/types.js';

/**
 * Create a mock block
 */
function createBlock(
  blockName: string,
  attrs: Record<string, unknown> = {},
  innerBlocks: BlockSnapshot[] = [],
  innerHTML = ''
): BlockSnapshot {
  return {
    blockName,
    attrs,
    innerBlocks,
    innerHTML,
    innerContent: innerHTML ? [innerHTML] : [],
  };
}

/**
 * Create a mock page snapshot
 */
function createPageSnapshot(blocks: BlockSnapshot[]): PageSnapshot {
  return {
    snapshot_version: '1.0',
    captured_at: new Date().toISOString(),
    page: {
      id: 1,
      slug: 'test-page',
      title: 'Test Page',
      status: 'publish',
      author: 'admin',
      author_id: 1,
      template: '',
      parent: 0,
      menu_order: 0,
      date: '2024-01-01T00:00:00',
      modified: '2024-01-01T00:00:00',
      link: 'https://example.com/test-page',
    },
    content: {
      blocks,
      raw: '',
    },
    meta: {},
  };
}

describe('summarizePageContent', () => {
  describe('empty pages', () => {
    it('should handle empty blocks array', () => {
      const snapshot = createPageSnapshot([]);
      const summary = summarizePageContent(snapshot);

      expect(summary.totalBlocks).toBe(0);
      expect(summary.sections).toHaveLength(0);
      expect(summary.summaryLines).toContain('Empty page (no blocks)');
    });
  });

  describe('simple pages', () => {
    it('should count blocks correctly', () => {
      const blocks = [
        createBlock('core/paragraph', {}, [], '<p>Hello</p>'),
        createBlock('core/paragraph', {}, [], '<p>World</p>'),
        createBlock('core/heading', { level: 2 }, [], '<h2>Title</h2>'),
      ];
      const snapshot = createPageSnapshot(blocks);
      const summary = summarizePageContent(snapshot);

      expect(summary.totalBlocks).toBe(3);
    });

    it('should count nested blocks', () => {
      const innerBlocks = [
        createBlock('core/paragraph', {}, [], '<p>Inner</p>'),
        createBlock('core/paragraph', {}, [], '<p>Content</p>'),
      ];
      const blocks = [
        createBlock('core/group', {}, innerBlocks),
      ];
      const snapshot = createPageSnapshot(blocks);
      const summary = summarizePageContent(snapshot);

      expect(summary.totalBlocks).toBe(3); // group + 2 paragraphs
    });
  });

  describe('section detection', () => {
    it('should detect hero section pattern', () => {
      const blocks = [
        createBlock('core/group', {}, [
          createBlock('core/heading', { level: 1 }, [], '<h1>Welcome</h1>'),
          createBlock('core/paragraph', {}, [], '<p>Description</p>'),
          createBlock('core/buttons', {}, [
            createBlock('core/button', {}, [], '<a>Click Here</a>'),
          ]),
        ]),
      ];
      const snapshot = createPageSnapshot(blocks);
      const summary = summarizePageContent(snapshot);

      expect(summary.sections.some(s => s.type === 'hero')).toBe(true);
    });

    it('should detect grid/columns pattern', () => {
      const blocks = [
        createBlock('core/columns', {}, [
          createBlock('core/column', {}, [
            createBlock('core/paragraph', {}, [], '<p>Col 1</p>'),
          ]),
          createBlock('core/column', {}, [
            createBlock('core/paragraph', {}, [], '<p>Col 2</p>'),
          ]),
          createBlock('core/column', {}, [
            createBlock('core/paragraph', {}, [], '<p>Col 3</p>'),
          ]),
        ]),
      ];
      const snapshot = createPageSnapshot(blocks);
      const summary = summarizePageContent(snapshot);

      expect(summary.sections.some(s => s.description.includes('column'))).toBe(true);
    });

    it('should detect CTA section pattern', () => {
      const blocks = [
        createBlock('core/group', {}, [
          createBlock('core/heading', { level: 2 }, [], '<h2>Get Started</h2>'),
          createBlock('core/buttons', {}, [
            createBlock('core/button', {}, [], '<a>Sign Up</a>'),
          ]),
        ]),
      ];
      const snapshot = createPageSnapshot(blocks);
      const summary = summarizePageContent(snapshot);

      expect(summary.sections.some(s => s.type === 'cta')).toBe(true);
    });

    it('should detect testimonial pattern', () => {
      const blocks = [
        createBlock('core/quote', {}, [], '<blockquote>Great product!</blockquote>'),
      ];
      const snapshot = createPageSnapshot(blocks);
      const summary = summarizePageContent(snapshot);

      expect(summary.sections.some(s => s.type === 'testimonial')).toBe(true);
    });

    it('should detect gallery pattern', () => {
      const blocks = [
        createBlock('core/gallery', { ids: [1, 2, 3] }),
      ];
      const snapshot = createPageSnapshot(blocks);
      const summary = summarizePageContent(snapshot);

      expect(summary.sections.some(s => s.type === 'gallery')).toBe(true);
    });
  });

  describe('summary lines', () => {
    it('should generate summary lines for sections', () => {
      const blocks = [
        createBlock('core/group', {}, [
          createBlock('core/heading', { level: 1 }, [], '<h1>Hero</h1>'),
          createBlock('core/paragraph', {}, [], '<p>Text</p>'),
        ]),
        createBlock('core/columns', {}, [
          createBlock('core/column'),
          createBlock('core/column'),
        ]),
      ];
      const snapshot = createPageSnapshot(blocks);
      const summary = summarizePageContent(snapshot);

      expect(summary.summaryLines.length).toBeGreaterThan(0);
    });

    it('should include component breakdown for hero sections', () => {
      const blocks = [
        createBlock('core/group', {}, [
          createBlock('core/heading', { level: 1 }),
          createBlock('core/paragraph'),
          createBlock('core/buttons'),
        ]),
      ];
      const snapshot = createPageSnapshot(blocks);
      const summary = summarizePageContent(snapshot);

      const heroSection = summary.sections.find(s => s.type === 'hero');
      expect(heroSection?.components).toBeDefined();
    });
  });
});

describe('isFirstSnapshot', () => {
  it('should return true for non-existent directory', () => {
    const result = isFirstSnapshot('/nonexistent/path/snapshots');
    expect(result).toBe(true);
  });
});

describe('getFirstSnapshotMessage', () => {
  it('should return the AI-readable message', () => {
    const message = getFirstSnapshotMessage();
    expect(message).toContain('AI-readable');
  });
});
