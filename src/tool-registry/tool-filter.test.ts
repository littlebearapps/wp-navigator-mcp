/**
 * Tool Filter Tests
 *
 * Tests for config-driven tool filtering based on manifest and roles.
 *
 * @package WP_Navigator_MCP
 * @since 2.7.0
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createToolFilter, ToolFilter } from './tool-filter.js';
import { ToolCategory, RegisteredTool } from './types.js';
import { ManifestTools, ManifestRoleOverrides } from '../manifest.js';
import { LoadedRole } from '../roles/types.js';

// Helper to create mock tools
function createMockTool(
  name: string,
  category: ToolCategory,
  featureFlag?: string
): RegisteredTool {
  return {
    definition: {
      name,
      description: `Mock ${name}`,
      inputSchema: { type: 'object', properties: {}, required: [] },
    },
    handler: async () => ({ content: [{ type: 'text', text: name }] }),
    category,
    featureFlag,
  };
}

// Create a set of mock tools for testing
function createMockToolsMap(): Map<string, RegisteredTool> {
  const tools = new Map<string, RegisteredTool>();

  // Core tools
  tools.set('wpnav_introspect', createMockTool('wpnav_introspect', ToolCategory.CORE));
  tools.set('wpnav_help', createMockTool('wpnav_help', ToolCategory.CORE));
  tools.set(
    'wpnav_get_site_overview',
    createMockTool('wpnav_get_site_overview', ToolCategory.CORE)
  );

  // Content tools
  tools.set('wpnav_list_posts', createMockTool('wpnav_list_posts', ToolCategory.CONTENT));
  tools.set('wpnav_get_post', createMockTool('wpnav_get_post', ToolCategory.CONTENT));
  tools.set('wpnav_create_post', createMockTool('wpnav_create_post', ToolCategory.CONTENT));
  tools.set('wpnav_update_post', createMockTool('wpnav_update_post', ToolCategory.CONTENT));
  tools.set('wpnav_delete_post', createMockTool('wpnav_delete_post', ToolCategory.CONTENT));
  tools.set('wpnav_list_pages', createMockTool('wpnav_list_pages', ToolCategory.CONTENT));
  tools.set('wpnav_get_page', createMockTool('wpnav_get_page', ToolCategory.CONTENT));

  // Users tools
  tools.set('wpnav_list_users', createMockTool('wpnav_list_users', ToolCategory.USERS));
  tools.set('wpnav_get_user', createMockTool('wpnav_get_user', ToolCategory.USERS));
  tools.set('wpnav_update_user', createMockTool('wpnav_update_user', ToolCategory.USERS));

  // Plugins tools
  tools.set('wpnav_list_plugins', createMockTool('wpnav_list_plugins', ToolCategory.PLUGINS));
  tools.set('wpnav_activate_plugin', createMockTool('wpnav_activate_plugin', ToolCategory.PLUGINS));

  // Themes tools
  tools.set('wpnav_list_themes', createMockTool('wpnav_list_themes', ToolCategory.THEMES));

  // Workflows tools (with feature flag)
  tools.set(
    'wpnav_workflow_test',
    createMockTool('wpnav_workflow_test', ToolCategory.WORKFLOWS, 'WORKFLOWS_ENABLED')
  );

  return tools;
}

describe('ToolFilter', () => {
  let mockTools: Map<string, RegisteredTool>;

  beforeEach(() => {
    mockTools = createMockToolsMap();
  });

  describe('basic filtering', () => {
    it('should enable all tools when no manifest provided', () => {
      const filter = createToolFilter({
        allTools: mockTools,
      });

      // All tools except workflow (has feature flag) should be enabled
      expect(filter.enabledTools.size).toBe(16);
      expect(filter.isEnabled('wpnav_list_posts')).toBe(true);
      expect(filter.isEnabled('wpnav_list_users')).toBe(true);
      expect(filter.warnings).toHaveLength(0);
    });

    it('should respect feature flags', () => {
      const featureFlags = new Map<string, boolean>();
      featureFlags.set('WORKFLOWS_ENABLED', false);

      const filter = createToolFilter({
        allTools: mockTools,
        featureFlags,
      });

      expect(filter.isEnabled('wpnav_workflow_test')).toBe(false);
      expect(filter.isEnabled('wpnav_list_posts')).toBe(true);
    });

    it('should enable feature-flagged tools when flag is true', () => {
      const featureFlags = new Map<string, boolean>();
      featureFlags.set('WORKFLOWS_ENABLED', true);

      const filter = createToolFilter({
        allTools: mockTools,
        featureFlags,
      });

      expect(filter.isEnabled('wpnav_workflow_test')).toBe(true);
    });
  });

  describe('category filtering', () => {
    it('should filter by enabled categories', () => {
      const manifestTools: ManifestTools = {
        enabled: ['core', 'content'],
      };

      const filter = createToolFilter({
        manifestTools,
        allTools: mockTools,
      });

      // Core and content tools enabled
      expect(filter.isEnabled('wpnav_introspect')).toBe(true);
      expect(filter.isEnabled('wpnav_list_posts')).toBe(true);

      // Other categories disabled
      expect(filter.isEnabled('wpnav_list_users')).toBe(false);
      expect(filter.isEnabled('wpnav_list_plugins')).toBe(false);
      expect(filter.isEnabled('wpnav_list_themes')).toBe(false);
    });

    it('should filter by disabled categories', () => {
      const manifestTools: ManifestTools = {
        disabled: ['users', 'plugins'],
      };

      const filter = createToolFilter({
        manifestTools,
        allTools: mockTools,
      });

      // Users and plugins disabled
      expect(filter.isEnabled('wpnav_list_users')).toBe(false);
      expect(filter.isEnabled('wpnav_list_plugins')).toBe(false);

      // Other categories enabled
      expect(filter.isEnabled('wpnav_list_posts')).toBe(true);
      expect(filter.isEnabled('wpnav_list_themes')).toBe(true);
    });

    it('should apply disabled after enabled (disabled wins)', () => {
      const manifestTools: ManifestTools = {
        enabled: ['core', 'content', 'users'],
        disabled: ['users'],
      };

      const filter = createToolFilter({
        manifestTools,
        allTools: mockTools,
      });

      // Core and content enabled
      expect(filter.isEnabled('wpnav_introspect')).toBe(true);
      expect(filter.isEnabled('wpnav_list_posts')).toBe(true);

      // Users disabled (even though in enabled list)
      expect(filter.isEnabled('wpnav_list_users')).toBe(false);
    });

    it('should warn on invalid category', () => {
      const manifestTools: ManifestTools = {
        enabled: ['core', 'invalid-category' as any],
      };

      const filter = createToolFilter({
        manifestTools,
        allTools: mockTools,
      });

      expect(filter.warnings).toContain('Unknown category: "invalid-category"');
    });
  });

  describe('pattern matching', () => {
    it('should match exact tool names', () => {
      const manifestTools: ManifestTools = {
        overrides: {
          wpnav_list_posts: true,
          wpnav_list_users: false,
        },
      };

      const filter = createToolFilter({
        manifestTools,
        allTools: mockTools,
      });

      expect(filter.isEnabled('wpnav_list_posts')).toBe(true);
      expect(filter.isEnabled('wpnav_list_users')).toBe(false);
    });

    it('should match wildcard patterns', () => {
      const manifestTools: ManifestTools = {
        enabled: ['core'],
        overrides: {
          'wpnav_list_*': true, // Enable all list tools
        },
      };

      const filter = createToolFilter({
        manifestTools,
        allTools: mockTools,
      });

      // All wpnav_list_* tools should be enabled
      expect(filter.isEnabled('wpnav_list_posts')).toBe(true);
      expect(filter.isEnabled('wpnav_list_pages')).toBe(true);
      expect(filter.isEnabled('wpnav_list_users')).toBe(true);
      expect(filter.isEnabled('wpnav_list_plugins')).toBe(true);

      // Non-list tools from non-core categories should be disabled
      expect(filter.isEnabled('wpnav_update_post')).toBe(false);
    });

    it('should match category binding patterns', () => {
      const manifestTools: ManifestTools = {
        overrides: {
          'content:*': true,
          'users:*': false,
        },
      };

      // Start with all disabled by setting enabled to empty
      const filter = createToolFilter({
        manifestTools: {
          enabled: [],
          overrides: manifestTools.overrides,
        },
        allTools: mockTools,
      });

      // All content tools enabled
      expect(filter.isEnabled('wpnav_list_posts')).toBe(true);
      expect(filter.isEnabled('wpnav_create_post')).toBe(true);

      // All users tools disabled
      expect(filter.isEnabled('wpnav_list_users')).toBe(false);
    });

    it('should warn on invalid pattern', () => {
      const manifestTools: ManifestTools = {
        overrides: {
          wpnav_nonexistent_tool: false,
        },
      };

      const filter = createToolFilter({
        manifestTools,
        allTools: mockTools,
      });

      expect(filter.warnings).toContain('Unknown tool: "wpnav_nonexistent_tool"');
    });

    it('should warn on wildcard pattern with no matches', () => {
      const manifestTools: ManifestTools = {
        overrides: {
          'wpnav_xyz_*': true,
        },
      };

      const filter = createToolFilter({
        manifestTools,
        allTools: mockTools,
      });

      expect(filter.warnings).toContain('Pattern matched no tools: "wpnav_xyz_*"');
    });
  });

  describe('role filtering', () => {
    it('should apply role allowed list', () => {
      const activeRole: LoadedRole = {
        name: 'content-editor',
        description: 'Content editor role',
        context: 'Focus on content',
        source: 'bundled',
        sourcePath: '/roles/content-editor.yaml',
        tools: {
          allowed: ['wpnav_list_posts', 'wpnav_get_post', 'wpnav_create_post'],
        },
      };

      const filter = createToolFilter({
        allTools: mockTools,
        activeRole,
      });

      // Only allowed tools enabled
      expect(filter.isEnabled('wpnav_list_posts')).toBe(true);
      expect(filter.isEnabled('wpnav_get_post')).toBe(true);
      expect(filter.isEnabled('wpnav_create_post')).toBe(true);

      // Other tools disabled
      expect(filter.isEnabled('wpnav_delete_post')).toBe(false);
      expect(filter.isEnabled('wpnav_list_users')).toBe(false);
    });

    it('should apply role denied list', () => {
      const activeRole: LoadedRole = {
        name: 'content-editor',
        description: 'Content editor role',
        context: 'Focus on content',
        source: 'bundled',
        sourcePath: '/roles/content-editor.yaml',
        tools: {
          denied: ['wpnav_delete_*', 'wpnav_list_users'],
        },
      };

      const filter = createToolFilter({
        allTools: mockTools,
        activeRole,
      });

      // Denied tools disabled
      expect(filter.isEnabled('wpnav_delete_post')).toBe(false);
      expect(filter.isEnabled('wpnav_list_users')).toBe(false);

      // Other tools enabled
      expect(filter.isEnabled('wpnav_list_posts')).toBe(true);
      expect(filter.isEnabled('wpnav_create_post')).toBe(true);
    });

    it('should apply role after manifest (role further restricts)', () => {
      const manifestTools: ManifestTools = {
        enabled: ['content', 'users'],
      };

      const activeRole: LoadedRole = {
        name: 'content-editor',
        description: 'Content editor role',
        context: 'Focus on content',
        source: 'bundled',
        sourcePath: '/roles/content-editor.yaml',
        tools: {
          denied: ['users:*'],
        },
      };

      const filter = createToolFilter({
        manifestTools,
        allTools: mockTools,
        activeRole,
      });

      // Content enabled by manifest, not denied by role
      expect(filter.isEnabled('wpnav_list_posts')).toBe(true);

      // Users enabled by manifest but denied by role
      expect(filter.isEnabled('wpnav_list_users')).toBe(false);
    });
  });

  describe('role overrides', () => {
    it('should apply role config overrides (tools_allow)', () => {
      const activeRole: LoadedRole = {
        name: 'content-editor',
        description: 'Content editor role',
        context: 'Focus on content',
        source: 'bundled',
        sourcePath: '/roles/content-editor.yaml',
        tools: {
          allowed: ['wpnav_list_posts'],
        },
      };

      const roleOverrides: ManifestRoleOverrides = {
        tools_allow: ['wpnav_list_users'], // Extend role with user list access
      };

      const filter = createToolFilter({
        allTools: mockTools,
        activeRole,
        roleOverrides,
      });

      // From role's allowed list
      expect(filter.isEnabled('wpnav_list_posts')).toBe(true);

      // From config's tools_allow
      expect(filter.isEnabled('wpnav_list_users')).toBe(true);

      // Not in either list
      expect(filter.isEnabled('wpnav_delete_post')).toBe(false);
    });

    it('should apply role config overrides (tools_deny)', () => {
      const activeRole: LoadedRole = {
        name: 'site-admin',
        description: 'Site admin role',
        context: 'Full access',
        source: 'bundled',
        sourcePath: '/roles/site-admin.yaml',
        // No restrictions
      };

      const roleOverrides: ManifestRoleOverrides = {
        tools_deny: ['wpnav_delete_*'], // Deny all delete tools
      };

      const filter = createToolFilter({
        allTools: mockTools,
        activeRole,
        roleOverrides,
      });

      // Delete tools denied by config override
      expect(filter.isEnabled('wpnav_delete_post')).toBe(false);

      // Other tools still enabled
      expect(filter.isEnabled('wpnav_list_posts')).toBe(true);
      expect(filter.isEnabled('wpnav_create_post')).toBe(true);
    });
  });

  describe('getEnabledDefinitions', () => {
    it('should return only enabled tool definitions', () => {
      const manifestTools: ManifestTools = {
        enabled: ['core'],
      };

      const filter = createToolFilter({
        manifestTools,
        allTools: mockTools,
      });

      const definitions = filter.getEnabledDefinitions();
      const names = definitions.map((d) => d.name);

      expect(names).toContain('wpnav_introspect');
      expect(names).toContain('wpnav_help');
      expect(names).not.toContain('wpnav_list_posts');
      expect(names).not.toContain('wpnav_list_users');
    });
  });

  describe('filter chain order', () => {
    it('should apply filter chain in correct order', () => {
      const featureFlags = new Map<string, boolean>();
      featureFlags.set('WORKFLOWS_ENABLED', true);

      const manifestTools: ManifestTools = {
        enabled: ['content', 'workflows'],
        disabled: [],
        overrides: {
          wpnav_delete_post: false, // Disable specific tool
        },
      };

      const activeRole: LoadedRole = {
        name: 'editor',
        description: 'Editor',
        context: 'Edit content',
        source: 'bundled',
        sourcePath: '/roles/editor.yaml',
        tools: {
          denied: ['wpnav_workflow_test'], // Role denies workflow
        },
      };

      const roleOverrides: ManifestRoleOverrides = {
        tools_allow: ['wpnav_introspect'], // Add core tool
      };

      const filter = createToolFilter({
        allTools: mockTools,
        featureFlags,
        manifestTools,
        activeRole,
        roleOverrides,
      });

      // Content enabled by manifest
      expect(filter.isEnabled('wpnav_list_posts')).toBe(true);

      // Workflow enabled by manifest but denied by role
      expect(filter.isEnabled('wpnav_workflow_test')).toBe(false);

      // Delete disabled by manifest override
      expect(filter.isEnabled('wpnav_delete_post')).toBe(false);

      // Core tool added by role override
      expect(filter.isEnabled('wpnav_introspect')).toBe(true);

      // Users not in manifest enabled list
      expect(filter.isEnabled('wpnav_list_users')).toBe(false);
    });
  });

  describe('backward compatibility', () => {
    it('should work without manifest (all tools enabled)', () => {
      const filter = createToolFilter({
        allTools: mockTools,
      });

      // All tools (except feature-flagged) should be enabled
      expect(filter.enabledTools.size).toBe(16);
    });

    it('should work with empty manifest tools section', () => {
      const manifestTools: ManifestTools = {};

      const filter = createToolFilter({
        manifestTools,
        allTools: mockTools,
      });

      // All tools should be enabled
      expect(filter.enabledTools.size).toBe(16);
    });
  });
});
