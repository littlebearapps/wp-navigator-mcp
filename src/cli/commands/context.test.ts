/**
 * Context Command Tests
 *
 * @package WP_Navigator_MCP
 * @since 2.7.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleContext, type ContextCommandOptions } from './context.js';
import type { WPConfig } from '../../config.js';
import { toolRegistry } from '../../tool-registry/index.js';

// =============================================================================
// Test Fixtures
// =============================================================================

function createMockConfig(): WPConfig {
  return {
    baseUrl: 'https://example.com',
    restApi: 'https://example.com/wp-json',
    wpnavBase: 'https://example.com/wp-json/wpnav/v1',
    wpnavIntrospect: 'https://example.com/wp-json/wpnav/v1/introspect',
    auth: {
      username: 'testuser',
      password: 'xxxx xxxx xxxx xxxx',
    },
    toggles: {
      enableWrites: false,
      toolTimeoutMs: 600000,
      maxResponseKb: 64,
      allowInsecureHttp: false,
    },
    featureFlags: {
      workflowsEnabled: false,
      bulkValidatorEnabled: false,
      seoAuditEnabled: false,
      contentReviewerEnabled: false,
      migrationPlannerEnabled: false,
      performanceAnalyzerEnabled: false,
    },
  };
}

function createMockIntrospect(): Record<string, unknown> {
  return {
    site_name: 'Test Site',
    version: '1.5.0',
    edition: 'pro',
    plugin_version: '1.5.0',
    page_builder: 'elementor',
    detected_plugins: ['woocommerce', 'elementor'],
    policy: {
      allow_writes: true,
    },
    capabilities: {
      can_manage_options: true,
    },
  };
}

function createMockWpRequest(introspect: Record<string, unknown>) {
  // Note: wpRequest returns parsed JSON directly, not a Response object
  return vi.fn().mockImplementation(async (endpoint: string) => {
    if (endpoint === '/wpnav/v1/introspect') {
      return introspect;
    }
    throw new Error(`Endpoint not found: ${endpoint}`);
  });
}

// =============================================================================
// Tests
// =============================================================================

describe('handleContext', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('without context (connection required)', () => {
    it('should return error when no context provided (TUI)', async () => {
      const result = await handleContext({});
      expect(result).toBe(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('connection required'));
    });

    it('should return JSON error when no context provided', async () => {
      const result = await handleContext({ json: true });
      expect(result).toBe(1);

      // Check JSON output
      expect(consoleLogSpy).toHaveBeenCalled();
      const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
      expect(output.success).toBe(false);
      expect(output.error.code).toBe('CONNECTION_REQUIRED');
    });
  });

  describe('with valid context', () => {
    it('should return success with JSON output', async () => {
      const config = createMockConfig();
      const introspect = createMockIntrospect();
      const wpRequest = createMockWpRequest(introspect);

      const result = await handleContext({ json: true }, { config, wpRequest });
      expect(result).toBe(0);

      // Check JSON output
      expect(consoleLogSpy).toHaveBeenCalled();
      const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
      expect(output.success).toBe(true);
      expect(output.data).toBeDefined();
    });

    it('should include focus_mode in output', async () => {
      const config = createMockConfig();
      const introspect = createMockIntrospect();
      const wpRequest = createMockWpRequest(introspect);

      await handleContext({ json: true }, { config, wpRequest });

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
      expect(output.data.focus_mode).toBeDefined();
      expect(output.data.focus_mode.name).toBeDefined();
      expect(output.data.focus_mode.description).toBeDefined();
      expect(output.data.focus_mode.token_estimate).toBeDefined();
    });

    it('should include tools in output', async () => {
      const config = createMockConfig();
      const introspect = createMockIntrospect();
      const wpRequest = createMockWpRequest(introspect);

      await handleContext({ json: true }, { config, wpRequest });

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
      expect(output.data.tools).toBeDefined();
      expect(output.data.tools.total_available).toBeGreaterThanOrEqual(0);
      expect(output.data.tools.enabled).toBeGreaterThanOrEqual(0);
      expect(output.data.tools.by_category).toBeDefined();
    });

    it('should include tool list when includeTools option is true', async () => {
      const config = createMockConfig();
      const introspect = createMockIntrospect();
      const wpRequest = createMockWpRequest(introspect);

      await handleContext({ json: true, includeTools: true }, { config, wpRequest });

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
      expect(output.data.tools.list).toBeDefined();
      expect(Array.isArray(output.data.tools.list)).toBe(true);
    });

    it('should include tool list when format is full', async () => {
      const config = createMockConfig();
      const introspect = createMockIntrospect();
      const wpRequest = createMockWpRequest(introspect);

      await handleContext({ json: true, format: 'full' }, { config, wpRequest });

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
      expect(output.data.tools.list).toBeDefined();
    });

    it('should include site info from introspect', async () => {
      const config = createMockConfig();
      const introspect = createMockIntrospect();
      const wpRequest = createMockWpRequest(introspect);

      await handleContext({ json: true }, { config, wpRequest });

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
      expect(output.data.site).toBeDefined();
      expect(output.data.site.name).toBe('Test Site');
      expect(output.data.site.url).toBe('https://example.com');
      expect(output.data.site.plugin_version).toBe('1.5.0');
      expect(output.data.site.plugin_edition).toBe('pro');
      expect(output.data.site.page_builder).toBe('elementor');
    });

    it('should include detected plugins', async () => {
      const config = createMockConfig();
      const introspect = createMockIntrospect();
      const wpRequest = createMockWpRequest(introspect);

      await handleContext({ json: true }, { config, wpRequest });

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
      expect(output.data.site.detected_plugins).toContain('woocommerce');
      expect(output.data.site.detected_plugins).toContain('elementor');
    });

    it('should include safety settings', async () => {
      const config = createMockConfig();
      const introspect = createMockIntrospect();
      const wpRequest = createMockWpRequest(introspect);

      await handleContext({ json: true }, { config, wpRequest });

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
      expect(output.data.safety).toBeDefined();
      expect(output.data.safety.mode).toBeDefined();
      expect(output.data.safety.enable_writes).toBe(false);
      expect(output.data.safety.allowed_operations).toBeDefined();
    });

    it('should include cookbooks info', async () => {
      const config = createMockConfig();
      const introspect = createMockIntrospect();
      const wpRequest = createMockWpRequest(introspect);

      await handleContext({ json: true }, { config, wpRequest });

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
      expect(output.data.cookbooks).toBeDefined();
      expect(output.data.cookbooks.available).toBeDefined();
      expect(output.data.cookbooks.loaded).toBeDefined();
      expect(output.data.cookbooks.recommended).toBeDefined();
    });

    it('should include environment', async () => {
      const config = createMockConfig();
      const introspect = createMockIntrospect();
      const wpRequest = createMockWpRequest(introspect);

      await handleContext({ json: true }, { config, wpRequest });

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
      // Without manifest, environment defaults to 'production'
      expect(output.data.environment).toBe('production');
    });

    it('should render TUI output without error', async () => {
      const config = createMockConfig();
      const introspect = createMockIntrospect();
      const wpRequest = createMockWpRequest(introspect);

      const result = await handleContext({}, { config, wpRequest });
      expect(result).toBe(0);

      // TUI outputs to stderr
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe('with connection failure', () => {
    it('should return error when introspect fails', async () => {
      const config = createMockConfig();
      // wpRequest throws on error responses (401, 500, etc.)
      const wpRequest = vi.fn().mockRejectedValue(new Error('Authentication required (401)'));

      const result = await handleContext({ json: true }, { config, wpRequest });
      expect(result).toBe(1);

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
      expect(output.success).toBe(false);
      expect(output.error.code).toBe('CONNECTION_FAILED');
    });

    it('should return error on network failure', async () => {
      const config = createMockConfig();
      const wpRequest = vi.fn().mockRejectedValue(new Error('Network error'));

      const result = await handleContext({ json: true }, { config, wpRequest });
      expect(result).toBe(1);

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
      expect(output.success).toBe(false);
      expect(output.error.message).toContain('Network error');
    });
  });

  describe('safety operations', () => {
    it('should block batch operations in normal mode', async () => {
      const config = createMockConfig();
      const introspect = createMockIntrospect();
      const wpRequest = createMockWpRequest(introspect);

      await handleContext({ json: true }, { config, wpRequest });

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
      expect(output.data.safety.blocked_operations).toContain('batch');
    });
  });

  // ===========================================================================
  // Additional v2.7.0 Tests
  // ===========================================================================

  describe('format options', () => {
    it('should output JSON when format is compact', async () => {
      const config = createMockConfig();
      const introspect = createMockIntrospect();
      const wpRequest = createMockWpRequest(introspect);

      const result = await handleContext({ format: 'compact' }, { config, wpRequest });
      expect(result).toBe(0);

      // compact format outputs JSON like --json flag
      expect(consoleLogSpy).toHaveBeenCalled();
      const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
      expect(output.success).toBe(true);
    });

    it('should NOT include tool list by default', async () => {
      const config = createMockConfig();
      const introspect = createMockIntrospect();
      const wpRequest = createMockWpRequest(introspect);

      await handleContext({ json: true }, { config, wpRequest });

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
      expect(output.data.tools.list).toBeUndefined();
    });
  });

  describe('AI settings', () => {
    it('should include AI settings from introspect', async () => {
      const config = createMockConfig();
      const introspect = createMockIntrospect();
      const wpRequest = createMockWpRequest(introspect);

      await handleContext({ json: true }, { config, wpRequest });

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
      expect(output.data.ai).toBeDefined();
      expect(output.data.ai).toHaveProperty('instructions');
      expect(output.data.ai).toHaveProperty('prompts_path');
    });
  });

  describe('role information', () => {
    it('should include null role when no active role', async () => {
      const config = createMockConfig();
      const introspect = createMockIntrospect();
      const wpRequest = createMockWpRequest(introspect);

      await handleContext({ json: true }, { config, wpRequest });

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
      expect(output.data.role).toBeNull();
    });
  });

  describe('with writes enabled', () => {
    it('should reflect enableWrites in safety settings', async () => {
      const config = createMockConfig();
      config.toggles.enableWrites = true;
      const introspect = createMockIntrospect();
      const wpRequest = createMockWpRequest(introspect);

      await handleContext({ json: true }, { config, wpRequest });

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
      expect(output.data.safety.enable_writes).toBe(true);
    });
  });

  describe('TUI error handling', () => {
    it('should render TUI error on connection failure', async () => {
      const config = createMockConfig();
      // wpRequest throws on error responses
      const wpRequest = vi.fn().mockRejectedValue(new Error('Internal Server Error (500)'));

      const result = await handleContext({}, { config, wpRequest });
      expect(result).toBe(1);

      // TUI error outputs to stderr
      expect(consoleErrorSpy).toHaveBeenCalled();
      const allCalls = consoleErrorSpy.mock.calls.map((c: unknown[]) => c[0]).join('\n');
      expect(allCalls).toContain('Internal Server Error');
    });

    it('should render TUI error on network exception', async () => {
      const config = createMockConfig();
      const wpRequest = vi.fn().mockRejectedValue(new Error('Connection refused'));

      const result = await handleContext({}, { config, wpRequest });
      expect(result).toBe(1);

      const allCalls = consoleErrorSpy.mock.calls.map((c: unknown[]) => c[0]).join('\n');
      expect(allCalls).toContain('Connection refused');
    });
  });

  describe('page builder detection', () => {
    it('should detect page builder from introspect', async () => {
      const config = createMockConfig();
      const introspect = {
        ...createMockIntrospect(),
        page_builder: 'wpbakery',
      };
      const wpRequest = createMockWpRequest(introspect);

      await handleContext({ json: true }, { config, wpRequest });

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
      expect(output.data.site.page_builder).toBe('wpbakery');
    });

    it('should handle missing page builder', async () => {
      const config = createMockConfig();
      const introspect = {
        ...createMockIntrospect(),
        page_builder: undefined,
      };
      const wpRequest = createMockWpRequest(introspect);

      await handleContext({ json: true }, { config, wpRequest });

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
      expect(output.data.site.page_builder).toBeNull();
    });
  });

  describe('tool categorization', () => {
    it('should categorize tools by category in by_category', async () => {
      const config = createMockConfig();
      const introspect = createMockIntrospect();
      const wpRequest = createMockWpRequest(introspect);

      await handleContext({ json: true }, { config, wpRequest });

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
      expect(output.data.tools.by_category).toBeDefined();
      expect(typeof output.data.tools.by_category).toBe('object');
    });
  });
});
