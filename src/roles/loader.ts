/**
 * WP Navigator Roles Loader
 *
 * Discovers and loads role files from multiple sources:
 * 1. Bundled roles (package defaults)
 * 2. Global roles (~/.wpnav/roles/)
 * 3. Project roles (./roles/)
 *
 * Later sources extend/override earlier ones via deep merge.
 *
 * @package WP_Navigator_MCP
 * @since 1.2.0
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { homedir } from 'os';
import { loadRoleFile } from './parser.js';
import type { RoleSource, LoadedRole, RoleLoadResult } from './types.js';

// =============================================================================
// Path Utilities
// =============================================================================

/**
 * Get the path to bundled roles directory.
 * Handles both development (src/) and installed (dist/) contexts.
 */
function getBundledRolesPath(): string {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  // In dist: dist/roles/loader.js
  // Bundled roles are at: src/roles/bundled/ (sibling to dist/)
  // Path: ../../src/roles/bundled
  return path.join(__dirname, '..', '..', 'src', 'roles', 'bundled');
}

/**
 * Get the global roles directory path.
 */
function getGlobalRolesPath(): string {
  return path.join(homedir(), '.wpnav', 'roles');
}

// =============================================================================
// Single File Loading
// =============================================================================

/**
 * Load a single role from a file path.
 *
 * @param filePath - Absolute path to the role file
 * @param source - Source type (defaults to 'project')
 * @returns RoleLoadResult with success status and role or error
 */
export function loadRole(filePath: string, source: RoleSource = 'project'): RoleLoadResult {
  return loadRoleFile(filePath, source);
}

// =============================================================================
// Directory Loading
// =============================================================================

/**
 * Load all roles from a directory.
 *
 * @param directory - Path to directory containing role files
 * @param source - Source type for all roles in this directory
 * @returns Array of RoleLoadResult (success or failure for each file)
 */
export function loadRolesFromDirectory(
  directory: string,
  source: RoleSource
): RoleLoadResult[] {
  if (!fs.existsSync(directory)) {
    return [];
  }

  let entries: string[];
  try {
    entries = fs.readdirSync(directory);
  } catch {
    return [];
  }

  const roleFiles = entries.filter((f) => /\.(yaml|yml|json)$/i.test(f));

  return roleFiles.map((file) => loadRoleFile(path.join(directory, file), source));
}

// =============================================================================
// Deep Merge
// =============================================================================

/**
 * Deep merge a child role with a parent role.
 *
 * Merge semantics:
 * - Identity fields (name, source, sourcePath): child wins
 * - Scalars (description, context, author): child overrides if specified
 * - Arrays (focus_areas, avoid, tags, tools.denied): concat and dedupe
 * - tools.allowed: child replaces entirely (not merged)
 *
 * @param parent - Base role (lower priority)
 * @param child - Extending role (higher priority)
 * @returns Merged role with child's source/path
 */
export function mergeRoles(parent: LoadedRole, child: LoadedRole): LoadedRole {
  return {
    // Child always wins for identity fields
    name: child.name,
    source: child.source,
    sourcePath: child.sourcePath,

    // Child overrides if specified, else inherit
    description: child.description || parent.description,
    context: child.context || parent.context,
    schema_version: child.schema_version ?? parent.schema_version,
    priority: child.priority ?? parent.priority,
    version: child.version || parent.version,
    author: child.author || parent.author,

    // Arrays: concat and dedupe (child additions + parent base)
    focus_areas: [...new Set([...(parent.focus_areas || []), ...(child.focus_areas || [])])],
    avoid: [...new Set([...(parent.avoid || []), ...(child.avoid || [])])],
    tags: [...new Set([...(parent.tags || []), ...(child.tags || [])])],

    // Tools: merge allowed/denied intelligently
    tools: {
      allowed: child.tools?.allowed ?? parent.tools?.allowed,
      denied: [...new Set([...(parent.tools?.denied || []), ...(child.tools?.denied || [])])],
    },
  };
}

// =============================================================================
// Role Discovery
// =============================================================================

/**
 * Options for role discovery.
 */
export interface DiscoveryOptions {
  /** Project directory to search for roles/ folder. Defaults to cwd. */
  projectDir?: string;
  /** Include global ~/.wpnav/roles/. Defaults to true. */
  includeGlobal?: boolean;
  /** Include bundled roles. Defaults to true. */
  includeBundled?: boolean;
}

/**
 * Result of role discovery.
 */
export interface DiscoveredRoles {
  /** Map of role name to merged role definition */
  roles: Map<string, LoadedRole>;
  /** Which role names came from each source */
  sources: {
    project: string[];
    global: string[];
    bundled: string[];
  };
  /** Failed role loads */
  errors: RoleLoadResult[];
}

/**
 * Discover roles from all sources.
 *
 * Loading order (lowest to highest priority):
 * 1. Bundled roles (package defaults)
 * 2. Global roles (~/.wpnav/roles/)
 * 3. Project roles (./roles/)
 *
 * Same-name roles are deep merged (child extends parent).
 *
 * @param options - Discovery options
 * @returns DiscoveredRoles with merged roles and source tracking
 */
export function discoverRoles(options: DiscoveryOptions = {}): DiscoveredRoles {
  const { projectDir = process.cwd(), includeGlobal = true, includeBundled = true } = options;

  const roles = new Map<string, LoadedRole>();
  const sources: DiscoveredRoles['sources'] = { project: [], global: [], bundled: [] };
  const errors: RoleLoadResult[] = [];

  // Load bundled first (lowest priority)
  if (includeBundled) {
    const bundledPath = getBundledRolesPath();
    const bundledResults = loadRolesFromDirectory(bundledPath, 'bundled');
    for (const result of bundledResults) {
      if (result.success && result.role) {
        roles.set(result.role.name, result.role);
        sources.bundled.push(result.role.name);
      } else {
        errors.push(result);
      }
    }
  }

  // Load global (medium priority - deep merge with bundled)
  if (includeGlobal) {
    const globalPath = getGlobalRolesPath();
    const globalResults = loadRolesFromDirectory(globalPath, 'global');
    for (const result of globalResults) {
      if (result.success && result.role) {
        const existing = roles.get(result.role.name);
        const merged = existing ? mergeRoles(existing, result.role) : result.role;
        roles.set(result.role.name, merged);
        sources.global.push(result.role.name);
      } else {
        errors.push(result);
      }
    }
  }

  // Load project (highest priority - deep merge with global/bundled)
  const projectRolesPath = path.join(projectDir, 'roles');
  const projectResults = loadRolesFromDirectory(projectRolesPath, 'project');
  for (const result of projectResults) {
    if (result.success && result.role) {
      const existing = roles.get(result.role.name);
      const merged = existing ? mergeRoles(existing, result.role) : result.role;
      roles.set(result.role.name, merged);
      sources.project.push(result.role.name);
    } else {
      errors.push(result);
    }
  }

  return { roles, sources, errors };
}

// =============================================================================
// Convenience Functions
// =============================================================================

/**
 * List all available role names (sorted alphabetically).
 *
 * @param options - Discovery options
 * @returns Sorted array of role names
 */
export function listAvailableRoles(options?: DiscoveryOptions): string[] {
  const { roles } = discoverRoles(options);
  return Array.from(roles.keys()).sort();
}

/**
 * Get a specific role by name.
 *
 * @param name - Role name to retrieve
 * @param options - Discovery options
 * @returns LoadedRole if found, null otherwise
 */
export function getRole(name: string, options?: DiscoveryOptions): LoadedRole | null {
  const { roles } = discoverRoles(options);
  return roles.get(name) || null;
}

/**
 * Get the path to the bundled roles directory.
 * Exported for testing purposes.
 */
export function getBundledPath(): string {
  return getBundledRolesPath();
}
