import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import { evaluateRules, SUGGESTION_RULES, ProjectContext, Suggestion } from './rules.js';
import { analyzeState } from './analyzer.js';
import { suggestCommand } from '../cli/commands/suggest.js';

describe('Suggestion Rules', () => {
  describe('evaluateRules', () => {
    it('returns setup suggestions when no connection', () => {
      const context: ProjectContext = {
        hasManifest: false,
        hasConnection: false,
        hasSiteSnapshot: false,
        detectedPlugins: [],
        availableCookbooks: [],
        loadedCookbooks: [],
      };

      const suggestions = evaluateRules(context);

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].action).toBe('wpnav configure');
      expect(suggestions[0].priority).toBe('high');
    });

    it('suggests init when connected but no manifest', () => {
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

    it('suggests snapshot when no site snapshot exists', () => {
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

    it('suggests refresh for stale snapshots', () => {
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

    it('filters by category', () => {
      const context: ProjectContext = {
        hasManifest: false,
        hasConnection: true,
        hasSiteSnapshot: false,
        detectedPlugins: ['woocommerce'],
        availableCookbooks: ['woocommerce'],
        loadedCookbooks: [],
      };

      const suggestions = evaluateRules(context, { category: 'setup' });

      expect(suggestions.every((s) => s.category === 'setup')).toBe(true);
    });

    it('applies limit', () => {
      const context: ProjectContext = {
        hasManifest: false,
        hasConnection: false,
        hasSiteSnapshot: false,
        detectedPlugins: [],
        availableCookbooks: [],
        loadedCookbooks: [],
      };

      const suggestions = evaluateRules(context, { limit: 1 });

      expect(suggestions.length).toBe(1);
    });

    it('suggests cookbook for detected plugins', () => {
      const context: ProjectContext = {
        hasManifest: true,
        hasConnection: true,
        hasSiteSnapshot: true,
        detectedPlugins: ['elementor'],
        availableCookbooks: ['elementor'],
        loadedCookbooks: [],
      };

      const suggestions = evaluateRules(context);

      expect(suggestions.some((s) => s.reason.includes('elementor'))).toBe(true);
    });

    it('provides role-specific suggestions', () => {
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
});

describe('State Analyzer', () => {
  beforeEach(() => {
    vi.spyOn(fs, 'accessSync').mockImplementation(() => {});
    vi.spyOn(fs, 'statSync').mockReturnValue({
      mtime: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    } as fs.Stats);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('detects existing files', () => {
    const context = analyzeState({ cwd: '/test' });

    // With mocked accessSync that doesn't throw, all should be true
    expect(context.hasManifest).toBe(true);
    expect(context.hasConnection).toBe(true);
  });

  it('extracts plugin slugs from introspect', () => {
    const context = analyzeState({
      introspect: {
        detected_plugins: ['woocommerce/woocommerce.php', 'yoast-seo/yoast.php'],
      },
    });

    expect(context.detectedPlugins).toContain('woocommerce');
    expect(context.detectedPlugins).toContain('yoast-seo');
  });

  it('passes through active role', () => {
    const context = analyzeState({ activeRole: 'developer' });

    expect(context.activeRole).toBe('developer');
  });
});

describe('Suggest Command', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(fs, 'accessSync').mockImplementation(() => {
      throw new Error('not found');
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns suggestions and context', async () => {
    const result = await suggestCommand({ json: true });

    expect(result.suggestions).toBeDefined();
    expect(Array.isArray(result.suggestions)).toBe(true);
    expect(result.context).toBeDefined();
  });

  it('outputs JSON when --json flag used', async () => {
    await suggestCommand({ json: true });

    expect(console.log).toHaveBeenCalled();
    const call = (console.log as any).mock.calls[0][0];
    expect(() => JSON.parse(call)).not.toThrow();
  });

  it('filters by category', async () => {
    const result = await suggestCommand({ category: 'setup' });

    expect(result.suggestions.every((s) => s.category === 'setup')).toBe(true);
  });

  it('applies limit', async () => {
    const result = await suggestCommand({ limit: 2 });

    expect(result.suggestions.length).toBeLessThanOrEqual(2);
  });
});
