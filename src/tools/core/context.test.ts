/**
 * Context Tool Meta-Tool Tests
 *
 * Tests for wpnav_context - AI agent context dump functionality.
 *
 * @package WP_Navigator_MCP
 * @since 2.7.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { contextToolHandler, contextToolDefinition, buildContextOutput } from './context.js';
import { toolRegistry } from '../../tool-registry/index.js';

// Mock the modules that require file system access
vi.mock('../../manifest.js', () => ({
  loadManifest: vi.fn(() => ({ found: false, manifest: undefined })),
  isManifestV2: vi.fn(() => false),
  getManifestAI: vi.fn(() => undefined),
  getManifestSafetyV2: vi.fn(() => ({
    allow_create_pages: true,
    allow_update_pages: true,
    allow_delete_pages: false,
    allow_plugin_changes: false,
    allow_theme_changes: false,
    require_confirmation: true,
    require_sync_confirmation: true,
    first_sync_acknowledged: false,
    backup_reminders: { enabled: true, before_sync: true, frequency: 'first_sync_only' },
    mode: 'cautious',
    max_batch_size: 10,
    allowed_operations: ['create', 'update'],
    blocked_operations: ['delete'],
  })),
}));

vi.mock('../../focus-modes.js', () => ({
  getFocusMode: vi.fn(() => 'content-editing'),
  getFocusModePreset: vi.fn(() => ({
    description: 'Focused on content creation',
    tokenEstimate: '~300 tokens',
  })),
}));

vi.mock('../../cookbook/index.js', () => ({
  discoverCookbooks: vi.fn(() => ({
    cookbooks: new Map([['gutenberg', { plugin: { slug: 'gutenberg', name: 'Gutenberg' } }]]),
  })),
}));

vi.mock('../../roles/index.js', () => ({
  discoverRoles: vi.fn(() => ({ roles: new Map() })),
  getRole: vi.fn(() => null),
}));

vi.mock('../../roles/runtime-state.js', () => ({
  runtimeRoleState: {
    getRole: vi.fn(() => null),
  },
}));

// Mock context
const createMockContext = (introspectData?: Record<string, unknown>) => ({
  wpRequest: vi.fn().mockImplementation(async (endpoint: string) => {
    if (endpoint === '/wpnav/v1/introspect') {
      return (
        introspectData || {
          site_name: 'Test Site',
          version: '1.5.0',
          edition: 'Pro',
          detected_plugins: ['woocommerce'],
          page_builder: 'gutenberg',
        }
      );
    }
    return {};
  }),
  config: {
    baseUrl: 'https://example.com',
    toggles: {
      enableWrites: true,
    },
  } as any,
  logger: { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} },
  clampText: (text: string) => text,
});

/**
 * Helper to parse response text safely
 */
function parseResponse(result: { content: Array<{ type: string; text?: string }> }): any {
  const text = result.content[0]?.text;
  if (!text) throw new Error('No text in response');
  return JSON.parse(text);
}

describe('contextToolDefinition', () => {
  it('has correct name', () => {
    expect(contextToolDefinition.name).toBe('wpnav_context');
  });

  it('has description mentioning context', () => {
    expect(contextToolDefinition.description).toContain('context');
  });

  it('has compact parameter with default true', () => {
    const props = contextToolDefinition.inputSchema.properties;
    expect(props).toHaveProperty('compact');
    expect(props.compact.type).toBe('boolean');
    expect(props.compact.default).toBe(true);
  });

  it('has include_snapshot parameter with default false', () => {
    const props = contextToolDefinition.inputSchema.properties;
    expect(props).toHaveProperty('include_snapshot');
    expect(props.include_snapshot.type).toBe('boolean');
    expect(props.include_snapshot.default).toBe(false);
  });
});

describe('contextToolHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('successful execution', () => {
    it('returns context output with all sections', async () => {
      const mockContext = createMockContext();
      const result = await contextToolHandler({}, mockContext);
      const response = parseResponse(result);

      expect(response).toHaveProperty('focus_mode');
      expect(response).toHaveProperty('tools');
      expect(response).toHaveProperty('role');
      expect(response).toHaveProperty('cookbooks');
      expect(response).toHaveProperty('site');
      expect(response).toHaveProperty('safety');
      expect(response).toHaveProperty('ai');
      expect(response).toHaveProperty('environment');
    });

    it('calls wpRequest with introspect endpoint', async () => {
      const mockContext = createMockContext();
      await contextToolHandler({}, mockContext);

      expect(mockContext.wpRequest).toHaveBeenCalledWith('/wpnav/v1/introspect');
    });

    it('returns site information from introspect', async () => {
      const mockContext = createMockContext({
        site_name: 'My WordPress Site',
        version: '2.0.0',
        edition: 'Pro',
      });
      const result = await contextToolHandler({}, mockContext);
      const response = parseResponse(result);

      expect(response.site.name).toBe('My WordPress Site');
      expect(response.site.plugin_version).toBe('2.0.0');
      expect(response.site.plugin_edition).toBe('Pro');
      expect(response.site.url).toBe('https://example.com');
    });

    it('returns valid JSON response', async () => {
      const mockContext = createMockContext();
      const result = await contextToolHandler({}, mockContext);

      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
      expect(() => parseResponse(result)).not.toThrow();
    });
  });

  describe('compact mode', () => {
    it('excludes tool list in compact mode (default)', async () => {
      const mockContext = createMockContext();
      const result = await contextToolHandler({ compact: true }, mockContext);
      const response = parseResponse(result);

      expect(response.tools.list).toBeUndefined();
    });

    it('includes tool list when compact is false', async () => {
      const mockContext = createMockContext();
      const result = await contextToolHandler({ compact: false }, mockContext);
      const response = parseResponse(result);

      expect(response.tools.list).toBeDefined();
      expect(Array.isArray(response.tools.list)).toBe(true);
    });
  });

  describe('focus mode section', () => {
    it('returns focus mode information', async () => {
      const mockContext = createMockContext();
      const result = await contextToolHandler({}, mockContext);
      const response = parseResponse(result);

      expect(response.focus_mode.name).toBe('content-editing');
      expect(response.focus_mode.description).toBeTruthy();
      expect(response.focus_mode.token_estimate).toBeTruthy();
    });
  });

  describe('tools section', () => {
    it('returns tool counts as numbers', async () => {
      const mockContext = createMockContext();
      const result = await contextToolHandler({}, mockContext);
      const response = parseResponse(result);

      expect(typeof response.tools.total_available).toBe('number');
      expect(typeof response.tools.enabled).toBe('number');
      // Note: In isolated tests, registry may be empty, so we just verify types
      expect(response.tools.total_available).toBeGreaterThanOrEqual(0);
    });

    it('groups tools by category', async () => {
      const mockContext = createMockContext();
      const result = await contextToolHandler({}, mockContext);
      const response = parseResponse(result);

      expect(response.tools.by_category).toBeDefined();
      expect(typeof response.tools.by_category).toBe('object');
    });
  });

  describe('safety section', () => {
    it('returns safety settings', async () => {
      const mockContext = createMockContext();
      const result = await contextToolHandler({}, mockContext);
      const response = parseResponse(result);

      expect(response.safety.mode).toBe('normal');
      expect(response.safety.enable_writes).toBe(true);
      expect(Array.isArray(response.safety.allowed_operations)).toBe(true);
      expect(Array.isArray(response.safety.blocked_operations)).toBe(true);
    });

    it('reflects enableWrites from config', async () => {
      const mockContext = createMockContext();
      mockContext.config.toggles.enableWrites = false;

      const result = await contextToolHandler({}, mockContext);
      const response = parseResponse(result);

      expect(response.safety.enable_writes).toBe(false);
    });
  });

  describe('cookbooks section', () => {
    it('returns cookbook information', async () => {
      const mockContext = createMockContext();
      const result = await contextToolHandler({}, mockContext);
      const response = parseResponse(result);

      expect(Array.isArray(response.cookbooks.loaded)).toBe(true);
      expect(Array.isArray(response.cookbooks.available)).toBe(true);
      expect(Array.isArray(response.cookbooks.recommended)).toBe(true);
    });
  });

  describe('error handling', () => {
    it('returns CONTEXT_FAILED error on wpRequest failure', async () => {
      const mockContext = createMockContext();
      mockContext.wpRequest = vi.fn().mockRejectedValue(new Error('Connection failed'));

      const result = await contextToolHandler({}, mockContext);
      const response = parseResponse(result);

      expect(response.error).toBe('CONTEXT_FAILED');
      expect(response.message).toContain('Connection failed');
      expect(response.hint).toBeTruthy();
    });
  });
});

describe('buildContextOutput', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns ContextOutput type', async () => {
    const mockContext = createMockContext();
    const output = await buildContextOutput(mockContext);

    expect(output).toHaveProperty('focus_mode');
    expect(output).toHaveProperty('tools');
    expect(output).toHaveProperty('role');
    expect(output).toHaveProperty('cookbooks');
    expect(output).toHaveProperty('site');
    expect(output).toHaveProperty('safety');
    expect(output).toHaveProperty('ai');
    expect(output).toHaveProperty('environment');
  });

  it('respects compact option for tool list', async () => {
    const mockContext = createMockContext();

    const compactOutput = await buildContextOutput(mockContext, { compact: true });
    expect(compactOutput.tools.list).toBeUndefined();

    const fullOutput = await buildContextOutput(mockContext, { compact: false });
    expect(fullOutput.tools.list).toBeDefined();
  });
});

describe('integration with tool registry', () => {
  it('tool registry getAllDefinitions returns array', () => {
    const allTools = toolRegistry.getAllDefinitions();
    // In isolated tests, registry may be empty - just verify it's an array
    expect(Array.isArray(allTools)).toBe(true);
  });

  it('tool registry isEnabled returns boolean', () => {
    // Test with a known tool name (may or may not be registered)
    const isEnabled = toolRegistry.isEnabled('wpnav_introspect');
    expect(typeof isEnabled).toBe('boolean');
  });
});

describe('safety modes', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Reset manifest mocks to default (not found) for each test
    const { loadManifest, isManifestV2, getManifestSafetyV2 } = await import('../../manifest.js');
    vi.mocked(loadManifest).mockReturnValue({ found: false, manifest: undefined });
    vi.mocked(isManifestV2).mockReturnValue(false);
    vi.mocked(getManifestSafetyV2).mockReturnValue({
      allow_create_pages: true,
      allow_update_pages: true,
      allow_delete_pages: false,
      allow_plugin_changes: false,
      allow_theme_changes: false,
      require_confirmation: true,
      require_sync_confirmation: true,
      first_sync_acknowledged: false,
      backup_reminders: { enabled: true, before_sync: true, frequency: 'first_sync_only' },
      mode: 'cautious',
      max_batch_size: 10,
      allowed_operations: ['create', 'update'],
      blocked_operations: ['delete'],
    });
  });

  it('yolo mode allows all operations', async () => {
    // Mock loadManifest to return a valid manifest with yolo mode
    const { loadManifest, isManifestV2, getManifestSafetyV2 } = await import('../../manifest.js');
    vi.mocked(loadManifest).mockReturnValue({
      found: true,
      manifest: {
        schema_version: 2,
        manifest_version: '2.0', // Required property
        meta: { name: 'Test Site Manifest' }, // Required property
        safety: {
          mode: 'yolo',
          max_batch_size: 10,
          allowed_operations: [],
          blocked_operations: [],
        },
      },
    });
    vi.mocked(isManifestV2).mockReturnValue(true);
    vi.mocked(getManifestSafetyV2).mockReturnValue({
      allow_create_pages: true,
      allow_update_pages: true,
      allow_delete_pages: false,
      allow_plugin_changes: false,
      allow_theme_changes: false,
      require_confirmation: true,
      require_sync_confirmation: true,
      first_sync_acknowledged: false,
      backup_reminders: { enabled: true, before_sync: true, frequency: 'first_sync_only' },
      mode: 'yolo',
      max_batch_size: 10,
      allowed_operations: ['create', 'update', 'delete', 'activate', 'deactivate', 'batch'],
      blocked_operations: [],
    });

    const mockContext = createMockContext();
    const result = await contextToolHandler({}, mockContext);
    const response = parseResponse(result);

    expect(response.safety.mode).toBe('yolo');
    expect(response.safety.allowed_operations).toContain('batch');
    expect(response.safety.blocked_operations).toEqual([]);
  });

  it('cautious mode blocks dangerous operations', async () => {
    // Mock loadManifest to return a valid manifest with cautious mode
    const { loadManifest, isManifestV2, getManifestSafetyV2 } = await import('../../manifest.js');
    vi.mocked(loadManifest).mockReturnValue({
      found: true,
      manifest: {
        schema_version: 2,
        manifest_version: '2.0', // Required property
        meta: { name: 'Test Site Manifest' }, // Required property
        safety: {
          mode: 'cautious',
          max_batch_size: 10,
          allowed_operations: ['create', 'update'],
          blocked_operations: ['delete'],
        },
      },
    });
    vi.mocked(isManifestV2).mockReturnValue(true);
    vi.mocked(getManifestSafetyV2).mockReturnValue({
      allow_create_pages: true,
      allow_update_pages: true,
      allow_delete_pages: false,
      allow_plugin_changes: false,
      allow_theme_changes: false,
      require_confirmation: true,
      require_sync_confirmation: true,
      first_sync_acknowledged: false,
      backup_reminders: { enabled: true, before_sync: true, frequency: 'first_sync_only' },
      mode: 'cautious',
      max_batch_size: 10,
      allowed_operations: ['create', 'update'],
      blocked_operations: ['delete'],
    });

    const mockContext = createMockContext();
    const result = await contextToolHandler({}, mockContext);
    const response = parseResponse(result);

    expect(response.safety.mode).toBe('cautious');
    expect(response.safety.allowed_operations).toContain('create');
    expect(response.safety.blocked_operations).toContain('delete');
    expect(response.safety.blocked_operations).toContain('batch');
  });

  it('normal mode (default) blocks batch operations', async () => {
    const mockContext = createMockContext();
    const result = await contextToolHandler({}, mockContext);
    const response = parseResponse(result);

    // Default mode when manifest is not found or safety is null
    expect(response.safety.mode).toBe('normal');
    expect(response.safety.allowed_operations).toContain('delete');
    expect(response.safety.blocked_operations).toContain('batch');
  });
});

describe('active role handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('includes active role when set', async () => {
    // Mock the role state and role loader
    const { runtimeRoleState } = await import('../../roles/runtime-state.js');
    const { getRole } = await import('../../roles/index.js');

    vi.mocked(runtimeRoleState.getRole).mockReturnValue('content-editor');
    vi.mocked(getRole).mockReturnValue({
      name: 'Content Editor',
      context: 'Focus on creating and managing content',
      focus_areas: ['posts', 'pages', 'media'],
      tools: {
        allowed: ['wpnav_create_post', 'wpnav_list_posts'],
        denied: ['wpnav_delete_post'],
      },
      source: 'bundled', // Added missing property
      sourcePath: '/some/path/to/role.yaml', // Added missing property
      description: 'A role for content editors', // Added missing property
    });

    const mockContext = createMockContext();
    const result = await contextToolHandler({ compact: false }, mockContext);
    const response = parseResponse(result);

    expect(response.role).not.toBeNull();
    expect(response.role.active).toBe('content-editor');
    expect(response.role.name).toBe('Content Editor');
    expect(response.role.context).toBe('Focus on creating and managing content');
    expect(response.role.focus_areas).toContain('posts');
    expect(response.role.tools_allowed).toContain('wpnav_create_post');
    expect(response.role.tools_denied).toContain('wpnav_delete_post');
  });

  it('returns null role when not set', async () => {
    // Mock role state to return null
    const { runtimeRoleState } = await import('../../roles/runtime-state.js');
    vi.mocked(runtimeRoleState.getRole).mockReturnValue(null);

    const mockContext = createMockContext();
    const result = await contextToolHandler({}, mockContext);
    const response = parseResponse(result);

    expect(response.role).toBeNull();
  });

  it('excludes context in compact mode', async () => {
    const { runtimeRoleState } = await import('../../roles/runtime-state.js');
    const { getRole } = await import('../../roles/index.js');

    vi.mocked(runtimeRoleState.getRole).mockReturnValue('developer');
    vi.mocked(getRole).mockReturnValue({
      name: 'Developer',
      context: 'Full access for development',
      focus_areas: [],
      tools: { allowed: [], denied: [] },
      source: 'bundled', // Added missing property
      sourcePath: '/some/path/to/role.yaml', // Added missing property
      description: 'A role for developers', // Added missing property
    });

    const mockContext = createMockContext();
    const result = await contextToolHandler({ compact: true }, mockContext);
    const response = parseResponse(result);

    expect(response.role).not.toBeNull();
    expect(response.role.context).toBeNull();
  });
});

describe('groupToolsByCategory coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Register tools with different name patterns to cover all branches
    toolRegistry.register({
      definition: {
        name: 'wpnav_list_posts',
        description: 'List posts',
        inputSchema: { type: 'object', properties: {} },
      },
      handler: async () => ({ content: [{ type: 'text', text: '{}' }] }),
      category: 'content' as any,
    });
    toolRegistry.register({
      definition: {
        name: 'wpnav_get_page',
        description: 'Get page',
        inputSchema: { type: 'object', properties: {} },
      },
      handler: async () => ({ content: [{ type: 'text', text: '{}' }] }),
      category: 'content' as any,
    });
    toolRegistry.register({
      definition: {
        name: 'wpnav_create_comment',
        description: 'Create comment',
        inputSchema: { type: 'object', properties: {} },
      },
      handler: async () => ({ content: [{ type: 'text', text: '{}' }] }),
      category: 'content' as any,
    });
    toolRegistry.register({
      definition: {
        name: 'wpnav_update_media',
        description: 'Update media',
        inputSchema: { type: 'object', properties: {} },
      },
      handler: async () => ({ content: [{ type: 'text', text: '{}' }] }),
      category: 'content' as any,
    });
    toolRegistry.register({
      definition: {
        name: 'wpnav_delete_category',
        description: 'Delete category',
        inputSchema: { type: 'object', properties: {} },
      },
      handler: async () => ({ content: [{ type: 'text', text: '{}' }] }),
      category: 'taxonomy' as any,
    });
    toolRegistry.register({
      definition: {
        name: 'wpnav_list_tags',
        description: 'List tags',
        inputSchema: { type: 'object', properties: {} },
      },
      handler: async () => ({ content: [{ type: 'text', text: '{}' }] }),
      category: 'taxonomy' as any,
    });
    toolRegistry.register({
      definition: {
        name: 'wpnav_list_taxonomies',
        description: 'List taxonomies',
        inputSchema: { type: 'object', properties: {} },
      },
      handler: async () => ({ content: [{ type: 'text', text: '{}' }] }),
      category: 'taxonomy' as any,
    });
    toolRegistry.register({
      definition: {
        name: 'wpnav_list_users',
        description: 'List users',
        inputSchema: { type: 'object', properties: {} },
      },
      handler: async () => ({ content: [{ type: 'text', text: '{}' }] }),
      category: 'users' as any,
    });
    toolRegistry.register({
      definition: {
        name: 'wpnav_list_plugins',
        description: 'List plugins',
        inputSchema: { type: 'object', properties: {} },
      },
      handler: async () => ({ content: [{ type: 'text', text: '{}' }] }),
      category: 'plugins' as any,
    });
    toolRegistry.register({
      definition: {
        name: 'wpnav_list_themes',
        description: 'List themes',
        inputSchema: { type: 'object', properties: {} },
      },
      handler: async () => ({ content: [{ type: 'text', text: '{}' }] }),
      category: 'themes' as any,
    });
    toolRegistry.register({
      definition: {
        name: 'wpnav_list_cookbooks',
        description: 'List cookbooks',
        inputSchema: { type: 'object', properties: {} },
      },
      handler: async () => ({ content: [{ type: 'text', text: '{}' }] }),
      category: 'core' as any,
    });
    toolRegistry.register({
      definition: {
        name: 'wpnav_list_roles',
        description: 'List roles',
        inputSchema: { type: 'object', properties: {} },
      },
      handler: async () => ({ content: [{ type: 'text', text: '{}' }] }),
      category: 'core' as any,
    });
    toolRegistry.register({
      definition: {
        name: 'wpnav_introspect',
        description: 'Introspect',
        inputSchema: { type: 'object', properties: {} },
      },
      handler: async () => ({ content: [{ type: 'text', text: '{}' }] }),
      category: 'core' as any,
    });
    toolRegistry.register({
      definition: {
        name: 'wpnav_help',
        description: 'Help',
        inputSchema: { type: 'object', properties: {} },
      },
      handler: async () => ({ content: [{ type: 'text', text: '{}' }] }),
      category: 'core' as any,
    });
    toolRegistry.register({
      definition: {
        name: 'wpnav_get_site_overview',
        description: 'Overview',
        inputSchema: { type: 'object', properties: {} },
      },
      handler: async () => ({ content: [{ type: 'text', text: '{}' }] }),
      category: 'core' as any,
    });
    toolRegistry.register({
      definition: {
        name: 'wpnav_gutenberg_insert_block',
        description: 'Insert block',
        inputSchema: { type: 'object', properties: {} },
      },
      handler: async () => ({ content: [{ type: 'text', text: '{}' }] }),
      category: 'content' as any,
    });
    toolRegistry.register({
      definition: {
        name: 'wpnav_batch_update',
        description: 'Batch update',
        inputSchema: { type: 'object', properties: {} },
      },
      handler: async () => ({ content: [{ type: 'text', text: '{}' }] }),
      category: 'core' as any,
    });
    toolRegistry.register({
      definition: {
        name: 'wpnav_search_tools',
        description: 'Search tools',
        inputSchema: { type: 'object', properties: {} },
      },
      handler: async () => ({ content: [{ type: 'text', text: '{}' }] }),
      category: 'core' as any,
    });
    toolRegistry.register({
      definition: {
        name: 'wpnav_describe_tools',
        description: 'Describe tools',
        inputSchema: { type: 'object', properties: {} },
      },
      handler: async () => ({ content: [{ type: 'text', text: '{}' }] }),
      category: 'core' as any,
    });
    toolRegistry.register({
      definition: {
        name: 'wpnav_execute',
        description: 'Execute',
        inputSchema: { type: 'object', properties: {} },
      },
      handler: async () => ({ content: [{ type: 'text', text: '{}' }] }),
      category: 'core' as any,
    });
    toolRegistry.register({
      definition: {
        name: 'some_other_tool',
        description: 'Other tool',
        inputSchema: { type: 'object', properties: {} },
      },
      handler: async () => ({ content: [{ type: 'text', text: '{}' }] }),
      category: 'core' as any,
    });
  });

  it('groups tools by category correctly', async () => {
    const mockContext = createMockContext();
    const result = await contextToolHandler({ compact: false }, mockContext);
    const response = parseResponse(result);

    // Verify categories are present based on registered tools
    expect(response.tools.by_category).toBeDefined();
    // Should have at least content, taxonomy, users, plugins, themes, core, meta, gutenberg, batch
    const categories = Object.keys(response.tools.by_category);
    expect(categories.length).toBeGreaterThan(0);
  });

  it('categorizes content tools correctly', async () => {
    const mockContext = createMockContext();
    const result = await contextToolHandler({ compact: false }, mockContext);
    const response = parseResponse(result);

    // Content tools should be grouped
    expect(response.tools.by_category.content).toBeGreaterThan(0);
  });

  it('categorizes taxonomy tools correctly', async () => {
    const mockContext = createMockContext();
    const result = await contextToolHandler({ compact: false }, mockContext);
    const response = parseResponse(result);

    // Taxonomy tools should be grouped
    expect(response.tools.by_category.taxonomy).toBeGreaterThan(0);
  });

  it('categorizes core tools correctly', async () => {
    const mockContext = createMockContext();
    const result = await contextToolHandler({ compact: false }, mockContext);
    const response = parseResponse(result);

    // Core tools (introspect, help, overview) should be grouped
    expect(response.tools.by_category.core).toBeGreaterThan(0);
  });

  it('categorizes meta tools correctly', async () => {
    const mockContext = createMockContext();
    const result = await contextToolHandler({ compact: false }, mockContext);
    const response = parseResponse(result);

    // Meta tools (search_tools, describe_tools, execute) should be grouped
    expect(response.tools.by_category.meta).toBeGreaterThan(0);
  });

  it('categorizes gutenberg tools correctly', async () => {
    const mockContext = createMockContext();
    const result = await contextToolHandler({ compact: false }, mockContext);
    const response = parseResponse(result);

    // Gutenberg/block tools should be grouped
    expect(response.tools.by_category.gutenberg).toBeGreaterThan(0);
  });

  it('categorizes batch tools correctly', async () => {
    const mockContext = createMockContext();
    const result = await contextToolHandler({ compact: false }, mockContext);
    const response = parseResponse(result);

    // Batch tools should be grouped
    expect(response.tools.by_category.batch).toBeGreaterThan(0);
  });

  it('puts unknown tools in other category', async () => {
    const mockContext = createMockContext();
    const result = await contextToolHandler({ compact: false }, mockContext);
    const response = parseResponse(result);

    // Unknown tools should be in 'other' category
    expect(response.tools.by_category.other).toBeGreaterThan(0);
  });
});

describe('detectPlugins behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('adds page_builder to detected plugins when unique', async () => {
    const mockContext = createMockContext({
      site_name: 'Test Site',
      detected_plugins: ['woocommerce'],
      page_builder: 'elementor',
    });

    const result = await contextToolHandler({}, mockContext);
    const response = parseResponse(result);

    expect(response.site.detected_plugins).toContain('woocommerce');
    expect(response.site.detected_plugins).toContain('elementor');
  });

  it('does not duplicate page_builder in detected plugins', async () => {
    const mockContext = createMockContext({
      site_name: 'Test Site',
      detected_plugins: ['gutenberg', 'woocommerce'],
      page_builder: 'gutenberg',
    });

    const result = await contextToolHandler({}, mockContext);
    const response = parseResponse(result);

    const gutenbergCount = response.site.detected_plugins.filter(
      (p: string) => p === 'gutenberg'
    ).length;
    expect(gutenbergCount).toBe(1);
  });

  it('handles empty detected_plugins array', async () => {
    const mockContext = createMockContext({
      site_name: 'Test Site',
      detected_plugins: [],
      page_builder: 'elementor',
    });

    const result = await contextToolHandler({}, mockContext);
    const response = parseResponse(result);

    expect(response.site.detected_plugins).toContain('elementor');
  });

  it('handles missing detected_plugins', async () => {
    const mockContext = createMockContext({
      site_name: 'Test Site',
      page_builder: 'gutenberg',
    });

    const result = await contextToolHandler({}, mockContext);
    const response = parseResponse(result);

    expect(Array.isArray(response.site.detected_plugins)).toBe(true);
    expect(response.site.detected_plugins).toContain('gutenberg');
  });
});
