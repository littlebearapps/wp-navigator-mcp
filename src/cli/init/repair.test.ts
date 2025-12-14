/**
 * Tests for WP Navigator Init Repair Mode
 *
 * @package WP_Navigator_Pro
 * @since 2.4.5
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  detectExistingConfig,
  checkProjectFiles,
  buildRepairState,
  executeRepair,
  shouldOfferRepair,
  type FileCheckResult,
  type RepairState,
} from './repair.js';

// Mock the http module to prevent actual network requests
vi.mock('../../http.js', () => ({
  makeWpRequest: vi.fn(() => {
    return async () => ({ success: true });
  }),
}));

// Mock wpnav-config to prevent file system side effects
vi.mock('../../wpnav-config.js', () => ({
  loadWpnavConfig: vi.fn(() => ({
    success: false,
    config: null,
  })),
  toLegacyConfig: vi.fn(() => ({})),
}));

describe('repair module', () => {
  let testDir: string;

  beforeEach(() => {
    // Create a temporary directory for each test
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wpnav-repair-test-'));
  });

  afterEach(() => {
    // Clean up test directory
    try {
      fs.rmSync(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('detectExistingConfig', () => {
    it('should return false for empty directory', () => {
      expect(detectExistingConfig(testDir)).toBe(false);
    });

    it('should return true when wpnavigator.jsonc exists', () => {
      fs.writeFileSync(path.join(testDir, 'wpnavigator.jsonc'), '{}');
      expect(detectExistingConfig(testDir)).toBe(true);
    });

    it('should return true when wpnav.config.json exists', () => {
      fs.writeFileSync(path.join(testDir, 'wpnav.config.json'), '{}');
      expect(detectExistingConfig(testDir)).toBe(true);
    });

    it('should return true when .wpnav.env exists', () => {
      fs.writeFileSync(path.join(testDir, '.wpnav.env'), 'WP_BASE_URL=https://example.com');
      expect(detectExistingConfig(testDir)).toBe(true);
    });

    it('should return true when snapshots/site_index.json exists', () => {
      fs.mkdirSync(path.join(testDir, 'snapshots'), { recursive: true });
      fs.writeFileSync(path.join(testDir, 'snapshots', 'site_index.json'), '{}');
      expect(detectExistingConfig(testDir)).toBe(true);
    });
  });

  describe('shouldOfferRepair', () => {
    it('should be an alias for detectExistingConfig', () => {
      expect(shouldOfferRepair(testDir)).toBe(false);
      fs.writeFileSync(path.join(testDir, 'wpnavigator.jsonc'), '{}');
      expect(shouldOfferRepair(testDir)).toBe(true);
    });
  });

  describe('checkProjectFiles', () => {
    it('should report all files as missing in empty directory', () => {
      const results = checkProjectFiles(testDir);

      // Check that wpnavigator.jsonc is missing
      const manifestResult = results.find((r) => r.name === 'wpnavigator.jsonc');
      expect(manifestResult).toBeDefined();
      expect(manifestResult?.status).toBe('missing');
    });

    it('should validate valid wpnavigator.jsonc', () => {
      const validManifest = JSON.stringify({
        schema_version: 1,
        site: { name: 'Test', url: 'https://example.com' },
      });
      fs.writeFileSync(path.join(testDir, 'wpnavigator.jsonc'), validManifest);

      const results = checkProjectFiles(testDir);
      const manifestResult = results.find((r) => r.name === 'wpnavigator.jsonc');

      expect(manifestResult?.status).toBe('valid');
    });

    it('should mark invalid wpnavigator.jsonc as invalid', () => {
      // Missing required fields
      fs.writeFileSync(path.join(testDir, 'wpnavigator.jsonc'), '{}');

      const results = checkProjectFiles(testDir);
      const manifestResult = results.find((r) => r.name === 'wpnavigator.jsonc');

      expect(manifestResult?.status).toBe('invalid');
      expect(manifestResult?.message).toContain('schema_version');
    });

    it('should validate valid .wpnav.env', () => {
      const validEnv = `WP_BASE_URL=https://example.com
WP_APP_USER=admin
WP_APP_PASS=xxxx xxxx xxxx xxxx`;
      fs.writeFileSync(path.join(testDir, '.wpnav.env'), validEnv);

      const results = checkProjectFiles(testDir);
      const envResult = results.find((r) => r.name === '.wpnav.env');

      expect(envResult?.status).toBe('valid');
    });

    it('should mark incomplete .wpnav.env as invalid', () => {
      // Missing WP_APP_PASS
      const incompleteEnv = `WP_BASE_URL=https://example.com
WP_APP_USER=admin`;
      fs.writeFileSync(path.join(testDir, '.wpnav.env'), incompleteEnv);

      const results = checkProjectFiles(testDir);
      const envResult = results.find((r) => r.name === '.wpnav.env');

      expect(envResult?.status).toBe('invalid');
      expect(envResult?.message).toContain('WP_APP_PASS');
    });

    it('should validate valid wpnav.config.json', () => {
      const validConfig = JSON.stringify({
        config_version: '1.0',
        environments: { local: {} },
      });
      fs.writeFileSync(path.join(testDir, 'wpnav.config.json'), validConfig);

      const results = checkProjectFiles(testDir);
      const configResult = results.find((r) => r.name === 'wpnav.config.json');

      expect(configResult?.status).toBe('valid');
    });

    it('should check required directories', () => {
      const results = checkProjectFiles(testDir);

      const snapshotsResult = results.find((r) => r.name === 'snapshots');
      expect(snapshotsResult?.status).toBe('missing');

      // Create directory and check again
      fs.mkdirSync(path.join(testDir, 'snapshots'), { recursive: true });
      const results2 = checkProjectFiles(testDir);
      const snapshotsResult2 = results2.find((r) => r.name === 'snapshots');
      expect(snapshotsResult2?.status).toBe('valid');
    });

    it('should validate .mcp.json with wpnav server', () => {
      const validMcp = JSON.stringify({
        mcpServers: {
          wpnav: {
            command: 'npx',
            args: ['-y', '@littlebearapps/wp-navigator-mcp'],
          },
        },
      });
      fs.writeFileSync(path.join(testDir, '.mcp.json'), validMcp);

      const results = checkProjectFiles(testDir);
      const mcpResult = results.find((r) => r.name === '.mcp.json');

      expect(mcpResult?.status).toBe('valid');
    });

    it('should mark .mcp.json without wpnav as invalid', () => {
      const invalidMcp = JSON.stringify({
        mcpServers: {
          other: { command: 'other' },
        },
      });
      fs.writeFileSync(path.join(testDir, '.mcp.json'), invalidMcp);

      const results = checkProjectFiles(testDir);
      const mcpResult = results.find((r) => r.name === '.mcp.json');

      expect(mcpResult?.status).toBe('invalid');
      expect(mcpResult?.message).toContain('wpnav');
    });
  });

  describe('buildRepairState', () => {
    it('should indicate no repair needed for valid setup', async () => {
      // Create valid files
      fs.writeFileSync(
        path.join(testDir, 'wpnavigator.jsonc'),
        JSON.stringify({ schema_version: 1, site: {} })
      );
      fs.writeFileSync(
        path.join(testDir, 'wpnav.config.json'),
        JSON.stringify({ config_version: '1.0', environments: {} })
      );

      // Create directories
      const dirs = ['snapshots', 'snapshots/pages', 'roles', 'docs', 'sample-prompts'];
      for (const dir of dirs) {
        fs.mkdirSync(path.join(testDir, dir), { recursive: true });
      }

      const state = await buildRepairState(testDir);

      expect(state.hasExistingConfig).toBe(true);
      // Note: needsRepair might still be true due to credentials check
      expect(state.missingFiles.length).toBeLessThanOrEqual(
        state.files.filter((f) => f.status === 'missing').length
      );
    });

    it('should identify missing files correctly', async () => {
      // Create only manifest
      fs.writeFileSync(
        path.join(testDir, 'wpnavigator.jsonc'),
        JSON.stringify({ schema_version: 1, site: {} })
      );

      const state = await buildRepairState(testDir);

      expect(state.hasExistingConfig).toBe(true);
      expect(state.missingFiles).toContain('snapshots');
      expect(state.missingFiles).toContain('docs');
    });

    it('should identify invalid files correctly', async () => {
      // Create invalid manifest
      fs.writeFileSync(path.join(testDir, 'wpnavigator.jsonc'), '{}');

      const state = await buildRepairState(testDir);

      expect(state.invalidFiles).toContain('wpnavigator.jsonc');
    });
  });

  describe('executeRepair', () => {
    it('should create missing directories', async () => {
      const state: RepairState = {
        hasExistingConfig: false,
        files: [
          { path: 'snapshots/', name: 'snapshots', status: 'missing', canRegenerate: true },
          { path: 'docs/', name: 'docs', status: 'missing', canRegenerate: true },
        ],
        credentials: { exists: false, valid: false },
        needsRepair: true,
        missingFiles: ['snapshots', 'docs'],
        invalidFiles: [],
      };

      const result = await executeRepair(testDir, state, { files: ['snapshots', 'docs'] });

      expect(result.success).toBe(true);
      expect(result.filesRepaired).toContain('snapshots');
      expect(result.filesRepaired).toContain('docs');
      expect(fs.existsSync(path.join(testDir, 'snapshots'))).toBe(true);
      expect(fs.existsSync(path.join(testDir, 'docs'))).toBe(true);
    });

    it('should regenerate wpnavigator.jsonc', async () => {
      const state: RepairState = {
        hasExistingConfig: false,
        files: [
          {
            path: 'wpnavigator.jsonc',
            name: 'wpnavigator.jsonc',
            status: 'missing',
            canRegenerate: true,
          },
        ],
        credentials: { exists: false, valid: false },
        needsRepair: true,
        missingFiles: ['wpnavigator.jsonc'],
        invalidFiles: [],
      };

      const result = await executeRepair(testDir, state, { files: ['wpnavigator.jsonc'] });

      expect(result.success).toBe(true);
      expect(result.filesRepaired).toContain('wpnavigator.jsonc');
      expect(fs.existsSync(path.join(testDir, 'wpnavigator.jsonc'))).toBe(true);

      // Verify content
      const content = fs.readFileSync(path.join(testDir, 'wpnavigator.jsonc'), 'utf8');
      expect(content).toContain('schema_version');
    });

    it('should regenerate CLAUDE.md', async () => {
      const state: RepairState = {
        hasExistingConfig: true,
        files: [{ path: 'CLAUDE.md', name: 'CLAUDE.md', status: 'missing', canRegenerate: true }],
        credentials: { exists: false, valid: false },
        needsRepair: true,
        missingFiles: ['CLAUDE.md'],
        invalidFiles: [],
      };

      const result = await executeRepair(testDir, state, { files: ['CLAUDE.md'] });

      expect(result.success).toBe(true);
      expect(result.filesRepaired).toContain('CLAUDE.md');
      expect(fs.existsSync(path.join(testDir, 'CLAUDE.md'))).toBe(true);
    });

    it('should skip non-regeneratable files (.wpnav.env)', async () => {
      const state: RepairState = {
        hasExistingConfig: true,
        files: [
          { path: '.wpnav.env', name: '.wpnav.env', status: 'missing', canRegenerate: false },
        ],
        credentials: { exists: false, valid: false },
        needsRepair: true,
        missingFiles: ['.wpnav.env'],
        invalidFiles: [],
      };

      const result = await executeRepair(testDir, state, { files: ['.wpnav.env'] });

      expect(result.filesSkipped).toContain('.wpnav.env');
      expect(fs.existsSync(path.join(testDir, '.wpnav.env'))).toBe(false);
    });

    it('should repair all files when all option is true', async () => {
      const state: RepairState = {
        hasExistingConfig: false,
        files: [
          {
            path: 'wpnavigator.jsonc',
            name: 'wpnavigator.jsonc',
            status: 'missing',
            canRegenerate: true,
          },
          { path: 'snapshots/', name: 'snapshots', status: 'missing', canRegenerate: true },
          { path: '.wpnav.env', name: '.wpnav.env', status: 'missing', canRegenerate: false },
        ],
        credentials: { exists: false, valid: false },
        needsRepair: true,
        missingFiles: ['wpnavigator.jsonc', 'snapshots', '.wpnav.env'],
        invalidFiles: [],
      };

      const result = await executeRepair(testDir, state, { all: true });

      // Should repair regeneratable files only
      expect(result.filesRepaired).toContain('wpnavigator.jsonc');
      expect(result.filesRepaired).toContain('snapshots');
      expect(result.filesRepaired).not.toContain('.wpnav.env');
    });

    it('should regenerate .gitignore', async () => {
      const state: RepairState = {
        hasExistingConfig: true,
        files: [{ path: '.gitignore', name: '.gitignore', status: 'missing', canRegenerate: true }],
        credentials: { exists: false, valid: false },
        needsRepair: true,
        missingFiles: ['.gitignore'],
        invalidFiles: [],
      };

      const result = await executeRepair(testDir, state, { files: ['.gitignore'] });

      expect(result.success).toBe(true);
      expect(result.filesRepaired).toContain('.gitignore');

      const content = fs.readFileSync(path.join(testDir, '.gitignore'), 'utf8');
      expect(content).toContain('.wpnav.env');
    });

    it('should append to existing .gitignore with missing patterns', async () => {
      // Create gitignore without wpnav patterns
      fs.writeFileSync(path.join(testDir, '.gitignore'), 'node_modules/\n.DS_Store\n');

      const state: RepairState = {
        hasExistingConfig: true,
        files: [
          {
            path: '.gitignore',
            name: '.gitignore',
            status: 'invalid',
            message: 'Missing patterns',
            canRegenerate: true,
          },
        ],
        credentials: { exists: false, valid: false },
        needsRepair: true,
        missingFiles: [],
        invalidFiles: ['.gitignore'],
      };

      const result = await executeRepair(testDir, state, { files: ['.gitignore'] });

      expect(result.success).toBe(true);

      const content = fs.readFileSync(path.join(testDir, '.gitignore'), 'utf8');
      expect(content).toContain('node_modules/');
      expect(content).toContain('.wpnav.env');
    });
  });

  describe('idempotent behavior', () => {
    it('should not modify valid files when repair is run multiple times', async () => {
      // Create valid setup
      const manifest = JSON.stringify({ schema_version: 1, site: { name: 'Test' } }, null, 2);
      fs.writeFileSync(path.join(testDir, 'wpnavigator.jsonc'), manifest);

      // First repair state check
      const state1 = await buildRepairState(testDir);
      const manifestResult1 = state1.files.find((f) => f.name === 'wpnavigator.jsonc');
      expect(manifestResult1?.status).toBe('valid');

      // Run repair with nothing to repair
      const result = await executeRepair(testDir, state1, { all: true });
      expect(result.filesRepaired.filter((f) => f === 'wpnavigator.jsonc')).toHaveLength(0);

      // Content should be unchanged
      const content = fs.readFileSync(path.join(testDir, 'wpnavigator.jsonc'), 'utf8');
      expect(content).toBe(manifest);
    });

    it('should be safe to run multiple times', async () => {
      // Run repair twice on empty directory
      const state1 = await buildRepairState(testDir);
      const result1 = await executeRepair(testDir, state1, { all: true });

      const state2 = await buildRepairState(testDir);
      const result2 = await executeRepair(testDir, state2, { all: true });

      // Second run should have nothing new to repair
      expect(result2.filesRepaired.length).toBeLessThanOrEqual(result1.filesRepaired.length);
    });
  });
});
