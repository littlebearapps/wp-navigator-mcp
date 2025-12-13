/**
 * Diff Engine
 *
 * Compares wpnavigator.jsonc manifest with current WordPress state.
 * Used by `wpnav diff` command for detecting drift.
 *
 * @package WP_Navigator_MCP
 * @since 1.2.0
 */

import type { WPNavManifest, ManifestPage, ManifestPlugin } from './manifest.js';
import type { SiteIndexSnapshot, PageSnapshot, PageSummary } from './snapshots/types.js';

// =============================================================================
// Diff Types
// =============================================================================

/**
 * Change type for diff entries
 */
export type ChangeType = 'add' | 'remove' | 'modify' | 'match';

/**
 * Severity of a change
 */
export type ChangeSeverity = 'info' | 'warning' | 'critical';

/**
 * Individual field change
 */
export interface FieldChange {
  /** Field name */
  field: string;
  /** Expected value (from manifest) */
  expected: unknown;
  /** Actual value (from WordPress) */
  actual: unknown;
}

/**
 * Page diff entry
 */
export interface PageDiff {
  /** Page slug */
  slug: string;
  /** Page title (manifest or WP) */
  title: string;
  /** Type of change */
  change: ChangeType;
  /** Severity of change */
  severity: ChangeSeverity;
  /** Changed fields (for modifications) */
  fields?: FieldChange[];
  /** Whether page exists in manifest */
  inManifest: boolean;
  /** Whether page exists in WordPress */
  inWordPress: boolean;
  /** WordPress page ID (if exists) */
  wpId?: number;
}

/**
 * Plugin diff entry
 */
export interface PluginDiff {
  /** Plugin slug */
  slug: string;
  /** Plugin name */
  name: string;
  /** Type of change */
  change: ChangeType;
  /** Severity of change */
  severity: ChangeSeverity;
  /** Changed fields */
  fields?: FieldChange[];
  /** Whether plugin is in manifest */
  inManifest: boolean;
  /** Whether plugin is active in WordPress */
  isActive: boolean;
  /** Expected state from manifest */
  expectedEnabled?: boolean;
}

/**
 * Complete diff result
 */
export interface DiffResult {
  /** Timestamp of diff */
  timestamp: string;
  /** Summary counts */
  summary: {
    /** Pages to add (in manifest, not in WP) */
    additions: number;
    /** Pages to remove (in WP, not in manifest) */
    removals: number;
    /** Pages with differences */
    modifications: number;
    /** Pages that match */
    matches: number;
    /** Total pages compared */
    total: number;
    /** Whether there are any differences */
    hasDifferences: boolean;
  };
  /** Page differences */
  pages: PageDiff[];
  /** Plugin differences */
  plugins: PluginDiff[];
  /** Manifest path */
  manifestPath?: string;
  /** Snapshot path (if used) */
  snapshotPath?: string;
}

// =============================================================================
// Diff Engine
// =============================================================================

/**
 * Options for diff comparison
 */
export interface DiffOptions {
  /** Include pages that match (no changes) */
  includeMatches?: boolean;
  /** Include plugins in diff */
  includePlugins?: boolean;
  /** Ignore certain fields when comparing */
  ignoreFields?: string[];
  /** Consider pages not in manifest as removals */
  strictMode?: boolean;
}

/**
 * WordPress page data from REST API or snapshot
 */
export interface WordPressPage {
  id: number;
  slug: string;
  title: string;
  status: string;
  template?: string;
  parent?: number;
  menu_order?: number;
}

/**
 * WordPress plugin data
 */
export interface WordPressPlugin {
  slug: string;
  name: string;
  active: boolean;
  version: string;
}

/**
 * Compare manifest with WordPress state
 */
export function computeDiff(
  manifest: WPNavManifest,
  wpPages: WordPressPage[],
  wpPlugins: WordPressPlugin[] = [],
  options: DiffOptions = {}
): DiffResult {
  const {
    includeMatches = false,
    includePlugins = true,
    ignoreFields = [],
    strictMode = false,
  } = options;

  const manifestPages = manifest.pages || [];
  const manifestPlugins = manifest.plugins || {};

  // Index WordPress pages by slug
  const wpPagesBySlug = new Map<string, WordPressPage>();
  for (const page of wpPages) {
    wpPagesBySlug.set(page.slug, page);
  }

  // Index manifest pages by slug
  const manifestPagesBySlug = new Map<string, ManifestPage>();
  for (const page of manifestPages) {
    manifestPagesBySlug.set(page.slug, page);
  }

  // Compare pages
  const pageDiffs: PageDiff[] = [];
  let additions = 0;
  let removals = 0;
  let modifications = 0;
  let matches = 0;

  // Check pages in manifest
  for (const manifestPage of manifestPages) {
    const wpPage = wpPagesBySlug.get(manifestPage.slug);

    if (!wpPage) {
      // Page in manifest but not in WordPress - ADDITION
      additions++;
      pageDiffs.push({
        slug: manifestPage.slug,
        title: manifestPage.title,
        change: 'add',
        severity: 'warning',
        inManifest: true,
        inWordPress: false,
      });
    } else {
      // Page exists in both - compare fields
      const fieldChanges = comparePageFields(manifestPage, wpPage, ignoreFields);

      if (fieldChanges.length > 0) {
        // Page has differences - MODIFICATION
        modifications++;
        pageDiffs.push({
          slug: manifestPage.slug,
          title: manifestPage.title,
          change: 'modify',
          severity: 'info',
          fields: fieldChanges,
          inManifest: true,
          inWordPress: true,
          wpId: wpPage.id,
        });
      } else {
        // Page matches
        matches++;
        if (includeMatches) {
          pageDiffs.push({
            slug: manifestPage.slug,
            title: manifestPage.title,
            change: 'match',
            severity: 'info',
            inManifest: true,
            inWordPress: true,
            wpId: wpPage.id,
          });
        }
      }
    }
  }

  // Check for pages in WordPress but not in manifest
  if (strictMode) {
    for (const wpPage of wpPages) {
      if (!manifestPagesBySlug.has(wpPage.slug)) {
        // Page in WordPress but not in manifest - REMOVAL
        removals++;
        pageDiffs.push({
          slug: wpPage.slug,
          title: wpPage.title,
          change: 'remove',
          severity: 'warning',
          inManifest: false,
          inWordPress: true,
          wpId: wpPage.id,
        });
      }
    }
  }

  // Compare plugins
  const pluginDiffs: PluginDiff[] = [];

  if (includePlugins && Object.keys(manifestPlugins).length > 0) {
    // Index WordPress plugins by slug
    const wpPluginsBySlug = new Map<string, WordPressPlugin>();
    for (const plugin of wpPlugins) {
      wpPluginsBySlug.set(plugin.slug, plugin);
    }

    // Check plugins in manifest
    for (const [slug, config] of Object.entries(manifestPlugins)) {
      const wpPlugin = wpPluginsBySlug.get(slug);

      if (!wpPlugin) {
        // Plugin in manifest but not installed
        pluginDiffs.push({
          slug,
          name: slug,
          change: 'add',
          severity: 'warning',
          inManifest: true,
          isActive: false,
          expectedEnabled: config.enabled,
        });
      } else if (wpPlugin.active !== config.enabled) {
        // Plugin state differs
        pluginDiffs.push({
          slug,
          name: wpPlugin.name,
          change: 'modify',
          severity: 'info',
          fields: [{
            field: 'enabled',
            expected: config.enabled,
            actual: wpPlugin.active,
          }],
          inManifest: true,
          isActive: wpPlugin.active,
          expectedEnabled: config.enabled,
        });
      } else if (includeMatches) {
        pluginDiffs.push({
          slug,
          name: wpPlugin.name,
          change: 'match',
          severity: 'info',
          inManifest: true,
          isActive: wpPlugin.active,
          expectedEnabled: config.enabled,
        });
      }
    }
  }

  const hasDifferences = additions > 0 || removals > 0 || modifications > 0 || pluginDiffs.some(p => p.change !== 'match');

  return {
    timestamp: new Date().toISOString(),
    summary: {
      additions,
      removals,
      modifications,
      matches,
      total: manifestPages.length + (strictMode ? wpPages.length - manifestPages.length : 0),
      hasDifferences,
    },
    pages: pageDiffs,
    plugins: pluginDiffs,
  };
}

/**
 * Compare page fields between manifest and WordPress
 */
function comparePageFields(
  manifest: ManifestPage,
  wp: WordPressPage,
  ignoreFields: string[]
): FieldChange[] {
  const changes: FieldChange[] = [];

  // Compare title
  if (!ignoreFields.includes('title') && manifest.title !== wp.title) {
    changes.push({
      field: 'title',
      expected: manifest.title,
      actual: wp.title,
    });
  }

  // Compare status
  if (!ignoreFields.includes('status') && manifest.status && manifest.status !== wp.status) {
    changes.push({
      field: 'status',
      expected: manifest.status,
      actual: wp.status,
    });
  }

  // Compare template (only if specified in manifest)
  if (!ignoreFields.includes('template') && manifest.template !== undefined) {
    const wpTemplate = wp.template || '';
    if (manifest.template !== wpTemplate) {
      changes.push({
        field: 'template',
        expected: manifest.template,
        actual: wpTemplate,
      });
    }
  }

  // Compare menu_order (only if specified in manifest)
  if (!ignoreFields.includes('menu_order') && manifest.menu_order !== undefined) {
    if (manifest.menu_order !== wp.menu_order) {
      changes.push({
        field: 'menu_order',
        expected: manifest.menu_order,
        actual: wp.menu_order,
      });
    }
  }

  return changes;
}

// =============================================================================
// Snapshot Integration
// =============================================================================

/**
 * Convert SiteIndexSnapshot pages to WordPressPage format
 */
export function snapshotToWordPressPages(snapshot: SiteIndexSnapshot): WordPressPage[] {
  return snapshot.content.pages.map((page: PageSummary) => ({
    id: page.id,
    slug: page.slug,
    title: page.title,
    status: page.status,
    template: page.template,
  }));
}

/**
 * Convert SiteIndexSnapshot plugins to WordPressPlugin format
 */
export function snapshotToWordPressPlugins(snapshot: SiteIndexSnapshot): WordPressPlugin[] {
  const plugins: WordPressPlugin[] = [];

  for (const plugin of snapshot.plugins.active) {
    plugins.push({
      slug: plugin.slug,
      name: plugin.name,
      active: true,
      version: plugin.version,
    });
  }

  for (const plugin of snapshot.plugins.inactive) {
    plugins.push({
      slug: plugin.slug,
      name: plugin.name,
      active: false,
      version: plugin.version,
    });
  }

  return plugins;
}

// =============================================================================
// Output Formatting
// =============================================================================

/**
 * Format diff result for human-readable output
 */
export function formatDiffText(diff: DiffResult): string {
  const lines: string[] = [];

  // Header
  lines.push('');
  lines.push('━━━ Diff: Manifest vs WordPress ━━━');
  lines.push('');

  // Summary
  const { summary } = diff;
  if (!summary.hasDifferences) {
    lines.push('✔ No differences found');
    lines.push('');
    return lines.join('\n');
  }

  // Stats line
  const parts: string[] = [];
  if (summary.additions > 0) parts.push(`+${summary.additions} to add`);
  if (summary.removals > 0) parts.push(`-${summary.removals} to remove`);
  if (summary.modifications > 0) parts.push(`~${summary.modifications} modified`);
  if (summary.matches > 0) parts.push(`${summary.matches} matched`);
  lines.push(parts.join(' | '));
  lines.push('');

  // Page changes
  if (diff.pages.length > 0) {
    lines.push('Pages:');
    for (const page of diff.pages) {
      const symbol = getChangeSymbol(page.change);
      const statusBadge = page.change === 'match' ? '' : ` [${page.change.toUpperCase()}]`;
      lines.push(`  ${symbol} ${page.slug} - "${page.title}"${statusBadge}`);

      if (page.fields && page.fields.length > 0) {
        for (const field of page.fields) {
          lines.push(`      ${field.field}: "${field.actual}" → "${field.expected}"`);
        }
      }
    }
    lines.push('');
  }

  // Plugin changes
  if (diff.plugins.length > 0) {
    lines.push('Plugins:');
    for (const plugin of diff.plugins) {
      if (plugin.change === 'match') continue;
      const symbol = getChangeSymbol(plugin.change);
      const state = plugin.change === 'modify'
        ? `${plugin.isActive ? 'active' : 'inactive'} → ${plugin.expectedEnabled ? 'active' : 'inactive'}`
        : plugin.change === 'add' ? 'not installed' : '';
      lines.push(`  ${symbol} ${plugin.slug} (${state})`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Get symbol for change type
 */
function getChangeSymbol(change: ChangeType): string {
  switch (change) {
    case 'add':
      return '+';
    case 'remove':
      return '-';
    case 'modify':
      return '~';
    case 'match':
      return '✔';
  }
}

/**
 * Format diff result as JSON
 */
export function formatDiffJson(diff: DiffResult): string {
  return JSON.stringify(diff, null, 2);
}
