/**
 * WP Navigator Roles Module
 *
 * Phase B3: Roles system for guiding AI behaviour.
 *
 * Roles define how AI assistants should interact with WordPress:
 * - Focus areas and things to avoid
 * - Allowed and denied tools
 * - Context and description for the AI
 *
 * Roles are loaded from three sources (in priority order):
 * 1. Bundled roles (package defaults)
 * 2. Global roles (~/.wpnav/roles/)
 * 3. Project roles (./roles/)
 *
 * Same-name roles are deep merged (child extends parent).
 *
 * @package WP_Navigator_MCP
 * @since 1.2.0
 */

// Type definitions
export * from './types.js';

// YAML/JSON parser and validation
export * from './parser.js';

// Role loading and discovery
export {
  loadRole,
  loadRolesFromDirectory,
  mergeRoles,
  discoverRoles,
  listAvailableRoles,
  getRole,
  getBundledPath,
  type DiscoveryOptions,
  type DiscoveredRoles,
} from './loader.js';

// Role resolution (CLI > env > config)
export {
  resolveRole,
  formatRoleInfo,
  RoleNotFoundError,
  type ResolveRoleOptions,
  type ResolvedRole,
} from './resolver.js';

// Role filter types and implementation (v2.7.0)
export * from './filter-types.js';
export {
  resolveEffectiveRole,
  resolveEffectiveRoleSync,
  autoDetectRole,
  isValidRole,
  getDefaultEffectiveRole,
} from './role-filter.js';

// Runtime role state (v2.7.0)
export { runtimeRoleState, STATE_FILE_NAME } from './runtime-state.js';
