/**
 * Sync Rollback Module
 *
 * Implements pre-sync snapshot creation and rollback capability for
 * safe WordPress synchronization.
 *
 * @package WP_Navigator_MCP
 * @since 1.2.0
 */

import * as fs from 'fs';
import * as path from 'path';
import type { DiffResult, WordPressPage, WordPressPlugin } from './diff.js';
import { SNAPSHOT_VERSION } from './snapshots/types.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Pre-sync snapshot for rollback
 */
export interface PreSyncSnapshot {
  /** Schema version */
  snapshot_version: typeof SNAPSHOT_VERSION;
  /** ISO timestamp when snapshot was captured */
  captured_at: string;
  /** Identifier for this sync operation */
  sync_id: string;
  /** Pages that will be modified */
  pages: PreSyncPageState[];
  /** Plugins that will be modified */
  plugins: PreSyncPluginState[];
  /** Summary of planned operations */
  planned_operations: {
    page_creates: number;
    page_updates: number;
    page_deletes: number;
    plugin_activations: number;
    plugin_deactivations: number;
  };
}

/**
 * Pre-sync page state (for rollback)
 */
export interface PreSyncPageState {
  /** WordPress page ID */
  wpId: number;
  /** Page slug */
  slug: string;
  /** Page title before sync */
  title: string;
  /** Page status before sync */
  status: string;
  /** Page template before sync */
  template: string;
  /** Parent page ID */
  parent: number;
  /** Menu order */
  menu_order: number;
  /** Operation that will be performed */
  planned_operation: 'create' | 'update' | 'delete';
}

/**
 * Pre-sync plugin state (for rollback)
 */
export interface PreSyncPluginState {
  /** Plugin slug */
  slug: string;
  /** Plugin name */
  name: string;
  /** Active status before sync */
  wasActive: boolean;
  /** Operation that will be performed */
  planned_operation: 'activate' | 'deactivate';
}

/**
 * Rollback result
 */
export interface RollbackResult {
  /** Whether rollback succeeded */
  success: boolean;
  /** Timestamp of rollback */
  timestamp: string;
  /** Number of pages restored */
  pagesRestored: number;
  /** Number of plugins restored */
  pluginsRestored: number;
  /** Errors encountered */
  errors: string[];
}

/**
 * Snapshot file info
 */
export interface SnapshotFileInfo {
  /** File path */
  path: string;
  /** Filename */
  filename: string;
  /** Sync ID */
  syncId: string;
  /** Capture timestamp */
  capturedAt: Date;
  /** Summary of operations */
  summary: {
    pages: number;
    plugins: number;
  };
}

// =============================================================================
// Constants
// =============================================================================

const PRE_SYNC_DIR = 'snapshots/pre-sync';
const PRE_SYNC_PREFIX = 'pre-sync-';

// =============================================================================
// Pre-Sync Snapshot Creation
// =============================================================================

/**
 * Generate a unique sync ID
 */
export function generateSyncId(): string {
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const random = Math.random().toString(36).substring(2, 6);
  return `${timestamp}-${random}`;
}

/**
 * Get path to pre-sync snapshots directory
 */
export function getPreSyncDir(projectDir: string): string {
  return path.join(projectDir, PRE_SYNC_DIR);
}

/**
 * Get path for a new pre-sync snapshot file
 */
export function getPreSyncSnapshotPath(projectDir: string, syncId: string): string {
  return path.join(getPreSyncDir(projectDir), `${PRE_SYNC_PREFIX}${syncId}.json`);
}

/**
 * Create a pre-sync snapshot capturing current WordPress state for affected resources
 */
export function createPreSyncSnapshot(
  diff: DiffResult,
  wpPages: WordPressPage[],
  wpPlugins: WordPressPlugin[],
  syncId: string
): PreSyncSnapshot {
  const pages: PreSyncPageState[] = [];
  const plugins: PreSyncPluginState[] = [];

  let pageCreates = 0;
  let pageUpdates = 0;
  let pageDeletes = 0;
  let pluginActivations = 0;
  let pluginDeactivations = 0;

  // Capture state for pages that will be modified
  for (const pageDiff of diff.pages) {
    if (pageDiff.change === 'match') continue;

    if (pageDiff.change === 'add') {
      // New page will be created - no existing state to capture
      pageCreates++;
      pages.push({
        wpId: 0, // Will be assigned on creation
        slug: pageDiff.slug,
        title: pageDiff.title,
        status: 'draft',
        template: '',
        parent: 0,
        menu_order: 0,
        planned_operation: 'create',
      });
    } else if (pageDiff.change === 'modify' && pageDiff.wpId) {
      // Existing page will be updated - capture current state
      pageUpdates++;
      const currentPage = wpPages.find((p) => p.id === pageDiff.wpId);
      if (currentPage) {
        pages.push({
          wpId: currentPage.id,
          slug: currentPage.slug,
          title: currentPage.title,
          status: currentPage.status,
          template: currentPage.template || '',
          parent: currentPage.parent || 0,
          menu_order: currentPage.menu_order || 0,
          planned_operation: 'update',
        });
      }
    } else if (pageDiff.change === 'remove' && pageDiff.wpId) {
      // Page will be deleted - capture current state
      pageDeletes++;
      const currentPage = wpPages.find((p) => p.id === pageDiff.wpId);
      if (currentPage) {
        pages.push({
          wpId: currentPage.id,
          slug: currentPage.slug,
          title: currentPage.title,
          status: currentPage.status,
          template: currentPage.template || '',
          parent: currentPage.parent || 0,
          menu_order: currentPage.menu_order || 0,
          planned_operation: 'delete',
        });
      }
    }
  }

  // Capture state for plugins that will be modified
  for (const pluginDiff of diff.plugins) {
    if (pluginDiff.change === 'match') continue;

    if (pluginDiff.change === 'modify') {
      const currentPlugin = wpPlugins.find((p) => p.slug === pluginDiff.slug);
      if (currentPlugin) {
        const operation = pluginDiff.expectedEnabled ? 'activate' : 'deactivate';
        if (operation === 'activate') pluginActivations++;
        else pluginDeactivations++;

        plugins.push({
          slug: pluginDiff.slug,
          name: pluginDiff.name,
          wasActive: currentPlugin.active,
          planned_operation: operation,
        });
      }
    }
  }

  return {
    snapshot_version: SNAPSHOT_VERSION,
    captured_at: new Date().toISOString(),
    sync_id: syncId,
    pages,
    plugins,
    planned_operations: {
      page_creates: pageCreates,
      page_updates: pageUpdates,
      page_deletes: pageDeletes,
      plugin_activations: pluginActivations,
      plugin_deactivations: pluginDeactivations,
    },
  };
}

/**
 * Save pre-sync snapshot to file
 */
export function savePreSyncSnapshot(projectDir: string, snapshot: PreSyncSnapshot): string {
  const snapshotDir = getPreSyncDir(projectDir);
  const snapshotPath = getPreSyncSnapshotPath(projectDir, snapshot.sync_id);

  // Create directory if it doesn't exist
  if (!fs.existsSync(snapshotDir)) {
    fs.mkdirSync(snapshotDir, { recursive: true });
  }

  // Write snapshot
  fs.writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2), 'utf-8');

  return snapshotPath;
}

// =============================================================================
// Rollback Operations
// =============================================================================

/**
 * List available pre-sync snapshots
 */
export function listPreSyncSnapshots(projectDir: string): SnapshotFileInfo[] {
  const snapshotDir = getPreSyncDir(projectDir);

  if (!fs.existsSync(snapshotDir)) {
    return [];
  }

  const files = fs.readdirSync(snapshotDir);
  const snapshots: SnapshotFileInfo[] = [];

  for (const filename of files) {
    if (!filename.startsWith(PRE_SYNC_PREFIX) || !filename.endsWith('.json')) {
      continue;
    }

    const filePath = path.join(snapshotDir, filename);

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const snapshot = JSON.parse(content) as PreSyncSnapshot;

      snapshots.push({
        path: filePath,
        filename,
        syncId: snapshot.sync_id,
        capturedAt: new Date(snapshot.captured_at),
        summary: {
          pages: snapshot.pages.length,
          plugins: snapshot.plugins.length,
        },
      });
    } catch {
      // Skip invalid files
    }
  }

  // Sort by capture time, most recent first
  snapshots.sort((a, b) => b.capturedAt.getTime() - a.capturedAt.getTime());

  return snapshots;
}

/**
 * Load a pre-sync snapshot by sync ID
 */
export function loadPreSyncSnapshot(projectDir: string, syncId: string): PreSyncSnapshot | null {
  const snapshotPath = getPreSyncSnapshotPath(projectDir, syncId);

  if (!fs.existsSync(snapshotPath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(snapshotPath, 'utf-8');
    return JSON.parse(content) as PreSyncSnapshot;
  } catch {
    return null;
  }
}

/**
 * WordPress API request function signature
 */
export type WpRequestFn = (endpoint: string, options?: RequestInit) => Promise<unknown>;

/**
 * Execute rollback from a pre-sync snapshot
 */
export async function executeRollback(
  snapshot: PreSyncSnapshot,
  wpRequest: WpRequestFn,
  options: { dryRun?: boolean } = {}
): Promise<RollbackResult> {
  const { dryRun = false } = options;
  const errors: string[] = [];
  let pagesRestored = 0;
  let pluginsRestored = 0;

  // Restore pages
  for (const page of snapshot.pages) {
    try {
      if (page.planned_operation === 'create') {
        // Page was created - need to delete it to rollback
        // We need to find the page by slug first
        if (!dryRun) {
          const pagesResponse = (await wpRequest(
            `/wp/v2/pages?slug=${encodeURIComponent(page.slug)}&status=any`
          )) as Array<{ id: number }>;
          if (pagesResponse.length > 0) {
            await wpRequest(`/wp/v2/pages/${pagesResponse[0].id}?force=true`, { method: 'DELETE' });
            pagesRestored++;
          }
        } else {
          pagesRestored++;
        }
      } else if (page.planned_operation === 'update' && page.wpId > 0) {
        // Page was updated - restore previous values
        if (!dryRun) {
          await wpRequest(`/wp/v2/pages/${page.wpId}`, {
            method: 'POST',
            body: JSON.stringify({
              title: page.title,
              status: page.status,
              template: page.template,
              parent: page.parent,
              menu_order: page.menu_order,
            }),
          });
        }
        pagesRestored++;
      } else if (page.planned_operation === 'delete' && page.wpId > 0) {
        // Page was deleted - need to recreate it
        // Note: We can't fully restore deleted pages without full content backup
        // This creates a stub page with the original metadata
        if (!dryRun) {
          await wpRequest('/wp/v2/pages', {
            method: 'POST',
            body: JSON.stringify({
              slug: page.slug,
              title: page.title,
              status: page.status,
              template: page.template,
              parent: page.parent,
              menu_order: page.menu_order,
            }),
          });
        }
        pagesRestored++;
      }
    } catch (err) {
      errors.push(
        `Failed to restore page '${page.slug}': ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  // Restore plugins
  for (const plugin of snapshot.plugins) {
    try {
      const pluginFile = `${plugin.slug}/${plugin.slug}.php`;
      const targetStatus = plugin.wasActive ? 'active' : 'inactive';

      if (!dryRun) {
        await wpRequest(`/wp/v2/plugins/${encodeURIComponent(pluginFile)}`, {
          method: 'POST',
          body: JSON.stringify({ status: targetStatus }),
        });
      }
      pluginsRestored++;
    } catch (err) {
      errors.push(
        `Failed to restore plugin '${plugin.slug}': ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  return {
    success: errors.length === 0,
    timestamp: new Date().toISOString(),
    pagesRestored,
    pluginsRestored,
    errors,
  };
}

/**
 * Delete a pre-sync snapshot
 */
export function deletePreSyncSnapshot(projectDir: string, syncId: string): boolean {
  const snapshotPath = getPreSyncSnapshotPath(projectDir, syncId);

  try {
    if (fs.existsSync(snapshotPath)) {
      fs.unlinkSync(snapshotPath);
      return true;
    }
  } catch {
    // Ignore errors
  }
  return false;
}

/**
 * Clean up old pre-sync snapshots (keep most recent N)
 */
export function cleanupOldSnapshots(projectDir: string, keepCount: number = 10): number {
  const snapshots = listPreSyncSnapshots(projectDir);

  if (snapshots.length <= keepCount) {
    return 0;
  }

  // Delete oldest snapshots beyond keepCount
  const toDelete = snapshots.slice(keepCount);
  let deleted = 0;

  for (const snapshot of toDelete) {
    if (deletePreSyncSnapshot(projectDir, snapshot.syncId)) {
      deleted++;
    }
  }

  return deleted;
}

// =============================================================================
// Output Formatting
// =============================================================================

/**
 * Format rollback result for human-readable output
 */
export function formatRollbackText(result: RollbackResult, dryRun: boolean = false): string {
  const lines: string[] = [];

  lines.push('');
  if (dryRun) {
    lines.push('━━━ Rollback Preview (Dry Run) ━━━');
  } else {
    lines.push('━━━ Rollback Results ━━━');
  }
  lines.push('');

  // Summary
  const restoredCount = result.pagesRestored + result.pluginsRestored;
  if (dryRun) {
    lines.push(`${restoredCount} resource(s) would be restored`);
  } else {
    lines.push(`✔ ${result.pagesRestored} page(s) restored`);
    lines.push(`✔ ${result.pluginsRestored} plugin(s) restored`);
  }
  lines.push('');

  // Errors
  if (result.errors.length > 0) {
    lines.push('Errors:');
    for (const error of result.errors) {
      lines.push(`  ✖ ${error}`);
    }
    lines.push('');
  }

  // Final status
  if (!dryRun) {
    if (result.success) {
      lines.push('✔ Rollback completed successfully');
    } else {
      lines.push('✖ Rollback completed with errors');
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Format rollback result as JSON
 */
export function formatRollbackJson(result: RollbackResult): string {
  return JSON.stringify(result, null, 2);
}
