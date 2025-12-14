/**
 * Tests for Node.js Version Check Module
 *
 * @package WP_Navigator_MCP
 * @since 2.4.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  parseNodeVersion,
  getNodeVersion,
  compareVersions,
  meetsRequirements,
  detectInstallMethod,
  getPlatformInstructions,
  checkNodeVersion,
  REQUIRED_NODE_VERSION,
  EXIT_CODE_NODE_VERSION,
  type NodeVersion,
  type InstallMethod,
} from './node-check.js';

describe('Node.js Version Check', () => {
  describe('parseNodeVersion', () => {
    it('parses version with v prefix', () => {
      const result = parseNodeVersion('v18.17.0');
      expect(result.major).toBe(18);
      expect(result.minor).toBe(17);
      expect(result.patch).toBe(0);
      expect(result.raw).toBe('v18.17.0');
    });

    it('parses version without v prefix', () => {
      const result = parseNodeVersion('20.10.0');
      expect(result.major).toBe(20);
      expect(result.minor).toBe(10);
      expect(result.patch).toBe(0);
    });

    it('parses version with single digit components', () => {
      const result = parseNodeVersion('v8.0.0');
      expect(result.major).toBe(8);
      expect(result.minor).toBe(0);
      expect(result.patch).toBe(0);
    });

    it('handles incomplete versions', () => {
      const result = parseNodeVersion('v18');
      expect(result.major).toBe(18);
      expect(result.minor).toBe(0);
      expect(result.patch).toBe(0);
    });

    it('handles empty string', () => {
      const result = parseNodeVersion('');
      expect(result.major).toBe(0);
      expect(result.minor).toBe(0);
      expect(result.patch).toBe(0);
    });
  });

  describe('getNodeVersion', () => {
    it('returns current Node.js version', () => {
      const result = getNodeVersion();
      expect(result.major).toBeGreaterThan(0);
      expect(result.raw).toBe(process.version);
    });
  });

  describe('compareVersions', () => {
    it('returns negative when first version is lower (major)', () => {
      const a: NodeVersion = { major: 16, minor: 0, patch: 0, raw: 'v16.0.0' };
      const b: NodeVersion = { major: 18, minor: 0, patch: 0, raw: 'v18.0.0' };
      expect(compareVersions(a, b)).toBeLessThan(0);
    });

    it('returns positive when first version is higher (major)', () => {
      const a: NodeVersion = { major: 20, minor: 0, patch: 0, raw: 'v20.0.0' };
      const b: NodeVersion = { major: 18, minor: 0, patch: 0, raw: 'v18.0.0' };
      expect(compareVersions(a, b)).toBeGreaterThan(0);
    });

    it('returns negative when first version is lower (minor)', () => {
      const a: NodeVersion = { major: 18, minor: 5, patch: 0, raw: 'v18.5.0' };
      const b: NodeVersion = { major: 18, minor: 17, patch: 0, raw: 'v18.17.0' };
      expect(compareVersions(a, b)).toBeLessThan(0);
    });

    it('returns positive when first version is higher (minor)', () => {
      const a: NodeVersion = { major: 18, minor: 17, patch: 0, raw: 'v18.17.0' };
      const b: NodeVersion = { major: 18, minor: 5, patch: 0, raw: 'v18.5.0' };
      expect(compareVersions(a, b)).toBeGreaterThan(0);
    });

    it('returns negative when first version is lower (patch)', () => {
      const a: NodeVersion = { major: 18, minor: 17, patch: 0, raw: 'v18.17.0' };
      const b: NodeVersion = { major: 18, minor: 17, patch: 5, raw: 'v18.17.5' };
      expect(compareVersions(a, b)).toBeLessThan(0);
    });

    it('returns zero when versions are equal', () => {
      const a: NodeVersion = { major: 18, minor: 17, patch: 0, raw: 'v18.17.0' };
      const b: NodeVersion = { major: 18, minor: 17, patch: 0, raw: 'v18.17.0' };
      expect(compareVersions(a, b)).toBe(0);
    });
  });

  describe('meetsRequirements', () => {
    const required: NodeVersion = { major: 18, minor: 0, patch: 0, raw: 'v18.0.0' };

    it('returns true when current version equals required', () => {
      const current: NodeVersion = { major: 18, minor: 0, patch: 0, raw: 'v18.0.0' };
      expect(meetsRequirements(current, required)).toBe(true);
    });

    it('returns true when current version is higher', () => {
      const current: NodeVersion = { major: 20, minor: 10, patch: 0, raw: 'v20.10.0' };
      expect(meetsRequirements(current, required)).toBe(true);
    });

    it('returns false when current version is lower', () => {
      const current: NodeVersion = { major: 16, minor: 14, patch: 0, raw: 'v16.14.0' };
      expect(meetsRequirements(current, required)).toBe(false);
    });

    it('returns true when minor version is higher with same major', () => {
      const current: NodeVersion = { major: 18, minor: 17, patch: 0, raw: 'v18.17.0' };
      expect(meetsRequirements(current, required)).toBe(true);
    });
  });

  describe('detectInstallMethod', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      // Reset environment for each test
      process.env = { ...originalEnv };
      delete process.env.NVM_DIR;
      delete process.env.FNM_DIR;
      delete process.env.FNM_MULTISHELL_PATH;
      delete process.env.VOLTA_HOME;
      delete process.env.ASDF_DIR;
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('detects nvm when NVM_DIR is set', () => {
      process.env.NVM_DIR = '/Users/test/.nvm';
      expect(detectInstallMethod()).toBe('nvm');
    });

    it('detects fnm when FNM_DIR is set', () => {
      process.env.FNM_DIR = '/Users/test/.fnm';
      expect(detectInstallMethod()).toBe('fnm');
    });

    it('detects fnm when FNM_MULTISHELL_PATH is set', () => {
      process.env.FNM_MULTISHELL_PATH = '/tmp/fnm_multishells/12345';
      expect(detectInstallMethod()).toBe('fnm');
    });

    it('detects volta when VOLTA_HOME is set', () => {
      process.env.VOLTA_HOME = '/Users/test/.volta';
      expect(detectInstallMethod()).toBe('volta');
    });

    it('detects asdf when ASDF_DIR is set', () => {
      process.env.ASDF_DIR = '/Users/test/.asdf';
      expect(detectInstallMethod()).toBe('asdf');
    });

    it('returns system or unknown when no version manager detected', () => {
      const method = detectInstallMethod();
      expect(['system', 'unknown', 'brew']).toContain(method);
    });
  });

  describe('getPlatformInstructions', () => {
    it('returns brew instructions for brew install method', () => {
      const instructions = getPlatformInstructions('brew', 'darwin');
      expect(instructions).toContain('brew upgrade node');
    });

    it('returns nvm instructions for nvm install method', () => {
      const instructions = getPlatformInstructions('nvm', 'darwin');
      expect(instructions).toContain('nvm install 20');
      expect(instructions).toContain('nvm use 20');
    });

    it('returns fnm instructions for fnm install method', () => {
      const instructions = getPlatformInstructions('fnm', 'darwin');
      expect(instructions).toContain('fnm install 20');
      expect(instructions).toContain('fnm use 20');
    });

    it('returns volta instructions for volta install method', () => {
      const instructions = getPlatformInstructions('volta', 'darwin');
      expect(instructions).toContain('volta install node@20');
    });

    it('returns asdf instructions for asdf install method', () => {
      const instructions = getPlatformInstructions('asdf', 'darwin');
      expect(instructions.some((i) => i.includes('asdf install nodejs'))).toBe(true);
    });

    it('returns macOS instructions for system/unknown on darwin', () => {
      const instructions = getPlatformInstructions('system', 'darwin');
      expect(instructions.some((i) => i.includes('brew install node'))).toBe(true);
      expect(instructions.some((i) => i.includes('nvm'))).toBe(true);
    });

    it('returns Windows instructions for system/unknown on win32', () => {
      const instructions = getPlatformInstructions('system', 'win32');
      expect(instructions.some((i) => i.includes('nodejs.org'))).toBe(true);
    });

    it('returns Linux instructions for system/unknown on linux', () => {
      const instructions = getPlatformInstructions('system', 'linux');
      expect(instructions.some((i) => i.includes('apt'))).toBe(true);
      expect(instructions.some((i) => i.includes('nvm'))).toBe(true);
    });
  });

  describe('checkNodeVersion', () => {
    it('returns ok=true when current Node meets requirements', () => {
      const result = checkNodeVersion();
      // We're running this test on Node 18+, so it should pass
      expect(result.ok).toBe(true);
      expect(result.current.major).toBeGreaterThanOrEqual(REQUIRED_NODE_VERSION.major);
    });

    it('includes install method and platform', () => {
      const result = checkNodeVersion();
      expect(['brew', 'nvm', 'fnm', 'volta', 'asdf', 'system', 'unknown']).toContain(
        result.installMethod
      );
      expect(result.platform).toBe(process.platform);
    });

    it('does not include instructions when version is ok', () => {
      const result = checkNodeVersion();
      if (result.ok) {
        expect(result.instructions).toBeUndefined();
      }
    });
  });

  describe('constants', () => {
    it('has correct required Node version', () => {
      expect(REQUIRED_NODE_VERSION.major).toBe(18);
      expect(REQUIRED_NODE_VERSION.minor).toBe(0);
      expect(REQUIRED_NODE_VERSION.patch).toBe(0);
    });

    it('has correct exit code', () => {
      expect(EXIT_CODE_NODE_VERSION).toBe(10);
    });
  });
});
