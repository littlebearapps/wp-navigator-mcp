/**
 * Tests for Sync Rollback Module
 *
 * @package WP_Navigator_MCP
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  generateSyncId,
  getPreSyncDir,
  getPreSyncSnapshotPath,
  createPreSyncSnapshot,
  savePreSyncSnapshot,
  listPreSyncSnapshots,
  loadPreSyncSnapshot,
  executeRollback,
  deletePreSyncSnapshot,
  cleanupOldSnapshots,
  formatRollbackText,
  formatRollbackJson,
  type PreSyncSnapshot,
  type RollbackResult,
} from './rollback.js';
import type { DiffResult, WordPressPage, WordPressPlugin } from './diff.js';

// Test directory for snapshot files
const TEST_DIR = '/tmp/wpnav-test-rollback';

describe('Rollback', () => {
  beforeEach(() => {
    // Clean up test directory
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true });
    }
    fs.mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    // Clean up test directory
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true });
    }
  });

  describe('generateSyncId', () => {
    it('should generate unique sync IDs', () => {
      const id1 = generateSyncId();
      const id2 = generateSyncId();
      expect(id1).not.toBe(id2);
    });

    it('should generate IDs with timestamp format', () => {
      const id = generateSyncId();
      // Should match: YYYY-MM-DDTHH-MM-SS-xxxx
      expect(id).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-[a-z0-9]{4}$/);
    });
  });

  describe('getPreSyncDir', () => {
    it('should return correct pre-sync directory path', () => {
      const dir = getPreSyncDir('/project');
      expect(dir).toBe('/project/snapshots/pre-sync');
    });
  });

  describe('getPreSyncSnapshotPath', () => {
    it('should return correct snapshot file path', () => {
      const syncId = '2024-01-01T12-00-00-abcd';
      const snapshotPath = getPreSyncSnapshotPath('/project', syncId);
      expect(snapshotPath).toBe('/project/snapshots/pre-sync/pre-sync-2024-01-01T12-00-00-abcd.json');
    });
  });

  describe('createPreSyncSnapshot', () => {
    it('should create snapshot with page updates', () => {
      const diff: DiffResult = {
        timestamp: new Date().toISOString(),
        summary: { additions: 0, removals: 0, modifications: 1, matches: 0, total: 1, hasDifferences: true },
        pages: [{
          slug: 'about',
          title: 'About Us',
          change: 'modify',
          severity: 'info',
          inManifest: true,
          inWordPress: true,
          wpId: 42,
          fields: [{ field: 'title', expected: 'About Us', actual: 'Old Title' }],
        }],
        plugins: [],
      };

      const wpPages: WordPressPage[] = [{
        id: 42,
        slug: 'about',
        title: 'Old Title',
        status: 'publish',
        template: 'page-about.php',
        parent: 0,
        menu_order: 1,
      }];

      const snapshot = createPreSyncSnapshot(diff, wpPages, [], 'test-sync-id');

      expect(snapshot.sync_id).toBe('test-sync-id');
      expect(snapshot.pages).toHaveLength(1);
      expect(snapshot.pages[0].wpId).toBe(42);
      expect(snapshot.pages[0].title).toBe('Old Title');
      expect(snapshot.pages[0].planned_operation).toBe('update');
      expect(snapshot.planned_operations.page_updates).toBe(1);
    });

    it('should create snapshot with page additions', () => {
      const diff: DiffResult = {
        timestamp: new Date().toISOString(),
        summary: { additions: 1, removals: 0, modifications: 0, matches: 0, total: 1, hasDifferences: true },
        pages: [{
          slug: 'new-page',
          title: 'New Page',
          change: 'add',
          severity: 'warning',
          inManifest: true,
          inWordPress: false,
        }],
        plugins: [],
      };

      const snapshot = createPreSyncSnapshot(diff, [], [], 'test-sync-id');

      expect(snapshot.pages).toHaveLength(1);
      expect(snapshot.pages[0].slug).toBe('new-page');
      expect(snapshot.pages[0].planned_operation).toBe('create');
      expect(snapshot.planned_operations.page_creates).toBe(1);
    });

    it('should create snapshot with page deletions', () => {
      const diff: DiffResult = {
        timestamp: new Date().toISOString(),
        summary: { additions: 0, removals: 1, modifications: 0, matches: 0, total: 1, hasDifferences: true },
        pages: [{
          slug: 'old-page',
          title: 'Old Page',
          change: 'remove',
          severity: 'warning',
          inManifest: false,
          inWordPress: true,
          wpId: 99,
        }],
        plugins: [],
      };

      const wpPages: WordPressPage[] = [{
        id: 99,
        slug: 'old-page',
        title: 'Old Page',
        status: 'publish',
        template: '',
        parent: 0,
        menu_order: 0,
      }];

      const snapshot = createPreSyncSnapshot(diff, wpPages, [], 'test-sync-id');

      expect(snapshot.pages).toHaveLength(1);
      expect(snapshot.pages[0].wpId).toBe(99);
      expect(snapshot.pages[0].planned_operation).toBe('delete');
      expect(snapshot.planned_operations.page_deletes).toBe(1);
    });

    it('should create snapshot with plugin state changes', () => {
      const diff: DiffResult = {
        timestamp: new Date().toISOString(),
        summary: { additions: 0, removals: 0, modifications: 1, matches: 0, total: 1, hasDifferences: true },
        pages: [],
        plugins: [{
          slug: 'akismet',
          name: 'Akismet',
          change: 'modify',
          severity: 'info',
          inManifest: true,
          isActive: false,
          expectedEnabled: true,
        }],
      };

      const wpPlugins: WordPressPlugin[] = [{
        slug: 'akismet',
        name: 'Akismet',
        active: false,
        version: '5.0.0',
      }];

      const snapshot = createPreSyncSnapshot(diff, [], wpPlugins, 'test-sync-id');

      expect(snapshot.plugins).toHaveLength(1);
      expect(snapshot.plugins[0].slug).toBe('akismet');
      expect(snapshot.plugins[0].wasActive).toBe(false);
      expect(snapshot.plugins[0].planned_operation).toBe('activate');
      expect(snapshot.planned_operations.plugin_activations).toBe(1);
    });

    it('should skip matched items', () => {
      const diff: DiffResult = {
        timestamp: new Date().toISOString(),
        summary: { additions: 0, removals: 0, modifications: 0, matches: 1, total: 1, hasDifferences: false },
        pages: [{
          slug: 'home',
          title: 'Home',
          change: 'match',
          severity: 'info',
          inManifest: true,
          inWordPress: true,
          wpId: 1,
        }],
        plugins: [],
      };

      const snapshot = createPreSyncSnapshot(diff, [], [], 'test-sync-id');

      expect(snapshot.pages).toHaveLength(0);
      expect(snapshot.plugins).toHaveLength(0);
    });
  });

  describe('savePreSyncSnapshot', () => {
    it('should save snapshot to file', () => {
      const snapshot: PreSyncSnapshot = {
        snapshot_version: '1.0',
        captured_at: new Date().toISOString(),
        sync_id: 'test-sync-123',
        pages: [],
        plugins: [],
        planned_operations: {
          page_creates: 0,
          page_updates: 0,
          page_deletes: 0,
          plugin_activations: 0,
          plugin_deactivations: 0,
        },
      };

      const savedPath = savePreSyncSnapshot(TEST_DIR, snapshot);

      expect(fs.existsSync(savedPath)).toBe(true);
      const content = JSON.parse(fs.readFileSync(savedPath, 'utf-8'));
      expect(content.sync_id).toBe('test-sync-123');
    });

    it('should create pre-sync directory if not exists', () => {
      const preSyncDir = getPreSyncDir(TEST_DIR);
      expect(fs.existsSync(preSyncDir)).toBe(false);

      const snapshot: PreSyncSnapshot = {
        snapshot_version: '1.0',
        captured_at: new Date().toISOString(),
        sync_id: 'test-sync-456',
        pages: [],
        plugins: [],
        planned_operations: {
          page_creates: 0,
          page_updates: 0,
          page_deletes: 0,
          plugin_activations: 0,
          plugin_deactivations: 0,
        },
      };

      savePreSyncSnapshot(TEST_DIR, snapshot);

      expect(fs.existsSync(preSyncDir)).toBe(true);
    });
  });

  describe('listPreSyncSnapshots', () => {
    it('should return empty array for non-existent directory', () => {
      const snapshots = listPreSyncSnapshots('/nonexistent/path');
      expect(snapshots).toEqual([]);
    });

    it('should list available snapshots', () => {
      // Create some snapshot files
      const preSyncDir = getPreSyncDir(TEST_DIR);
      fs.mkdirSync(preSyncDir, { recursive: true });

      const snapshot1: PreSyncSnapshot = {
        snapshot_version: '1.0',
        captured_at: '2024-01-01T10:00:00.000Z',
        sync_id: 'sync-1',
        pages: [{ wpId: 1, slug: 'a', title: 'A', status: 'publish', template: '', parent: 0, menu_order: 0, planned_operation: 'update' }],
        plugins: [],
        planned_operations: { page_creates: 0, page_updates: 1, page_deletes: 0, plugin_activations: 0, plugin_deactivations: 0 },
      };

      const snapshot2: PreSyncSnapshot = {
        snapshot_version: '1.0',
        captured_at: '2024-01-02T10:00:00.000Z',
        sync_id: 'sync-2',
        pages: [],
        plugins: [{ slug: 'test', name: 'Test', wasActive: true, planned_operation: 'deactivate' }],
        planned_operations: { page_creates: 0, page_updates: 0, page_deletes: 0, plugin_activations: 0, plugin_deactivations: 1 },
      };

      fs.writeFileSync(path.join(preSyncDir, 'pre-sync-sync-1.json'), JSON.stringify(snapshot1));
      fs.writeFileSync(path.join(preSyncDir, 'pre-sync-sync-2.json'), JSON.stringify(snapshot2));

      const snapshots = listPreSyncSnapshots(TEST_DIR);

      expect(snapshots).toHaveLength(2);
      // Should be sorted by date, most recent first
      expect(snapshots[0].syncId).toBe('sync-2');
      expect(snapshots[1].syncId).toBe('sync-1');
      expect(snapshots[0].summary.plugins).toBe(1);
      expect(snapshots[1].summary.pages).toBe(1);
    });

    it('should skip invalid files', () => {
      const preSyncDir = getPreSyncDir(TEST_DIR);
      fs.mkdirSync(preSyncDir, { recursive: true });

      // Create invalid files
      fs.writeFileSync(path.join(preSyncDir, 'pre-sync-invalid.json'), 'not json');
      fs.writeFileSync(path.join(preSyncDir, 'other-file.txt'), 'random content');

      const snapshots = listPreSyncSnapshots(TEST_DIR);
      expect(snapshots).toHaveLength(0);
    });
  });

  describe('loadPreSyncSnapshot', () => {
    it('should load snapshot by sync ID', () => {
      const preSyncDir = getPreSyncDir(TEST_DIR);
      fs.mkdirSync(preSyncDir, { recursive: true });

      const snapshot: PreSyncSnapshot = {
        snapshot_version: '1.0',
        captured_at: new Date().toISOString(),
        sync_id: 'test-load',
        pages: [],
        plugins: [],
        planned_operations: { page_creates: 0, page_updates: 0, page_deletes: 0, plugin_activations: 0, plugin_deactivations: 0 },
      };

      fs.writeFileSync(path.join(preSyncDir, 'pre-sync-test-load.json'), JSON.stringify(snapshot));

      const loaded = loadPreSyncSnapshot(TEST_DIR, 'test-load');

      expect(loaded).not.toBeNull();
      expect(loaded?.sync_id).toBe('test-load');
    });

    it('should return null for non-existent snapshot', () => {
      const loaded = loadPreSyncSnapshot(TEST_DIR, 'nonexistent');
      expect(loaded).toBeNull();
    });
  });

  describe('executeRollback', () => {
    it('should restore plugin state', async () => {
      const snapshot: PreSyncSnapshot = {
        snapshot_version: '1.0',
        captured_at: new Date().toISOString(),
        sync_id: 'test-rollback',
        pages: [],
        plugins: [{
          slug: 'akismet',
          name: 'Akismet',
          wasActive: true,
          planned_operation: 'deactivate',
        }],
        planned_operations: { page_creates: 0, page_updates: 0, page_deletes: 0, plugin_activations: 0, plugin_deactivations: 1 },
      };

      const wpRequest = vi.fn().mockResolvedValue({});

      const result = await executeRollback(snapshot, wpRequest);

      expect(result.success).toBe(true);
      expect(result.pluginsRestored).toBe(1);
      expect(wpRequest).toHaveBeenCalledWith(
        '/wp/v2/plugins/akismet%2Fakismet.php',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ status: 'active' }),
        })
      );
    });

    it('should restore page updates', async () => {
      const snapshot: PreSyncSnapshot = {
        snapshot_version: '1.0',
        captured_at: new Date().toISOString(),
        sync_id: 'test-rollback',
        pages: [{
          wpId: 42,
          slug: 'about',
          title: 'Original Title',
          status: 'publish',
          template: 'page-about.php',
          parent: 0,
          menu_order: 1,
          planned_operation: 'update',
        }],
        plugins: [],
        planned_operations: { page_creates: 0, page_updates: 1, page_deletes: 0, plugin_activations: 0, plugin_deactivations: 0 },
      };

      const wpRequest = vi.fn().mockResolvedValue({});

      const result = await executeRollback(snapshot, wpRequest);

      expect(result.success).toBe(true);
      expect(result.pagesRestored).toBe(1);
      expect(wpRequest).toHaveBeenCalledWith(
        '/wp/v2/pages/42',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('Original Title'),
        })
      );
    });

    it('should handle rollback of created pages by deleting them', async () => {
      const snapshot: PreSyncSnapshot = {
        snapshot_version: '1.0',
        captured_at: new Date().toISOString(),
        sync_id: 'test-rollback',
        pages: [{
          wpId: 0,
          slug: 'new-page',
          title: 'New Page',
          status: 'draft',
          template: '',
          parent: 0,
          menu_order: 0,
          planned_operation: 'create',
        }],
        plugins: [],
        planned_operations: { page_creates: 1, page_updates: 0, page_deletes: 0, plugin_activations: 0, plugin_deactivations: 0 },
      };

      const wpRequest = vi.fn()
        .mockResolvedValueOnce([{ id: 123 }]) // GET to find page by slug
        .mockResolvedValueOnce({}); // DELETE

      const result = await executeRollback(snapshot, wpRequest);

      expect(result.success).toBe(true);
      expect(result.pagesRestored).toBe(1);
      expect(wpRequest).toHaveBeenCalledWith(
        expect.stringContaining('/wp/v2/pages?slug=new-page'),
      );
      expect(wpRequest).toHaveBeenCalledWith(
        '/wp/v2/pages/123?force=true',
        { method: 'DELETE' }
      );
    });

    it('should support dry run mode', async () => {
      const snapshot: PreSyncSnapshot = {
        snapshot_version: '1.0',
        captured_at: new Date().toISOString(),
        sync_id: 'test-rollback',
        pages: [{
          wpId: 42,
          slug: 'about',
          title: 'Original',
          status: 'publish',
          template: '',
          parent: 0,
          menu_order: 0,
          planned_operation: 'update',
        }],
        plugins: [],
        planned_operations: { page_creates: 0, page_updates: 1, page_deletes: 0, plugin_activations: 0, plugin_deactivations: 0 },
      };

      const wpRequest = vi.fn();

      const result = await executeRollback(snapshot, wpRequest, { dryRun: true });

      expect(result.pagesRestored).toBe(1);
      expect(wpRequest).not.toHaveBeenCalled();
    });

    it('should collect errors without stopping', async () => {
      const snapshot: PreSyncSnapshot = {
        snapshot_version: '1.0',
        captured_at: new Date().toISOString(),
        sync_id: 'test-rollback',
        pages: [
          { wpId: 1, slug: 'good', title: 'Good', status: 'publish', template: '', parent: 0, menu_order: 0, planned_operation: 'update' },
          { wpId: 2, slug: 'bad', title: 'Bad', status: 'publish', template: '', parent: 0, menu_order: 0, planned_operation: 'update' },
        ],
        plugins: [],
        planned_operations: { page_creates: 0, page_updates: 2, page_deletes: 0, plugin_activations: 0, plugin_deactivations: 0 },
      };

      const wpRequest = vi.fn()
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce(new Error('Network error'));

      const result = await executeRollback(snapshot, wpRequest);

      expect(result.success).toBe(false);
      expect(result.pagesRestored).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Network error');
    });
  });

  describe('deletePreSyncSnapshot', () => {
    it('should delete snapshot file', () => {
      const preSyncDir = getPreSyncDir(TEST_DIR);
      fs.mkdirSync(preSyncDir, { recursive: true });

      const filePath = path.join(preSyncDir, 'pre-sync-to-delete.json');
      fs.writeFileSync(filePath, '{}');
      expect(fs.existsSync(filePath)).toBe(true);

      const result = deletePreSyncSnapshot(TEST_DIR, 'to-delete');

      expect(result).toBe(true);
      expect(fs.existsSync(filePath)).toBe(false);
    });

    it('should return false for non-existent file', () => {
      const result = deletePreSyncSnapshot(TEST_DIR, 'nonexistent');
      expect(result).toBe(false);
    });
  });

  describe('cleanupOldSnapshots', () => {
    it('should keep most recent N snapshots', () => {
      const preSyncDir = getPreSyncDir(TEST_DIR);
      fs.mkdirSync(preSyncDir, { recursive: true });

      // Create 5 snapshots with different dates
      for (let i = 1; i <= 5; i++) {
        const snapshot: PreSyncSnapshot = {
          snapshot_version: '1.0',
          captured_at: new Date(2024, 0, i).toISOString(),
          sync_id: `sync-${i}`,
          pages: [],
          plugins: [],
          planned_operations: { page_creates: 0, page_updates: 0, page_deletes: 0, plugin_activations: 0, plugin_deactivations: 0 },
        };
        fs.writeFileSync(path.join(preSyncDir, `pre-sync-sync-${i}.json`), JSON.stringify(snapshot));
      }

      expect(listPreSyncSnapshots(TEST_DIR)).toHaveLength(5);

      const deleted = cleanupOldSnapshots(TEST_DIR, 3);

      expect(deleted).toBe(2);
      expect(listPreSyncSnapshots(TEST_DIR)).toHaveLength(3);
    });

    it('should do nothing if fewer than keepCount snapshots', () => {
      const preSyncDir = getPreSyncDir(TEST_DIR);
      fs.mkdirSync(preSyncDir, { recursive: true });

      const snapshot: PreSyncSnapshot = {
        snapshot_version: '1.0',
        captured_at: new Date().toISOString(),
        sync_id: 'only-one',
        pages: [],
        plugins: [],
        planned_operations: { page_creates: 0, page_updates: 0, page_deletes: 0, plugin_activations: 0, plugin_deactivations: 0 },
      };
      fs.writeFileSync(path.join(preSyncDir, 'pre-sync-only-one.json'), JSON.stringify(snapshot));

      const deleted = cleanupOldSnapshots(TEST_DIR, 10);

      expect(deleted).toBe(0);
    });
  });

  describe('formatRollbackText', () => {
    it('should format successful rollback', () => {
      const result: RollbackResult = {
        success: true,
        timestamp: new Date().toISOString(),
        pagesRestored: 2,
        pluginsRestored: 1,
        errors: [],
      };

      const text = formatRollbackText(result);

      expect(text).toContain('Rollback Results');
      expect(text).toContain('2 page(s) restored');
      expect(text).toContain('1 plugin(s) restored');
      expect(text).toContain('Rollback completed successfully');
    });

    it('should format dry run rollback', () => {
      const result: RollbackResult = {
        success: true,
        timestamp: new Date().toISOString(),
        pagesRestored: 3,
        pluginsRestored: 0,
        errors: [],
      };

      const text = formatRollbackText(result, true);

      expect(text).toContain('Dry Run');
      expect(text).toContain('3 resource(s) would be restored');
    });

    it('should format rollback with errors', () => {
      const result: RollbackResult = {
        success: false,
        timestamp: new Date().toISOString(),
        pagesRestored: 1,
        pluginsRestored: 0,
        errors: ['Failed to restore page', 'Network error'],
      };

      const text = formatRollbackText(result);

      expect(text).toContain('Errors:');
      expect(text).toContain('Failed to restore page');
      expect(text).toContain('Network error');
      expect(text).toContain('completed with errors');
    });
  });

  describe('formatRollbackJson', () => {
    it('should output valid JSON', () => {
      const result: RollbackResult = {
        success: true,
        timestamp: '2024-01-01T00:00:00.000Z',
        pagesRestored: 1,
        pluginsRestored: 1,
        errors: [],
      };

      const json = formatRollbackJson(result);
      const parsed = JSON.parse(json);

      expect(parsed.success).toBe(true);
      expect(parsed.pagesRestored).toBe(1);
      expect(parsed.pluginsRestored).toBe(1);
    });
  });
});
