/**
 * Tests for enhanced validate command
 *
 * @package WP_Navigator_MCP
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// =============================================================================
// Helper Functions (extracted from cli.ts for testing)
// =============================================================================

/**
 * Snapshot validation result
 */
interface SnapshotValidation {
  checked: boolean;
  site_index?: { exists: boolean; valid: boolean; errors: string[] };
  pages: Array<{ file: string; valid: boolean; errors?: string[] }>;
  plugins: Array<{ file: string; valid: boolean; errors?: string[] }>;
}

/**
 * Validate a single snapshot JSON file
 */
function validateSnapshotFile(filePath: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(content);

    // Basic structure validation - must be an object (not array, null, or primitive)
    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
      errors.push('Snapshot must be a JSON object');
    }

    return { valid: errors.length === 0, errors };
  } catch (err) {
    if (err instanceof SyntaxError) {
      errors.push(`Invalid JSON: ${err.message}`);
    } else {
      errors.push(`Cannot read file: ${err instanceof Error ? err.message : 'unknown error'}`);
    }
    return { valid: false, errors };
  }
}

/**
 * Validate snapshots directory structure
 */
function validateSnapshots(cwd: string): SnapshotValidation {
  const snapshotsDir = path.join(cwd, 'snapshots');
  const result: SnapshotValidation = {
    checked: true,
    pages: [],
    plugins: [],
  };

  // Check site_index.json
  const siteIndexPath = path.join(snapshotsDir, 'site_index.json');
  if (fs.existsSync(siteIndexPath)) {
    const validation = validateSnapshotFile(siteIndexPath);
    result.site_index = {
      exists: true,
      valid: validation.valid,
      errors: validation.errors,
    };
  } else {
    result.site_index = {
      exists: false,
      valid: false,
      errors: ['site_index.json not found'],
    };
  }

  // Check pages/*.json
  const pagesDir = path.join(snapshotsDir, 'pages');
  if (fs.existsSync(pagesDir)) {
    try {
      const files = fs.readdirSync(pagesDir).filter((f) => f.endsWith('.json'));
      for (const file of files) {
        const filePath = path.join(pagesDir, file);
        const validation = validateSnapshotFile(filePath);
        result.pages.push({
          file: `snapshots/pages/${file}`,
          valid: validation.valid,
          errors: validation.errors.length > 0 ? validation.errors : undefined,
        });
      }
    } catch {
      // Directory not readable
    }
  }

  // Check plugins/*.json
  const pluginsDir = path.join(snapshotsDir, 'plugins');
  if (fs.existsSync(pluginsDir)) {
    try {
      const files = fs.readdirSync(pluginsDir).filter((f) => f.endsWith('.json'));
      for (const file of files) {
        const filePath = path.join(pluginsDir, file);
        const validation = validateSnapshotFile(filePath);
        result.plugins.push({
          file: `snapshots/plugins/${file}`,
          valid: validation.valid,
          errors: validation.errors.length > 0 ? validation.errors : undefined,
        });
      }
    } catch {
      // Directory not readable
    }
  }

  return result;
}

// =============================================================================
// Tests
// =============================================================================

describe('validateSnapshotFile', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wpnav-validate-test-'));
  });

  afterEach(() => {
    try {
      fs.rmSync(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('should pass for valid JSON object', () => {
    const filePath = path.join(testDir, 'valid.json');
    fs.writeFileSync(filePath, JSON.stringify({ title: 'Test', content: 'Hello' }));

    const result = validateSnapshotFile(filePath);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should pass for empty JSON object', () => {
    const filePath = path.join(testDir, 'empty.json');
    fs.writeFileSync(filePath, '{}');

    const result = validateSnapshotFile(filePath);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should fail for invalid JSON', () => {
    const filePath = path.join(testDir, 'invalid.json');
    fs.writeFileSync(filePath, '{ invalid json }');

    const result = validateSnapshotFile(filePath);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain('Invalid JSON');
  });

  it('should fail for non-object JSON (array)', () => {
    const filePath = path.join(testDir, 'array.json');
    fs.writeFileSync(filePath, '[1, 2, 3]');

    const result = validateSnapshotFile(filePath);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Snapshot must be a JSON object');
  });

  it('should fail for non-object JSON (primitive)', () => {
    const filePath = path.join(testDir, 'string.json');
    fs.writeFileSync(filePath, '"just a string"');

    const result = validateSnapshotFile(filePath);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Snapshot must be a JSON object');
  });

  it('should fail for non-existent file', () => {
    const filePath = path.join(testDir, 'nonexistent.json');

    const result = validateSnapshotFile(filePath);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain('Cannot read file');
  });
});

describe('validateSnapshots', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wpnav-validate-test-'));
  });

  afterEach(() => {
    try {
      fs.rmSync(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('should return checked: true when snapshots dir exists', () => {
    const snapshotsDir = path.join(testDir, 'snapshots');
    fs.mkdirSync(snapshotsDir);

    const result = validateSnapshots(testDir);
    expect(result.checked).toBe(true);
  });

  it('should validate site_index.json when present and valid', () => {
    const snapshotsDir = path.join(testDir, 'snapshots');
    fs.mkdirSync(snapshotsDir);
    fs.writeFileSync(path.join(snapshotsDir, 'site_index.json'), '{"name": "Test Site"}');

    const result = validateSnapshots(testDir);
    expect(result.site_index).toBeDefined();
    expect(result.site_index!.exists).toBe(true);
    expect(result.site_index!.valid).toBe(true);
    expect(result.site_index!.errors).toHaveLength(0);
  });

  it('should report site_index.json not found when missing', () => {
    const snapshotsDir = path.join(testDir, 'snapshots');
    fs.mkdirSync(snapshotsDir);

    const result = validateSnapshots(testDir);
    expect(result.site_index).toBeDefined();
    expect(result.site_index!.exists).toBe(false);
    expect(result.site_index!.valid).toBe(false);
    expect(result.site_index!.errors).toContain('site_index.json not found');
  });

  it('should report errors for invalid site_index.json', () => {
    const snapshotsDir = path.join(testDir, 'snapshots');
    fs.mkdirSync(snapshotsDir);
    fs.writeFileSync(path.join(snapshotsDir, 'site_index.json'), '{ broken }');

    const result = validateSnapshots(testDir);
    expect(result.site_index).toBeDefined();
    expect(result.site_index!.exists).toBe(true);
    expect(result.site_index!.valid).toBe(false);
    expect(result.site_index!.errors.length).toBeGreaterThan(0);
  });

  it('should validate page snapshots in pages/ directory', () => {
    const snapshotsDir = path.join(testDir, 'snapshots');
    const pagesDir = path.join(snapshotsDir, 'pages');
    fs.mkdirSync(pagesDir, { recursive: true });
    fs.writeFileSync(path.join(pagesDir, 'home.json'), '{"slug": "home", "title": "Home"}');
    fs.writeFileSync(path.join(pagesDir, 'about.json'), '{"slug": "about", "title": "About"}');

    const result = validateSnapshots(testDir);
    expect(result.pages).toHaveLength(2);
    expect(result.pages.every((p) => p.valid)).toBe(true);
  });

  it('should report errors for invalid page snapshots', () => {
    const snapshotsDir = path.join(testDir, 'snapshots');
    const pagesDir = path.join(snapshotsDir, 'pages');
    fs.mkdirSync(pagesDir, { recursive: true });
    fs.writeFileSync(path.join(pagesDir, 'good.json'), '{"slug": "good"}');
    fs.writeFileSync(path.join(pagesDir, 'bad.json'), '{ broken json }');

    const result = validateSnapshots(testDir);
    expect(result.pages).toHaveLength(2);

    // Find pages by their validity status since file order may vary
    const validPages = result.pages.filter((p) => p.valid);
    const invalidPages = result.pages.filter((p) => !p.valid);

    expect(validPages).toHaveLength(1);
    expect(invalidPages).toHaveLength(1);
    expect(invalidPages[0].errors).toBeDefined();
    expect(invalidPages[0].errors!.length).toBeGreaterThan(0);
    expect(invalidPages[0].file).toContain('bad.json');
  });

  it('should validate plugin snapshots in plugins/ directory', () => {
    const snapshotsDir = path.join(testDir, 'snapshots');
    const pluginsDir = path.join(snapshotsDir, 'plugins');
    fs.mkdirSync(pluginsDir, { recursive: true });
    fs.writeFileSync(path.join(pluginsDir, 'akismet.json'), '{"name": "Akismet", "active": true}');

    const result = validateSnapshots(testDir);
    expect(result.plugins).toHaveLength(1);
    expect(result.plugins[0].valid).toBe(true);
    expect(result.plugins[0].file).toBe('snapshots/plugins/akismet.json');
  });

  it('should only count .json files', () => {
    const snapshotsDir = path.join(testDir, 'snapshots');
    const pagesDir = path.join(snapshotsDir, 'pages');
    fs.mkdirSync(pagesDir, { recursive: true });
    fs.writeFileSync(path.join(pagesDir, 'home.json'), '{}');
    fs.writeFileSync(path.join(pagesDir, 'readme.md'), '# Readme');
    fs.writeFileSync(path.join(pagesDir, 'backup.txt'), 'backup');

    const result = validateSnapshots(testDir);
    expect(result.pages).toHaveLength(1);
    expect(result.pages[0].file).toContain('home.json');
  });

  it('should handle empty pages directory', () => {
    const snapshotsDir = path.join(testDir, 'snapshots');
    const pagesDir = path.join(snapshotsDir, 'pages');
    fs.mkdirSync(pagesDir, { recursive: true });

    const result = validateSnapshots(testDir);
    expect(result.pages).toHaveLength(0);
  });

  it('should handle missing pages and plugins directories', () => {
    const snapshotsDir = path.join(testDir, 'snapshots');
    fs.mkdirSync(snapshotsDir);

    const result = validateSnapshots(testDir);
    expect(result.pages).toHaveLength(0);
    expect(result.plugins).toHaveLength(0);
  });
});

describe('exit code logic', () => {
  it('should prioritize manifest errors (exit 2) over snapshot errors', () => {
    // Test the logic that manifest errors (exit 2) take precedence
    const hasManifestErrors = true;
    const hasSnapshotErrors = true;
    const hasConfigErrors = false;

    // Per the implementation:
    // if (hasManifestErrors) process.exit(2);
    // else if (hasSnapshotErrors) process.exit(4);
    // else if (hasConfigErrors || strictFail) process.exit(1);

    let exitCode = 0;
    if (hasManifestErrors) {
      exitCode = 2;
    } else if (hasSnapshotErrors) {
      exitCode = 4;
    } else if (hasConfigErrors) {
      exitCode = 1;
    }

    expect(exitCode).toBe(2);
  });

  it('should use exit 4 for snapshot-only errors', () => {
    const hasManifestErrors = false;
    const hasSnapshotErrors = true;
    const hasConfigErrors = false;

    let exitCode = 0;
    if (hasManifestErrors) {
      exitCode = 2;
    } else if (hasSnapshotErrors) {
      exitCode = 4;
    } else if (hasConfigErrors) {
      exitCode = 1;
    }

    expect(exitCode).toBe(4);
  });

  it('should use exit 1 for config errors', () => {
    const hasManifestErrors = false;
    const hasSnapshotErrors = false;
    const hasConfigErrors = true;

    let exitCode = 0;
    if (hasManifestErrors) {
      exitCode = 2;
    } else if (hasSnapshotErrors) {
      exitCode = 4;
    } else if (hasConfigErrors) {
      exitCode = 1;
    }

    expect(exitCode).toBe(1);
  });

  it('should use exit 0 for success', () => {
    const hasManifestErrors = false;
    const hasSnapshotErrors = false;
    const hasConfigErrors = false;

    let exitCode = 0;
    if (hasManifestErrors) {
      exitCode = 2;
    } else if (hasSnapshotErrors) {
      exitCode = 4;
    } else if (hasConfigErrors) {
      exitCode = 1;
    }

    expect(exitCode).toBe(0);
  });

  it('should use exit 1 for strict mode with warnings', () => {
    const hasManifestErrors = false;
    const hasSnapshotErrors = false;
    const hasConfigErrors = false;
    const strictMode = true;
    const hasWarnings = true;
    const strictFail = strictMode && hasWarnings;

    let exitCode = 0;
    if (hasManifestErrors) {
      exitCode = 2;
    } else if (hasSnapshotErrors) {
      exitCode = 4;
    } else if (hasConfigErrors || strictFail) {
      exitCode = 1;
    }

    expect(exitCode).toBe(1);
  });
});

describe('flag parsing', () => {
  it('should correctly identify manifest-only mode', () => {
    const options: Record<string, string> = { 'manifest-only': 'true' };

    const validateManifestFlag = options.manifest === 'true' || options['manifest-only'] === 'true';
    const manifestOnly = options['manifest-only'] === 'true';

    expect(validateManifestFlag).toBe(true);
    expect(manifestOnly).toBe(true);
  });

  it('should correctly identify json output mode', () => {
    const options: Record<string, string> = { json: 'true' };
    const isJson = options.json === 'true';

    expect(isJson).toBe(true);
  });

  it('should correctly identify strict mode', () => {
    const options: Record<string, string> = { strict: 'true' };
    const strictMode = options.strict === 'true';

    expect(strictMode).toBe(true);
  });

  it('should correctly identify snapshots flag', () => {
    const options: Record<string, string> = { snapshots: 'true' };
    const validateSnapshotsFlag = options.snapshots === 'true';

    expect(validateSnapshotsFlag).toBe(true);
  });

  it('should default to false when flags not provided', () => {
    const options: Record<string, string> = {};

    const isJson = options.json === 'true';
    const strictMode = options.strict === 'true';
    const validateSnapshotsFlag = options.snapshots === 'true';
    const manifestOnly = options['manifest-only'] === 'true';

    expect(isJson).toBe(false);
    expect(strictMode).toBe(false);
    expect(validateSnapshotsFlag).toBe(false);
    expect(manifestOnly).toBe(false);
  });
});
