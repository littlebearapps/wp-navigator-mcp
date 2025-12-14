/**
 * Version Matcher Tests
 *
 * Tests for plugin version matching utilities.
 *
 * @package WP_Navigator_MCP
 * @since 2.1.0
 */

import { describe, it, expect } from 'vitest';
import {
  isVersionCompatible,
  matchCookbooksToPlugins,
  type PluginInfo,
} from './version-matcher.js';
import type { LoadedCookbook } from './types.js';

// =============================================================================
// isVersionCompatible Tests
// =============================================================================

describe('isVersionCompatible', () => {
  describe('basic version checks', () => {
    it('should return true when no constraints provided', () => {
      expect(isVersionCompatible('1.0.0')).toBe(true);
      expect(isVersionCompatible('5.0.0', undefined, undefined)).toBe(true);
    });

    it('should return true when plugin version is undefined', () => {
      expect(isVersionCompatible(undefined, '1.0.0', '2.0.0')).toBe(true);
    });

    it('should return true for invalid version format', () => {
      expect(isVersionCompatible('invalid', '1.0.0')).toBe(true);
    });
  });

  describe('minimum version checks', () => {
    it('should return true when version meets minimum', () => {
      expect(isVersionCompatible('3.20.0', '3.20.0')).toBe(true);
      expect(isVersionCompatible('3.21.0', '3.20.0')).toBe(true);
      expect(isVersionCompatible('4.0.0', '3.20.0')).toBe(true);
    });

    it('should return false when version below minimum', () => {
      expect(isVersionCompatible('3.19.0', '3.20.0')).toBe(false);
      expect(isVersionCompatible('2.0.0', '3.0.0')).toBe(false);
      expect(isVersionCompatible('3.19.9', '3.20.0')).toBe(false);
    });
  });

  describe('maximum version checks', () => {
    it('should return true when version within maximum', () => {
      expect(isVersionCompatible('3.20.0', undefined, '4.0.0')).toBe(true);
      expect(isVersionCompatible('3.99.99', undefined, '4.0.0')).toBe(true);
    });

    it('should return false when version exceeds maximum', () => {
      expect(isVersionCompatible('4.1.0', undefined, '4.0.0')).toBe(false);
      expect(isVersionCompatible('5.0.0', undefined, '4.0.0')).toBe(false);
    });
  });

  describe('combined min/max checks', () => {
    it('should return true when version in range', () => {
      expect(isVersionCompatible('3.21.0', '3.20.0', '4.0.0')).toBe(true);
      expect(isVersionCompatible('3.20.0', '3.20.0', '4.0.0')).toBe(true);
      expect(isVersionCompatible('4.0.0', '3.20.0', '4.0.0')).toBe(true);
    });

    it('should return false when version out of range', () => {
      expect(isVersionCompatible('3.19.0', '3.20.0', '4.0.0')).toBe(false);
      expect(isVersionCompatible('4.1.0', '3.20.0', '4.0.0')).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle two-part versions', () => {
      expect(isVersionCompatible('6.0', '6.0')).toBe(true);
      expect(isVersionCompatible('6.1', '6.0')).toBe(true);
      expect(isVersionCompatible('5.9', '6.0')).toBe(false);
    });

    it('should handle single-part versions', () => {
      expect(isVersionCompatible('6', '6')).toBe(true);
      expect(isVersionCompatible('7', '6')).toBe(true);
    });

    it('should compare different length versions', () => {
      expect(isVersionCompatible('6.0.0', '6.0')).toBe(true);
      expect(isVersionCompatible('6.0', '6.0.0')).toBe(true);
    });
  });
});

// =============================================================================
// matchCookbooksToPlugins Tests
// =============================================================================

describe('matchCookbooksToPlugins', () => {
  const createCookbook = (
    slug: string,
    minVersion?: string,
    maxVersion?: string
  ): LoadedCookbook => ({
    schema_version: 1,
    cookbook_version: '1.0.0',
    plugin: {
      slug,
      name: slug.charAt(0).toUpperCase() + slug.slice(1),
      min_version: minVersion,
      max_version: maxVersion,
    },
    capabilities: {},
    source: 'bundled',
    sourcePath: `/test/${slug}.md`,
  });

  it('should match plugins to cookbooks', () => {
    const cookbooks = new Map<string, LoadedCookbook>([
      ['gutenberg', createCookbook('gutenberg', '6.0')],
      ['elementor', createCookbook('elementor', '3.20.0')],
    ]);

    const plugins: PluginInfo[] = [
      { slug: 'gutenberg', version: '17.0.0' },
      { slug: 'elementor', version: '3.21.0' },
    ];

    const matches = matchCookbooksToPlugins(cookbooks, plugins);

    expect(matches).toHaveLength(2);
    expect(matches[0].plugin.slug).toBe('gutenberg');
    expect(matches[0].compatible).toBe(true);
    expect(matches[1].plugin.slug).toBe('elementor');
    expect(matches[1].compatible).toBe(true);
  });

  it('should skip plugins without cookbooks', () => {
    const cookbooks = new Map<string, LoadedCookbook>([['gutenberg', createCookbook('gutenberg')]]);

    const plugins: PluginInfo[] = [
      { slug: 'gutenberg', version: '17.0.0' },
      { slug: 'woocommerce', version: '8.0.0' },
      { slug: 'yoast-seo', version: '21.0.0' },
    ];

    const matches = matchCookbooksToPlugins(cookbooks, plugins);

    expect(matches).toHaveLength(1);
    expect(matches[0].plugin.slug).toBe('gutenberg');
  });

  it('should mark incompatible versions', () => {
    const cookbooks = new Map<string, LoadedCookbook>([
      ['elementor', createCookbook('elementor', '3.20.0', '4.0.0')],
    ]);

    const plugins: PluginInfo[] = [{ slug: 'elementor', version: '3.19.0' }];

    const matches = matchCookbooksToPlugins(cookbooks, plugins);

    expect(matches).toHaveLength(1);
    expect(matches[0].compatible).toBe(false);
    expect(matches[0].reason).toContain('below minimum');
  });

  it('should mark version exceeds maximum', () => {
    const cookbooks = new Map<string, LoadedCookbook>([
      ['elementor', createCookbook('elementor', '3.20.0', '4.0.0')],
    ]);

    const plugins: PluginInfo[] = [{ slug: 'elementor', version: '4.1.0' }];

    const matches = matchCookbooksToPlugins(cookbooks, plugins);

    expect(matches).toHaveLength(1);
    expect(matches[0].compatible).toBe(false);
    expect(matches[0].reason).toContain('exceeds maximum');
  });

  it('should handle empty inputs', () => {
    expect(matchCookbooksToPlugins(new Map(), [])).toEqual([]);
    expect(matchCookbooksToPlugins(new Map([['test', createCookbook('test')]]), [])).toEqual([]);
  });
});
