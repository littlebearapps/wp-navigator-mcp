/**
 * Sync Engine
 *
 * Applies wpnavigator.jsonc manifest changes to WordPress.
 * Used by `wpnav sync` command for synchronization.
 *
 * @package WP_Navigator_MCP
 * @since 1.2.0
 */

import type { WPNavManifest, ManifestPage, ManifestPlugin } from './manifest.js';
import type { DiffResult, PageDiff, PluginDiff, WordPressPage, WordPressPlugin } from './diff.js';

// =============================================================================
// Sync Types
// =============================================================================

/**
 * Result of a single sync operation
 */
export interface SyncOperationResult {
  /** Success or failure */
  success: boolean;
  /** Operation type */
  operation: 'create' | 'update' | 'delete' | 'activate' | 'deactivate';
  /** Resource type */
  resourceType: 'page' | 'plugin';
  /** Resource identifier (slug) */
  slug: string;
  /** Human-readable message */
  message: string;
  /** Error details if failed */
  error?: string;
  /** WordPress ID (for created/updated pages) */
  wpId?: number;
}

/**
 * Complete sync result
 */
export interface SyncResult {
  /** Timestamp of sync */
  timestamp: string;
  /** Whether all operations succeeded */
  success: boolean;
  /** Summary of operations */
  summary: {
    /** Total operations attempted */
    total: number;
    /** Successful operations */
    succeeded: number;
    /** Failed operations */
    failed: number;
    /** Skipped (dry-run) */
    skipped: number;
  };
  /** Individual operation results */
  operations: SyncOperationResult[];
  /** Was this a dry run? */
  dryRun: boolean;
}

/**
 * Options for sync operation
 */
export interface SyncOptions {
  /** Show diff only, don't apply changes */
  dryRun?: boolean;
  /** Process only specific slugs */
  includeOnly?: string[];
  /** Skip specific slugs */
  exclude?: string[];
  /** Skip plugin operations */
  skipPlugins?: boolean;
  /** Skip page operations */
  skipPages?: boolean;
  /** Sync deletions (remove pages not in manifest) */
  syncDeletions?: boolean;
}

// =============================================================================
// Sync Engine
// =============================================================================

/**
 * WordPress API request function signature
 * Compatible with CLIContext.wpRequest
 */
export type WpRequestFn = (endpoint: string, options?: RequestInit) => Promise<unknown>;

/**
 * Execute sync based on diff result
 */
export async function executeSync(
  diff: DiffResult,
  manifest: WPNavManifest,
  wpRequest: WpRequestFn,
  options: SyncOptions = {}
): Promise<SyncResult> {
  const {
    dryRun = false,
    includeOnly,
    exclude = [],
    skipPlugins = false,
    skipPages = false,
    syncDeletions = false,
  } = options;

  const operations: SyncOperationResult[] = [];
  let succeeded = 0;
  let failed = 0;
  let skipped = 0;

  // Filter pages based on options
  const pagesToProcess = diff.pages.filter((page) => {
    if (skipPages) return false;
    if (includeOnly && !includeOnly.includes(page.slug)) return false;
    if (exclude.includes(page.slug)) return false;
    // Only process add and modify operations (remove requires syncDeletions)
    if (page.change === 'remove' && !syncDeletions) return false;
    if (page.change === 'match') return false;
    return true;
  });

  // Filter plugins based on options
  const pluginsToProcess = diff.plugins.filter((plugin) => {
    if (skipPlugins) return false;
    if (includeOnly && !includeOnly.includes(plugin.slug)) return false;
    if (exclude.includes(plugin.slug)) return false;
    if (plugin.change === 'match') return false;
    return true;
  });

  // Process page operations
  for (const pageDiff of pagesToProcess) {
    const manifestPage = manifest.pages?.find((p) => p.slug === pageDiff.slug);

    if (pageDiff.change === 'add' && manifestPage) {
      // Create new page
      const result = await syncCreatePage(manifestPage, wpRequest, dryRun);
      operations.push(result);
      if (dryRun) skipped++;
      else if (result.success) succeeded++;
      else failed++;
    } else if (pageDiff.change === 'modify' && manifestPage && pageDiff.wpId) {
      // Update existing page
      const result = await syncUpdatePage(pageDiff.wpId, manifestPage, wpRequest, dryRun);
      operations.push(result);
      if (dryRun) skipped++;
      else if (result.success) succeeded++;
      else failed++;
    } else if (pageDiff.change === 'remove' && syncDeletions && pageDiff.wpId) {
      // Delete page (only if syncDeletions enabled)
      const result = await syncDeletePage(pageDiff.wpId, pageDiff.slug, wpRequest, dryRun);
      operations.push(result);
      if (dryRun) skipped++;
      else if (result.success) succeeded++;
      else failed++;
    }
  }

  // Process plugin operations
  for (const pluginDiff of pluginsToProcess) {
    const manifestPlugin = manifest.plugins?.[pluginDiff.slug];

    if (pluginDiff.change === 'modify' && manifestPlugin) {
      // Change plugin activation state
      if (manifestPlugin.enabled && !pluginDiff.isActive) {
        const result = await syncActivatePlugin(pluginDiff.slug, wpRequest, dryRun);
        operations.push(result);
        if (dryRun) skipped++;
        else if (result.success) succeeded++;
        else failed++;
      } else if (!manifestPlugin.enabled && pluginDiff.isActive) {
        const result = await syncDeactivatePlugin(pluginDiff.slug, wpRequest, dryRun);
        operations.push(result);
        if (dryRun) skipped++;
        else if (result.success) succeeded++;
        else failed++;
      }
    } else if (pluginDiff.change === 'add' && manifestPlugin) {
      // Plugin not installed - report as failed since we can't install plugins via REST
      operations.push({
        success: false,
        operation: 'activate',
        resourceType: 'plugin',
        slug: pluginDiff.slug,
        message: `Plugin '${pluginDiff.slug}' is not installed`,
        error: 'Cannot install plugins via REST API. Please install manually.',
      });
      if (!dryRun) failed++;
      else skipped++;
    }
  }

  const allSuccess = failed === 0;

  return {
    timestamp: new Date().toISOString(),
    success: allSuccess,
    summary: {
      total: operations.length,
      succeeded,
      failed,
      skipped,
    },
    operations,
    dryRun,
  };
}

// =============================================================================
// Page Operations
// =============================================================================

/**
 * Create a new page
 */
async function syncCreatePage(
  page: ManifestPage,
  wpRequest: WpRequestFn,
  dryRun: boolean
): Promise<SyncOperationResult> {
  if (dryRun) {
    return {
      success: true,
      operation: 'create',
      resourceType: 'page',
      slug: page.slug,
      message: `Would create page '${page.slug}' - "${page.title}"`,
    };
  }

  try {
    const body: Record<string, unknown> = {
      slug: page.slug,
      title: page.title,
      status: page.status || 'draft',
    };

    // Add optional fields
    if (page.template) body.template = page.template;
    if (page.parent) body.parent = page.parent;
    if (page.menu_order !== undefined) body.menu_order = page.menu_order;
    if (page.content) body.content = page.content;

    const response = (await wpRequest('/wp/v2/pages', {
      method: 'POST',
      body: JSON.stringify(body),
    })) as { id: number };

    return {
      success: true,
      operation: 'create',
      resourceType: 'page',
      slug: page.slug,
      message: `Created page '${page.slug}' - "${page.title}"`,
      wpId: response.id,
    };
  } catch (error) {
    return {
      success: false,
      operation: 'create',
      resourceType: 'page',
      slug: page.slug,
      message: `Failed to create page '${page.slug}'`,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Update an existing page
 */
async function syncUpdatePage(
  wpId: number,
  page: ManifestPage,
  wpRequest: WpRequestFn,
  dryRun: boolean
): Promise<SyncOperationResult> {
  if (dryRun) {
    return {
      success: true,
      operation: 'update',
      resourceType: 'page',
      slug: page.slug,
      message: `Would update page '${page.slug}' (ID: ${wpId})`,
      wpId,
    };
  }

  try {
    const body: Record<string, unknown> = {
      title: page.title,
    };

    // Add optional fields if specified in manifest
    if (page.status) body.status = page.status;
    if (page.template !== undefined) body.template = page.template;
    if (page.menu_order !== undefined) body.menu_order = page.menu_order;
    if (page.content) body.content = page.content;

    await wpRequest(`/wp/v2/pages/${wpId}`, {
      method: 'POST',
      body: JSON.stringify(body),
    });

    return {
      success: true,
      operation: 'update',
      resourceType: 'page',
      slug: page.slug,
      message: `Updated page '${page.slug}' (ID: ${wpId})`,
      wpId,
    };
  } catch (error) {
    return {
      success: false,
      operation: 'update',
      resourceType: 'page',
      slug: page.slug,
      message: `Failed to update page '${page.slug}'`,
      error: error instanceof Error ? error.message : String(error),
      wpId,
    };
  }
}

/**
 * Delete a page
 */
async function syncDeletePage(
  wpId: number,
  slug: string,
  wpRequest: WpRequestFn,
  dryRun: boolean
): Promise<SyncOperationResult> {
  if (dryRun) {
    return {
      success: true,
      operation: 'delete',
      resourceType: 'page',
      slug,
      message: `Would delete page '${slug}' (ID: ${wpId})`,
      wpId,
    };
  }

  try {
    await wpRequest(`/wp/v2/pages/${wpId}?force=true`, {
      method: 'DELETE',
    });

    return {
      success: true,
      operation: 'delete',
      resourceType: 'page',
      slug,
      message: `Deleted page '${slug}' (ID: ${wpId})`,
      wpId,
    };
  } catch (error) {
    return {
      success: false,
      operation: 'delete',
      resourceType: 'page',
      slug,
      message: `Failed to delete page '${slug}'`,
      error: error instanceof Error ? error.message : String(error),
      wpId,
    };
  }
}

// =============================================================================
// Plugin Operations
// =============================================================================

/**
 * Activate a plugin
 */
async function syncActivatePlugin(
  slug: string,
  wpRequest: WpRequestFn,
  dryRun: boolean
): Promise<SyncOperationResult> {
  if (dryRun) {
    return {
      success: true,
      operation: 'activate',
      resourceType: 'plugin',
      slug,
      message: `Would activate plugin '${slug}'`,
    };
  }

  try {
    // WordPress plugin activation requires the plugin file path, not just slug
    // Format: slug/slug.php or slug.php for single-file plugins
    const pluginFile = `${slug}/${slug}.php`;

    await wpRequest(`/wp/v2/plugins/${encodeURIComponent(pluginFile)}`, {
      method: 'POST',
      body: JSON.stringify({ status: 'active' }),
    });

    return {
      success: true,
      operation: 'activate',
      resourceType: 'plugin',
      slug,
      message: `Activated plugin '${slug}'`,
    };
  } catch (error) {
    return {
      success: false,
      operation: 'activate',
      resourceType: 'plugin',
      slug,
      message: `Failed to activate plugin '${slug}'`,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Deactivate a plugin
 */
async function syncDeactivatePlugin(
  slug: string,
  wpRequest: WpRequestFn,
  dryRun: boolean
): Promise<SyncOperationResult> {
  if (dryRun) {
    return {
      success: true,
      operation: 'deactivate',
      resourceType: 'plugin',
      slug,
      message: `Would deactivate plugin '${slug}'`,
    };
  }

  try {
    const pluginFile = `${slug}/${slug}.php`;

    await wpRequest(`/wp/v2/plugins/${encodeURIComponent(pluginFile)}`, {
      method: 'POST',
      body: JSON.stringify({ status: 'inactive' }),
    });

    return {
      success: true,
      operation: 'deactivate',
      resourceType: 'plugin',
      slug,
      message: `Deactivated plugin '${slug}'`,
    };
  } catch (error) {
    return {
      success: false,
      operation: 'deactivate',
      resourceType: 'plugin',
      slug,
      message: `Failed to deactivate plugin '${slug}'`,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// =============================================================================
// Output Formatting
// =============================================================================

/**
 * Format sync result for human-readable output
 */
export function formatSyncText(result: SyncResult): string {
  const lines: string[] = [];

  // Header
  lines.push('');
  if (result.dryRun) {
    lines.push('━━━ Sync Preview (Dry Run) ━━━');
  } else {
    lines.push('━━━ Sync Results ━━━');
  }
  lines.push('');

  // Summary
  const { summary } = result;
  if (result.dryRun) {
    lines.push(`${summary.skipped} change(s) would be applied`);
  } else {
    const parts: string[] = [];
    if (summary.succeeded > 0) parts.push(`✔ ${summary.succeeded} succeeded`);
    if (summary.failed > 0) parts.push(`✖ ${summary.failed} failed`);
    lines.push(parts.join(' | ') || 'No changes');
  }
  lines.push('');

  // Operations
  if (result.operations.length > 0) {
    lines.push('Operations:');
    for (const op of result.operations) {
      const symbol = result.dryRun ? '~' : op.success ? '✔' : '✖';
      const status = result.dryRun ? '[DRY-RUN]' : op.success ? '' : '[FAILED]';
      lines.push(`  ${symbol} ${op.message} ${status}`);
      if (op.error && !result.dryRun) {
        lines.push(`      Error: ${op.error}`);
      }
    }
    lines.push('');
  }

  // Final status
  if (!result.dryRun) {
    if (result.success) {
      lines.push('✔ Sync completed successfully');
    } else {
      lines.push('✖ Sync completed with errors');
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Format sync result as JSON
 */
export function formatSyncJson(result: SyncResult): string {
  return JSON.stringify(result, null, 2);
}
