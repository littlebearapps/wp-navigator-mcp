/**
 * Role Filter Types
 *
 * Type definitions for role-based filtering and resolution.
 *
 * @package WP_Navigator_MCP
 * @since 2.7.0
 */

import { LoadedRole } from './types.js';
import { ManifestRoles, ManifestRoleOverrides } from '../manifest.js';

/**
 * Source of role resolution
 */
export type RoleResolutionSource = 'config' | 'runtime' | 'auto-detect' | 'none';

/**
 * Effective role after resolution
 *
 * Represents the final role that will be applied, including
 * the source of the resolution and merged tool restrictions.
 */
export interface EffectiveRole {
  /** The resolved role, or null if no role is active */
  role: LoadedRole | null;
  /** How the role was resolved */
  source: RoleResolutionSource;
  /** Merged tool restrictions (role + config overrides) */
  tools: {
    /** Allowed tool patterns (null = no whitelist, all tools allowed by config) */
    allowed: string[] | null;
    /** Denied tool patterns */
    denied: string[];
  };
  /** Warnings generated during resolution */
  warnings: string[];
}

/**
 * Options for resolving the effective role
 */
export interface RoleFilterOptions {
  /** Manifest roles configuration */
  manifestRoles?: ManifestRoles;
  /** Role overrides from config */
  roleOverrides?: ManifestRoleOverrides;
  /** Runtime role override (from wpnav_load_role or CLI) */
  runtimeRoleOverride?: string | null;
  /** WordPress user capabilities (for auto-detect) */
  userCapabilities?: string[];
  /** Function to load a role by slug */
  roleLoader?: (slug: string) => Promise<LoadedRole | null>;
}

/**
 * Result of role resolution
 */
export interface RoleResolutionResult {
  /** The effective role */
  effective: EffectiveRole;
  /** Whether resolution was successful */
  success: boolean;
  /** Error message if resolution failed */
  error?: string;
}

/**
 * Runtime role state
 *
 * Tracks the currently active role during a session.
 * Used for runtime role switching via wpnav_load_role or CLI.
 */
export interface RuntimeRoleStateData {
  /** Current role slug, or null if no runtime override */
  activeRole: string | null;
  /** How the role was set */
  source: 'cli' | 'tool' | 'state-file' | null;
  /** Timestamp when role was set */
  setAt: number | null;
}

/**
 * State file format (.wpnav-state.json)
 *
 * Session-local state file that tracks runtime overrides.
 * Auto-gitignored, not committed to repo.
 */
export interface WpnavStateFile {
  /** Active role slug override */
  active_role?: string | null;
  /** Source of role override */
  role_source?: 'cli' | 'state-file';
  /** Timestamp when last modified */
  modified_at?: string;
}

/**
 * Auto-detect role mapping
 *
 * Maps WordPress capabilities to recommended roles.
 */
export const CAPABILITY_ROLE_MAPPING: Record<string, string[]> = {
  // High-privilege capabilities suggest admin/developer roles
  manage_options: ['site-admin', 'developer'],
  activate_plugins: ['site-admin', 'developer'],
  edit_theme_options: ['site-admin', 'developer'],
  install_plugins: ['developer'],
  edit_files: ['developer'],
  manage_network: ['site-admin'],

  // Editor capabilities
  edit_others_posts: ['content-editor', 'seo-specialist'],
  edit_pages: ['content-editor'],
  edit_published_posts: ['content-editor'],
  publish_posts: ['content-editor'],

  // Author/Contributor
  edit_posts: ['content-author'],

  // User management
  list_users: ['site-admin'],
  create_users: ['site-admin'],
};

/**
 * Priority order for auto-detected roles
 * Lower index = higher priority
 */
export const AUTO_DETECT_ROLE_PRIORITY = [
  'developer',
  'site-admin',
  'seo-specialist',
  'content-editor',
  'content-author',
];
