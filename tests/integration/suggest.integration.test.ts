/**
 * Suggest Command Integration Tests
 *
 * Tests the suggest command with various project contexts and configurations.
 *
 * @package WP_Navigator_Pro
 * @since 2.8.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import { evaluateRules, ProjectContext, Suggestion } from '../../src/suggest/rules.js';
import { analyzeState, AnalyzerOptions } from '../../src/suggest/analyzer.js';

describe('Suggest Command Integration', () => {
  describe('Full Workflow', () => {
    beforeEach(() => {
      vi.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('suggests setup commands for new project', () => {
      const context: ProjectContext = {
        hasManifest: false,
        hasConnection: false,
        hasSiteSnapshot: false,
        detectedPlugins: [],
        availableCookbooks: [],
        loadedCookbooks: [],
      };

      const suggestions = evaluateRules(context);

      // Should prioritize connection setup
      expect(suggestions[0].action).toBe('wpnav configure');
      expect(suggestions[0].priority).toBe('high');
    });

    it('suggests init after connection established', () => {
      const context: ProjectContext = {
        hasManifest: false,
        hasConnection: true,
        hasSiteSnapshot: false,
        detectedPlugins: [],
        availableCookbooks: [],
        loadedCookbooks: [],
      };

      const suggestions = evaluateRules(context);

      expect(suggestions.some((s) => s.action === 'wpnav init')).toBe(true);
    });

    it('suggests snapshot for configured projects', () => {
      const context: ProjectContext = {
        hasManifest: true,
        hasConnection: true,
        hasSiteSnapshot: false,
        detectedPlugins: [],
        availableCookbooks: [],
        loadedCookbooks: [],
      };

      const suggestions = evaluateRules(context);

      expect(suggestions.some((s) => s.action === 'wpnav snapshot site')).toBe(true);
    });

    it('suggests cookbook loading for detected plugins', () => {
      const context: ProjectContext = {
        hasManifest: true,
        hasConnection: true,
        hasSiteSnapshot: true,
        detectedPlugins: ['woocommerce', 'elementor'],
        availableCookbooks: ['woocommerce', 'elementor'],
        loadedCookbooks: [],
      };

      const suggestions = evaluateRules(context);

      // Should suggest loading cookbooks for detected plugins
      expect(
        suggestions.some((s) => s.reason.includes('woocommerce') || s.reason.includes('elementor'))
      ).toBe(true);
    });

    it('provides content-focused suggestions for content-editor role', () => {
      const context: ProjectContext = {
        hasManifest: true,
        hasConnection: true,
        hasSiteSnapshot: true,
        detectedPlugins: [],
        availableCookbooks: [],
        loadedCookbooks: [],
        activeRole: 'content-editor',
      };

      const suggestions = evaluateRules(context);

      expect(suggestions.some((s) => s.reason.includes('content editor'))).toBe(true);
    });
  });

  describe('State Analysis', () => {
    it('detects project files correctly', () => {
      // Mock file system to simulate existing files
      vi.spyOn(fs, 'accessSync').mockImplementation((path) => {
        const existingPaths = [
          '/test/wpnavigator.jsonc',
          '/test/wpnav.config.json',
          '/test/snapshots/site.json',
        ];
        if (!existingPaths.some((p) => String(path).includes(p.split('/').pop()!))) {
          throw new Error('ENOENT');
        }
      });
      vi.spyOn(fs, 'statSync').mockReturnValue({
        mtime: new Date(Date.now() - 1000 * 60 * 60), // 1 hour ago
      } as fs.Stats);

      const context = analyzeState({ cwd: '/test' });

      expect(context.hasManifest).toBe(true);
      expect(context.hasConnection).toBe(true);
      expect(context.hasSiteSnapshot).toBe(true);
      expect(context.snapshotAge).toBeCloseTo(1, 0); // ~1 hour
    });

    it('extracts plugin slugs from introspect data', () => {
      vi.spyOn(fs, 'accessSync').mockImplementation(() => {
        throw new Error('ENOENT');
      });

      const context = analyzeState({
        introspect: {
          detected_plugins: [
            'woocommerce/woocommerce.php',
            'elementor/elementor.php',
            'yoast-seo/yoast.php',
          ],
          available_cookbooks: ['woocommerce', 'elementor', 'yoast'],
        },
      });

      expect(context.detectedPlugins).toContain('woocommerce');
      expect(context.detectedPlugins).toContain('elementor');
      expect(context.detectedPlugins).toContain('yoast-seo');
      expect(context.availableCookbooks).toHaveLength(3);
    });

    it('handles missing introspect data gracefully', () => {
      vi.spyOn(fs, 'accessSync').mockImplementation(() => {
        throw new Error('ENOENT');
      });

      const context = analyzeState({});

      expect(context.detectedPlugins).toHaveLength(0);
      expect(context.availableCookbooks).toHaveLength(0);
      expect(context.loadedCookbooks).toHaveLength(0);
    });
  });

  describe('Suggestion Filtering', () => {
    const fullContext: ProjectContext = {
      hasManifest: false,
      hasConnection: false,
      hasSiteSnapshot: false,
      detectedPlugins: ['woocommerce'],
      availableCookbooks: ['woocommerce'],
      loadedCookbooks: [],
    };

    it('filters by category', () => {
      const setupOnly = evaluateRules(fullContext, { category: 'setup' });

      expect(setupOnly.every((s) => s.category === 'setup')).toBe(true);
    });

    it('applies limit', () => {
      const limited = evaluateRules(fullContext, { limit: 2 });

      expect(limited.length).toBeLessThanOrEqual(2);
    });

    it('combines category and limit', () => {
      const filtered = evaluateRules(fullContext, { category: 'setup', limit: 1 });

      expect(filtered.length).toBe(1);
      expect(filtered[0].category).toBe('setup');
    });
  });

  describe('Priority Ordering', () => {
    it('orders suggestions by priority', () => {
      const context: ProjectContext = {
        hasManifest: false,
        hasConnection: false,
        hasSiteSnapshot: false,
        detectedPlugins: [],
        availableCookbooks: [],
        loadedCookbooks: [],
      };

      const suggestions = evaluateRules(context);

      // High priority should come before medium/low
      const firstHighIndex = suggestions.findIndex((s) => s.priority === 'high');
      const firstMediumIndex = suggestions.findIndex((s) => s.priority === 'medium');
      const firstLowIndex = suggestions.findIndex((s) => s.priority === 'low');

      if (firstHighIndex !== -1 && firstMediumIndex !== -1) {
        expect(firstHighIndex).toBeLessThan(firstMediumIndex);
      }
      if (firstMediumIndex !== -1 && firstLowIndex !== -1) {
        expect(firstMediumIndex).toBeLessThan(firstLowIndex);
      }
    });
  });

  describe('Stale Snapshot Detection', () => {
    it('suggests refresh for snapshots older than 24 hours', () => {
      const context: ProjectContext = {
        hasManifest: true,
        hasConnection: true,
        hasSiteSnapshot: true,
        snapshotAge: 48, // 48 hours old
        detectedPlugins: [],
        availableCookbooks: [],
        loadedCookbooks: [],
      };

      const suggestions = evaluateRules(context);

      expect(suggestions.some((s) => s.reason.includes('hours old'))).toBe(true);
    });

    it('does not suggest refresh for recent snapshots', () => {
      const context: ProjectContext = {
        hasManifest: true,
        hasConnection: true,
        hasSiteSnapshot: true,
        snapshotAge: 2, // 2 hours old
        detectedPlugins: [],
        availableCookbooks: [],
        loadedCookbooks: [],
      };

      const suggestions = evaluateRules(context);

      expect(suggestions.some((s) => s.reason.includes('hours old'))).toBe(false);
    });
  });
});
