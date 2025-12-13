/**
 * Tests for Diff Engine
 *
 * @package WP_Navigator_MCP
 */

import { describe, it, expect } from 'vitest';
import {
  computeDiff,
  formatDiffText,
  formatDiffJson,
  snapshotToWordPressPages,
  snapshotToWordPressPlugins,
  type WordPressPage,
  type WordPressPlugin,
  type DiffResult,
} from './diff.js';
import type { WPNavManifest } from './manifest.js';
import type { SiteIndexSnapshot } from './snapshots/types.js';

/**
 * Create a minimal manifest for testing
 */
function createManifest(pages: { slug: string; title: string; status?: string }[]): WPNavManifest {
  return {
    schema_version: 1,
    manifest_version: '1.0',
    meta: { name: 'Test Site' },
    pages: pages.map((p) => ({
      slug: p.slug,
      title: p.title,
      status: p.status as 'publish' | 'draft' | undefined,
    })),
  };
}

/**
 * Create WordPress page data for testing
 */
function createWpPages(pages: { id: number; slug: string; title: string; status?: string }[]): WordPressPage[] {
  return pages.map((p) => ({
    id: p.id,
    slug: p.slug,
    title: p.title,
    status: p.status || 'publish',
  }));
}

describe('computeDiff', () => {
  describe('page additions', () => {
    it('should detect pages in manifest but not in WordPress', () => {
      const manifest = createManifest([
        { slug: 'about', title: 'About Us' },
        { slug: 'contact', title: 'Contact' },
      ]);
      const wpPages = createWpPages([
        { id: 1, slug: 'about', title: 'About Us' },
      ]);

      const diff = computeDiff(manifest, wpPages);

      expect(diff.summary.additions).toBe(1);
      expect(diff.pages.find((p) => p.slug === 'contact')).toMatchObject({
        change: 'add',
        inManifest: true,
        inWordPress: false,
      });
    });
  });

  describe('page removals', () => {
    it('should detect pages in WordPress but not in manifest (strict mode)', () => {
      const manifest = createManifest([
        { slug: 'about', title: 'About Us' },
      ]);
      const wpPages = createWpPages([
        { id: 1, slug: 'about', title: 'About Us' },
        { id: 2, slug: 'old-page', title: 'Old Page' },
      ]);

      const diff = computeDiff(manifest, wpPages, [], { strictMode: true });

      expect(diff.summary.removals).toBe(1);
      expect(diff.pages.find((p) => p.slug === 'old-page')).toMatchObject({
        change: 'remove',
        inManifest: false,
        inWordPress: true,
      });
    });

    it('should not flag removals in non-strict mode', () => {
      const manifest = createManifest([
        { slug: 'about', title: 'About Us' },
      ]);
      const wpPages = createWpPages([
        { id: 1, slug: 'about', title: 'About Us' },
        { id: 2, slug: 'old-page', title: 'Old Page' },
      ]);

      const diff = computeDiff(manifest, wpPages);

      expect(diff.summary.removals).toBe(0);
    });
  });

  describe('page modifications', () => {
    it('should detect title changes', () => {
      const manifest = createManifest([
        { slug: 'about', title: 'About Us Updated' },
      ]);
      const wpPages = createWpPages([
        { id: 1, slug: 'about', title: 'About Us' },
      ]);

      const diff = computeDiff(manifest, wpPages);

      expect(diff.summary.modifications).toBe(1);
      const pageDiff = diff.pages.find((p) => p.slug === 'about');
      expect(pageDiff?.change).toBe('modify');
      expect(pageDiff?.fields).toContainEqual({
        field: 'title',
        expected: 'About Us Updated',
        actual: 'About Us',
      });
    });

    it('should detect status changes', () => {
      const manifest = createManifest([
        { slug: 'about', title: 'About Us', status: 'draft' },
      ]);
      const wpPages = createWpPages([
        { id: 1, slug: 'about', title: 'About Us', status: 'publish' },
      ]);

      const diff = computeDiff(manifest, wpPages);

      expect(diff.summary.modifications).toBe(1);
      const pageDiff = diff.pages.find((p) => p.slug === 'about');
      expect(pageDiff?.fields).toContainEqual({
        field: 'status',
        expected: 'draft',
        actual: 'publish',
      });
    });
  });

  describe('page matches', () => {
    it('should count matching pages', () => {
      const manifest = createManifest([
        { slug: 'about', title: 'About Us' },
        { slug: 'contact', title: 'Contact' },
      ]);
      const wpPages = createWpPages([
        { id: 1, slug: 'about', title: 'About Us' },
        { id: 2, slug: 'contact', title: 'Contact' },
      ]);

      const diff = computeDiff(manifest, wpPages);

      expect(diff.summary.matches).toBe(2);
      expect(diff.summary.hasDifferences).toBe(false);
    });

    it('should include matches when option is set', () => {
      const manifest = createManifest([
        { slug: 'about', title: 'About Us' },
      ]);
      const wpPages = createWpPages([
        { id: 1, slug: 'about', title: 'About Us' },
      ]);

      const diff = computeDiff(manifest, wpPages, [], { includeMatches: true });

      expect(diff.pages).toHaveLength(1);
      expect(diff.pages[0].change).toBe('match');
    });

    it('should exclude matches by default', () => {
      const manifest = createManifest([
        { slug: 'about', title: 'About Us' },
      ]);
      const wpPages = createWpPages([
        { id: 1, slug: 'about', title: 'About Us' },
      ]);

      const diff = computeDiff(manifest, wpPages);

      expect(diff.pages).toHaveLength(0);
    });
  });

  describe('ignoreFields option', () => {
    it('should ignore specified fields when comparing', () => {
      const manifest = createManifest([
        { slug: 'about', title: 'Different Title' },
      ]);
      const wpPages = createWpPages([
        { id: 1, slug: 'about', title: 'About Us' },
      ]);

      const diff = computeDiff(manifest, wpPages, [], { ignoreFields: ['title'] });

      expect(diff.summary.modifications).toBe(0);
      expect(diff.summary.matches).toBe(1);
    });
  });

  describe('plugin comparison', () => {
    it('should detect plugin state differences', () => {
      const manifest: WPNavManifest = {
        schema_version: 1,
        manifest_version: '1.0',
        meta: { name: 'Test Site' },
        plugins: {
          'akismet': { enabled: true },
        },
      };
      const wpPlugins: WordPressPlugin[] = [
        { slug: 'akismet', name: 'Akismet', active: false, version: '5.0' },
      ];

      const diff = computeDiff(manifest, [], wpPlugins);

      expect(diff.plugins).toHaveLength(1);
      expect(diff.plugins[0]).toMatchObject({
        slug: 'akismet',
        change: 'modify',
        isActive: false,
        expectedEnabled: true,
      });
    });

    it('should detect missing plugins', () => {
      const manifest: WPNavManifest = {
        schema_version: 1,
        manifest_version: '1.0',
        meta: { name: 'Test Site' },
        plugins: {
          'missing-plugin': { enabled: true },
        },
      };

      const diff = computeDiff(manifest, [], []);

      expect(diff.plugins).toHaveLength(1);
      expect(diff.plugins[0]).toMatchObject({
        slug: 'missing-plugin',
        change: 'add',
        inManifest: true,
        isActive: false,
      });
    });
  });

  describe('summary', () => {
    it('should provide accurate summary', () => {
      const manifest = createManifest([
        { slug: 'new-page', title: 'New Page' },
        { slug: 'existing', title: 'Modified Title' },
        { slug: 'matching', title: 'Matching Page' },
      ]);
      const wpPages = createWpPages([
        { id: 1, slug: 'existing', title: 'Existing' },
        { id: 2, slug: 'matching', title: 'Matching Page' },
        { id: 3, slug: 'to-remove', title: 'Remove Me' },
      ]);

      const diff = computeDiff(manifest, wpPages, [], { strictMode: true });

      expect(diff.summary.additions).toBe(1);
      expect(diff.summary.removals).toBe(1);
      expect(diff.summary.modifications).toBe(1);
      expect(diff.summary.matches).toBe(1);
      expect(diff.summary.hasDifferences).toBe(true);
    });
  });
});

describe('snapshotToWordPressPages', () => {
  it('should convert snapshot pages to WordPressPage format', () => {
    const snapshot: SiteIndexSnapshot = {
      snapshot_version: '1.0',
      captured_at: new Date().toISOString(),
      site: {
        name: 'Test',
        url: 'https://example.com',
        wordpress_version: '6.4',
        theme: { name: 'Twenty Twenty-Four', slug: 'twentytwentyfour', version: '1.0' },
      },
      content: {
        pages: [
          { id: 1, slug: 'about', title: 'About Us', status: 'publish', modified: '' },
          { id: 2, slug: 'contact', title: 'Contact', status: 'draft', template: 'template-contact.php', modified: '' },
        ],
        posts: [],
        media: { count: 0 },
      },
      plugins: { active: [], inactive: [] },
    };

    const pages = snapshotToWordPressPages(snapshot);

    expect(pages).toHaveLength(2);
    expect(pages[0]).toMatchObject({
      id: 1,
      slug: 'about',
      title: 'About Us',
      status: 'publish',
    });
    expect(pages[1]).toMatchObject({
      id: 2,
      slug: 'contact',
      template: 'template-contact.php',
    });
  });
});

describe('snapshotToWordPressPlugins', () => {
  it('should convert snapshot plugins to WordPressPlugin format', () => {
    const snapshot: SiteIndexSnapshot = {
      snapshot_version: '1.0',
      captured_at: new Date().toISOString(),
      site: {
        name: 'Test',
        url: 'https://example.com',
        wordpress_version: '6.4',
        theme: { name: 'Twenty Twenty-Four', slug: 'twentytwentyfour', version: '1.0' },
      },
      content: { pages: [], posts: [], media: { count: 0 } },
      plugins: {
        active: [
          { slug: 'akismet', name: 'Akismet', version: '5.0' },
        ],
        inactive: [
          { slug: 'hello-dolly', name: 'Hello Dolly', version: '1.0' },
        ],
      },
    };

    const plugins = snapshotToWordPressPlugins(snapshot);

    expect(plugins).toHaveLength(2);
    expect(plugins.find((p) => p.slug === 'akismet')).toMatchObject({
      active: true,
      version: '5.0',
    });
    expect(plugins.find((p) => p.slug === 'hello-dolly')).toMatchObject({
      active: false,
      version: '1.0',
    });
  });
});

describe('formatDiffText', () => {
  it('should format diff with no differences', () => {
    const diff: DiffResult = {
      timestamp: new Date().toISOString(),
      summary: {
        additions: 0,
        removals: 0,
        modifications: 0,
        matches: 2,
        total: 2,
        hasDifferences: false,
      },
      pages: [],
      plugins: [],
    };

    const text = formatDiffText(diff);

    expect(text).toContain('No differences found');
  });

  it('should format diff with changes', () => {
    const diff: DiffResult = {
      timestamp: new Date().toISOString(),
      summary: {
        additions: 1,
        removals: 1,
        modifications: 1,
        matches: 0,
        total: 3,
        hasDifferences: true,
      },
      pages: [
        { slug: 'new', title: 'New Page', change: 'add', severity: 'warning', inManifest: true, inWordPress: false },
        { slug: 'old', title: 'Old Page', change: 'remove', severity: 'warning', inManifest: false, inWordPress: true, wpId: 1 },
        {
          slug: 'modified',
          title: 'Modified',
          change: 'modify',
          severity: 'info',
          inManifest: true,
          inWordPress: true,
          wpId: 2,
          fields: [{ field: 'title', expected: 'Modified', actual: 'Old Title' }],
        },
      ],
      plugins: [],
    };

    const text = formatDiffText(diff);

    expect(text).toContain('+1 to add');
    expect(text).toContain('-1 to remove');
    expect(text).toContain('~1 modified');
    expect(text).toContain('+ new');
    expect(text).toContain('- old');
    expect(text).toContain('~ modified');
  });
});

describe('formatDiffJson', () => {
  it('should output valid JSON', () => {
    const diff: DiffResult = {
      timestamp: '2024-01-01T00:00:00.000Z',
      summary: {
        additions: 0,
        removals: 0,
        modifications: 0,
        matches: 1,
        total: 1,
        hasDifferences: false,
      },
      pages: [],
      plugins: [],
    };

    const json = formatDiffJson(diff);
    const parsed = JSON.parse(json);

    expect(parsed.timestamp).toBe('2024-01-01T00:00:00.000Z');
    expect(parsed.summary.hasDifferences).toBe(false);
  });
});
