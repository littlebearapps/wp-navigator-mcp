/**
 * Set Command Tests
 *
 * Tests for `wpnav set <key> <value>` config update command.
 *
 * @package WP_Navigator_MCP
 * @since 2.8.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { handleSet, handleSetList, handleSetValue } from './set.js';

// =============================================================================
// Mocks
// =============================================================================

// Mock the wpnav-config module
vi.mock('../../wpnav-config.js', () => ({
  discoverConfigFile: vi.fn(),
  parseConfigFile: vi.fn(),
}));

import { discoverConfigFile, parseConfigFile } from '../../wpnav-config.js';

// =============================================================================
// Test Fixtures
// =============================================================================

function createMockConfig() {
  return {
    config_version: '1.0',
    default_environment: 'local',
    environments: {
      local: {
        site: 'http://localhost:8080',
        user: 'admin',
        password: 'secret123',
      },
      staging: {
        site: 'https://staging.example.com',
        user: 'admin',
        password: 'staging-pass',
      },
      production: {
        site: 'https://example.com',
        user: 'admin',
        password: 'prod-pass',
      },
    },
    safety: {
      enable_writes: true,
      tool_timeout_ms: 600000,
    },
    features: {
      workflows: false,
    },
  };
}

function createMinimalConfig() {
  return {
    config_version: '1.0',
    environments: {
      default: {
        site: 'https://example.com',
        user: 'admin',
        password: 'password',
      },
    },
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('Set Command', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let tempDir: string;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.clearAllMocks();

    // Create temp directory for file operations
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wpnav-set-test-'));
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();

    // Cleanup temp directory
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  // ===========================================================================
  // handleSetList tests
  // ===========================================================================

  describe('handleSetList', () => {
    it('should list all settable keys with JSON output', async () => {
      const configPath = path.join(tempDir, 'wpnav.config.json');
      vi.mocked(discoverConfigFile).mockReturnValue({
        found: true,
        path: configPath,
        searched: [tempDir],
      });
      vi.mocked(parseConfigFile).mockReturnValue(createMockConfig());

      const result = await handleSetList({ json: true });
      expect(result).toBe(0);

      expect(consoleLogSpy).toHaveBeenCalled();
      const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
      expect(output.success).toBe(true);
      expect(output.command).toBe('set --list');
      expect(output.data.values).toBeDefined();
      expect(output.data.settable_keys).toBeDefined();
      expect(output.data.settable_keys.length).toBeGreaterThan(0);
    });

    it('should show current values in output', async () => {
      const configPath = path.join(tempDir, 'wpnav.config.json');
      vi.mocked(discoverConfigFile).mockReturnValue({
        found: true,
        path: configPath,
        searched: [tempDir],
      });
      vi.mocked(parseConfigFile).mockReturnValue(createMockConfig());

      await handleSetList({ json: true });

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
      expect(output.data.values.default_environment).toBe('local');
      expect(output.data.values['safety.enable_writes']).toBe(true);
      expect(output.data.values['safety.tool_timeout_ms']).toBe(600000);
    });

    it('should return error when config not found (JSON)', async () => {
      vi.mocked(discoverConfigFile).mockReturnValue({
        found: false,
        searched: [tempDir],
      });

      const result = await handleSetList({ json: true });
      expect(result).toBe(1);

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
      expect(output.success).toBe(false);
      expect(output.error.code).toBe('CONFIG_NOT_FOUND');
    });

    it('should return error when config not found (TUI)', async () => {
      vi.mocked(discoverConfigFile).mockReturnValue({
        found: false,
        searched: [tempDir],
      });

      const result = await handleSetList({});
      expect(result).toBe(1);

      const allCalls = consoleErrorSpy.mock.calls.map((c: unknown[]) => c[0]).join('\n');
      expect(allCalls).toContain('No wpnav.config.json found');
    });

    it('should render TUI output without error', async () => {
      const configPath = path.join(tempDir, 'wpnav.config.json');
      vi.mocked(discoverConfigFile).mockReturnValue({
        found: true,
        path: configPath,
        searched: [tempDir],
      });
      vi.mocked(parseConfigFile).mockReturnValue(createMockConfig());

      const result = await handleSetList({});
      expect(result).toBe(0);

      // TUI outputs to stderr
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  // ===========================================================================
  // handleSetValue tests
  // ===========================================================================

  describe('handleSetValue', () => {
    it('should update string value and write to config file', async () => {
      const configPath = path.join(tempDir, 'wpnav.config.json');
      const config = createMockConfig();

      // Write initial config
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

      vi.mocked(discoverConfigFile).mockReturnValue({
        found: true,
        path: configPath,
        searched: [tempDir],
      });
      vi.mocked(parseConfigFile).mockReturnValue(config);

      const result = await handleSetValue('default_environment', 'staging', { json: true });
      expect(result).toBe(0);

      // Verify file was updated
      const updatedConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      expect(updatedConfig.default_environment).toBe('staging');

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
      expect(output.success).toBe(true);
      expect(output.data.key).toBe('default_environment');
      expect(output.data.value).toBe('staging');
      expect(output.data.previous).toBe('local');
    });

    it('should update boolean value with "true"', async () => {
      const configPath = path.join(tempDir, 'wpnav.config.json');
      const config = createMockConfig();
      config.safety!.enable_writes = false;
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

      vi.mocked(discoverConfigFile).mockReturnValue({
        found: true,
        path: configPath,
        searched: [tempDir],
      });
      vi.mocked(parseConfigFile).mockReturnValue(config);

      const result = await handleSetValue('safety.enable_writes', 'true', { json: true });
      expect(result).toBe(0);

      const updatedConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      expect(updatedConfig.safety.enable_writes).toBe(true);
    });

    it('should update boolean value with "false"', async () => {
      const configPath = path.join(tempDir, 'wpnav.config.json');
      const config = createMockConfig();
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

      vi.mocked(discoverConfigFile).mockReturnValue({
        found: true,
        path: configPath,
        searched: [tempDir],
      });
      vi.mocked(parseConfigFile).mockReturnValue(config);

      const result = await handleSetValue('safety.enable_writes', 'false', { json: true });
      expect(result).toBe(0);

      const updatedConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      expect(updatedConfig.safety.enable_writes).toBe(false);
    });

    it('should update number value', async () => {
      const configPath = path.join(tempDir, 'wpnav.config.json');
      const config = createMockConfig();
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

      vi.mocked(discoverConfigFile).mockReturnValue({
        found: true,
        path: configPath,
        searched: [tempDir],
      });
      vi.mocked(parseConfigFile).mockReturnValue(config);

      const result = await handleSetValue('safety.tool_timeout_ms', '300000', { json: true });
      expect(result).toBe(0);

      const updatedConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      expect(updatedConfig.safety.tool_timeout_ms).toBe(300000);
    });

    it('should create nested objects if they do not exist', async () => {
      const configPath = path.join(tempDir, 'wpnav.config.json');
      const config = createMinimalConfig();
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

      vi.mocked(discoverConfigFile).mockReturnValue({
        found: true,
        path: configPath,
        searched: [tempDir],
      });
      vi.mocked(parseConfigFile).mockReturnValue(config);

      const result = await handleSetValue('safety.enable_writes', 'true', { json: true });
      expect(result).toBe(0);

      const updatedConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      expect(updatedConfig.safety).toBeDefined();
      expect(updatedConfig.safety.enable_writes).toBe(true);
    });

    it('should handle unchanged value gracefully', async () => {
      const configPath = path.join(tempDir, 'wpnav.config.json');
      const config = createMockConfig();
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

      vi.mocked(discoverConfigFile).mockReturnValue({
        found: true,
        path: configPath,
        searched: [tempDir],
      });
      vi.mocked(parseConfigFile).mockReturnValue(config);

      const result = await handleSetValue('default_environment', 'local', { json: true });
      expect(result).toBe(0);

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
      expect(output.success).toBe(true);
      expect(output.data.message).toContain('unchanged');
    });

    it('should return error for unknown key (JSON)', async () => {
      const result = await handleSetValue('unknown.key', 'value', { json: true });
      expect(result).toBe(1);

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
      expect(output.success).toBe(false);
      expect(output.error.code).toBe('INVALID_KEY');
      expect(output.error.available_keys).toBeDefined();
    });

    it('should return error for unknown key (TUI)', async () => {
      const result = await handleSetValue('unknown.key', 'value', {});
      expect(result).toBe(1);

      const allCalls = consoleErrorSpy.mock.calls.map((c: unknown[]) => c[0]).join('\n');
      expect(allCalls).toContain('Unknown config key');
    });

    it('should return error for invalid boolean value', async () => {
      const result = await handleSetValue('safety.enable_writes', 'maybe', { json: true });
      expect(result).toBe(1);

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
      expect(output.success).toBe(false);
      expect(output.error.code).toBe('INVALID_VALUE');
    });

    it('should return error for invalid number value', async () => {
      const result = await handleSetValue('safety.tool_timeout_ms', 'not-a-number', { json: true });
      expect(result).toBe(1);

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
      expect(output.success).toBe(false);
      expect(output.error.code).toBe('INVALID_VALUE');
    });

    it('should return error when setting default_environment to non-existent env', async () => {
      const configPath = path.join(tempDir, 'wpnav.config.json');
      const config = createMockConfig();
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

      vi.mocked(discoverConfigFile).mockReturnValue({
        found: true,
        path: configPath,
        searched: [tempDir],
      });
      vi.mocked(parseConfigFile).mockReturnValue(config);

      const result = await handleSetValue('default_environment', 'nonexistent', { json: true });
      expect(result).toBe(1);

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
      expect(output.success).toBe(false);
      expect(output.error.code).toBe('ENVIRONMENT_NOT_FOUND');
      expect(output.error.available).toContain('local');
      expect(output.error.available).toContain('staging');
      expect(output.error.available).toContain('production');
    });

    it('should return error when config not found (JSON)', async () => {
      vi.mocked(discoverConfigFile).mockReturnValue({
        found: false,
        searched: [tempDir],
      });

      const result = await handleSetValue('default_environment', 'staging', { json: true });
      expect(result).toBe(1);

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
      expect(output.success).toBe(false);
      expect(output.error.code).toBe('CONFIG_NOT_FOUND');
    });

    it('should render TUI output on success', async () => {
      const configPath = path.join(tempDir, 'wpnav.config.json');
      const config = createMockConfig();
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

      vi.mocked(discoverConfigFile).mockReturnValue({
        found: true,
        path: configPath,
        searched: [tempDir],
      });
      vi.mocked(parseConfigFile).mockReturnValue(config);

      const result = await handleSetValue('default_environment', 'staging', {});
      expect(result).toBe(0);

      const allCalls = consoleErrorSpy.mock.calls.map((c: unknown[]) => c[0]).join('\n');
      expect(allCalls).toContain('Updated');
      expect(allCalls).toContain('default_environment');
    });
  });

  // ===========================================================================
  // handleSet (main handler) tests
  // ===========================================================================

  describe('handleSet (main handler)', () => {
    it('should route --list flag to handleSetList', async () => {
      const configPath = path.join(tempDir, 'wpnav.config.json');
      vi.mocked(discoverConfigFile).mockReturnValue({
        found: true,
        path: configPath,
        searched: [tempDir],
      });
      vi.mocked(parseConfigFile).mockReturnValue(createMockConfig());

      const result = await handleSet([], { list: true, json: true });
      expect(result).toBe(0);

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
      expect(output.command).toBe('set --list');
    });

    it('should route key value to handleSetValue', async () => {
      const configPath = path.join(tempDir, 'wpnav.config.json');
      const config = createMockConfig();
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

      vi.mocked(discoverConfigFile).mockReturnValue({
        found: true,
        path: configPath,
        searched: [tempDir],
      });
      vi.mocked(parseConfigFile).mockReturnValue(config);

      const result = await handleSet(['default_environment', 'staging'], { json: true });
      expect(result).toBe(0);

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
      expect(output.command).toBe('set');
      expect(output.data.key).toBe('default_environment');
    });

    it('should return error when no key provided', async () => {
      const result = await handleSet([], { json: true });
      expect(result).toBe(1);

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
      expect(output.success).toBe(false);
      expect(output.error.code).toBe('MISSING_KEY');
    });

    it('should return error when no value provided', async () => {
      const result = await handleSet(['default_environment'], { json: true });
      expect(result).toBe(1);

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
      expect(output.success).toBe(false);
      expect(output.error.code).toBe('MISSING_VALUE');
    });
  });

  // ===========================================================================
  // Value parsing tests
  // ===========================================================================

  describe('Value parsing', () => {
    it('should parse "yes" as true for boolean', async () => {
      const configPath = path.join(tempDir, 'wpnav.config.json');
      const config = createMockConfig();
      config.safety!.enable_writes = false;
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

      vi.mocked(discoverConfigFile).mockReturnValue({
        found: true,
        path: configPath,
        searched: [tempDir],
      });
      vi.mocked(parseConfigFile).mockReturnValue(config);

      const result = await handleSetValue('safety.enable_writes', 'yes', { json: true });
      expect(result).toBe(0);

      const updatedConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      expect(updatedConfig.safety.enable_writes).toBe(true);
    });

    it('should parse "no" as false for boolean', async () => {
      const configPath = path.join(tempDir, 'wpnav.config.json');
      const config = createMockConfig();
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

      vi.mocked(discoverConfigFile).mockReturnValue({
        found: true,
        path: configPath,
        searched: [tempDir],
      });
      vi.mocked(parseConfigFile).mockReturnValue(config);

      const result = await handleSetValue('safety.enable_writes', 'no', { json: true });
      expect(result).toBe(0);

      const updatedConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      expect(updatedConfig.safety.enable_writes).toBe(false);
    });

    it('should parse "1" as true for boolean', async () => {
      const configPath = path.join(tempDir, 'wpnav.config.json');
      const config = createMockConfig();
      config.safety!.enable_writes = false;
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

      vi.mocked(discoverConfigFile).mockReturnValue({
        found: true,
        path: configPath,
        searched: [tempDir],
      });
      vi.mocked(parseConfigFile).mockReturnValue(config);

      const result = await handleSetValue('safety.enable_writes', '1', { json: true });
      expect(result).toBe(0);

      const updatedConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      expect(updatedConfig.safety.enable_writes).toBe(true);
    });

    it('should parse "0" as false for boolean', async () => {
      const configPath = path.join(tempDir, 'wpnav.config.json');
      const config = createMockConfig();
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

      vi.mocked(discoverConfigFile).mockReturnValue({
        found: true,
        path: configPath,
        searched: [tempDir],
      });
      vi.mocked(parseConfigFile).mockReturnValue(config);

      const result = await handleSetValue('safety.enable_writes', '0', { json: true });
      expect(result).toBe(0);

      const updatedConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      expect(updatedConfig.safety.enable_writes).toBe(false);
    });
  });
});
