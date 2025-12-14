/**
 * Tests for WP Navigator Codex Setup Command
 *
 * Tests AGENTS.md generation, .codex/ directory creation, and config snippet output.
 *
 * @package WP_Navigator_MCP
 * @since 2.3.0
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { performCodexSetup, handleCodexSetup, type CodexSetupResult } from './codex-setup.js';

describe('Codex Setup Command', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wpnav-codex-setup-test-'));
  });

  afterEach(() => {
    // Clean up temp directory
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('performCodexSetup', () => {
    it('creates AGENTS.md in the project directory', () => {
      // Create wpnav.config.json (required)
      fs.writeFileSync(path.join(tempDir, 'wpnav.config.json'), '{}');

      const result = performCodexSetup(tempDir);

      expect(result.agentsMdCreated).toBe(true);
      expect(fs.existsSync(path.join(tempDir, 'AGENTS.md'))).toBe(true);
    });

    it('creates .codex/ directory', () => {
      fs.writeFileSync(path.join(tempDir, 'wpnav.config.json'), '{}');

      const result = performCodexSetup(tempDir);

      expect(result.codexDirCreated).toBe(true);
      expect(fs.existsSync(path.join(tempDir, '.codex'))).toBe(true);
      expect(fs.statSync(path.join(tempDir, '.codex')).isDirectory()).toBe(true);
    });

    it('does not recreate .codex/ if it already exists', () => {
      fs.writeFileSync(path.join(tempDir, 'wpnav.config.json'), '{}');
      fs.mkdirSync(path.join(tempDir, '.codex'));

      const result = performCodexSetup(tempDir);

      expect(result.codexDirCreated).toBe(false);
      expect(fs.existsSync(path.join(tempDir, '.codex'))).toBe(true);
    });

    it('includes config.toml snippet in result', () => {
      fs.writeFileSync(path.join(tempDir, 'wpnav.config.json'), '{}');

      const result = performCodexSetup(tempDir);

      expect(result.configSnippet).toContain('[mcp_servers.wpnav]');
      expect(result.configSnippet).toContain('command = "npx"');
      expect(result.configSnippet).toContain('@littlebearapps/wp-navigator-mcp');
    });

    it('overwrites existing AGENTS.md', () => {
      fs.writeFileSync(path.join(tempDir, 'wpnav.config.json'), '{}');
      fs.writeFileSync(path.join(tempDir, 'AGENTS.md'), '# Old Content');

      const result = performCodexSetup(tempDir);

      expect(result.agentsMdCreated).toBe(true);
      expect(result.agentsMdOverwritten).toBe(true);

      const content = fs.readFileSync(path.join(tempDir, 'AGENTS.md'), 'utf8');
      expect(content).toContain('# AGENTS.md - WP Navigator Project');
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

      performCodexSetup(tempDir);

      const content = fs.readFileSync(path.join(tempDir, 'AGENTS.md'), 'utf8');
      expect(content).toContain('**URL**: https://example.com');
    });

    it('handles wpnav.config.json without environments', () => {
      fs.writeFileSync(path.join(tempDir, 'wpnav.config.json'), '{}');

      // Should not throw
      const result = performCodexSetup(tempDir);
      expect(result.agentsMdCreated).toBe(true);
    });

    it('generates AGENTS.md with Codex-specific content', () => {
      fs.writeFileSync(path.join(tempDir, 'wpnav.config.json'), '{}');

      performCodexSetup(tempDir);

      const content = fs.readFileSync(path.join(tempDir, 'AGENTS.md'), 'utf8');
      expect(content).toContain('## Codex Integration');
      expect(content).toContain('config.toml');
      expect(content).toContain('[mcp_servers.wpnav]');
    });
  });

  describe('handleCodexSetup', () => {
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
      const exitCode = await handleCodexSetup({});

      expect(exitCode).toBe(1);
    });

    it('fails with JSON error when config missing', async () => {
      const exitCode = await handleCodexSetup({ json: true });

      expect(exitCode).toBe(1);
      expect(consoleLogSpy).toHaveBeenCalled();

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
      expect(output.success).toBe(false);
      expect(output.error.code).toBe('CONFIG_NOT_FOUND');
    });

    it('succeeds when wpnav.config.json exists', async () => {
      fs.writeFileSync(path.join(tempDir, 'wpnav.config.json'), '{}');

      const exitCode = await handleCodexSetup({});

      expect(exitCode).toBe(0);
      expect(fs.existsSync(path.join(tempDir, 'AGENTS.md'))).toBe(true);
      expect(fs.existsSync(path.join(tempDir, '.codex'))).toBe(true);
    });

    it('returns JSON output with success data', async () => {
      fs.writeFileSync(path.join(tempDir, 'wpnav.config.json'), '{}');

      const exitCode = await handleCodexSetup({ json: true });

      expect(exitCode).toBe(0);
      expect(consoleLogSpy).toHaveBeenCalled();

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
      expect(output.success).toBe(true);
      expect(output.command).toBe('codex-setup');
      expect(output.data.agents_md_created).toBe(true);
      expect(output.data.codex_dir_created).toBe(true);
      expect(output.data.config_snippet).toContain('[mcp_servers.wpnav]');
    });

    it('returns agents_md_overwritten true when AGENTS.md exists', async () => {
      fs.writeFileSync(path.join(tempDir, 'wpnav.config.json'), '{}');
      fs.writeFileSync(path.join(tempDir, 'AGENTS.md'), '# Old');

      const exitCode = await handleCodexSetup({ json: true });

      expect(exitCode).toBe(0);
      const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
      expect(output.data.agents_md_overwritten).toBe(true);
    });

    it('returns codex_dir_created false when .codex/ exists', async () => {
      fs.writeFileSync(path.join(tempDir, 'wpnav.config.json'), '{}');
      fs.mkdirSync(path.join(tempDir, '.codex'));

      const exitCode = await handleCodexSetup({ json: true });

      expect(exitCode).toBe(0);
      const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
      expect(output.data.codex_dir_created).toBe(false);
    });

    it('is idempotent (safe to run twice)', async () => {
      fs.writeFileSync(path.join(tempDir, 'wpnav.config.json'), '{}');

      // First run
      const exitCode1 = await handleCodexSetup({ json: true });
      expect(exitCode1).toBe(0);

      // Second run
      const exitCode2 = await handleCodexSetup({ json: true });
      expect(exitCode2).toBe(0);

      // Files should still exist and be valid
      expect(fs.existsSync(path.join(tempDir, 'AGENTS.md'))).toBe(true);
      expect(fs.existsSync(path.join(tempDir, '.codex'))).toBe(true);
    });
  });

  describe('AGENTS.md content', () => {
    it('includes required sections for Codex users', () => {
      fs.writeFileSync(path.join(tempDir, 'wpnav.config.json'), '{}');

      performCodexSetup(tempDir);

      const content = fs.readFileSync(path.join(tempDir, 'AGENTS.md'), 'utf8');

      // Must have these sections
      expect(content).toContain('## Overview');
      expect(content).toContain('## Quick Start');
      expect(content).toContain('## Safety Defaults');
      expect(content).toContain('## Codex Integration');
      expect(content).toContain('## Available CLI Commands');
      expect(content).toContain('## MCP Tool Categories');
      expect(content).toContain('## Common Workflows');
      expect(content).toContain('## Project Files');
      expect(content).toContain('## Troubleshooting');
      expect(content).toContain('## Resources');
    });

    it('includes config.toml example', () => {
      fs.writeFileSync(path.join(tempDir, 'wpnav.config.json'), '{}');

      performCodexSetup(tempDir);

      const content = fs.readFileSync(path.join(tempDir, 'AGENTS.md'), 'utf8');

      expect(content).toContain('[mcp_servers.wpnav]');
      expect(content).toContain('command = "npx"');
      expect(content).toContain('@littlebearapps/wp-navigator-mcp');
    });

    it('includes all 13 tool categories', () => {
      fs.writeFileSync(path.join(tempDir, 'wpnav.config.json'), '{}');

      performCodexSetup(tempDir);

      const content = fs.readFileSync(path.join(tempDir, 'AGENTS.md'), 'utf8');

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

    it('references AGENTS.md in project files table', () => {
      fs.writeFileSync(path.join(tempDir, 'wpnav.config.json'), '{}');

      performCodexSetup(tempDir);

      const content = fs.readFileSync(path.join(tempDir, 'AGENTS.md'), 'utf8');
      expect(content).toContain('AGENTS.md');
      expect(content).toContain('.codex/');
    });
  });
});
