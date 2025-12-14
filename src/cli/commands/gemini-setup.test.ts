/**
 * Tests for WP Navigator Gemini Setup Command
 *
 * Tests GEMINI.md generation, .gemini/ directory creation, and config snippet output.
 *
 * @package WP_Navigator_MCP
 * @since 2.3.0
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { performGeminiSetup, handleGeminiSetup, type GeminiSetupResult } from './gemini-setup.js';

describe('Gemini Setup Command', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wpnav-gemini-setup-test-'));
  });

  afterEach(() => {
    // Clean up temp directory
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('performGeminiSetup', () => {
    it('creates GEMINI.md in the project directory', () => {
      // Create wpnav.config.json (required)
      fs.writeFileSync(path.join(tempDir, 'wpnav.config.json'), '{}');

      const result = performGeminiSetup(tempDir);

      expect(result.geminiMdCreated).toBe(true);
      expect(fs.existsSync(path.join(tempDir, 'GEMINI.md'))).toBe(true);
    });

    it('creates .gemini/ directory', () => {
      fs.writeFileSync(path.join(tempDir, 'wpnav.config.json'), '{}');

      const result = performGeminiSetup(tempDir);

      expect(result.geminiDirCreated).toBe(true);
      expect(fs.existsSync(path.join(tempDir, '.gemini'))).toBe(true);
      expect(fs.statSync(path.join(tempDir, '.gemini')).isDirectory()).toBe(true);
    });

    it('does not recreate .gemini/ if it already exists', () => {
      fs.writeFileSync(path.join(tempDir, 'wpnav.config.json'), '{}');
      fs.mkdirSync(path.join(tempDir, '.gemini'));

      const result = performGeminiSetup(tempDir);

      expect(result.geminiDirCreated).toBe(false);
      expect(fs.existsSync(path.join(tempDir, '.gemini'))).toBe(true);
    });

    it('includes settings.json snippet in result', () => {
      fs.writeFileSync(path.join(tempDir, 'wpnav.config.json'), '{}');

      const result = performGeminiSetup(tempDir);

      expect(result.configSnippet).toContain('"mcpServers"');
      expect(result.configSnippet).toContain('"wpnav"');
      expect(result.configSnippet).toContain('@littlebearapps/wp-navigator-mcp');
    });

    it('overwrites existing GEMINI.md', () => {
      fs.writeFileSync(path.join(tempDir, 'wpnav.config.json'), '{}');
      fs.writeFileSync(path.join(tempDir, 'GEMINI.md'), '# Old Content');

      const result = performGeminiSetup(tempDir);

      expect(result.geminiMdCreated).toBe(true);
      expect(result.geminiMdOverwritten).toBe(true);

      const content = fs.readFileSync(path.join(tempDir, 'GEMINI.md'), 'utf8');
      expect(content).toContain('# GEMINI.md - WP Navigator Project');
      expect(content).not.toContain('# Old Content');
    });

    it('reads site_url from wpnav.config.json', () => {
      const config = {
        environments: {
          default: {
            site_url: 'https://example.com',
          },
        },
      };
      fs.writeFileSync(path.join(tempDir, 'wpnav.config.json'), JSON.stringify(config));

      performGeminiSetup(tempDir);

      const content = fs.readFileSync(path.join(tempDir, 'GEMINI.md'), 'utf8');
      expect(content).toContain('**URL**: https://example.com');
    });

    it('handles wpnav.config.json without environments', () => {
      fs.writeFileSync(path.join(tempDir, 'wpnav.config.json'), '{}');

      // Should not throw
      const result = performGeminiSetup(tempDir);
      expect(result.geminiMdCreated).toBe(true);
    });

    it('generates GEMINI.md with Gemini-specific content', () => {
      fs.writeFileSync(path.join(tempDir, 'wpnav.config.json'), '{}');

      performGeminiSetup(tempDir);

      const content = fs.readFileSync(path.join(tempDir, 'GEMINI.md'), 'utf8');
      expect(content).toContain('## Gemini Integration');
      expect(content).toContain('settings.json');
      expect(content).toContain('"mcpServers"');
    });
  });

  describe('handleGeminiSetup', () => {
    let consoleLogSpy: ReturnType<typeof vi.spyOn>;
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
    let processCwdSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      processCwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(tempDir);
    });

    afterEach(() => {
      consoleLogSpy.mockRestore();
      consoleErrorSpy.mockRestore();
      processCwdSpy.mockRestore();
    });

    it('fails when wpnav.config.json does not exist', async () => {
      const exitCode = await handleGeminiSetup({});

      expect(exitCode).toBe(1);
    });

    it('fails with JSON error when config missing', async () => {
      const exitCode = await handleGeminiSetup({ json: true });

      expect(exitCode).toBe(1);
      expect(consoleLogSpy).toHaveBeenCalled();

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
      expect(output.success).toBe(false);
      expect(output.error.code).toBe('CONFIG_NOT_FOUND');
    });

    it('succeeds when wpnav.config.json exists', async () => {
      fs.writeFileSync(path.join(tempDir, 'wpnav.config.json'), '{}');

      const exitCode = await handleGeminiSetup({});

      expect(exitCode).toBe(0);
      expect(fs.existsSync(path.join(tempDir, 'GEMINI.md'))).toBe(true);
      expect(fs.existsSync(path.join(tempDir, '.gemini'))).toBe(true);
    });

    it('returns JSON output with success data', async () => {
      fs.writeFileSync(path.join(tempDir, 'wpnav.config.json'), '{}');

      const exitCode = await handleGeminiSetup({ json: true });

      expect(exitCode).toBe(0);
      expect(consoleLogSpy).toHaveBeenCalled();

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
      expect(output.success).toBe(true);
      expect(output.command).toBe('gemini-setup');
      expect(output.data.gemini_md_created).toBe(true);
      expect(output.data.gemini_dir_created).toBe(true);
      expect(output.data.config_snippet).toContain('"mcpServers"');
    });

    it('returns gemini_md_overwritten true when GEMINI.md exists', async () => {
      fs.writeFileSync(path.join(tempDir, 'wpnav.config.json'), '{}');
      fs.writeFileSync(path.join(tempDir, 'GEMINI.md'), '# Old');

      const exitCode = await handleGeminiSetup({ json: true });

      expect(exitCode).toBe(0);
      const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
      expect(output.data.gemini_md_overwritten).toBe(true);
    });

    it('returns gemini_dir_created false when .gemini/ exists', async () => {
      fs.writeFileSync(path.join(tempDir, 'wpnav.config.json'), '{}');
      fs.mkdirSync(path.join(tempDir, '.gemini'));

      const exitCode = await handleGeminiSetup({ json: true });

      expect(exitCode).toBe(0);
      const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
      expect(output.data.gemini_dir_created).toBe(false);
    });

    it('is idempotent (safe to run twice)', async () => {
      fs.writeFileSync(path.join(tempDir, 'wpnav.config.json'), '{}');

      // First run
      const exitCode1 = await handleGeminiSetup({ json: true });
      expect(exitCode1).toBe(0);

      // Second run
      const exitCode2 = await handleGeminiSetup({ json: true });
      expect(exitCode2).toBe(0);

      // Files should still exist and be valid
      expect(fs.existsSync(path.join(tempDir, 'GEMINI.md'))).toBe(true);
      expect(fs.existsSync(path.join(tempDir, '.gemini'))).toBe(true);
    });

    it('includes copied_to_clipboard in JSON output', async () => {
      fs.writeFileSync(path.join(tempDir, 'wpnav.config.json'), '{}');

      const exitCode = await handleGeminiSetup({ json: true });

      expect(exitCode).toBe(0);
      const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
      expect('copied_to_clipboard' in output.data).toBe(true);
    });
  });

  describe('GEMINI.md content', () => {
    it('includes required sections for Gemini users', () => {
      fs.writeFileSync(path.join(tempDir, 'wpnav.config.json'), '{}');

      performGeminiSetup(tempDir);

      const content = fs.readFileSync(path.join(tempDir, 'GEMINI.md'), 'utf8');

      // Must have these sections
      expect(content).toContain('## Overview');
      expect(content).toContain('## Quick Start');
      expect(content).toContain('## Safety Defaults');
      expect(content).toContain('## Gemini Integration');
      expect(content).toContain('## Available CLI Commands');
      expect(content).toContain('## MCP Tool Categories');
      expect(content).toContain('## Common Workflows');
      expect(content).toContain('## Project Files');
      expect(content).toContain('## Troubleshooting');
      expect(content).toContain('## Resources');
    });

    it('includes settings.json example', () => {
      fs.writeFileSync(path.join(tempDir, 'wpnav.config.json'), '{}');

      performGeminiSetup(tempDir);

      const content = fs.readFileSync(path.join(tempDir, 'GEMINI.md'), 'utf8');

      expect(content).toContain('"mcpServers"');
      expect(content).toContain('"wpnav"');
      expect(content).toContain('@littlebearapps/wp-navigator-mcp');
    });

    it('includes all 13 tool categories', () => {
      fs.writeFileSync(path.join(tempDir, 'wpnav.config.json'), '{}');

      performGeminiSetup(tempDir);

      const content = fs.readFileSync(path.join(tempDir, 'GEMINI.md'), 'utf8');

      const expectedCategories = [
        'Core',
        'Pages',
        'Posts',
        'Media',
        'Comments',
        'Categories',
        'Tags',
        'Taxonomies',
        'Users',
        'Plugins',
        'Themes',
        'Gutenberg',
        'Testing',
      ];

      for (const category of expectedCategories) {
        expect(content).toContain(`| ${category} |`);
      }
    });

    it('references GEMINI.md and .gemini/ in project files table', () => {
      fs.writeFileSync(path.join(tempDir, 'wpnav.config.json'), '{}');

      performGeminiSetup(tempDir);

      const content = fs.readFileSync(path.join(tempDir, 'GEMINI.md'), 'utf8');
      expect(content).toContain('GEMINI.md');
      expect(content).toContain('.gemini/');
    });

    it('references settings.json in troubleshooting', () => {
      fs.writeFileSync(path.join(tempDir, 'wpnav.config.json'), '{}');

      performGeminiSetup(tempDir);

      const content = fs.readFileSync(path.join(tempDir, 'GEMINI.md'), 'utf8');
      expect(content).toContain('settings.json');
    });
  });
});
