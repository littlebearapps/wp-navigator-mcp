/**
 * WP Navigator Role Resolver
 *
 * Resolves which role to use based on priority:
 * 1. CLI --role flag (highest priority)
 * 2. WPNAV_ROLE environment variable
 * 3. Config file default_role
 * 4. None (no role active)
 *
 * @package WP_Navigator_MCP
 * @since 1.2.0
 */

import { getRole, listAvailableRoles, type DiscoveryOptions } from './loader.js';
import type { LoadedRole } from './types.js';

/**
 * Error thrown when a specified role cannot be found
 */
export class RoleNotFoundError extends Error {
  public readonly roleName: string;
  public readonly availableRoles: string[];
  public readonly source: 'cli' | 'env' | 'config';

  constructor(roleName: string, availableRoles: string[], source: 'cli' | 'env' | 'config') {
    const sourceLabel = {
      cli: '--role flag',
      env: 'WPNAV_ROLE environment variable',
      config: 'config file default_role',
    }[source];

    super(
      `Role '${roleName}' not found (specified via ${sourceLabel}). ` +
        `Available roles: ${availableRoles.length > 0 ? availableRoles.join(', ') : '(none)'}`
    );
    this.name = 'RoleNotFoundError';
    this.roleName = roleName;
    this.availableRoles = availableRoles;
    this.source = source;
  }
}

/**
 * Options for role resolution
 */
export interface ResolveRoleOptions {
  /** Role name from CLI --role flag */
  cliRole?: string;
  /** Default role from config file */
  configDefaultRole?: string;
  /** Options for role discovery */
  discoveryOptions?: DiscoveryOptions;
}

/**
 * Result of role resolution
 */
export interface ResolvedRole {
  /** The loaded role (null if no role active) */
  role: LoadedRole | null;
  /** Source of the resolved role */
  source: 'cli' | 'env' | 'config' | 'none';
  /** The role name that was resolved */
  roleName: string | null;
}

/**
 * Resolve which role to use based on priority.
 *
 * Priority order:
 * 1. CLI --role flag (highest)
 * 2. WPNAV_ROLE environment variable
 * 3. Config file default_role
 * 4. None (no role)
 *
 * @param options - Resolution options
 * @returns Resolved role result
 * @throws RoleNotFoundError if a specified role doesn't exist
 */
export function resolveRole(options: ResolveRoleOptions = {}): ResolvedRole {
  const { cliRole, configDefaultRole, discoveryOptions } = options;

  // Get available roles for error messages
  const availableRoles = listAvailableRoles(discoveryOptions);

  // Priority 1: CLI --role flag
  if (cliRole) {
    const role = getRole(cliRole, discoveryOptions);
    if (!role) {
      throw new RoleNotFoundError(cliRole, availableRoles, 'cli');
    }
    return { role, source: 'cli', roleName: cliRole };
  }

  // Priority 2: WPNAV_ROLE environment variable
  const envRole = process.env.WPNAV_ROLE;
  if (envRole) {
    const role = getRole(envRole, discoveryOptions);
    if (!role) {
      throw new RoleNotFoundError(envRole, availableRoles, 'env');
    }
    return { role, source: 'env', roleName: envRole };
  }

  // Priority 3: Config file default_role
  if (configDefaultRole) {
    const role = getRole(configDefaultRole, discoveryOptions);
    if (!role) {
      throw new RoleNotFoundError(configDefaultRole, availableRoles, 'config');
    }
    return { role, source: 'config', roleName: configDefaultRole };
  }

  // Priority 4: No role
  return { role: null, source: 'none', roleName: null };
}

/**
 * Format role information for display
 */
export function formatRoleInfo(resolved: ResolvedRole): string {
  if (!resolved.role) {
    return 'No role active';
  }

  const { role, source } = resolved;
  const sourceLabel = {
    cli: 'CLI --role',
    env: 'WPNAV_ROLE',
    config: 'config default_role',
    none: '',
  }[source];

  return `${role.name} (via ${sourceLabel}) - ${role.description}`;
}
