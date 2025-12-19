/**
 * State Analyzer
 *
 * Analyzes project state to build context for suggestions.
 *
 * @package WP_Navigator_Pro
 * @since 2.8.0
 */

import fs from 'node:fs';
import path from 'node:path';
import { ProjectContext } from './rules.js';

/**
 * Options for state analysis
 */
export interface AnalyzerOptions {
  /** Current working directory */
  cwd?: string;
  /** Introspect response (if already fetched) */
  introspect?: {
    detected_plugins?: string[];
    available_cookbooks?: string[];
  };
  /** Loaded cookbooks */
  loadedCookbooks?: string[];
  /** Active role name */
  activeRole?: string;
}

/**
 * Check if a file or directory exists
 */
function exists(filepath: string): boolean {
  try {
    fs.accessSync(filepath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get file modification time in hours from now
 */
function getAgeInHours(filepath: string): number | undefined {
  try {
    const stats = fs.statSync(filepath);
    const now = Date.now();
    const mtime = stats.mtime.getTime();
    return (now - mtime) / (1000 * 60 * 60);
  } catch {
    return undefined;
  }
}

/**
 * Analyze project state and build context
 */
export function analyzeState(options: AnalyzerOptions = {}): ProjectContext {
  const cwd = options.cwd ?? process.cwd();

  // Check for manifest
  const manifestPath = path.join(cwd, 'wpnavigator.jsonc');
  const hasManifest = exists(manifestPath);

  // Check for config (connection)
  const configPaths = [path.join(cwd, 'wpnav.config.json'), path.join(cwd, '.wpnav.env')];
  const hasConnection = configPaths.some(exists);

  // Check for site snapshot
  const snapshotDir = path.join(cwd, 'snapshots');
  const siteSnapshotPath = path.join(snapshotDir, 'site.json');
  const hasSiteSnapshot = exists(siteSnapshotPath);
  const snapshotAge = hasSiteSnapshot ? getAgeInHours(siteSnapshotPath) : undefined;

  // Extract plugins from introspect
  const detectedPlugins = (options.introspect?.detected_plugins ?? []).map((p) => {
    // Extract plugin slug from "plugin/plugin.php" format
    const match = p.match(/^([^/]+)/);
    return match ? match[1] : p;
  });

  // Available and loaded cookbooks
  const availableCookbooks = options.introspect?.available_cookbooks ?? [];
  const loadedCookbooks = options.loadedCookbooks ?? [];

  return {
    hasManifest,
    hasConnection,
    hasSiteSnapshot,
    snapshotAge,
    detectedPlugins,
    availableCookbooks,
    loadedCookbooks,
    activeRole: options.activeRole,
  };
}
