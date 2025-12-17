/**
 * Connect Command Tests
 *
 * @module cli/commands/connect.test
 * @since v2.7.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { handleConnect } from './connect.js';
import * as magicLink from '../auth/magic-link.js';

// =============================================================================
// Test Fixtures
// =============================================================================

const futureExpiry = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
const validMagicLinkUrl = `wpnav://connect?site=example.com&token=abc123def456ghi789jkl012mno345pqr&expires=${futureExpiry}`;

const mockCredentials: magicLink.MagicLinkExchangeResponse = {
  site_url: 'https://example.com',
  username: 'admin',
  app_password: 'xxxx xxxx xxxx xxxx xxxx xxxx',
  site_name: 'My WordPress Site',
  plugin_version: '1.5.0',
  plugin_edition: 'pro',
};

// =============================================================================
// Mocks
// =============================================================================

vi.mock('../auth/magic-link.js', async () => {
  const actual = await vi.importActual('../auth/magic-link.js');
  return {
    ...actual,
    processMagicLink: vi.fn(),
  };
});

vi.mock('../tui/prompts.js', () => ({
  inputPrompt: vi.fn(),
  confirmPrompt: vi.fn().mockResolvedValue(true),
}));

vi.mock('../tui/components.js', () => ({
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
  newline: vi.fn(),
  box: vi.fn(),
  keyValue: vi.fn(),
  createSpinner: vi.fn(() => ({
    succeed: vi.fn(),
    fail: vi.fn(),
  })),
  colorize: vi.fn((text) => text),
  symbols: { success: '✓', error: '✗' },
}));

// =============================================================================
// Test Setup
// =============================================================================

describe('Connect Command', () => {
  let originalCwd: string;
  let tempDir: string;

  beforeEach(() => {
    vi.resetAllMocks();
    originalCwd = process.cwd();

    // Create temp directory
    tempDir = fs.mkdtempSync(
      path.join(fs.realpathSync(require('os').tmpdir()), 'wpnav-connect-test-')
    );
    process.chdir(tempDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    // Clean up temp directory
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
    vi.restoreAllMocks();
  });

  describe('with valid magic link', () => {
    beforeEach(() => {
      vi.mocked(magicLink.processMagicLink).mockResolvedValue({
        success: true,
        credentials: mockCredentials,
      });
    });

    it('successfully connects and stores credentials', async () => {
      const exitCode = await handleConnect([validMagicLinkUrl], { json: true });

      expect(exitCode).toBe(0);

      // Check .wpnav.env was created
      const envPath = path.join(tempDir, '.wpnav.env');
      expect(fs.existsSync(envPath)).toBe(true);

      // Check content
      const envContent = fs.readFileSync(envPath, 'utf8');
      expect(envContent).toContain('WP_BASE_URL=https://example.com');
      expect(envContent).toContain('WP_APP_USER=admin');
      expect(envContent).toContain('WP_APP_PASS=xxxx xxxx xxxx xxxx xxxx xxxx');
    });

    it('auto-inits project if wpnavigator.jsonc missing', async () => {
      const exitCode = await handleConnect([validMagicLinkUrl], { json: true });

      expect(exitCode).toBe(0);

      // Check wpnavigator.jsonc was created
      const manifestPath = path.join(tempDir, 'wpnavigator.jsonc');
      expect(fs.existsSync(manifestPath)).toBe(true);

      // Check snapshots directory was created
      const snapshotsDir = path.join(tempDir, 'snapshots');
      expect(fs.existsSync(snapshotsDir)).toBe(true);
    });

    it('skips auto-init with --skip-init flag', async () => {
      const exitCode = await handleConnect([validMagicLinkUrl], { json: true, skipInit: true });

      expect(exitCode).toBe(0);

      // Check .wpnav.env was created
      expect(fs.existsSync(path.join(tempDir, '.wpnav.env'))).toBe(true);

      // Check wpnavigator.jsonc was NOT created
      expect(fs.existsSync(path.join(tempDir, 'wpnavigator.jsonc'))).toBe(false);
    });

    it('does not auto-init if wpnavigator.jsonc exists', async () => {
      // Create existing manifest
      fs.writeFileSync(path.join(tempDir, 'wpnavigator.jsonc'), '{"schema_version": 1}');

      const exitCode = await handleConnect([validMagicLinkUrl], { json: true });

      expect(exitCode).toBe(0);

      // Check manifest wasn't modified (same content)
      const manifestContent = fs.readFileSync(path.join(tempDir, 'wpnavigator.jsonc'), 'utf8');
      expect(manifestContent).toBe('{"schema_version": 1}');
    });

    it('updates .gitignore with .wpnav.env', async () => {
      await handleConnect([validMagicLinkUrl], { json: true });

      const gitignorePath = path.join(tempDir, '.gitignore');
      expect(fs.existsSync(gitignorePath)).toBe(true);

      const gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
      expect(gitignoreContent).toContain('.wpnav.env');
    });

    it('appends to existing .gitignore', async () => {
      // Create existing .gitignore
      fs.writeFileSync(path.join(tempDir, '.gitignore'), 'node_modules/\n');

      await handleConnect([validMagicLinkUrl], { json: true });

      const gitignoreContent = fs.readFileSync(path.join(tempDir, '.gitignore'), 'utf8');
      expect(gitignoreContent).toContain('node_modules/');
      expect(gitignoreContent).toContain('.wpnav.env');
    });

    it('does not duplicate .wpnav.env in .gitignore', async () => {
      // Create .gitignore that already has .wpnav.env
      fs.writeFileSync(path.join(tempDir, '.gitignore'), '.wpnav.env\n');

      await handleConnect([validMagicLinkUrl], { json: true });

      const gitignoreContent = fs.readFileSync(path.join(tempDir, '.gitignore'), 'utf8');
      const matches = gitignoreContent.match(/\.wpnav\.env/g) || [];
      expect(matches.length).toBe(1);
    });

    it('strips quotes from magic link URL', async () => {
      const quotedUrl = `"${validMagicLinkUrl}"`;
      await handleConnect([quotedUrl], { json: true });

      expect(magicLink.processMagicLink).toHaveBeenCalledWith(
        validMagicLinkUrl, // Without quotes
        expect.any(Object)
      );
    });

    it('passes allowInsecureHttp option when --local flag is set', async () => {
      await handleConnect([validMagicLinkUrl], { json: true, local: true });

      expect(magicLink.processMagicLink).toHaveBeenCalledWith(
        validMagicLinkUrl,
        expect.objectContaining({ allowInsecureHttp: true })
      );
    });
  });

  describe('with existing .wpnav.env', () => {
    beforeEach(() => {
      vi.mocked(magicLink.processMagicLink).mockResolvedValue({
        success: true,
        credentials: mockCredentials,
      });

      // Create existing .wpnav.env
      fs.writeFileSync(path.join(tempDir, '.wpnav.env'), 'OLD_CONTENT=test');
    });

    it('overwrites with --yes flag', async () => {
      const exitCode = await handleConnect([validMagicLinkUrl], { json: true, yes: true });

      expect(exitCode).toBe(0);

      const envContent = fs.readFileSync(path.join(tempDir, '.wpnav.env'), 'utf8');
      expect(envContent).not.toContain('OLD_CONTENT');
      expect(envContent).toContain('WP_BASE_URL=https://example.com');
    });

    it('returns error without --yes flag in JSON mode', async () => {
      const exitCode = await handleConnect([validMagicLinkUrl], { json: true });

      expect(exitCode).toBe(1);

      // Original file should be preserved
      const envContent = fs.readFileSync(path.join(tempDir, '.wpnav.env'), 'utf8');
      expect(envContent).toBe('OLD_CONTENT=test');
    });
  });

  describe('error handling', () => {
    it('returns error for expired token', async () => {
      vi.mocked(magicLink.processMagicLink).mockResolvedValue({
        success: false,
        error: {
          code: 'TOKEN_EXPIRED',
          message: 'This Magic Link has expired',
        },
      });

      const exitCode = await handleConnect([validMagicLinkUrl], { json: true });

      expect(exitCode).toBe(1);
    });

    it('returns error for invalid token', async () => {
      vi.mocked(magicLink.processMagicLink).mockResolvedValue({
        success: false,
        error: {
          code: 'TOKEN_INVALID',
          message: 'Invalid token',
        },
      });

      const exitCode = await handleConnect([validMagicLinkUrl], { json: true });

      expect(exitCode).toBe(1);
    });

    it('returns error for network error', async () => {
      vi.mocked(magicLink.processMagicLink).mockResolvedValue({
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: 'Could not connect',
        },
      });

      const exitCode = await handleConnect([validMagicLinkUrl], { json: true });

      expect(exitCode).toBe(1);
    });

    it('returns error for plugin not found', async () => {
      vi.mocked(magicLink.processMagicLink).mockResolvedValue({
        success: false,
        error: {
          code: 'PLUGIN_NOT_FOUND',
          message: 'Plugin not found',
          httpStatus: 404,
        },
      });

      const exitCode = await handleConnect([validMagicLinkUrl], { json: true });

      expect(exitCode).toBe(1);
    });

    it('returns error when no URL provided in JSON mode', async () => {
      const exitCode = await handleConnect([], { json: true });

      expect(exitCode).toBe(1);
    });
  });

  describe('JSON output', () => {
    beforeEach(() => {
      vi.mocked(magicLink.processMagicLink).mockResolvedValue({
        success: true,
        credentials: mockCredentials,
      });
    });

    it('outputs valid JSON on success', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await handleConnect([validMagicLinkUrl], { json: true });

      expect(consoleSpy).toHaveBeenCalled();
      const output = JSON.parse(consoleSpy.mock.calls[0][0]);

      expect(output.success).toBe(true);
      expect(output.command).toBe('connect');
      expect(output.data.site_url).toBe('https://example.com');
      expect(output.data.username).toBe('admin');

      consoleSpy.mockRestore();
    });

    it('outputs valid JSON on error', async () => {
      vi.mocked(magicLink.processMagicLink).mockResolvedValue({
        success: false,
        error: {
          code: 'TOKEN_INVALID',
          message: 'Invalid token',
        },
      });

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await handleConnect([validMagicLinkUrl], { json: true });

      expect(consoleSpy).toHaveBeenCalled();
      const output = JSON.parse(consoleSpy.mock.calls[0][0]);

      expect(output.success).toBe(false);
      expect(output.command).toBe('connect');
      expect(output.error.code).toBe('TOKEN_INVALID');

      consoleSpy.mockRestore();
    });
  });

  describe('file permissions', () => {
    beforeEach(() => {
      vi.mocked(magicLink.processMagicLink).mockResolvedValue({
        success: true,
        credentials: mockCredentials,
      });
    });

    it('sets .wpnav.env to mode 0600 (owner read/write only)', async () => {
      await handleConnect([validMagicLinkUrl], { json: true });

      const envPath = path.join(tempDir, '.wpnav.env');
      const stats = fs.statSync(envPath);
      const mode = stats.mode & 0o777; // Get permission bits only

      // On Windows, this may not be exactly 0o600
      if (process.platform !== 'win32') {
        expect(mode).toBe(0o600);
      }
    });
  });
});
