/**
 * WP Navigator Cookbook Version Matcher
 *
 * Utilities for matching plugin versions against cookbook requirements.
 *
 * @package WP_Navigator_MCP
 * @since 2.1.0
 */

import type { LoadedCookbook } from './types.js';

/**
 * Plugin information for matching
 */
export interface PluginInfo {
  slug: string;
  version?: string;
  name?: string;
  status?: string;
}

/**
 * Result of matching a plugin to a cookbook
 */
export interface CookbookMatch {
  plugin: PluginInfo;
  cookbook: LoadedCookbook;
  compatible: boolean;
  reason?: string;
}

/**
 * Parse a version string into comparable parts.
 * Handles simple semver: "1.2.3" -> [1, 2, 3]
 */
function parseVersion(version: string): number[] {
  return version
    .split('.')
    .map((part) => parseInt(part, 10))
    .filter((n) => !isNaN(n));
}

/**
 * Compare two version arrays.
 * Returns: -1 if a < b, 0 if a == b, 1 if a > b
 */
function compareVersions(a: number[], b: number[]): number {
  const maxLength = Math.max(a.length, b.length);
  for (let i = 0; i < maxLength; i++) {
    const partA = a[i] ?? 0;
    const partB = b[i] ?? 0;
    if (partA < partB) return -1;
    if (partA > partB) return 1;
  }
  return 0;
}

/**
 * Check if a plugin version is compatible with cookbook requirements.
 *
 * @param pluginVersion - The installed plugin version (e.g., "3.21.0")
 * @param minVersion - Minimum required version (optional)
 * @param maxVersion - Maximum supported version (optional)
 * @returns true if compatible, false otherwise
 */
export function isVersionCompatible(
  pluginVersion: string | undefined,
  minVersion?: string,
  maxVersion?: string
): boolean {
  // No version to check - assume compatible
  if (!pluginVersion) {
    return true;
  }

  const current = parseVersion(pluginVersion);
  if (current.length === 0) {
    // Invalid version format - assume compatible
    return true;
  }

  // Check minimum version
  if (minVersion) {
    const min = parseVersion(minVersion);
    if (min.length > 0 && compareVersions(current, min) < 0) {
      return false;
    }
  }

  // Check maximum version
  if (maxVersion) {
    const max = parseVersion(maxVersion);
    if (max.length > 0 && compareVersions(current, max) > 0) {
      return false;
    }
  }

  return true;
}

/**
 * Match a list of active plugins against available cookbooks.
 *
 * @param cookbooks - Map of plugin slug to cookbook
 * @param plugins - List of active plugins with version info
 * @returns Array of matched cookbooks with compatibility status
 */
export function matchCookbooksToPlugins(
  cookbooks: Map<string, LoadedCookbook>,
  plugins: PluginInfo[]
): CookbookMatch[] {
  const matches: CookbookMatch[] = [];

  for (const plugin of plugins) {
    const cookbook = cookbooks.get(plugin.slug);
    if (!cookbook) {
      // No cookbook for this plugin - skip
      continue;
    }

    const minVersion = cookbook.plugin.min_version;
    const maxVersion = cookbook.plugin.max_version;
    const compatible = isVersionCompatible(plugin.version, minVersion, maxVersion);

    let reason: string | undefined;
    if (!compatible) {
      if (minVersion && plugin.version) {
        const current = parseVersion(plugin.version);
        const min = parseVersion(minVersion);
        if (compareVersions(current, min) < 0) {
          reason = `Plugin version ${plugin.version} is below minimum ${minVersion}`;
        }
      }
      if (maxVersion && plugin.version && !reason) {
        const current = parseVersion(plugin.version);
        const max = parseVersion(maxVersion);
        if (compareVersions(current, max) > 0) {
          reason = `Plugin version ${plugin.version} exceeds maximum ${maxVersion}`;
        }
      }
    }

    matches.push({
      plugin,
      cookbook,
      compatible,
      reason,
    });
  }

  return matches;
}
