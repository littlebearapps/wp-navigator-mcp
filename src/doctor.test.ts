/**
 * Tests for doctor command utilities
 *
 * @package WP_Navigator_MCP
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// =============================================================================
// Helper Functions (extracted for testing)
// =============================================================================

/**
 * Parse existing .wpnav.env file
 */
function parseWpnavEnv(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eqIndex = trimmed.indexOf('=');
    if (eqIndex > 0) {
      const key = trimmed.slice(0, eqIndex).trim();
      let value = trimmed.slice(eqIndex + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      result[key] = value;
    }
  }

  return result;
}

/**
 * Diagnostic check result
 */
interface DiagnosticCheck {
  name: string;
  label: string;
  status: 'pass' | 'fail' | 'warn' | 'skip';
  message: string;
  details?: Record<string, unknown>;
  fix?: string;
}

/**
 * Check .wpnav.env file presence and validity
 */
function checkEnvFile(cwd: string): DiagnosticCheck {
  const envFilePath = path.join(cwd, '.wpnav.env');
  const envFileExists = fs.existsSync(envFilePath);

  if (envFileExists) {
    try {
      const content = fs.readFileSync(envFilePath, 'utf8');
      const parsed = parseWpnavEnv(content);
      const hasRequiredKeys = parsed.WP_BASE_URL && parsed.WP_APP_USER && parsed.WP_APP_PASS;

      if (hasRequiredKeys) {
        return {
          name: 'env_file',
          label: '.wpnav.env',
          status: 'pass',
          message: 'Credentials file found and valid',
          details: { path: envFilePath, site: parsed.WP_BASE_URL },
        };
      } else {
        return {
          name: 'env_file',
          label: '.wpnav.env',
          status: 'warn',
          message: 'Credentials file missing required keys',
          details: {
            hasUrl: !!parsed.WP_BASE_URL,
            hasUser: !!parsed.WP_APP_USER,
            hasPass: !!parsed.WP_APP_PASS,
          },
          fix: 'npx wpnav configure',
        };
      }
    } catch (err) {
      return {
        name: 'env_file',
        label: '.wpnav.env',
        status: 'fail',
        message: `Cannot read credentials file: ${err instanceof Error ? err.message : 'unknown error'}`,
        fix: 'npx wpnav configure',
      };
    }
  } else {
    return {
      name: 'env_file',
      label: '.wpnav.env',
      status: 'fail',
      message: 'Credentials file not found',
      fix: 'npx wpnav configure',
    };
  }
}

/**
 * Check snapshots directory
 */
function checkSnapshotsDir(cwd: string): DiagnosticCheck {
  const snapshotsDir = path.join(cwd, 'snapshots');
  const snapshotsDirExists = fs.existsSync(snapshotsDir);

  if (snapshotsDirExists) {
    try {
      const files = fs.readdirSync(snapshotsDir);
      const jsonFiles = files.filter((f) => f.endsWith('.json'));

      if (jsonFiles.length > 0) {
        return {
          name: 'snapshots',
          label: 'Snapshots Directory',
          status: 'pass',
          message: `${jsonFiles.length} snapshot file(s) found`,
          details: {
            path: snapshotsDir,
            count: jsonFiles.length,
            files: jsonFiles.slice(0, 5),
          },
        };
      } else {
        return {
          name: 'snapshots',
          label: 'Snapshots Directory',
          status: 'warn',
          message: 'Directory exists but no snapshots found',
          details: { path: snapshotsDir },
          fix: 'npx wpnav call wpnav_snapshot_page --slug home',
        };
      }
    } catch (err) {
      return {
        name: 'snapshots',
        label: 'Snapshots Directory',
        status: 'fail',
        message: `Cannot read snapshots directory: ${err instanceof Error ? err.message : 'unknown'}`,
      };
    }
  } else {
    return {
      name: 'snapshots',
      label: 'Snapshots Directory',
      status: 'warn',
      message: 'Snapshots directory not found (optional)',
      details: { expectedPath: snapshotsDir },
      fix: 'mkdir snapshots',
    };
  }
}

/**
 * Get status symbol for check result
 */
function getStatusSymbol(status: DiagnosticCheck['status']): string {
  switch (status) {
    case 'pass':
      return '✔';
    case 'fail':
      return '✖';
    case 'warn':
      return '⚠';
    case 'skip':
      return '○';
  }
}

// =============================================================================
// Tests
// =============================================================================

describe('checkEnvFile', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wpnav-doctor-test-'));
  });

  afterEach(() => {
    try {
      fs.rmSync(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('should pass when .wpnav.env exists with all required keys', () => {
    const envContent = `WP_BASE_URL=https://example.com
WP_APP_USER=admin
WP_APP_PASS=xxxx xxxx xxxx xxxx`;
    fs.writeFileSync(path.join(testDir, '.wpnav.env'), envContent);

    const result = checkEnvFile(testDir);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('valid');
  });

  it('should warn when .wpnav.env missing required keys', () => {
    const envContent = `WP_BASE_URL=https://example.com
WP_APP_USER=admin`;
    fs.writeFileSync(path.join(testDir, '.wpnav.env'), envContent);

    const result = checkEnvFile(testDir);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('missing required keys');
    expect(result.fix).toBe('npx wpnav configure');
  });

  it('should fail when .wpnav.env does not exist', () => {
    const result = checkEnvFile(testDir);
    expect(result.status).toBe('fail');
    expect(result.message).toContain('not found');
    expect(result.fix).toBe('npx wpnav configure');
  });
});

describe('checkSnapshotsDir', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wpnav-doctor-test-'));
  });

  afterEach(() => {
    try {
      fs.rmSync(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('should pass when snapshots directory has JSON files', () => {
    const snapshotsDir = path.join(testDir, 'snapshots');
    fs.mkdirSync(snapshotsDir);
    fs.writeFileSync(path.join(snapshotsDir, 'home.json'), '{}');
    fs.writeFileSync(path.join(snapshotsDir, 'about.json'), '{}');

    const result = checkSnapshotsDir(testDir);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('2 snapshot file(s)');
    expect(result.details?.count).toBe(2);
  });

  it('should warn when snapshots directory is empty', () => {
    const snapshotsDir = path.join(testDir, 'snapshots');
    fs.mkdirSync(snapshotsDir);

    const result = checkSnapshotsDir(testDir);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('no snapshots found');
  });

  it('should warn when snapshots directory does not exist', () => {
    const result = checkSnapshotsDir(testDir);
    expect(result.status).toBe('warn');
    expect(result.message).toContain('not found');
    expect(result.fix).toBe('mkdir snapshots');
  });

  it('should only count .json files', () => {
    const snapshotsDir = path.join(testDir, 'snapshots');
    fs.mkdirSync(snapshotsDir);
    fs.writeFileSync(path.join(snapshotsDir, 'home.json'), '{}');
    fs.writeFileSync(path.join(snapshotsDir, 'readme.md'), '# Snapshots');
    fs.writeFileSync(path.join(snapshotsDir, 'backup.txt'), 'backup');

    const result = checkSnapshotsDir(testDir);
    expect(result.status).toBe('pass');
    expect(result.message).toContain('1 snapshot file(s)');
    expect(result.details?.count).toBe(1);
  });
});

describe('getStatusSymbol', () => {
  it('should return correct symbols for each status', () => {
    expect(getStatusSymbol('pass')).toBe('✔');
    expect(getStatusSymbol('fail')).toBe('✖');
    expect(getStatusSymbol('warn')).toBe('⚠');
    expect(getStatusSymbol('skip')).toBe('○');
  });
});

describe('DiagnosticCheck interface', () => {
  it('should allow valid check objects', () => {
    const check: DiagnosticCheck = {
      name: 'test_check',
      label: 'Test Check',
      status: 'pass',
      message: 'Test passed',
      details: { key: 'value' },
      fix: 'npx wpnav test',
    };

    expect(check.name).toBe('test_check');
    expect(check.label).toBe('Test Check');
    expect(check.status).toBe('pass');
  });

  it('should allow check without optional fields', () => {
    const check: DiagnosticCheck = {
      name: 'minimal',
      label: 'Minimal Check',
      status: 'skip',
      message: 'Skipped',
    };

    expect(check.details).toBeUndefined();
    expect(check.fix).toBeUndefined();
  });
});

describe('summary calculation', () => {
  it('should count check statuses correctly', () => {
    const checks: DiagnosticCheck[] = [
      { name: 'a', label: 'A', status: 'pass', message: 'ok' },
      { name: 'b', label: 'B', status: 'pass', message: 'ok' },
      { name: 'c', label: 'C', status: 'fail', message: 'failed' },
      { name: 'd', label: 'D', status: 'warn', message: 'warning' },
      { name: 'e', label: 'E', status: 'skip', message: 'skipped' },
    ];

    const passCount = checks.filter((c) => c.status === 'pass').length;
    const failCount = checks.filter((c) => c.status === 'fail').length;
    const warnCount = checks.filter((c) => c.status === 'warn').length;
    const skipCount = checks.filter((c) => c.status === 'skip').length;

    expect(passCount).toBe(2);
    expect(failCount).toBe(1);
    expect(warnCount).toBe(1);
    expect(skipCount).toBe(1);
  });

  it('should determine success based on fail count', () => {
    const checksAllPass: DiagnosticCheck[] = [
      { name: 'a', label: 'A', status: 'pass', message: 'ok' },
      { name: 'b', label: 'B', status: 'warn', message: 'ok' },
    ];

    const checksWithFail: DiagnosticCheck[] = [
      { name: 'a', label: 'A', status: 'pass', message: 'ok' },
      { name: 'b', label: 'B', status: 'fail', message: 'failed' },
    ];

    const successAllPass = checksAllPass.filter((c) => c.status === 'fail').length === 0;
    const successWithFail = checksWithFail.filter((c) => c.status === 'fail').length === 0;

    expect(successAllPass).toBe(true);
    expect(successWithFail).toBe(false);
  });
});
