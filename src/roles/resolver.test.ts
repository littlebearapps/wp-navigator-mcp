/**
 * Role Resolver Tests
 *
 * Tests for the role resolution logic (CLI > env > config priority).
 *
 * @package WP_Navigator_MCP
 * @since 1.2.0
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { resolveRole, formatRoleInfo, RoleNotFoundError } from './resolver.js';
import * as loader from './loader.js';
import type { LoadedRole } from './types.js';

// Mock the loader module
vi.mock('./loader.js', async (importOriginal) => {
  const original = await importOriginal<typeof loader>();
  return {
    ...original,
    getRole: vi.fn(),
    listAvailableRoles: vi.fn(),
  };
});

const mockGetRole = vi.mocked(loader.getRole);
const mockListAvailableRoles = vi.mocked(loader.listAvailableRoles);

// Sample role for testing
const contentEditorRole: LoadedRole = {
  name: 'content-editor',
  description: 'Content editing focus',
  context: 'You are a content editor...',
  source: 'bundled',
  sourcePath: '/path/to/content-editor.yaml',
  focus_areas: ['writing', 'editing'],
  avoid: ['technical changes'],
  tools: { allowed: ['wpnav_list_posts'] },
};

const developerRole: LoadedRole = {
  name: 'developer',
  description: 'Developer focus',
  context: 'You are a developer...',
  source: 'bundled',
  sourcePath: '/path/to/developer.yaml',
};

describe('resolveRole', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Default: roles exist
    mockGetRole.mockImplementation((name) => {
      if (name === 'content-editor') return contentEditorRole;
      if (name === 'developer') return developerRole;
      return null;
    });
    mockListAvailableRoles.mockReturnValue(['content-editor', 'developer', 'site-admin']);
    // Clear env
    delete process.env.WPNAV_ROLE;
  });

  afterEach(() => {
    delete process.env.WPNAV_ROLE;
  });

  describe('priority resolution', () => {
    it('returns CLI role when provided (highest priority)', () => {
      process.env.WPNAV_ROLE = 'developer';
      const result = resolveRole({
        cliRole: 'content-editor',
        configDefaultRole: 'site-admin',
      });

      expect(result.role).toBe(contentEditorRole);
      expect(result.source).toBe('cli');
      expect(result.roleName).toBe('content-editor');
    });

    it('returns env role when CLI is not provided', () => {
      process.env.WPNAV_ROLE = 'developer';
      const result = resolveRole({
        configDefaultRole: 'content-editor',
      });

      expect(result.role).toBe(developerRole);
      expect(result.source).toBe('env');
      expect(result.roleName).toBe('developer');
    });

    it('returns config default role when CLI and env are not set', () => {
      const result = resolveRole({
        configDefaultRole: 'content-editor',
      });

      expect(result.role).toBe(contentEditorRole);
      expect(result.source).toBe('config');
      expect(result.roleName).toBe('content-editor');
    });

    it('returns null role when nothing is set', () => {
      const result = resolveRole({});

      expect(result.role).toBeNull();
      expect(result.source).toBe('none');
      expect(result.roleName).toBeNull();
    });
  });

  describe('error handling', () => {
    it('throws RoleNotFoundError for invalid CLI role', () => {
      mockGetRole.mockImplementation(() => null);

      expect(() => resolveRole({ cliRole: 'nonexistent' })).toThrow(RoleNotFoundError);

      try {
        resolveRole({ cliRole: 'nonexistent' });
      } catch (e) {
        expect(e).toBeInstanceOf(RoleNotFoundError);
        const err = e as RoleNotFoundError;
        expect(err.roleName).toBe('nonexistent');
        expect(err.source).toBe('cli');
        expect(err.availableRoles).toEqual(['content-editor', 'developer', 'site-admin']);
      }
    });

    it('throws RoleNotFoundError for invalid env role', () => {
      mockGetRole.mockImplementation(() => null);
      process.env.WPNAV_ROLE = 'nonexistent';

      expect(() => resolveRole({})).toThrow(RoleNotFoundError);

      try {
        resolveRole({});
      } catch (e) {
        const err = e as RoleNotFoundError;
        expect(err.source).toBe('env');
      }
    });

    it('throws RoleNotFoundError for invalid config role', () => {
      mockGetRole.mockImplementation(() => null);

      expect(() => resolveRole({ configDefaultRole: 'nonexistent' })).toThrow(RoleNotFoundError);

      try {
        resolveRole({ configDefaultRole: 'nonexistent' });
      } catch (e) {
        const err = e as RoleNotFoundError;
        expect(err.source).toBe('config');
      }
    });
  });

  describe('empty options', () => {
    it('works with no options', () => {
      const result = resolveRole();
      expect(result.role).toBeNull();
      expect(result.source).toBe('none');
    });
  });
});

describe('RoleNotFoundError', () => {
  it('includes helpful error message', () => {
    const err = new RoleNotFoundError('test-role', ['content-editor', 'developer'], 'cli');

    expect(err.message).toContain('test-role');
    expect(err.message).toContain('--role flag');
    expect(err.message).toContain('content-editor, developer');
    expect(err.name).toBe('RoleNotFoundError');
  });

  it('handles empty available roles', () => {
    const err = new RoleNotFoundError('test-role', [], 'env');

    expect(err.message).toContain('(none)');
  });

  it('shows correct source label for each source', () => {
    const cliErr = new RoleNotFoundError('r', [], 'cli');
    const envErr = new RoleNotFoundError('r', [], 'env');
    const configErr = new RoleNotFoundError('r', [], 'config');

    expect(cliErr.message).toContain('--role flag');
    expect(envErr.message).toContain('WPNAV_ROLE environment variable');
    expect(configErr.message).toContain('config file default_role');
  });
});

describe('formatRoleInfo', () => {
  it('formats active role', () => {
    const result = formatRoleInfo({
      role: contentEditorRole,
      source: 'cli',
      roleName: 'content-editor',
    });

    expect(result).toContain('content-editor');
    expect(result).toContain('CLI --role');
    expect(result).toContain('Content editing focus');
  });

  it('formats no role', () => {
    const result = formatRoleInfo({
      role: null,
      source: 'none',
      roleName: null,
    });

    expect(result).toBe('No role active');
  });

  it('shows different sources correctly', () => {
    expect(
      formatRoleInfo({
        role: contentEditorRole,
        source: 'env',
        roleName: 'content-editor',
      })
    ).toContain('WPNAV_ROLE');

    expect(
      formatRoleInfo({
        role: contentEditorRole,
        source: 'config',
        roleName: 'content-editor',
      })
    ).toContain('config default_role');
  });
});
