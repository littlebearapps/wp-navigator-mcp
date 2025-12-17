/**
 * Role Filter Module
 *
 * Resolves the effective role from configuration and runtime state.
 * Supports:
 * - Config-based role selection (manifest roles.active)
 * - Runtime role override (wpnav_load_role, CLI)
 * - Auto-detection from WordPress user capabilities
 * - Role tool restrictions merged with config overrides
 *
 * @package WP_Navigator_MCP
 * @since 2.7.0
 */

import { LoadedRole } from './types.js';
import { getRole } from './loader.js';
import {
  EffectiveRole,
  RoleFilterOptions,
  RoleResolutionResult,
  RoleResolutionSource,
  CAPABILITY_ROLE_MAPPING,
  AUTO_DETECT_ROLE_PRIORITY,
} from './filter-types.js';
import { ManifestRoleOverrides } from '../manifest.js';

/**
 * Resolve the effective role from configuration and runtime state.
 *
 * Resolution priority:
 * 1. Runtime override (from wpnav_load_role or CLI)
 * 2. Config active role (manifest roles.active)
 * 3. Auto-detect from user capabilities (if auto_detect enabled)
 * 4. No role (all tools allowed by config)
 *
 * @param options - Role filter options
 * @returns Resolution result with effective role
 */
export function resolveEffectiveRole(options: RoleFilterOptions): RoleResolutionResult {
  const {
    manifestRoles,
    roleOverrides,
    runtimeRoleOverride,
    userCapabilities = [],
    roleLoader = (slug) => Promise.resolve(getRole(slug)),
  } = options;

  const warnings: string[] = [];
  let role: LoadedRole | null = null;
  let source: RoleResolutionSource = 'none';

  // Priority 1: Runtime override
  if (runtimeRoleOverride) {
    const loadedRole = getRole(runtimeRoleOverride);
    if (loadedRole) {
      role = loadedRole;
      source = 'runtime';
    } else {
      warnings.push(`Runtime role override not found: "${runtimeRoleOverride}"`);
    }
  }

  // Priority 2: Config active role
  if (!role && manifestRoles?.active) {
    const loadedRole = getRole(manifestRoles.active);
    if (loadedRole) {
      role = loadedRole;
      source = 'config';
    } else {
      warnings.push(`Config active role not found: "${manifestRoles.active}"`);
    }
  }

  // Priority 3: Auto-detect from capabilities
  if (!role && manifestRoles?.auto_detect !== false && userCapabilities.length > 0) {
    const detectedRole = autoDetectRole(userCapabilities);
    if (detectedRole) {
      const loadedRole = getRole(detectedRole);
      if (loadedRole) {
        role = loadedRole;
        source = 'auto-detect';
      }
    }
  }

  // Build effective role with merged tools
  const effective = buildEffectiveRole(role, source, roleOverrides, warnings);

  return {
    effective,
    success: warnings.length === 0 || role !== null,
  };
}

/**
 * Auto-detect appropriate role based on WordPress user capabilities.
 *
 * Uses CAPABILITY_ROLE_MAPPING to find matching roles, then
 * selects the highest-priority match from AUTO_DETECT_ROLE_PRIORITY.
 *
 * @param capabilities - WordPress user capabilities
 * @returns Role slug or null if no match
 */
export function autoDetectRole(capabilities: string[]): string | null {
  if (!capabilities.length) {
    return null;
  }

  // Collect all matching roles
  const matchingRoles = new Set<string>();

  for (const cap of capabilities) {
    const roles = CAPABILITY_ROLE_MAPPING[cap];
    if (roles) {
      roles.forEach((r) => matchingRoles.add(r));
    }
  }

  if (matchingRoles.size === 0) {
    return null;
  }

  // Return highest-priority matching role
  for (const priorityRole of AUTO_DETECT_ROLE_PRIORITY) {
    if (matchingRoles.has(priorityRole)) {
      return priorityRole;
    }
  }

  // If no priority match, return first matching role
  return Array.from(matchingRoles)[0];
}

/**
 * Build effective role with merged tool restrictions.
 *
 * Merges role's tools.allowed/denied with config overrides.
 * Config overrides extend (tools_allow) or further restrict (tools_deny).
 *
 * @param role - Loaded role or null
 * @param source - How the role was resolved
 * @param overrides - Config role overrides
 * @param warnings - Warnings array to append to
 * @returns Effective role
 */
function buildEffectiveRole(
  role: LoadedRole | null,
  source: RoleResolutionSource,
  overrides?: ManifestRoleOverrides,
  warnings: string[] = []
): EffectiveRole {
  // Start with role's tool restrictions
  let allowed: string[] | null = role?.tools?.allowed ?? null;
  let denied: string[] = role?.tools?.denied ?? [];

  // Apply config overrides
  if (overrides) {
    // tools_allow extends the allowed list (or creates one if role has whitelist)
    if (overrides.tools_allow && overrides.tools_allow.length > 0) {
      if (allowed !== null) {
        // Extend existing whitelist
        allowed = [...allowed, ...overrides.tools_allow];
      }
      // If no whitelist from role, tools_allow just adds to available tools
      // (handled by the tool filter's applyRoleOverrides)
    }

    // tools_deny further restricts
    if (overrides.tools_deny && overrides.tools_deny.length > 0) {
      denied = [...denied, ...overrides.tools_deny];
    }
  }

  return {
    role,
    source,
    tools: {
      allowed,
      denied,
    },
    warnings,
  };
}

/**
 * Synchronous role resolution (for non-async contexts).
 *
 * Same as resolveEffectiveRole but synchronous.
 * Uses getRole() directly which is synchronous.
 *
 * @param options - Role filter options (roleLoader ignored)
 * @returns Effective role
 */
export function resolveEffectiveRoleSync(
  options: Omit<RoleFilterOptions, 'roleLoader'>
): EffectiveRole {
  const result = resolveEffectiveRole(options);
  return result.effective;
}

/**
 * Check if a role slug is valid (exists in available roles).
 *
 * @param slug - Role slug to check
 * @returns true if role exists
 */
export function isValidRole(slug: string): boolean {
  return getRole(slug) !== null;
}

/**
 * Get the default effective role (no role active).
 *
 * @returns Effective role with no restrictions
 */
export function getDefaultEffectiveRole(): EffectiveRole {
  return {
    role: null,
    source: 'none',
    tools: {
      allowed: null,
      denied: [],
    },
    warnings: [],
  };
}
