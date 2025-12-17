/**
 * Role Filter Tests
 *
 * Tests for role resolution and filtering.
 *
 * @package WP_Navigator_MCP
 * @since 2.7.0
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  resolveEffectiveRole,
  resolveEffectiveRoleSync,
  autoDetectRole,
  isValidRole,
  getDefaultEffectiveRole,
} from './role-filter.js';
import type { LoadedRole } from './types.js';
import type { ManifestRoleOverrides } from '../manifest.js';

// Mock role data
function createMockRole(overrides: Partial<LoadedRole> = {}): LoadedRole {
  return {
    name: overrides.name ?? 'test-role',
    description: overrides.description ?? 'Test role description',
    context: overrides.context ?? 'Test context',
    focus_areas: overrides.focus_areas ?? ['testing'],
    avoid: overrides.avoid ?? [],
    tools: overrides.tools ?? { allowed: undefined, denied: [] },
    source: overrides.source ?? 'bundled',
    sourcePath: overrides.sourcePath ?? '/bundled/test-role.md',
    schema_version: overrides.schema_version ?? 1,
  };
}

// Mock getRole function
vi.mock('./loader.js', () => ({
  getRole: vi.fn((slug: string) => {
    const roles: Record<string, LoadedRole> = {
      developer: createMockRole({
        name: 'developer',
        description: 'Developer role',
        tools: { allowed: ['wpnav_*'], denied: [] },
      }),
      'content-editor': createMockRole({
        name: 'content-editor',
        description: 'Content editor role',
        tools: { allowed: ['wpnav_list_*', 'wpnav_get_*'], denied: ['wpnav_delete_*'] },
      }),
      'site-admin': createMockRole({
        name: 'site-admin',
        description: 'Site admin role',
        tools: { allowed: undefined, denied: ['wpnav_seed_test_data'] },
      }),
      'read-only': createMockRole({
        name: 'read-only',
        description: 'Read-only role',
        tools: { allowed: ['wpnav_list_*', 'wpnav_get_*', 'wpnav_introspect'], denied: [] },
      }),
    };
    return roles[slug] ?? null;
  }),
}));

describe('Role Filter', () => {
  describe('resolveEffectiveRole', () => {
    it('returns no role when manifestRoles is undefined', () => {
      const result = resolveEffectiveRole({});

      expect(result.effective.role).toBeNull();
      expect(result.effective.source).toBe('none');
      expect(result.effective.warnings).toHaveLength(0);
    });

    it('returns no role when active is empty string', () => {
      const result = resolveEffectiveRole({
        manifestRoles: { active: '' },
      });

      expect(result.effective.role).toBeNull();
      expect(result.effective.source).toBe('none');
    });

    it('loads role from manifest active setting', () => {
      const result = resolveEffectiveRole({
        manifestRoles: { active: 'developer' },
      });

      expect(result.effective.role).not.toBeNull();
      expect(result.effective.role?.name).toBe('developer');
      expect(result.effective.source).toBe('config');
    });

    it('returns warning for unknown role', () => {
      const result = resolveEffectiveRole({
        manifestRoles: { active: 'nonexistent-role' },
      });

      expect(result.effective.role).toBeNull();
      expect(result.effective.source).toBe('none');
      expect(result.effective.warnings).toContain(
        'Config active role not found: "nonexistent-role"'
      );
    });

    it('prioritizes runtime override over config', () => {
      const result = resolveEffectiveRole({
        manifestRoles: { active: 'developer' },
        runtimeRoleOverride: 'content-editor',
      });

      expect(result.effective.role?.name).toBe('content-editor');
      expect(result.effective.source).toBe('runtime');
    });

    it('uses auto_detect when capabilities provided and auto_detect not disabled', () => {
      const result = resolveEffectiveRole({
        manifestRoles: {}, // auto_detect defaults to enabled
        userCapabilities: ['publish_posts'], // maps to content-editor
      });

      expect(result.effective.role?.name).toBe('content-editor');
      expect(result.effective.source).toBe('auto-detect');
    });

    it('falls back to none when auto_detect has no matching capabilities', () => {
      const result = resolveEffectiveRole({
        manifestRoles: {},
        userCapabilities: [],
      });

      expect(result.effective.role).toBeNull();
      expect(result.effective.source).toBe('none');
    });

    it('does not auto-detect when auto_detect is false', () => {
      const result = resolveEffectiveRole({
        manifestRoles: { auto_detect: false },
        userCapabilities: ['edit_posts', 'publish_posts'],
      });

      expect(result.effective.role).toBeNull();
      expect(result.effective.source).toBe('none');
    });

    it('warns for runtime override not found', () => {
      const result = resolveEffectiveRole({
        runtimeRoleOverride: 'nonexistent',
      });

      expect(result.effective.warnings).toContain('Runtime role override not found: "nonexistent"');
    });
  });

  describe('resolveEffectiveRoleSync', () => {
    it('resolves role synchronously with config', () => {
      const result = resolveEffectiveRoleSync({
        manifestRoles: { active: 'developer' },
      });

      expect(result.role?.name).toBe('developer');
      expect(result.source).toBe('config');
    });

    it('applies role overrides from config', () => {
      const roleOverrides: ManifestRoleOverrides = {
        tools_allow: ['wpnav_custom_tool'],
        tools_deny: ['wpnav_dangerous_tool'],
      };

      const result = resolveEffectiveRoleSync({
        manifestRoles: { active: 'developer' },
        roleOverrides,
      });

      expect(result.role?.name).toBe('developer');
      expect(result.tools.denied).toContain('wpnav_dangerous_tool');
    });

    it('merges override tools with role tools', () => {
      const roleOverrides: ManifestRoleOverrides = {
        tools_allow: ['wpnav_extra_tool'],
        tools_deny: ['wpnav_blocked_tool'],
      };

      const result = resolveEffectiveRoleSync({
        manifestRoles: { active: 'content-editor' },
        roleOverrides,
      });

      // content-editor has denied: ['wpnav_delete_*']
      expect(result.tools.denied).toContain('wpnav_delete_*');
      expect(result.tools.denied).toContain('wpnav_blocked_tool');
    });
  });

  describe('autoDetectRole', () => {
    it('returns developer for manage_options capability', () => {
      const role = autoDetectRole(['manage_options', 'edit_posts']);
      expect(role).toBe('developer');
    });

    it('returns developer for activate_plugins capability (developer higher priority)', () => {
      // activate_plugins maps to both ['site-admin', 'developer']
      // developer has higher priority in AUTO_DETECT_ROLE_PRIORITY
      const role = autoDetectRole(['activate_plugins', 'edit_posts']);
      expect(role).toBe('developer');
    });

    it('returns content-editor for publish_posts capability', () => {
      // publish_posts maps to content-editor
      const role = autoDetectRole(['publish_posts']);
      expect(role).toBe('content-editor');
    });

    it('returns null for read capability only (no mapping)', () => {
      // 'read' is not in CAPABILITY_ROLE_MAPPING
      const role = autoDetectRole(['read']);
      expect(role).toBeNull();
    });

    it('returns null for empty capabilities', () => {
      const role = autoDetectRole([]);
      expect(role).toBeNull();
    });

    it('prioritizes higher-level capabilities', () => {
      // If user has both manage_options and edit_posts, should get developer
      const role = autoDetectRole(['read', 'edit_posts', 'manage_options']);
      expect(role).toBe('developer');
    });

    it('returns site-admin for list_users capability', () => {
      // list_users maps only to site-admin
      const role = autoDetectRole(['list_users']);
      expect(role).toBe('site-admin');
    });
  });

  describe('isValidRole', () => {
    it('returns true for existing role', () => {
      expect(isValidRole('developer')).toBe(true);
      expect(isValidRole('content-editor')).toBe(true);
    });

    it('returns false for non-existing role', () => {
      expect(isValidRole('nonexistent')).toBe(false);
    });
  });

  describe('getDefaultEffectiveRole', () => {
    it('returns effective role with no restrictions', () => {
      const defaultRole = getDefaultEffectiveRole();

      expect(defaultRole.role).toBeNull();
      expect(defaultRole.source).toBe('none');
      expect(defaultRole.tools.allowed).toBeNull();
      expect(defaultRole.tools.denied).toEqual([]);
      expect(defaultRole.warnings).toEqual([]);
    });
  });

  describe('Role Resolution Priority', () => {
    it('priority order: runtime > config > auto-detect > none', () => {
      // Test 1: Runtime override takes precedence
      const result1 = resolveEffectiveRole({
        manifestRoles: { active: 'developer' },
        runtimeRoleOverride: 'content-editor',
        userCapabilities: ['manage_options'],
      });
      expect(result1.effective.source).toBe('runtime');
      expect(result1.effective.role?.name).toBe('content-editor');

      // Test 2: Config takes precedence over auto-detect
      const result2 = resolveEffectiveRole({
        manifestRoles: { active: 'developer' },
        userCapabilities: ['publish_posts'],
      });
      expect(result2.effective.source).toBe('config');
      expect(result2.effective.role?.name).toBe('developer');

      // Test 3: Auto-detect when no config active
      // publish_posts maps to content-editor which exists in our mock
      const result3 = resolveEffectiveRole({
        manifestRoles: {},
        userCapabilities: ['publish_posts'],
      });
      expect(result3.effective.source).toBe('auto-detect');
      expect(result3.effective.role?.name).toBe('content-editor');

      // Test 4: None when nothing configured
      const result4 = resolveEffectiveRole({});
      expect(result4.effective.source).toBe('none');
      expect(result4.effective.role).toBeNull();
    });
  });

  describe('Tool Restrictions', () => {
    it('role with allowed: null allows all tools by default', () => {
      const result = resolveEffectiveRoleSync({
        manifestRoles: { active: 'site-admin' },
      });

      expect(result.tools.allowed).toBeNull();
    });

    it('role with specific allowed restricts to those patterns', () => {
      const result = resolveEffectiveRoleSync({
        manifestRoles: { active: 'read-only' },
      });

      expect(result.tools.allowed).toContain('wpnav_list_*');
      expect(result.tools.allowed).toContain('wpnav_get_*');
    });

    it('denied tools are preserved from role', () => {
      const result = resolveEffectiveRoleSync({
        manifestRoles: { active: 'content-editor' },
      });

      expect(result.tools.denied).toContain('wpnav_delete_*');
    });

    it('config overrides extend denied list', () => {
      const result = resolveEffectiveRoleSync({
        manifestRoles: { active: 'content-editor' },
        roleOverrides: {
          tools_deny: ['wpnav_dangerous_tool'],
        },
      });

      expect(result.tools.denied).toContain('wpnav_delete_*');
      expect(result.tools.denied).toContain('wpnav_dangerous_tool');
    });

    it('config overrides extend allowed list when role has whitelist', () => {
      const result = resolveEffectiveRoleSync({
        manifestRoles: { active: 'content-editor' },
        roleOverrides: {
          tools_allow: ['wpnav_extra_tool'],
        },
      });

      // content-editor has allowed: ['wpnav_list_*', 'wpnav_get_*']
      expect(result.tools.allowed).toContain('wpnav_list_*');
      expect(result.tools.allowed).toContain('wpnav_extra_tool');
    });
  });
});
