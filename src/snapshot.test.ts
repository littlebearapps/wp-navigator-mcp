/**
 * Tests for snapshot command functionality
 *
 * @package WP_Navigator_MCP
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  SNAPSHOT_VERSION,
  SNAPSHOT_PATHS,
  isSiteIndexSnapshot,
  isPageSnapshot,
  createEmptySiteSnapshot,
  createEmptyPageSnapshot,
  type SiteIndexSnapshot,
} from './snapshots/index.js';
import { parseGutenbergBlocks } from './gutenberg/index.js';

// Test Helpers
let tempDir: string;

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wpnav-snapshot-test-'));
});

afterEach(() => {
  if (tempDir && fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true });
  }
});

describe('Snapshot Types', () => {
  describe('SNAPSHOT_VERSION', () => {
    it('should be a valid version string', () => {
      expect(SNAPSHOT_VERSION).toBe('1.0');
    });
  });

  describe('SNAPSHOT_PATHS', () => {
    it('should define all required paths', () => {
      expect(SNAPSHOT_PATHS.ROOT).toBe('snapshots');
      expect(SNAPSHOT_PATHS.SITE_INDEX).toBe('snapshots/site_index.json');
      expect(SNAPSHOT_PATHS.PAGES).toBe('snapshots/pages');
    });
  });

  describe('createEmptySiteSnapshot', () => {
    it('should create a valid empty site snapshot', () => {
      const snapshot = createEmptySiteSnapshot();
      expect(snapshot.snapshot_version).toBe(SNAPSHOT_VERSION);
      expect(snapshot.captured_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(isSiteIndexSnapshot(snapshot)).toBe(true);
    });
  });

  describe('createEmptyPageSnapshot', () => {
    it('should create a valid empty page snapshot', () => {
      const snapshot = createEmptyPageSnapshot();
      expect(snapshot.snapshot_version).toBe(SNAPSHOT_VERSION);
      expect(isPageSnapshot(snapshot)).toBe(true);
    });
  });

  describe('isSiteIndexSnapshot', () => {
    it('should validate correct site snapshot', () => {
      const valid: SiteIndexSnapshot = {
        snapshot_version: SNAPSHOT_VERSION,
        captured_at: new Date().toISOString(),
        site: {
          name: 'Test Site',
          url: 'https://example.com',
          wordpress_version: '6.4',
          theme: { name: 'Twenty Twenty-Four', slug: 'twentytwentyfour', version: '1.0' },
        },
        content: { pages: [], posts: [], media: { count: 0 } },
        plugins: { active: [], inactive: [] },
      };
      expect(isSiteIndexSnapshot(valid)).toBe(true);
    });

    it('should reject invalid objects', () => {
      expect(isSiteIndexSnapshot(null)).toBe(false);
      expect(isSiteIndexSnapshot(undefined)).toBe(false);
      expect(isSiteIndexSnapshot({})).toBe(false);
    });
  });
});

describe('Gutenberg Block Parser', () => {
  it('should parse simple paragraph block', () => {
    const content = '<!-- wp:paragraph -->\n<p>Hello World</p>\n<!-- /wp:paragraph -->';
    const blocks = parseGutenbergBlocks(content);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].blockName).toBe('core/paragraph');
  });

  it('should parse heading block with attributes', () => {
    const content = '<!-- wp:heading {"level":2} -->\n<h2>My Heading</h2>\n<!-- /wp:heading -->';
    const blocks = parseGutenbergBlocks(content);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].blockName).toBe('core/heading');
    expect(blocks[0].attrs).toEqual({ level: 2 });
  });

  it('should parse self-closing block', () => {
    const content = '<!-- wp:separator {"className":"is-style-wide"} /-->';
    const blocks = parseGutenbergBlocks(content);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].blockName).toBe('core/separator');
  });

  it('should parse namespaced block', () => {
    const content = '<!-- wp:acf/testimonial {"id":"block_123"} -->\n<div>Test</div>\n<!-- /wp:acf/testimonial -->';
    const blocks = parseGutenbergBlocks(content);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].blockName).toBe('acf/testimonial');
  });

  it('should parse multiple blocks', () => {
    const content = `<!-- wp:heading {"level":1} -->
<h1>Title</h1>
<!-- /wp:heading -->
<!-- wp:paragraph -->
<p>First paragraph</p>
<!-- /wp:paragraph -->`;
    const blocks = parseGutenbergBlocks(content);
    expect(blocks).toHaveLength(2);
  });

  it('should handle empty content', () => {
    expect(parseGutenbergBlocks('')).toHaveLength(0);
  });
});

describe('Snapshot File Writing', () => {
  it('should write valid JSON snapshot file', () => {
    const snapshot = createEmptySiteSnapshot();
    const filePath = path.join(tempDir, 'test_snapshot.json');
    fs.writeFileSync(filePath, JSON.stringify(snapshot, null, 2));
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    expect(parsed.snapshot_version).toBe(SNAPSHOT_VERSION);
  });

  it('should write page snapshot to pages subdirectory', () => {
    const pagesDir = path.join(tempDir, SNAPSHOT_PATHS.PAGES);
    fs.mkdirSync(pagesDir, { recursive: true });
    const snapshot = createEmptyPageSnapshot();
    snapshot.page.slug = 'about';
    const filePath = path.join(pagesDir, 'about.json');
    fs.writeFileSync(filePath, JSON.stringify(snapshot, null, 2));
    expect(fs.existsSync(filePath)).toBe(true);
  });
});
