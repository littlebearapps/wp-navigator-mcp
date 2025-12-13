/**
 * Tests for Sync Engine
 *
 * @package WP_Navigator_MCP
 */

import { describe, it, expect, vi } from 'vitest';
import {
  executeSync,
  formatSyncText,
  formatSyncJson,
  type SyncResult,
  type WpRequestFn,
} from './sync.js';
import type { DiffResult, PageDiff, PluginDiff } from './diff.js';
import type { WPNavManifest } from './manifest.js';

/**
 * Create mock WordPress request function
 */
function createMockWpRequest(
  responses: Record<string, unknown> = {}
): WpRequestFn {
  return vi.fn(async (endpoint: string, options?: RequestInit) => {
    // Return mock response based on endpoint
    if (endpoint.includes('/wp/v2/pages') && options?.method === 'POST') {
      return { id: 123, slug: 'test-page' };
    }
    if (endpoint.includes('/wp/v2/plugins')) {
      return { status: 'active' };
    }
    return responses[endpoint] ?? {};
  });
}

/**
 * Create a basic diff result for testing
 */
function createDiffResult(overrides: Partial<DiffResult> = {}): DiffResult {
  return {
    timestamp: new Date().toISOString(),
    summary: {
      additions: 0,
      removals: 0,
      modifications: 0,
      matches: 0,
      total: 0,
      hasDifferences: false,
    },
    pages: [],
    plugins: [],
    ...overrides,
  };
}

/**
 * Create a basic manifest for testing
 */
function createManifest(overrides: Partial<WPNavManifest> = {}): WPNavManifest {
  return {
    schema_version: 1,
    manifest_version: '1.0',
    meta: { name: 'Test Site' },
    ...overrides,
  };
}

describe('executeSync', () => {
  describe('page creation', () => {
    it('should create pages that are in manifest but not in WordPress', async () => {
      const diff = createDiffResult({
        pages: [
          {
            slug: 'new-page',
            title: 'New Page',
            change: 'add',
            severity: 'warning',
            inManifest: true,
            inWordPress: false,
          },
        ],
        summary: { additions: 1, removals: 0, modifications: 0, matches: 0, total: 1, hasDifferences: true },
      });

      const manifest = createManifest({
        pages: [{ slug: 'new-page', title: 'New Page', status: 'publish' }],
      });

      const wpRequest = createMockWpRequest();
      const result = await executeSync(diff, manifest, wpRequest);

      expect(result.success).toBe(true);
      expect(result.operations).toHaveLength(1);
      expect(result.operations[0]).toMatchObject({
        operation: 'create',
        resourceType: 'page',
        slug: 'new-page',
        success: true,
      });
      expect(wpRequest).toHaveBeenCalledWith('/wp/v2/pages', expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"slug":"new-page"'),
      }));
    });

    it('should handle page creation failure gracefully', async () => {
      const diff = createDiffResult({
        pages: [
          {
            slug: 'new-page',
            title: 'New Page',
            change: 'add',
            severity: 'warning',
            inManifest: true,
            inWordPress: false,
          },
        ],
      });

      const manifest = createManifest({
        pages: [{ slug: 'new-page', title: 'New Page' }],
      });

      const wpRequest = vi.fn(async () => {
        throw new Error('Network error');
      });

      const result = await executeSync(diff, manifest, wpRequest);

      expect(result.success).toBe(false);
      expect(result.summary.failed).toBe(1);
      expect(result.operations[0]).toMatchObject({
        success: false,
        error: 'Network error',
      });
    });
  });

  describe('page updates', () => {
    it('should update pages that differ between manifest and WordPress', async () => {
      const diff = createDiffResult({
        pages: [
          {
            slug: 'existing-page',
            title: 'Updated Title',
            change: 'modify',
            severity: 'info',
            inManifest: true,
            inWordPress: true,
            wpId: 42,
            fields: [{ field: 'title', expected: 'Updated Title', actual: 'Old Title' }],
          },
        ],
      });

      const manifest = createManifest({
        pages: [{ slug: 'existing-page', title: 'Updated Title' }],
      });

      const wpRequest = createMockWpRequest();
      const result = await executeSync(diff, manifest, wpRequest);

      expect(result.success).toBe(true);
      expect(result.operations[0]).toMatchObject({
        operation: 'update',
        slug: 'existing-page',
        wpId: 42,
      });
      expect(wpRequest).toHaveBeenCalledWith('/wp/v2/pages/42', expect.objectContaining({
        method: 'POST',
      }));
    });
  });

  describe('page deletion', () => {
    it('should not delete pages by default', async () => {
      const diff = createDiffResult({
        pages: [
          {
            slug: 'orphan-page',
            title: 'Orphan Page',
            change: 'remove',
            severity: 'warning',
            inManifest: false,
            inWordPress: true,
            wpId: 99,
          },
        ],
      });

      const manifest = createManifest();
      const wpRequest = createMockWpRequest();
      const result = await executeSync(diff, manifest, wpRequest);

      expect(result.operations).toHaveLength(0);
    });

    it('should delete pages when syncDeletions is enabled', async () => {
      const diff = createDiffResult({
        pages: [
          {
            slug: 'orphan-page',
            title: 'Orphan Page',
            change: 'remove',
            severity: 'warning',
            inManifest: false,
            inWordPress: true,
            wpId: 99,
          },
        ],
      });

      const manifest = createManifest();
      const wpRequest = createMockWpRequest();
      const result = await executeSync(diff, manifest, wpRequest, { syncDeletions: true });

      expect(result.operations).toHaveLength(1);
      expect(result.operations[0]).toMatchObject({
        operation: 'delete',
        slug: 'orphan-page',
      });
    });
  });

  describe('plugin operations', () => {
    it('should activate plugins that should be enabled', async () => {
      const diff = createDiffResult({
        plugins: [
          {
            slug: 'akismet',
            name: 'Akismet',
            change: 'modify',
            severity: 'info',
            inManifest: true,
            isActive: false,
            expectedEnabled: true,
          },
        ],
      });

      const manifest = createManifest({
        plugins: { akismet: { enabled: true } },
      });

      const wpRequest = createMockWpRequest();
      const result = await executeSync(diff, manifest, wpRequest);

      expect(result.operations[0]).toMatchObject({
        operation: 'activate',
        slug: 'akismet',
      });
    });

    it('should deactivate plugins that should be disabled', async () => {
      const diff = createDiffResult({
        plugins: [
          {
            slug: 'hello-dolly',
            name: 'Hello Dolly',
            change: 'modify',
            severity: 'info',
            inManifest: true,
            isActive: true,
            expectedEnabled: false,
          },
        ],
      });

      const manifest = createManifest({
        plugins: { 'hello-dolly': { enabled: false } },
      });

      const wpRequest = createMockWpRequest();
      const result = await executeSync(diff, manifest, wpRequest);

      expect(result.operations[0]).toMatchObject({
        operation: 'deactivate',
        slug: 'hello-dolly',
      });
    });

    it('should report missing plugins as failed', async () => {
      const diff = createDiffResult({
        plugins: [
          {
            slug: 'missing-plugin',
            name: 'missing-plugin',
            change: 'add',
            severity: 'warning',
            inManifest: true,
            isActive: false,
          },
        ],
      });

      const manifest = createManifest({
        plugins: { 'missing-plugin': { enabled: true } },
      });

      const wpRequest = createMockWpRequest();
      const result = await executeSync(diff, manifest, wpRequest);

      expect(result.operations[0]).toMatchObject({
        success: false,
        error: expect.stringContaining('Cannot install plugins'),
      });
    });
  });

  describe('dry run mode', () => {
    it('should not make API calls in dry run mode', async () => {
      const diff = createDiffResult({
        pages: [
          {
            slug: 'new-page',
            title: 'New Page',
            change: 'add',
            severity: 'warning',
            inManifest: true,
            inWordPress: false,
          },
        ],
      });

      const manifest = createManifest({
        pages: [{ slug: 'new-page', title: 'New Page' }],
      });

      const wpRequest = createMockWpRequest();
      const result = await executeSync(diff, manifest, wpRequest, { dryRun: true });

      expect(wpRequest).not.toHaveBeenCalled();
      expect(result.dryRun).toBe(true);
      expect(result.summary.skipped).toBe(1);
      expect(result.operations[0].message).toContain('Would create');
    });
  });

  describe('filtering', () => {
    it('should skip pages when skipPages is true', async () => {
      const diff = createDiffResult({
        pages: [
          {
            slug: 'new-page',
            title: 'New Page',
            change: 'add',
            severity: 'warning',
            inManifest: true,
            inWordPress: false,
          },
        ],
      });

      const manifest = createManifest({
        pages: [{ slug: 'new-page', title: 'New Page' }],
      });

      const wpRequest = createMockWpRequest();
      const result = await executeSync(diff, manifest, wpRequest, { skipPages: true });

      expect(result.operations).toHaveLength(0);
    });

    it('should skip plugins when skipPlugins is true', async () => {
      const diff = createDiffResult({
        plugins: [
          {
            slug: 'akismet',
            name: 'Akismet',
            change: 'modify',
            severity: 'info',
            inManifest: true,
            isActive: false,
            expectedEnabled: true,
          },
        ],
      });

      const manifest = createManifest({
        plugins: { akismet: { enabled: true } },
      });

      const wpRequest = createMockWpRequest();
      const result = await executeSync(diff, manifest, wpRequest, { skipPlugins: true });

      expect(result.operations).toHaveLength(0);
    });

    it('should only process included slugs when includeOnly is set', async () => {
      const diff = createDiffResult({
        pages: [
          { slug: 'page-a', title: 'A', change: 'add', severity: 'warning', inManifest: true, inWordPress: false },
          { slug: 'page-b', title: 'B', change: 'add', severity: 'warning', inManifest: true, inWordPress: false },
        ],
      });

      const manifest = createManifest({
        pages: [
          { slug: 'page-a', title: 'A' },
          { slug: 'page-b', title: 'B' },
        ],
      });

      const wpRequest = createMockWpRequest();
      const result = await executeSync(diff, manifest, wpRequest, { includeOnly: ['page-a'] });

      expect(result.operations).toHaveLength(1);
      expect(result.operations[0].slug).toBe('page-a');
    });

    it('should exclude specified slugs', async () => {
      const diff = createDiffResult({
        pages: [
          { slug: 'page-a', title: 'A', change: 'add', severity: 'warning', inManifest: true, inWordPress: false },
          { slug: 'page-b', title: 'B', change: 'add', severity: 'warning', inManifest: true, inWordPress: false },
        ],
      });

      const manifest = createManifest({
        pages: [
          { slug: 'page-a', title: 'A' },
          { slug: 'page-b', title: 'B' },
        ],
      });

      const wpRequest = createMockWpRequest();
      const result = await executeSync(diff, manifest, wpRequest, { exclude: ['page-a'] });

      expect(result.operations).toHaveLength(1);
      expect(result.operations[0].slug).toBe('page-b');
    });
  });

  describe('summary', () => {
    it('should return accurate summary counts', async () => {
      const diff = createDiffResult({
        pages: [
          { slug: 'create', title: 'Create', change: 'add', severity: 'warning', inManifest: true, inWordPress: false },
          { slug: 'update', title: 'Update', change: 'modify', severity: 'info', inManifest: true, inWordPress: true, wpId: 1 },
        ],
      });

      const manifest = createManifest({
        pages: [
          { slug: 'create', title: 'Create' },
          { slug: 'update', title: 'Update' },
        ],
      });

      const wpRequest = createMockWpRequest();
      const result = await executeSync(diff, manifest, wpRequest);

      expect(result.summary.total).toBe(2);
      expect(result.summary.succeeded).toBe(2);
      expect(result.summary.failed).toBe(0);
    });
  });
});

describe('formatSyncText', () => {
  it('should format dry run results', () => {
    const result: SyncResult = {
      timestamp: new Date().toISOString(),
      success: true,
      summary: { total: 2, succeeded: 0, failed: 0, skipped: 2 },
      operations: [
        { success: true, operation: 'create', resourceType: 'page', slug: 'new', message: 'Would create page' },
        { success: true, operation: 'activate', resourceType: 'plugin', slug: 'akismet', message: 'Would activate plugin' },
      ],
      dryRun: true,
    };

    const text = formatSyncText(result);

    expect(text).toContain('Dry Run');
    expect(text).toContain('2 change(s) would be applied');
    expect(text).toContain('[DRY-RUN]');
  });

  it('should format successful sync results', () => {
    const result: SyncResult = {
      timestamp: new Date().toISOString(),
      success: true,
      summary: { total: 2, succeeded: 2, failed: 0, skipped: 0 },
      operations: [
        { success: true, operation: 'create', resourceType: 'page', slug: 'new', message: 'Created page', wpId: 123 },
        { success: true, operation: 'activate', resourceType: 'plugin', slug: 'akismet', message: 'Activated plugin' },
      ],
      dryRun: false,
    };

    const text = formatSyncText(result);

    expect(text).toContain('Sync Results');
    expect(text).toContain('2 succeeded');
    expect(text).toContain('Sync completed successfully');
  });

  it('should format failed sync results', () => {
    const result: SyncResult = {
      timestamp: new Date().toISOString(),
      success: false,
      summary: { total: 2, succeeded: 1, failed: 1, skipped: 0 },
      operations: [
        { success: true, operation: 'create', resourceType: 'page', slug: 'good', message: 'Created page' },
        { success: false, operation: 'create', resourceType: 'page', slug: 'bad', message: 'Failed to create', error: 'Network error' },
      ],
      dryRun: false,
    };

    const text = formatSyncText(result);

    expect(text).toContain('1 succeeded');
    expect(text).toContain('1 failed');
    expect(text).toContain('[FAILED]');
    expect(text).toContain('Network error');
    expect(text).toContain('Sync completed with errors');
  });
});

describe('formatSyncJson', () => {
  it('should output valid JSON', () => {
    const result: SyncResult = {
      timestamp: '2024-01-01T00:00:00.000Z',
      success: true,
      summary: { total: 1, succeeded: 1, failed: 0, skipped: 0 },
      operations: [
        { success: true, operation: 'create', resourceType: 'page', slug: 'test', message: 'Created' },
      ],
      dryRun: false,
    };

    const json = formatSyncJson(result);
    const parsed = JSON.parse(json);

    expect(parsed.timestamp).toBe('2024-01-01T00:00:00.000Z');
    expect(parsed.success).toBe(true);
    expect(parsed.operations).toHaveLength(1);
  });
});
