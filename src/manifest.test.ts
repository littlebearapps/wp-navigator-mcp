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
  // v2 exports
  isManifestV2,
  isToolCategoryString,
  isAIFocusMode,
  isSafetyMode,
  isOperationType,
  getManifestTools,
  getManifestRoles,
  getManifestAI,
  getManifestSafetyV2,
  asManifestV2,
  DEFAULT_MANIFEST_TOOLS,
  DEFAULT_MANIFEST_ROLES,
  DEFAULT_MANIFEST_AI,
  DEFAULT_MANIFEST_SAFETY_V2,
  type WPNavManifest,
  type WPNavManifestV2,
  type WPNavManifestRuntime,
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
      expect(CURRENT_SCHEMA_VERSION).toBe(2);
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
      expect(() => validateManifest(manifest, '/test')).toThrow(
        /Unsupported manifest schema_version: 99/
      );
    });

    it('should include upgrade instructions in SchemaVersionError', () => {
      const manifest = { schema_version: 99, manifest_version: '1.0', meta: { name: 'Test' } };
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
      expect(() => validateManifest(manifest, '/test')).toThrow(
        /plugins\.woo\.enabled must be a boolean/
      );
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
        pages: [{ slug: 'home', title: 'Home', status: 'publish' }],
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
      mockFs.readFileSync.mockReturnValue(
        JSON.stringify({ manifest_version: '1.0', meta: { name: 'Test' } })
      );

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

  // =============================================================================
  // Schema v2 Tests
  // =============================================================================

  describe('schema v2', () => {
    // Valid v2 manifest for tests
    const validV2Manifest: WPNavManifestV2 = {
      schema_version: 2,
      manifest_version: '1.0',
      meta: { name: 'Test Site' },
    };

    describe('type guards', () => {
      describe('isManifestV2', () => {
        it('should return true for schema_version >= 2', () => {
          expect(isManifestV2(validV2Manifest)).toBe(true);
        });

        it('should return false for schema_version 1', () => {
          const v1: WPNavManifest = {
            schema_version: 1,
            manifest_version: '1.0',
            meta: { name: 'Test' },
          };
          expect(isManifestV2(v1)).toBe(false);
        });
      });

      describe('isToolCategoryString', () => {
        it('should return true for valid categories', () => {
          const validCategories = [
            'core',
            'content',
            'taxonomy',
            'users',
            'plugins',
            'themes',
            'workflows',
            'cookbook',
            'roles',
            'batch',
          ];
          for (const cat of validCategories) {
            expect(isToolCategoryString(cat)).toBe(true);
          }
        });

        it('should return false for invalid categories', () => {
          expect(isToolCategoryString('invalid')).toBe(false);
          expect(isToolCategoryString('')).toBe(false);
          expect(isToolCategoryString('CORE')).toBe(false);
        });
      });

      describe('isAIFocusMode', () => {
        it('should return true for valid focus modes', () => {
          const validModes = ['content-editing', 'full-admin', 'read-only', 'custom'];
          for (const mode of validModes) {
            expect(isAIFocusMode(mode)).toBe(true);
          }
        });

        it('should return false for invalid modes', () => {
          expect(isAIFocusMode('invalid')).toBe(false);
          expect(isAIFocusMode('')).toBe(false);
        });
      });

      describe('isSafetyMode', () => {
        it('should return true for valid safety modes', () => {
          const validModes = ['yolo', 'normal', 'cautious'];
          for (const mode of validModes) {
            expect(isSafetyMode(mode)).toBe(true);
          }
        });

        it('should return false for invalid modes', () => {
          expect(isSafetyMode('invalid')).toBe(false);
          expect(isSafetyMode('balanced')).toBe(false);
        });
      });

      describe('isOperationType', () => {
        it('should return true for valid operation types', () => {
          const validOps = ['create', 'update', 'delete', 'activate', 'deactivate', 'batch'];
          for (const op of validOps) {
            expect(isOperationType(op)).toBe(true);
          }
        });

        it('should return false for invalid types', () => {
          expect(isOperationType('invalid')).toBe(false);
          expect(isOperationType('read')).toBe(false);
        });
      });
    });

    describe('validation', () => {
      it('should validate minimal v2 manifest', () => {
        const result = validateManifest(validV2Manifest, '/test');
        expect(result.schema_version).toBe(2);
        expect(result.meta.name).toBe('Test Site');
      });

      it('should validate v2 manifest with tools section', () => {
        const manifest = {
          ...validV2Manifest,
          tools: {
            enabled: ['core', 'content'],
            disabled: ['users'],
            overrides: { wpnav_delete_post: false },
          },
        };
        const result = validateManifest(manifest, '/test');
        expect(isManifestV2(result)).toBe(true);
        if (isManifestV2(result)) {
          expect(result.tools?.enabled).toEqual(['core', 'content']);
          expect(result.tools?.disabled).toEqual(['users']);
          expect(result.tools?.overrides?.wpnav_delete_post).toBe(false);
        }
      });

      it('should reject invalid tool category in enabled', () => {
        const manifest = {
          ...validV2Manifest,
          tools: { enabled: ['core', 'invalid_category'] },
        };
        expect(() => validateManifest(manifest, '/test')).toThrow(/invalid_category/);
      });

      it('should reject invalid tool category in disabled', () => {
        const manifest = {
          ...validV2Manifest,
          tools: { disabled: ['not_a_category'] },
        };
        expect(() => validateManifest(manifest, '/test')).toThrow(/not_a_category/);
      });

      it('should validate v2 manifest with roles section', () => {
        const manifest = {
          ...validV2Manifest,
          roles: {
            active: 'content-editor',
            auto_detect: true,
            project_path: './roles',
          },
        };
        const result = validateManifest(manifest, '/test');
        expect(isManifestV2(result)).toBe(true);
        if (isManifestV2(result)) {
          expect(result.roles?.active).toBe('content-editor');
          expect(result.roles?.auto_detect).toBe(true);
        }
      });

      it('should reject invalid roles.active type', () => {
        const manifest = {
          ...validV2Manifest,
          roles: { active: 123 },
        };
        expect(() => validateManifest(manifest, '/test')).toThrow(/roles\.active/);
      });

      it('should validate v2 manifest with ai section', () => {
        const manifest = {
          ...validV2Manifest,
          ai: {
            focus: 'content-editing',
            instructions: 'Focus on blog posts',
            prompts_path: './prompts',
          },
        };
        const result = validateManifest(manifest, '/test');
        expect(isManifestV2(result)).toBe(true);
        if (isManifestV2(result)) {
          expect(result.ai?.focus).toBe('content-editing');
          expect(result.ai?.instructions).toBe('Focus on blog posts');
        }
      });

      it('should reject invalid ai.focus value', () => {
        const manifest = {
          ...validV2Manifest,
          ai: { focus: 'invalid-focus' },
        };
        expect(() => validateManifest(manifest, '/test')).toThrow(/ai\.focus/);
      });

      it('should validate v2 manifest with safety v2 fields', () => {
        const manifest = {
          ...validV2Manifest,
          safety: {
            mode: 'cautious',
            max_batch_size: 5,
            allowed_operations: ['create', 'update'],
            blocked_operations: ['delete'],
          },
        };
        const result = validateManifest(manifest, '/test');
        expect(isManifestV2(result)).toBe(true);
        if (isManifestV2(result)) {
          expect(result.safety?.mode).toBe('cautious');
          expect(result.safety?.max_batch_size).toBe(5);
          expect(result.safety?.allowed_operations).toEqual(['create', 'update']);
        }
      });

      it('should reject invalid safety.mode', () => {
        const manifest = {
          ...validV2Manifest,
          safety: { mode: 'invalid_mode' },
        };
        expect(() => validateManifest(manifest, '/test')).toThrow(/safety\.mode/);
      });

      it('should reject invalid operation type in allowed_operations', () => {
        const manifest = {
          ...validV2Manifest,
          safety: { allowed_operations: ['create', 'invalid_op'] },
        };
        expect(() => validateManifest(manifest, '/test')).toThrow(/invalid_op/);
      });

      it('should validate v2 manifest with env section', () => {
        const manifest = {
          ...validV2Manifest,
          env: {
            local: { safety: { mode: 'yolo' } },
            staging: { safety: { mode: 'normal' } },
          },
        };
        const result = validateManifest(manifest, '/test');
        expect(isManifestV2(result)).toBe(true);
        if (isManifestV2(result)) {
          expect(result.env?.local?.safety?.mode).toBe('yolo');
        }
      });

      it('should reject invalid safety.mode in env section', () => {
        const manifest = {
          ...validV2Manifest,
          env: {
            local: { safety: { mode: 'invalid' } },
          },
        };
        expect(() => validateManifest(manifest, '/test')).toThrow(/Invalid safety\.mode/);
      });

      it('should validate full v2 manifest with all sections', () => {
        const fullV2Manifest = {
          schema_version: 2,
          manifest_version: '1.0',
          meta: { name: 'Full Test', description: 'Complete v2 test' },
          tools: {
            enabled: ['core', 'content', 'taxonomy'],
            disabled: ['users'],
            overrides: { wpnav_delete_post: false },
            cookbooks: { load: ['gutenberg'], auto_detect: true },
          },
          roles: {
            active: 'content-editor',
            auto_detect: true,
            project_path: './roles',
          },
          ai: {
            focus: 'content-editing',
            instructions: 'Test instructions',
          },
          safety: {
            mode: 'cautious',
            max_batch_size: 10,
            allowed_operations: ['create', 'update'],
            blocked_operations: ['delete'],
          },
          env: {
            local: { safety: { mode: 'yolo' } },
          },
        };
        const result = validateManifest(fullV2Manifest, '/test');
        expect(result.schema_version).toBe(2);
        expect(isManifestV2(result)).toBe(true);
      });
    });

    describe('default value helpers v2', () => {
      describe('getManifestTools', () => {
        it('should return defaults when no manifest provided', () => {
          const result = getManifestTools(undefined);
          expect(result).toEqual(DEFAULT_MANIFEST_TOOLS);
        });

        it('should return defaults for v1 manifest', () => {
          const v1: WPNavManifest = {
            schema_version: 1,
            manifest_version: '1.0',
            meta: { name: 'Test' },
          };
          const result = getManifestTools(v1);
          expect(result).toEqual(DEFAULT_MANIFEST_TOOLS);
        });

        it('should merge with defaults for v2 manifest', () => {
          const v2: WPNavManifestV2 = {
            ...validV2Manifest,
            tools: { enabled: ['core', 'content'] },
          };
          const result = getManifestTools(v2);
          expect(result.enabled).toEqual(['core', 'content']);
          expect(result.disabled).toEqual(DEFAULT_MANIFEST_TOOLS.disabled);
        });
      });

      describe('getManifestRoles', () => {
        it('should return defaults when no manifest provided', () => {
          const result = getManifestRoles(undefined);
          expect(result).toEqual(DEFAULT_MANIFEST_ROLES);
        });

        it('should merge with defaults for v2 manifest', () => {
          const v2: WPNavManifestV2 = {
            ...validV2Manifest,
            roles: { active: 'site-admin' },
          };
          const result = getManifestRoles(v2);
          expect(result.active).toBe('site-admin');
          expect(result.auto_detect).toBe(DEFAULT_MANIFEST_ROLES.auto_detect);
        });
      });

      describe('getManifestAI', () => {
        it('should return defaults when no manifest provided', () => {
          const result = getManifestAI(undefined);
          expect(result).toEqual(DEFAULT_MANIFEST_AI);
        });

        it('should merge with defaults for v2 manifest', () => {
          const v2: WPNavManifestV2 = {
            ...validV2Manifest,
            ai: { focus: 'full-admin', instructions: 'Custom' },
          };
          const result = getManifestAI(v2);
          expect(result.focus).toBe('full-admin');
          expect(result.instructions).toBe('Custom');
          expect(result.prompts_path).toBe(DEFAULT_MANIFEST_AI.prompts_path);
        });
      });

      describe('getManifestSafetyV2', () => {
        it('should return defaults when no manifest provided', () => {
          const result = getManifestSafetyV2(undefined);
          expect(result).toEqual(DEFAULT_MANIFEST_SAFETY_V2);
        });

        it('should merge with defaults for v2 manifest', () => {
          const v2: WPNavManifestV2 = {
            ...validV2Manifest,
            safety: { mode: 'yolo', max_batch_size: 20 },
          };
          const result = getManifestSafetyV2(v2);
          expect(result.mode).toBe('yolo');
          expect(result.max_batch_size).toBe(20);
          expect(result.allowed_operations).toEqual(DEFAULT_MANIFEST_SAFETY_V2.allowed_operations);
        });
      });

      describe('asManifestV2', () => {
        it('should return v2 manifest as-is', () => {
          const result = asManifestV2(validV2Manifest);
          expect(result.schema_version).toBe(2);
          expect(result.meta.name).toBe('Test Site');
        });

        it('should upgrade v1 manifest to v2', () => {
          const v1: WPNavManifest = {
            schema_version: 1,
            manifest_version: '1.0',
            meta: { name: 'V1 Site' },
            safety: { require_confirmation: true },
          };
          const result = asManifestV2(v1);
          expect(result.schema_version).toBe(2);
          expect(result.meta.name).toBe('V1 Site');
          // v1 safety fields should be preserved
          expect(result.safety?.require_confirmation).toBe(true);
        });
      });
    });

    describe('backwards compatibility', () => {
      it('should still validate v1 manifests', () => {
        const v1: WPNavManifest = {
          schema_version: 1,
          manifest_version: '1.0',
          meta: { name: 'V1 Site' },
          pages: [{ slug: 'about', title: 'About' }],
          plugins: { woocommerce: { enabled: true } },
        };
        const result = validateManifest(v1, '/test');
        expect(result.schema_version).toBe(1);
        expect(result.pages).toHaveLength(1);
      });

      it('should not require v2 sections in v1 manifest', () => {
        const v1: WPNavManifest = {
          schema_version: 1,
          manifest_version: '1.0',
          meta: { name: 'Minimal V1' },
        };
        expect(() => validateManifest(v1, '/test')).not.toThrow();
      });

      it('should still enforce v1 validation rules', () => {
        const v1Invalid = {
          schema_version: 1,
          manifest_version: '1.0',
          meta: { name: 'Test' },
          pages: [{ slug: 'no-title' }], // Missing title
        };
        expect(() => validateManifest(v1Invalid, '/test')).toThrow(/title/);
      });
    });

    describe('loadManifest with v2', () => {
      it('should load v2 manifest with new sections', () => {
        const v2Content = JSON.stringify({
          schema_version: 2,
          manifest_version: '1.0',
          meta: { name: 'V2 Site' },
          tools: { enabled: ['core'] },
          ai: { focus: 'content-editing' },
        });
        mockFs.existsSync.mockReturnValue(true);
        mockFs.readFileSync.mockReturnValue(v2Content);

        const result = loadManifest('/test/project');

        expect(result.found).toBe(true);
        expect(result.manifest?.schema_version).toBe(2);
        if (result.manifest && isManifestV2(result.manifest)) {
          expect(result.manifest.tools?.enabled).toEqual(['core']);
          expect(result.manifest.ai?.focus).toBe('content-editing');
        }
      });
    });
  });
});
