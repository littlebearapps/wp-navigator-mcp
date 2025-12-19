/**
 * Use Command Tests
 *
 * Tests for `wpnav use <env>` environment switching command.
 *
 * @package WP_Navigator_MCP
 * @since 2.8.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { handleUse, handleUseList, handleUseSwitch } from './use.js';

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

describe('Use Command', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let tempDir: string;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.clearAllMocks();

    // Create temp directory for file operations
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wpnav-use-test-'));
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();

    // Cleanup temp directory
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  // ===========================================================================
  // handleUseList tests
  // ===========================================================================

  describe('handleUseList', () => {
    it('should list all environments with JSON output', async () => {
      const configPath = path.join(tempDir, 'wpnav.config.json');
      vi.mocked(discoverConfigFile).mockReturnValue({
        found: true,
        path: configPath,
        searched: [tempDir],
      });
      vi.mocked(parseConfigFile).mockReturnValue(createMockConfig());

      const result = await handleUseList({ json: true });
      expect(result).toBe(0);

      expect(consoleLogSpy).toHaveBeenCalled();
      const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
      expect(output.success).toBe(true);
      expect(output.command).toBe('use --list');
      expect(output.data.environments).toHaveLength(3);
      expect(output.data.environments).toContain('local');
      expect(output.data.environments).toContain('staging');
      expect(output.data.environments).toContain('production');
    });

    it('should show active environment in JSON output', async () => {
      const configPath = path.join(tempDir, 'wpnav.config.json');
      vi.mocked(discoverConfigFile).mockReturnValue({
        found: true,
        path: configPath,
        searched: [tempDir],
      });
      vi.mocked(parseConfigFile).mockReturnValue(createMockConfig());

      await handleUseList({ json: true });

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
      expect(output.data.active).toBe('local');
    });

    it('should show null when no active environment', async () => {
      const configPath = path.join(tempDir, 'wpnav.config.json');
      vi.mocked(discoverConfigFile).mockReturnValue({
        found: true,
        path: configPath,
        searched: [tempDir],
      });
      vi.mocked(parseConfigFile).mockReturnValue(createMinimalConfig());

      await handleUseList({ json: true });

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
      expect(output.data.active).toBeNull();
    });

    it('should include config path in output', async () => {
      const configPath = path.join(tempDir, 'wpnav.config.json');
      vi.mocked(discoverConfigFile).mockReturnValue({
        found: true,
        path: configPath,
        searched: [tempDir],
      });
      vi.mocked(parseConfigFile).mockReturnValue(createMockConfig());

      await handleUseList({ json: true });

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
      expect(output.data.config_path).toBe(configPath);
    });

    it('should return error when config not found (JSON)', async () => {
      vi.mocked(discoverConfigFile).mockReturnValue({
        found: false,
        searched: [tempDir],
      });

      const result = await handleUseList({ json: true });
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

      const result = await handleUseList({});
      expect(result).toBe(1);

      const allCalls = consoleErrorSpy.mock.calls.map((c: unknown[]) => c[0]).join('\n');
      expect(allCalls).toContain('No wpnav.config.json found');
    });

    it('should return error when config invalid (JSON)', async () => {
      const configPath = path.join(tempDir, 'wpnav.config.json');
      vi.mocked(discoverConfigFile).mockReturnValue({
        found: true,
        path: configPath,
        searched: [tempDir],
      });
      vi.mocked(parseConfigFile).mockImplementation(() => {
        throw new Error('Invalid JSON');
      });

      const result = await handleUseList({ json: true });
      expect(result).toBe(1);

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
      expect(output.success).toBe(false);
      expect(output.error.code).toBe('CONFIG_INVALID');
    });

    it('should render TUI output without error', async () => {
      const configPath = path.join(tempDir, 'wpnav.config.json');
      vi.mocked(discoverConfigFile).mockReturnValue({
        found: true,
        path: configPath,
        searched: [tempDir],
      });
      vi.mocked(parseConfigFile).mockReturnValue(createMockConfig());

      const result = await handleUseList({});
      expect(result).toBe(0);

      // TUI outputs to stderr
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('should show environment details in TUI', async () => {
      const configPath = path.join(tempDir, 'wpnav.config.json');
      vi.mocked(discoverConfigFile).mockReturnValue({
        found: true,
        path: configPath,
        searched: [tempDir],
      });
      vi.mocked(parseConfigFile).mockReturnValue(createMockConfig());

      await handleUseList({});

      const allCalls = consoleErrorSpy.mock.calls.map((c: unknown[]) => c[0]).join('\n');
      expect(allCalls).toContain('Available Environments');
      expect(allCalls).toContain('http://localhost:8080');
      expect(allCalls).toContain('https://staging.example.com');
    });
  });

  // ===========================================================================
  // handleUseSwitch tests
  // ===========================================================================

  describe('handleUseSwitch', () => {
    it('should switch environment and update config file', async () => {
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

      const result = await handleUseSwitch('staging', { json: true });
      expect(result).toBe(0);

      // Verify file was updated
      const updatedConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      expect(updatedConfig.default_environment).toBe('staging');

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
      expect(output.success).toBe(true);
      expect(output.data.environment).toBe('staging');
      expect(output.data.previous).toBe('local');
    });

    it('should include site info in success output', async () => {
      const configPath = path.join(tempDir, 'wpnav.config.json');
      const config = createMockConfig();
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

      vi.mocked(discoverConfigFile).mockReturnValue({
        found: true,
        path: configPath,
        searched: [tempDir],
      });
      vi.mocked(parseConfigFile).mockReturnValue(config);

      await handleUseSwitch('production', { json: true });

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
      expect(output.data.site).toBe('https://example.com');
      expect(output.data.user).toBe('admin');
    });

    it('should handle already using same environment', async () => {
      const configPath = path.join(tempDir, 'wpnav.config.json');
      const config = createMockConfig();
      config.default_environment = 'staging';
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

      vi.mocked(discoverConfigFile).mockReturnValue({
        found: true,
        path: configPath,
        searched: [tempDir],
      });
      vi.mocked(parseConfigFile).mockReturnValue(config);

      const result = await handleUseSwitch('staging', { json: true });
      expect(result).toBe(0);

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
      expect(output.success).toBe(true);
      expect(output.data.message).toContain('Already using');
    });

    it('should return error when env name missing (JSON)', async () => {
      const result = await handleUseSwitch('', { json: true });
      expect(result).toBe(1);

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
      expect(output.success).toBe(false);
      expect(output.error.code).toBe('MISSING_ENVIRONMENT');
    });

    it('should return error when env name missing (TUI)', async () => {
      const result = await handleUseSwitch('', {});
      expect(result).toBe(1);

      const allCalls = consoleErrorSpy.mock.calls.map((c: unknown[]) => c[0]).join('\n');
      expect(allCalls).toContain('Environment name required');
    });

    it('should return error when config not found (JSON)', async () => {
      vi.mocked(discoverConfigFile).mockReturnValue({
        found: false,
        searched: [tempDir],
      });

      const result = await handleUseSwitch('staging', { json: true });
      expect(result).toBe(1);

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
      expect(output.success).toBe(false);
      expect(output.error.code).toBe('CONFIG_NOT_FOUND');
    });

    it('should return error when environment not found (JSON)', async () => {
      const configPath = path.join(tempDir, 'wpnav.config.json');
      const config = createMockConfig();
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

      vi.mocked(discoverConfigFile).mockReturnValue({
        found: true,
        path: configPath,
        searched: [tempDir],
      });
      vi.mocked(parseConfigFile).mockReturnValue(config);

      const result = await handleUseSwitch('nonexistent', { json: true });
      expect(result).toBe(1);

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
      expect(output.success).toBe(false);
      expect(output.error.code).toBe('ENVIRONMENT_NOT_FOUND');
      expect(output.error.available).toContain('local');
      expect(output.error.available).toContain('staging');
      expect(output.error.available).toContain('production');
    });

    it('should return error when environment not found (TUI)', async () => {
      const configPath = path.join(tempDir, 'wpnav.config.json');
      const config = createMockConfig();
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

      vi.mocked(discoverConfigFile).mockReturnValue({
        found: true,
        path: configPath,
        searched: [tempDir],
      });
      vi.mocked(parseConfigFile).mockReturnValue(config);

      const result = await handleUseSwitch('nonexistent', {});
      expect(result).toBe(1);

      const allCalls = consoleErrorSpy.mock.calls.map((c: unknown[]) => c[0]).join('\n');
      expect(allCalls).toContain('Environment not found');
      expect(allCalls).toContain('local');
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

      const result = await handleUseSwitch('staging', {});
      expect(result).toBe(0);

      const allCalls = consoleErrorSpy.mock.calls.map((c: unknown[]) => c[0]).join('\n');
      expect(allCalls).toContain('Switched to environment');
      expect(allCalls).toContain('staging');
    });
  });

  // ===========================================================================
  // handleUse (main handler) tests
  // ===========================================================================

  describe('handleUse (main handler)', () => {
    it('should route --list flag to handleUseList', async () => {
      const configPath = path.join(tempDir, 'wpnav.config.json');
      vi.mocked(discoverConfigFile).mockReturnValue({
        found: true,
        path: configPath,
        searched: [tempDir],
      });
      vi.mocked(parseConfigFile).mockReturnValue(createMockConfig());

      const result = await handleUse([], { list: true, json: true });
      expect(result).toBe(0);

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
      expect(output.command).toBe('use --list');
    });

    it('should route environment arg to handleUseSwitch', async () => {
      const configPath = path.join(tempDir, 'wpnav.config.json');
      const config = createMockConfig();
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

      vi.mocked(discoverConfigFile).mockReturnValue({
        found: true,
        path: configPath,
        searched: [tempDir],
      });
      vi.mocked(parseConfigFile).mockReturnValue(config);

      const result = await handleUse(['staging'], { json: true });
      expect(result).toBe(0);

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
      expect(output.command).toBe('use');
      expect(output.data.environment).toBe('staging');
    });

    it('should return error when no env and no --list', async () => {
      const result = await handleUse([], { json: true });
      expect(result).toBe(1);

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
      expect(output.success).toBe(false);
      expect(output.error.code).toBe('MISSING_ENVIRONMENT');
    });
  });
});
