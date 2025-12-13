/**
 * Tests for wpnavigator.jsonc manifest schema and loader
 *
 * @package WP_Navigator_MCP
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  MANIFEST_SCHEMA_VERSION,
  MIN_MANIFEST_VERSION,
  CURRENT_SCHEMA_VERSION,
  stripJsonComments,
  parseJsonc,
  validateManifest,
  loadManifest,
  ManifestValidationError,
  SchemaVersionError,
  getBrandPalette,
  getBrandFonts,
  getBrandLayout,
  getManifestSafety,
  getBackupReminders,
  DEFAULT_BRAND_PALETTE,
  DEFAULT_BRAND_FONTS,
  DEFAULT_BRAND_LAYOUT,
  DEFAULT_MANIFEST_SAFETY,
  DEFAULT_BACKUP_REMINDERS,
  type WPNavManifest,
} from './manifest.js';

// Mock fs module
vi.mock('fs');
const mockFs = vi.mocked(fs);

describe('manifest', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('CURRENT_SCHEMA_VERSION', () => {
    it('should be defined as integer', () => {
      expect(CURRENT_SCHEMA_VERSION).toBe(1);
      expect(Number.isInteger(CURRENT_SCHEMA_VERSION)).toBe(true);
    });

    it('should be >= 1', () => {
      expect(CURRENT_SCHEMA_VERSION).toBeGreaterThanOrEqual(1);
    });
  });

  describe('MANIFEST_SCHEMA_VERSION (legacy)', () => {
    it('should be defined', () => {
      expect(MANIFEST_SCHEMA_VERSION).toBe('1.0');
    });

    it('should be >= MIN_MANIFEST_VERSION', () => {
      const current = MANIFEST_SCHEMA_VERSION.split('.').map(Number);
      const min = MIN_MANIFEST_VERSION.split('.').map(Number);
      expect(current[0]).toBeGreaterThanOrEqual(min[0]);
    });
  });

  describe('stripJsonComments', () => {
    it('should strip single-line comments', () => {
      const input = `{
  "key": "value" // this is a comment
}`;
      const result = stripJsonComments(input);
      expect(result).not.toContain('//');
      expect(result).not.toContain('this is a comment');
      expect(result).toContain('"key": "value"');
    });

    it('should strip multi-line comments', () => {
      const input = `{
  /* this is a
     multi-line comment */
  "key": "value"
}`;
      const result = stripJsonComments(input);
      expect(result).not.toContain('/*');
      expect(result).not.toContain('*/');
      expect(result).not.toContain('multi-line comment');
      expect(result).toContain('"key": "value"');
    });

    it('should preserve strings containing comment-like sequences', () => {
      const input = `{
  "url": "https://example.com",
  "comment": "this has // in it",
  "other": "and /* this */ too"
}`;
      const result = stripJsonComments(input);
      expect(result).toContain('"https://example.com"');
      expect(result).toContain('"this has // in it"');
      expect(result).toContain('"and /* this */ too"');
    });

    it('should handle escaped quotes in strings', () => {
      const input = `{
  "quote": "he said \\"hello\\"" // comment
}`;
      const result = stripJsonComments(input);
      expect(result).toContain('"he said \\"hello\\""');
      expect(result).not.toContain('// comment');
    });

    it('should handle empty input', () => {
      expect(stripJsonComments('')).toBe('');
    });

    it('should handle input with no comments', () => {
      const input = '{"key": "value"}';
      expect(stripJsonComments(input)).toBe(input);
    });

    it('should handle multiple comments', () => {
      const input = `{
  // comment 1
  "a": 1, // inline comment
  /* block
     comment */
  "b": 2
}`;
      const result = stripJsonComments(input);
      expect(result).toContain('"a": 1,');
      expect(result).toContain('"b": 2');
      expect(result).not.toContain('comment 1');
      expect(result).not.toContain('inline comment');
      expect(result).not.toContain('block');
    });
  });

  describe('parseJsonc', () => {
    it('should parse valid JSONC', () => {
      const input = `{
  // Site manifest
  "manifest_version": "1.0",
  "meta": {
    "name": "Test Site" /* inline */
  }
}`;
      const result = parseJsonc<WPNavManifest>(input);
      expect(result.manifest_version).toBe('1.0');
      expect(result.meta.name).toBe('Test Site');
    });

    it('should throw on invalid JSON after stripping comments', () => {
      const input = '{ invalid json }';
      expect(() => parseJsonc(input)).toThrow();
    });
  });

  describe('validateManifest', () => {
    const validManifest: WPNavManifest = {
      schema_version: 1,
      manifest_version: '1.0',
      meta: {
        name: 'Test Site',
      },
    };

    it('should validate a minimal manifest', () => {
      const result = validateManifest(validManifest, '/test/manifest.jsonc');
      expect(result.schema_version).toBe(1);
      expect(result.manifest_version).toBe('1.0');
      expect(result.meta.name).toBe('Test Site');
    });

    it('should throw for non-object input', () => {
      expect(() => validateManifest('string', '/test')).toThrow(ManifestValidationError);
      expect(() => validateManifest(null, '/test')).toThrow(ManifestValidationError);
      expect(() => validateManifest([], '/test')).toThrow(ManifestValidationError);
    });

    // schema_version tests
    it('should throw SchemaVersionError for missing schema_version', () => {
      const manifest = { manifest_version: '1.0', meta: { name: 'Test' } };
      expect(() => validateManifest(manifest, '/test')).toThrow(SchemaVersionError);
      expect(() => validateManifest(manifest, '/test')).toThrow(/schema_version is missing/);
    });

    it('should throw SchemaVersionError for non-integer schema_version', () => {
      const manifest = { schema_version: '1', manifest_version: '1.0', meta: { name: 'Test' } };
      expect(() => validateManifest(manifest, '/test')).toThrow(SchemaVersionError);
      expect(() => validateManifest(manifest, '/test')).toThrow(/expected integer/);
    });

    it('should throw SchemaVersionError for unsupported schema_version', () => {
      const manifest = { schema_version: 99, manifest_version: '1.0', meta: { name: 'Test' } };
      expect(() => validateManifest(manifest, '/test')).toThrow(SchemaVersionError);
      expect(() => validateManifest(manifest, '/test')).toThrow(/Unsupported manifest schema_version: 99/);
    });

    it('should include upgrade instructions in SchemaVersionError', () => {
      const manifest = { schema_version: 2, manifest_version: '1.0', meta: { name: 'Test' } };
      try {
        validateManifest(manifest, '/test');
        expect.fail('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(SchemaVersionError);
        const err = e as SchemaVersionError;
        expect(err.upgradeInstructions).toContain('Update the wpnav CLI');
        expect(err.exitCode).toBe(2);
      }
    });

    it('should throw for schema_version < 1', () => {
      const manifest = { schema_version: 0, manifest_version: '1.0', meta: { name: 'Test' } };
      expect(() => validateManifest(manifest, '/test')).toThrow(SchemaVersionError);
      expect(() => validateManifest(manifest, '/test')).toThrow(/must be >= 1/);
    });

    // legacy manifest_version tests
    it('should throw for missing manifest_version', () => {
      const manifest = { schema_version: 1, meta: { name: 'Test' } };
      expect(() => validateManifest(manifest, '/test')).toThrow(/manifest_version/);
    });

    it('should throw for invalid manifest_version format', () => {
      const manifest = { schema_version: 1, manifest_version: 'invalid', meta: { name: 'Test' } };
      expect(() => validateManifest(manifest, '/test')).toThrow(/Invalid manifest_version format/);
    });

    it('should throw for too old manifest_version', () => {
      const manifest = { schema_version: 1, manifest_version: '0.1', meta: { name: 'Test' } };
      expect(() => validateManifest(manifest, '/test')).toThrow(/older than minimum/);
    });

    it('should throw for too new manifest_version', () => {
      const manifest = { schema_version: 1, manifest_version: '99.0', meta: { name: 'Test' } };
      expect(() => validateManifest(manifest, '/test')).toThrow(/newer than supported/);
    });

    // meta tests
    it('should throw for missing meta', () => {
      const manifest = { schema_version: 1, manifest_version: '1.0' };
      expect(() => validateManifest(manifest, '/test')).toThrow(/meta/);
    });

    it('should throw for missing meta.name', () => {
      const manifest = { schema_version: 1, manifest_version: '1.0', meta: {} };
      expect(() => validateManifest(manifest, '/test')).toThrow(/meta.name/);
    });

    it('should validate pages array', () => {
      const manifest = {
        ...validManifest,
        pages: [
          { slug: 'about', title: 'About Us' },
          { slug: 'contact', title: 'Contact' },
        ],
      };
      const result = validateManifest(manifest, '/test');
      expect(result.pages).toHaveLength(2);
    });

    it('should throw for pages not being an array', () => {
      const manifest = { ...validManifest, pages: 'not array' };
      expect(() => validateManifest(manifest, '/test')).toThrow(/pages must be an array/);
    });

    it('should throw for page missing slug', () => {
      const manifest = { ...validManifest, pages: [{ title: 'No Slug' }] };
      expect(() => validateManifest(manifest, '/test')).toThrow(/pages\[0\].*slug/);
    });

    it('should throw for page missing title', () => {
      const manifest = { ...validManifest, pages: [{ slug: 'no-title' }] };
      expect(() => validateManifest(manifest, '/test')).toThrow(/pages\[0\].*title/);
    });

    it('should validate plugins object', () => {
      const manifest = {
        ...validManifest,
        plugins: {
          woocommerce: { enabled: true },
          'yoast-seo': { enabled: false, settings: { sitemap: true } },
        },
      };
      const result = validateManifest(manifest, '/test');
      expect(result.plugins?.woocommerce.enabled).toBe(true);
      expect(result.plugins?.['yoast-seo'].enabled).toBe(false);
    });

    it('should throw for plugins not being an object', () => {
      const manifest = { ...validManifest, plugins: [] };
      expect(() => validateManifest(manifest, '/test')).toThrow(/plugins must be an object/);
    });

    it('should throw for plugin missing enabled field', () => {
      const manifest = { ...validManifest, plugins: { woo: { settings: {} } } };
      expect(() => validateManifest(manifest, '/test')).toThrow(/plugins\.woo\.enabled/);
    });

    it('should throw for plugin enabled not being boolean', () => {
      const manifest = { ...validManifest, plugins: { woo: { enabled: 'yes' } } };
      expect(() => validateManifest(manifest, '/test')).toThrow(/plugins\.woo\.enabled must be a boolean/);
    });

    it('should validate full manifest with all sections', () => {
      const fullManifest: WPNavManifest = {
        schema_version: 1,
        manifest_version: '1.0',
        meta: {
          name: 'Full Test Site',
          description: 'A complete test',
          url: 'https://example.com',
          tags: ['test', 'example'],
        },
        brand: {
          palette: { primary: '#ff0000' },
          fonts: { heading: 'Roboto' },
          layout: { spacing: 'compact' },
          voice: { tone: 'friendly' },
        },
        pages: [
          { slug: 'home', title: 'Home', status: 'publish' },
        ],
        plugins: {
          woocommerce: { enabled: true },
        },
        safety: {
          allow_create_pages: true,
          require_confirmation: false,
        },
      };
      const result = validateManifest(fullManifest, '/test');
      expect(result.brand?.palette?.primary).toBe('#ff0000');
      expect(result.safety?.require_confirmation).toBe(false);
    });
  });

  describe('loadManifest', () => {
    const validManifestContent = JSON.stringify({
      schema_version: 1,
      manifest_version: '1.0',
      meta: { name: 'Test Site' },
    });

    it('should load wpnavigator.jsonc from project root', () => {
      mockFs.existsSync.mockImplementation((p) => {
        return String(p).endsWith('wpnavigator.jsonc');
      });
      mockFs.readFileSync.mockReturnValue(validManifestContent);

      const result = loadManifest('/test/project');

      expect(result.found).toBe(true);
      expect(result.manifest?.meta.name).toBe('Test Site');
      expect(result.path).toContain('wpnavigator.jsonc');
    });

    it('should load wpnavigator.json if .jsonc not found', () => {
      mockFs.existsSync.mockImplementation((p) => {
        return String(p).endsWith('wpnavigator.json');
      });
      mockFs.readFileSync.mockReturnValue(validManifestContent);

      const result = loadManifest('/test/project');

      expect(result.found).toBe(true);
      expect(result.path).toContain('wpnavigator.json');
    });

    it('should return found=false if no manifest exists', () => {
      mockFs.existsSync.mockReturnValue(false);

      const result = loadManifest('/test/project');

      expect(result.found).toBe(false);
      expect(result.manifest).toBeUndefined();
      expect(result.error).toBeUndefined();
    });

    it('should return error for invalid JSON', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('{ invalid json }');

      const result = loadManifest('/test/project');

      expect(result.found).toBe(true);
      expect(result.manifest).toBeUndefined();
      expect(result.error).toContain('Invalid JSON');
    });

    it('should return error for validation failures (missing schema_version)', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify({ manifest_version: '1.0', meta: { name: 'Test' } }));

      const result = loadManifest('/test/project');

      expect(result.found).toBe(true);
      expect(result.manifest).toBeUndefined();
      expect(result.error).toContain('schema_version');
    });

    it('should parse JSONC with comments', () => {
      const jsoncContent = `{
  // Site manifest
  "schema_version": 1,
  "manifest_version": "1.0",
  "meta": {
    "name": "Test Site" /* with comment */
  }
}`;
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(jsoncContent);

      const result = loadManifest('/test/project');

      expect(result.found).toBe(true);
      expect(result.manifest?.meta.name).toBe('Test Site');
    });

    it('should handle file read errors', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const result = loadManifest('/test/project');

      expect(result.found).toBe(true);
      expect(result.error).toContain('Permission denied');
    });
  });

  describe('default value helpers', () => {
    describe('getBrandPalette', () => {
      it('should return defaults when no brand provided', () => {
        const result = getBrandPalette(undefined);
        expect(result).toEqual(DEFAULT_BRAND_PALETTE);
      });

      it('should merge with defaults', () => {
        const brand = { palette: { primary: '#custom' } };
        const result = getBrandPalette(brand);
        expect(result.primary).toBe('#custom');
        expect(result.secondary).toBe(DEFAULT_BRAND_PALETTE.secondary);
      });
    });

    describe('getBrandFonts', () => {
      it('should return defaults when no brand provided', () => {
        const result = getBrandFonts(undefined);
        expect(result).toEqual(DEFAULT_BRAND_FONTS);
      });

      it('should merge with defaults', () => {
        const brand = { fonts: { heading: 'Custom Font' } };
        const result = getBrandFonts(brand);
        expect(result.heading).toBe('Custom Font');
        expect(result.body).toBe(DEFAULT_BRAND_FONTS.body);
      });
    });

    describe('getBrandLayout', () => {
      it('should return defaults when no brand provided', () => {
        const result = getBrandLayout(undefined);
        expect(result).toEqual(DEFAULT_BRAND_LAYOUT);
      });

      it('should merge with defaults', () => {
        const brand = { layout: { spacing: 'compact' as const } };
        const result = getBrandLayout(brand);
        expect(result.spacing).toBe('compact');
        expect(result.containerWidth).toBe(DEFAULT_BRAND_LAYOUT.containerWidth);
      });
    });

    describe('getManifestSafety', () => {
      it('should return defaults when no manifest provided', () => {
        const result = getManifestSafety(undefined);
        expect(result).toEqual(DEFAULT_MANIFEST_SAFETY);
      });

      it('should merge with defaults', () => {
        const manifest: WPNavManifest = {
          schema_version: 1,
          manifest_version: '1.0',
          meta: { name: 'Test' },
          safety: { allow_delete_pages: true },
        };
        const result = getManifestSafety(manifest);
        expect(result.allow_delete_pages).toBe(true);
        expect(result.require_confirmation).toBe(DEFAULT_MANIFEST_SAFETY.require_confirmation);
      });

      it('should include new safety fields', () => {
        const result = getManifestSafety(undefined);
        expect(result.require_sync_confirmation).toBe(true);
        expect(result.first_sync_acknowledged).toBe(false);
        expect(result.backup_reminders).toBeDefined();
      });

      it('should deep merge backup_reminders', () => {
        const manifest: WPNavManifest = {
          schema_version: 1,
          manifest_version: '1.0',
          meta: { name: 'Test' },
          safety: {
            backup_reminders: { frequency: 'always' },
          },
        };
        const result = getManifestSafety(manifest);
        expect(result.backup_reminders.frequency).toBe('always');
        expect(result.backup_reminders.enabled).toBe(DEFAULT_BACKUP_REMINDERS.enabled);
      });
    });

    describe('getBackupReminders', () => {
      it('should return defaults when no manifest provided', () => {
        const result = getBackupReminders(undefined);
        expect(result).toEqual(DEFAULT_BACKUP_REMINDERS);
      });

      it('should merge with defaults', () => {
        const manifest: WPNavManifest = {
          schema_version: 1,
          manifest_version: '1.0',
          meta: { name: 'Test' },
          safety: {
            backup_reminders: { enabled: false, frequency: 'never' },
          },
        };
        const result = getBackupReminders(manifest);
        expect(result.enabled).toBe(false);
        expect(result.frequency).toBe('never');
        expect(result.before_sync).toBe(DEFAULT_BACKUP_REMINDERS.before_sync);
      });
    });
  });

  describe('safety validation', () => {
    it('should accept valid backup_reminders.frequency values', () => {
      const validFrequencies = ['first_sync_only', 'always', 'daily', 'never'];
      for (const frequency of validFrequencies) {
        const manifest = {
          schema_version: 1,
          manifest_version: '1.0',
          meta: { name: 'Test' },
          safety: { backup_reminders: { frequency } },
        };
        expect(() => validateManifest(manifest, '/test')).not.toThrow();
      }
    });

    it('should reject invalid backup_reminders.frequency', () => {
      const manifest = {
        schema_version: 1,
        manifest_version: '1.0',
        meta: { name: 'Test' },
        safety: { backup_reminders: { frequency: 'invalid' } },
      };
      expect(() => validateManifest(manifest, '/test')).toThrow(/backup_reminders\.frequency/);
    });
  });
});
