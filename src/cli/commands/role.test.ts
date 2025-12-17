/**
 * Role Command Tests
 *
 * @package WP_Navigator_MCP
 * @since 2.7.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  handleRole,
  handleRoleList,
  handleRoleShow,
  handleRoleUse,
  handleRoleClear,
} from './role.js';

// =============================================================================
// Mocks
// =============================================================================

// Mock the roles module
vi.mock('../../roles/index.js', () => ({
  discoverRoles: vi.fn(),
  getRole: vi.fn(),
  listAvailableRoles: vi.fn(),
}));

// Mock runtime state module
vi.mock('../../roles/runtime-state.js', () => ({
  runtimeRoleState: {
    initialize: vi.fn(),
    getRole: vi.fn(),
    setRole: vi.fn(),
    clear: vi.fn(),
  },
  STATE_FILE_NAME: '.wpnav-state.json',
}));

import { discoverRoles, getRole, listAvailableRoles } from '../../roles/index.js';
import { runtimeRoleState } from '../../roles/runtime-state.js';

// =============================================================================
// Test Fixtures
// =============================================================================

function createMockRoles() {
  return new Map([
    [
      'content-editor',
      {
        name: 'content-editor',
        description: 'Focus on content creation and editing',
        context: 'You are a content editor specializing in WordPress',
        source: 'bundled' as const,
        sourcePath: '/bundled/content-editor.yaml',
        focus_areas: ['Post editing', 'Page management', 'Media handling'],
        avoid: ['Plugin changes', 'Theme modifications'],
        tools: {
          allowed: ['wpnav_list_posts', 'wpnav_create_post', 'wpnav_update_post'],
          denied: ['wpnav_activate_plugin', 'wpnav_delete_plugin'],
        },
      },
    ],
    [
      'developer',
      {
        name: 'developer',
        description: 'Full access for development tasks',
        context: 'You are a WordPress developer with full access',
        source: 'bundled' as const,
        sourcePath: '/bundled/developer.yaml',
        focus_areas: ['Plugin management', 'Theme development', 'Site configuration'],
        avoid: [],
        tools: {
          allowed: [],
          denied: [],
        },
      },
    ],
    [
      'seo-specialist',
      {
        name: 'seo-specialist',
        description: 'SEO and content optimization',
        context: 'You are an SEO specialist',
        source: 'project' as const,
        sourcePath: './roles/seo-specialist.yaml',
        focus_areas: ['Meta optimization', 'Content structure'],
        avoid: ['Direct database access'],
        tools: {
          allowed: ['wpnav_list_posts', 'wpnav_update_post'],
          denied: ['wpnav_delete_post'],
        },
      },
    ],
  ]);
}

function createMockDiscoveryResult() {
  return {
    roles: createMockRoles(),
    sources: {
      bundled: ['content-editor', 'developer'],
      global: [] as string[],
      project: ['seo-specialist'],
    },
    errors: [] as Array<{ success: boolean; error?: string; path: string }>,
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('Role Command', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.clearAllMocks();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  // ===========================================================================
  // handleRoleList tests
  // ===========================================================================

  describe('handleRoleList', () => {
    it('should list all roles with JSON output', async () => {
      vi.mocked(discoverRoles).mockReturnValue(createMockDiscoveryResult());
      vi.mocked(runtimeRoleState.getRole).mockReturnValue(null);

      const result = await handleRoleList({ json: true });
      expect(result).toBe(0);

      expect(consoleLogSpy).toHaveBeenCalled();
      const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
      expect(output.success).toBe(true);
      expect(output.command).toBe('role list');
      expect(output.data.total).toBe(3);
      expect(output.data.roles).toHaveLength(3);
    });

    it('should include role details in JSON output', async () => {
      vi.mocked(discoverRoles).mockReturnValue(createMockDiscoveryResult());
      vi.mocked(runtimeRoleState.getRole).mockReturnValue(null);

      await handleRoleList({ json: true });

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
      const contentEditor = output.data.roles.find(
        (r: { slug: string }) => r.slug === 'content-editor'
      );
      expect(contentEditor).toBeDefined();
      expect(contentEditor.name).toBe('content-editor');
      expect(contentEditor.description).toBe('Focus on content creation and editing');
      expect(contentEditor.source).toBe('bundled');
      expect(contentEditor.tools_allowed_count).toBe(3);
      expect(contentEditor.tools_denied_count).toBe(2);
    });

    it('should include source counts in JSON output', async () => {
      vi.mocked(discoverRoles).mockReturnValue(createMockDiscoveryResult());
      vi.mocked(runtimeRoleState.getRole).mockReturnValue(null);

      await handleRoleList({ json: true });

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
      expect(output.data.sources.bundled).toBe(2);
      expect(output.data.sources.global).toBe(0);
      expect(output.data.sources.project).toBe(1);
    });

    it('should show active role in JSON output', async () => {
      vi.mocked(discoverRoles).mockReturnValue(createMockDiscoveryResult());
      vi.mocked(runtimeRoleState.getRole).mockReturnValue('developer');

      await handleRoleList({ json: true });

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
      expect(output.data.active).toBe('developer');
    });

    it('should show null when no active role', async () => {
      vi.mocked(discoverRoles).mockReturnValue(createMockDiscoveryResult());
      vi.mocked(runtimeRoleState.getRole).mockReturnValue(null);

      await handleRoleList({ json: true });

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
      expect(output.data.active).toBeNull();
    });

    it('should render TUI output without error', async () => {
      vi.mocked(discoverRoles).mockReturnValue(createMockDiscoveryResult());
      vi.mocked(runtimeRoleState.getRole).mockReturnValue(null);

      const result = await handleRoleList({});
      expect(result).toBe(0);

      // TUI outputs to stderr
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should show active role indicator in TUI', async () => {
      vi.mocked(discoverRoles).mockReturnValue(createMockDiscoveryResult());
      vi.mocked(runtimeRoleState.getRole).mockReturnValue('content-editor');

      await handleRoleList({});

      // Should include active role info
      const allCalls = consoleErrorSpy.mock.calls.map((c: unknown[]) => c[0]).join('\n');
      expect(allCalls).toContain('Active role');
    });

    it('should handle empty roles list', async () => {
      vi.mocked(discoverRoles).mockReturnValue({
        roles: new Map(),
        sources: { bundled: [] as string[], global: [] as string[], project: [] as string[] },
        errors: [] as Array<{ success: boolean; error?: string; path: string }>,
      });
      vi.mocked(runtimeRoleState.getRole).mockReturnValue(null);

      const result = await handleRoleList({ json: true });
      expect(result).toBe(0);

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
      expect(output.data.total).toBe(0);
      expect(output.data.roles).toHaveLength(0);
    });
  });

  // ===========================================================================
  // handleRoleShow tests
  // ===========================================================================

  describe('handleRoleShow', () => {
    it('should show role details with JSON output', async () => {
      const mockRole = createMockRoles().get('content-editor')!;
      vi.mocked(getRole).mockReturnValue(mockRole);

      const result = await handleRoleShow('content-editor', { json: true });
      expect(result).toBe(0);

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
      expect(output.success).toBe(true);
      expect(output.command).toBe('role show');
      expect(output.data.name).toBe('content-editor');
      expect(output.data.description).toBe('Focus on content creation and editing');
    });

    it('should include focus areas in output', async () => {
      const mockRole = createMockRoles().get('content-editor')!;
      vi.mocked(getRole).mockReturnValue(mockRole);

      await handleRoleShow('content-editor', { json: true });

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
      expect(output.data.focus_areas).toContain('Post editing');
      expect(output.data.focus_areas).toContain('Page management');
    });

    it('should include avoid list in output', async () => {
      const mockRole = createMockRoles().get('content-editor')!;
      vi.mocked(getRole).mockReturnValue(mockRole);

      await handleRoleShow('content-editor', { json: true });

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
      expect(output.data.avoid).toContain('Plugin changes');
    });

    it('should include tools in output', async () => {
      const mockRole = createMockRoles().get('content-editor')!;
      vi.mocked(getRole).mockReturnValue(mockRole);

      await handleRoleShow('content-editor', { json: true });

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
      expect(output.data.tools.allowed).toContain('wpnav_list_posts');
      expect(output.data.tools.denied).toContain('wpnav_activate_plugin');
    });

    it('should return error when slug missing (JSON)', async () => {
      const result = await handleRoleShow('', { json: true });
      expect(result).toBe(1);

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
      expect(output.success).toBe(false);
      expect(output.error.code).toBe('MISSING_SLUG');
    });

    it('should return error when slug missing (TUI)', async () => {
      const result = await handleRoleShow('', {});
      expect(result).toBe(1);

      const allCalls = consoleErrorSpy.mock.calls.map((c: unknown[]) => c[0]).join('\n');
      expect(allCalls).toContain('Role slug required');
    });

    it('should return error when role not found (JSON)', async () => {
      vi.mocked(getRole).mockReturnValue(null);
      vi.mocked(listAvailableRoles).mockReturnValue(['content-editor', 'developer']);

      const result = await handleRoleShow('nonexistent', { json: true });
      expect(result).toBe(1);

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
      expect(output.success).toBe(false);
      expect(output.error.code).toBe('ROLE_NOT_FOUND');
      expect(output.error.available).toContain('content-editor');
    });

    it('should return error when role not found (TUI)', async () => {
      vi.mocked(getRole).mockReturnValue(null);
      vi.mocked(listAvailableRoles).mockReturnValue(['content-editor', 'developer']);

      const result = await handleRoleShow('nonexistent', {});
      expect(result).toBe(1);

      const allCalls = consoleErrorSpy.mock.calls.map((c: unknown[]) => c[0]).join('\n');
      expect(allCalls).toContain('Role not found');
      expect(allCalls).toContain('content-editor');
    });

    it('should render TUI output without error', async () => {
      const mockRole = createMockRoles().get('content-editor')!;
      vi.mocked(getRole).mockReturnValue(mockRole);

      const result = await handleRoleShow('content-editor', {});
      expect(result).toBe(0);
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // handleRoleUse tests
  // ===========================================================================

  describe('handleRoleUse', () => {
    it('should set active role with JSON output', async () => {
      const mockRole = createMockRoles().get('developer')!;
      vi.mocked(runtimeRoleState.setRole).mockReturnValue({ success: true });
      vi.mocked(getRole).mockReturnValue(mockRole);

      const result = await handleRoleUse('developer', { json: true });
      expect(result).toBe(0);

      expect(runtimeRoleState.initialize).toHaveBeenCalled();
      expect(runtimeRoleState.setRole).toHaveBeenCalledWith('developer', 'cli');

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
      expect(output.success).toBe(true);
      expect(output.command).toBe('role use');
      expect(output.data.slug).toBe('developer');
    });

    it('should include state file path in output', async () => {
      const mockRole = createMockRoles().get('developer')!;
      vi.mocked(runtimeRoleState.setRole).mockReturnValue({ success: true });
      vi.mocked(getRole).mockReturnValue(mockRole);

      await handleRoleUse('developer', { json: true });

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
      expect(output.data.state_file).toBe('.wpnav-state.json');
    });

    it('should return error when slug missing (JSON)', async () => {
      const result = await handleRoleUse('', { json: true });
      expect(result).toBe(1);

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
      expect(output.success).toBe(false);
      expect(output.error.code).toBe('MISSING_SLUG');
    });

    it('should return error when slug missing (TUI)', async () => {
      const result = await handleRoleUse('', {});
      expect(result).toBe(1);

      const allCalls = consoleErrorSpy.mock.calls.map((c: unknown[]) => c[0]).join('\n');
      expect(allCalls).toContain('Role slug required');
    });

    it('should return error when setRole fails (JSON)', async () => {
      vi.mocked(runtimeRoleState.setRole).mockReturnValue({
        success: false,
        error: 'Role not found: "invalid"',
      });
      vi.mocked(listAvailableRoles).mockReturnValue(['content-editor', 'developer']);

      const result = await handleRoleUse('invalid', { json: true });
      expect(result).toBe(1);

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
      expect(output.success).toBe(false);
      expect(output.error.code).toBe('ROLE_NOT_FOUND');
    });

    it('should return error when setRole fails (TUI)', async () => {
      vi.mocked(runtimeRoleState.setRole).mockReturnValue({
        success: false,
        error: 'Role not found: "invalid"',
      });
      vi.mocked(listAvailableRoles).mockReturnValue(['content-editor', 'developer']);

      const result = await handleRoleUse('invalid', {});
      expect(result).toBe(1);

      const allCalls = consoleErrorSpy.mock.calls.map((c: unknown[]) => c[0]).join('\n');
      expect(allCalls).toContain('Role not found');
    });

    it('should render TUI output without error on success', async () => {
      const mockRole = createMockRoles().get('developer')!;
      vi.mocked(runtimeRoleState.setRole).mockReturnValue({ success: true });
      vi.mocked(getRole).mockReturnValue(mockRole);

      const result = await handleRoleUse('developer', {});
      expect(result).toBe(0);
      expect(consoleErrorSpy).toHaveBeenCalled();

      const allCalls = consoleErrorSpy.mock.calls.map((c: unknown[]) => c[0]).join('\n');
      expect(allCalls).toContain('Role activated');
    });
  });

  // ===========================================================================
  // handleRoleClear tests
  // ===========================================================================

  describe('handleRoleClear', () => {
    it('should clear active role with JSON output', async () => {
      vi.mocked(runtimeRoleState.getRole).mockReturnValue('developer');

      const result = await handleRoleClear({ json: true });
      expect(result).toBe(0);

      expect(runtimeRoleState.initialize).toHaveBeenCalled();
      expect(runtimeRoleState.clear).toHaveBeenCalled();

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
      expect(output.success).toBe(true);
      expect(output.command).toBe('role clear');
      expect(output.data.previous_role).toBe('developer');
    });

    it('should handle clearing when no role was set (JSON)', async () => {
      vi.mocked(runtimeRoleState.getRole).mockReturnValue(null);

      const result = await handleRoleClear({ json: true });
      expect(result).toBe(0);

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
      expect(output.success).toBe(true);
      expect(output.data.previous_role).toBeNull();
    });

    it('should render TUI output with previous role', async () => {
      vi.mocked(runtimeRoleState.getRole).mockReturnValue('developer');

      const result = await handleRoleClear({});
      expect(result).toBe(0);

      const allCalls = consoleErrorSpy.mock.calls.map((c: unknown[]) => c[0]).join('\n');
      expect(allCalls).toContain('Role cleared');
    });

    it('should render TUI output when no role was set', async () => {
      vi.mocked(runtimeRoleState.getRole).mockReturnValue(null);

      const result = await handleRoleClear({});
      expect(result).toBe(0);

      const allCalls = consoleErrorSpy.mock.calls.map((c: unknown[]) => c[0]).join('\n');
      expect(allCalls).toContain('No active role');
    });
  });

  // ===========================================================================
  // handleRole (main handler) tests
  // ===========================================================================

  describe('handleRole (main handler)', () => {
    it('should route "list" subcommand correctly', async () => {
      vi.mocked(discoverRoles).mockReturnValue(createMockDiscoveryResult());
      vi.mocked(runtimeRoleState.getRole).mockReturnValue(null);

      const result = await handleRole('list', [], { json: true });
      expect(result).toBe(0);

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
      expect(output.command).toBe('role list');
    });

    it('should default to list when no subcommand', async () => {
      vi.mocked(discoverRoles).mockReturnValue(createMockDiscoveryResult());
      vi.mocked(runtimeRoleState.getRole).mockReturnValue(null);

      const result = await handleRole(undefined, [], { json: true });
      expect(result).toBe(0);

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
      expect(output.command).toBe('role list');
    });

    it('should route "show" subcommand with args', async () => {
      const mockRole = createMockRoles().get('content-editor')!;
      vi.mocked(getRole).mockReturnValue(mockRole);

      const result = await handleRole('show', ['content-editor'], { json: true });
      expect(result).toBe(0);

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
      expect(output.command).toBe('role show');
      expect(output.data.name).toBe('content-editor');
    });

    it('should route "use" subcommand with args', async () => {
      const mockRole = createMockRoles().get('developer')!;
      vi.mocked(runtimeRoleState.setRole).mockReturnValue({ success: true });
      vi.mocked(getRole).mockReturnValue(mockRole);

      const result = await handleRole('use', ['developer'], { json: true });
      expect(result).toBe(0);

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
      expect(output.command).toBe('role use');
    });

    it('should route "clear" subcommand', async () => {
      vi.mocked(runtimeRoleState.getRole).mockReturnValue(null);

      const result = await handleRole('clear', [], { json: true });
      expect(result).toBe(0);

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
      expect(output.command).toBe('role clear');
    });

    it('should return error for unknown subcommand (JSON)', async () => {
      const result = await handleRole('unknown', [], { json: true });
      expect(result).toBe(1);

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
      expect(output.success).toBe(false);
      expect(output.error.code).toBe('UNKNOWN_SUBCOMMAND');
      expect(output.error.available).toContain('list');
      expect(output.error.available).toContain('show');
      expect(output.error.available).toContain('use');
      expect(output.error.available).toContain('clear');
    });

    it('should return error for unknown subcommand (TUI)', async () => {
      const result = await handleRole('unknown', [], {});
      expect(result).toBe(1);

      const allCalls = consoleErrorSpy.mock.calls.map((c: unknown[]) => c[0]).join('\n');
      expect(allCalls).toContain('Unknown role subcommand');
      expect(allCalls).toContain('Available subcommands');
    });
  });
});
