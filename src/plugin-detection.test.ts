/**
 * Tests for Plugin Detection Module
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  detectPlugin,
  checkMcpCompatibility,
  formatPluginMessage,
  getEditionFeatures,
  compareSemver,
  getMcpVersion,
  type PluginDetectionResult,
  type McpCompat,
} from './plugin-detection.js';

// =============================================================================
// compareSemver Tests
// =============================================================================

describe('compareSemver', () => {
  it('should return 0 for equal versions', () => {
    expect(compareSemver('1.0.0', '1.0.0')).toBe(0);
    expect(compareSemver('2.1.3', '2.1.3')).toBe(0);
  });

  it('should return -1 when a < b', () => {
    expect(compareSemver('1.0.0', '1.0.1')).toBe(-1);
    expect(compareSemver('1.0.0', '1.1.0')).toBe(-1);
    expect(compareSemver('1.0.0', '2.0.0')).toBe(-1);
    expect(compareSemver('0.9.9', '1.0.0')).toBe(-1);
  });

  it('should return 1 when a > b', () => {
    expect(compareSemver('1.0.1', '1.0.0')).toBe(1);
    expect(compareSemver('1.1.0', '1.0.0')).toBe(1);
    expect(compareSemver('2.0.0', '1.0.0')).toBe(1);
    expect(compareSemver('1.0.0', '0.9.9')).toBe(1);
  });

  it('should handle missing patch version', () => {
    expect(compareSemver('1.0', '1.0.0')).toBe(0);
    expect(compareSemver('1.0.0', '1.0')).toBe(0);
  });
});

// =============================================================================
// getMcpVersion Tests
// =============================================================================

describe('getMcpVersion', () => {
  it('should return a semver version string', () => {
    const version = getMcpVersion();
    expect(version).toMatch(/^\d+\.\d+\.\d+/);
  });
});

// =============================================================================
// checkMcpCompatibility Tests
// =============================================================================

describe('checkMcpCompatibility', () => {
  const mcpCompat: McpCompat = {
    min_version: '1.0.0',
    max_version: '2.0.0',
    tested_up_to: '1.5.0',
  };

  it('should return compatible when mcp_compat is undefined', () => {
    const result = checkMcpCompatibility(undefined, '1.0.0');
    expect(result.compatible).toBe(true);
    expect(result.message).toContain('does not report mcp_compat');
  });

  it('should return incompatible when MCP version is below minimum', () => {
    // Mock a low version scenario
    const lowCompat: McpCompat = {
      min_version: '99.0.0',
      max_version: '100.0.0',
      tested_up_to: '99.5.0',
    };

    const result = checkMcpCompatibility(lowCompat, '1.0.0');
    expect(result.compatible).toBe(false);
    expect(result.message).toContain('below minimum');
    expect(result.warning).toContain('Update MCP');
  });

  it('should include MCP and plugin versions in result', () => {
    const result = checkMcpCompatibility(mcpCompat, '1.2.3');
    expect(result.mcpVersion).toBeTruthy();
    expect(result.pluginVersion).toBe('1.2.3');
  });
});

// =============================================================================
// formatPluginMessage Tests
// =============================================================================

describe('formatPluginMessage', () => {
  it('should format Free edition message', () => {
    const result: PluginDetectionResult = {
      detected: true,
      edition: 'free',
      version: '1.5.0',
    };

    const message = formatPluginMessage(result);
    expect(message).toContain('WP Navigator Free v1.5.0');
    expect(message).not.toContain('Pro features');
  });

  it('should format Pro edition message with Pro note', () => {
    const result: PluginDetectionResult = {
      detected: true,
      edition: 'pro',
      version: '1.5.0',
    };

    const message = formatPluginMessage(result);
    expect(message).toContain('WP Navigator Pro v1.5.0');
    expect(message).toContain('Pro features available');
  });

  it('should return error message when not detected', () => {
    const result: PluginDetectionResult = {
      detected: false,
      error: 'Plugin not found',
    };

    const message = formatPluginMessage(result);
    expect(message).toBe('Plugin not found');
  });

  it('should return default message when error is undefined', () => {
    const result: PluginDetectionResult = {
      detected: false,
    };

    const message = formatPluginMessage(result);
    expect(message).toBe('Plugin not detected');
  });
});

// =============================================================================
// getEditionFeatures Tests
// =============================================================================

describe('getEditionFeatures', () => {
  it('should return core features for free edition', () => {
    const features = getEditionFeatures('free');
    expect(features).toContain('Content management (pages, posts, media)');
    expect(features).toContain('Plugin activation/deactivation');
    expect(features).not.toContain('Server-side rollback');
    expect(features).not.toContain('Bulk operations');
  });

  it('should return extended features for pro edition', () => {
    const features = getEditionFeatures('pro');
    expect(features).toContain('Content management (pages, posts, media)');
    expect(features).toContain('Server-side rollback');
    expect(features).toContain('Bulk operations');
    expect(features).toContain('Advanced policy controls');
  });

  it('should have more features for pro than free', () => {
    const freeFeatures = getEditionFeatures('free');
    const proFeatures = getEditionFeatures('pro');
    expect(proFeatures.length).toBeGreaterThan(freeFeatures.length);
  });
});

// =============================================================================
// detectPlugin Tests (mocked fetch)
// =============================================================================

describe('detectPlugin', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('should detect Pro edition from introspect response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        plugin: {
          name: 'WP Navigator Pro',
          version: '1.5.0',
          edition: 'pro',
        },
        site: {
          name: 'Test Site',
          url: 'https://example.com',
        },
        policy: {
          categories: {
            content: true,
            plugins: true,
          },
        },
      }),
    });

    const result = await detectPlugin('https://example.com', 'admin', 'password');

    expect(result.detected).toBe(true);
    expect(result.edition).toBe('pro');
    expect(result.version).toBe('1.5.0');
    expect(result.siteName).toBe('Test Site');
  });

  it('should detect Free edition from introspect response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        plugin: {
          name: 'WP Navigator',
          version: '1.5.0',
          edition: 'free',
        },
        site: {
          name: 'Test Site',
        },
      }),
    });

    const result = await detectPlugin('https://example.com', 'admin', 'password');

    expect(result.detected).toBe(true);
    expect(result.edition).toBe('free');
  });

  it('should detect Pro edition from plugin name when edition field is missing', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        plugin: {
          name: 'WP Navigator Pro',
          version: '1.5.0',
          // No edition field
        },
      }),
    });

    const result = await detectPlugin('https://example.com', 'admin', 'password');

    expect(result.detected).toBe(true);
    expect(result.edition).toBe('pro');
  });

  it('should detect Pro edition from capabilities', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        plugin: {
          name: 'WP Navigator',
          version: '1.5.0',
        },
        capabilities: ['bulk_operations', 'advanced_rollback'],
      }),
    });

    const result = await detectPlugin('https://example.com', 'admin', 'password');

    expect(result.detected).toBe(true);
    expect(result.edition).toBe('pro');
  });

  it('should default to free edition when no pro indicators', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        plugin: {
          name: 'WP Navigator',
          version: '1.5.0',
        },
      }),
    });

    const result = await detectPlugin('https://example.com', 'admin', 'password');

    expect(result.detected).toBe(true);
    expect(result.edition).toBe('free');
  });

  it('should return NOT_FOUND error on 404', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    });

    const result = await detectPlugin('https://example.com', 'admin', 'password');

    expect(result.detected).toBe(false);
    expect(result.errorCode).toBe('NOT_FOUND');
    expect(result.error).toContain('not found');
  });

  it('should return AUTH_FAILED error on 401', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
    });

    const result = await detectPlugin('https://example.com', 'admin', 'password');

    expect(result.detected).toBe(false);
    expect(result.errorCode).toBe('AUTH_FAILED');
    expect(result.error).toContain('Authentication failed');
  });

  it('should return AUTH_FAILED error on 403', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
    });

    const result = await detectPlugin('https://example.com', 'admin', 'password');

    expect(result.detected).toBe(false);
    expect(result.errorCode).toBe('AUTH_FAILED');
    expect(result.error).toContain('Access denied');
  });

  it('should return INVALID_RESPONSE when content-type is not JSON', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'text/html' }),
      text: async () => '<html>Error</html>',
    });

    const result = await detectPlugin('https://example.com', 'admin', 'password');

    expect(result.detected).toBe(false);
    expect(result.errorCode).toBe('INVALID_RESPONSE');
  });

  it('should return INVALID_RESPONSE for malformed plugin data', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        plugin: {
          // Missing version field
          name: 'WP Navigator',
        },
      }),
    });

    const result = await detectPlugin('https://example.com', 'admin', 'password');

    expect(result.detected).toBe(false);
    expect(result.errorCode).toBe('INVALID_RESPONSE');
  });

  it('should return NETWORK_ERROR on timeout', async () => {
    global.fetch = vi.fn().mockRejectedValue(
      Object.assign(new Error('The operation was aborted'), { name: 'AbortError' })
    );

    const result = await detectPlugin('https://example.com', 'admin', 'password');

    expect(result.detected).toBe(false);
    expect(result.errorCode).toBe('NETWORK_ERROR');
    expect(result.error).toContain('timed out');
  });

  it('should return NETWORK_ERROR on host not found', async () => {
    global.fetch = vi.fn().mockRejectedValue(
      new Error('getaddrinfo ENOTFOUND example.com')
    );

    const result = await detectPlugin('https://example.com', 'admin', 'password');

    expect(result.detected).toBe(false);
    expect(result.errorCode).toBe('NETWORK_ERROR');
    expect(result.error).toContain('Host not found');
  });

  it('should return NETWORK_ERROR on connection refused', async () => {
    global.fetch = vi.fn().mockRejectedValue(
      new Error('connect ECONNREFUSED 127.0.0.1:443')
    );

    const result = await detectPlugin('https://example.com', 'admin', 'password');

    expect(result.detected).toBe(false);
    expect(result.errorCode).toBe('NETWORK_ERROR');
    expect(result.error).toContain('Connection refused');
  });

  it('should return NETWORK_ERROR on SSL certificate error', async () => {
    global.fetch = vi.fn().mockRejectedValue(
      new Error('unable to verify the first certificate')
    );

    const result = await detectPlugin('https://example.com', 'admin', 'password');

    expect(result.detected).toBe(false);
    expect(result.errorCode).toBe('NETWORK_ERROR');
    expect(result.error).toContain('SSL certificate');
  });

  it('should include mcp_compat in result when available', async () => {
    const mcpCompat: McpCompat = {
      min_version: '1.0.0',
      max_version: '2.0.0',
      tested_up_to: '1.5.0',
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        plugin: {
          name: 'WP Navigator Pro',
          version: '1.5.0',
          edition: 'pro',
          mcp_compat: mcpCompat,
        },
      }),
    });

    const result = await detectPlugin('https://example.com', 'admin', 'password');

    expect(result.detected).toBe(true);
    expect(result.mcpCompat).toEqual(mcpCompat);
  });

  it('should normalize trailing slash from site URL', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        plugin: {
          name: 'WP Navigator',
          version: '1.0.0',
        },
      }),
    });

    await detectPlugin('https://example.com/', 'admin', 'password');

    expect(global.fetch).toHaveBeenCalledWith(
      'https://example.com/wp-json/wpnav/v1/introspect',
      expect.any(Object)
    );
  });
});
