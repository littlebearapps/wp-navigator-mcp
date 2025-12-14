/**
 * Tests for WP Navigator Claude Setup Command
 *
 * Tests CLAUDE.md generation, .mcp.json creation, and smoke test.
 *
 * @package WP_Navigator_MCP
 * @since 2.3.0
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { performClaudeSetup, handleClaudeSetup, type ClaudeSetupResult } from './claude-setup.js';

describe('Claude Setup Command', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wpnav-claude-setup-test-'));
  });

  afterEach(() => {
    // Clean up temp directory
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('performClaudeSetup', () => {
    it('creates CLAUDE.md in the project directory', () => {
      // Create wpnav.config.json (required)
      fs.writeFileSync(path.join(tempDir, 'wpnav.config.json'), '{}');

      const result = performClaudeSetup(tempDir);

      expect(result.claudeMdCreated).toBe(true);
      expect(fs.existsSync(path.join(tempDir, 'CLAUDE.md'))).toBe(true);
    });

    it('creates .mcp.json in the project directory', () => {
      fs.writeFileSync(path.join(tempDir, 'wpnav.config.json'), '{}');

      const result = performClaudeSetup(tempDir);

      expect(result.mcpJsonCreated).toBe(true);
      expect(fs.existsSync(path.join(tempDir, '.mcp.json'))).toBe(true);
    });

    it('generates valid .mcp.json with correct structure', () => {
      fs.writeFileSync(path.join(tempDir, 'wpnav.config.json'), '{}');

      performClaudeSetup(tempDir);

      const mcpJson = JSON.parse(fs.readFileSync(path.join(tempDir, '.mcp.json'), 'utf8'));
      expect(mcpJson.mcpServers).toBeDefined();
      expect(mcpJson.mcpServers.wpnav).toBeDefined();
      expect(mcpJson.mcpServers.wpnav.command).toBe('npx');
      expect(mcpJson.mcpServers.wpnav.args).toContain('@littlebearapps/wp-navigator-mcp');
    });

    it('overwrites existing CLAUDE.md', () => {
      fs.writeFileSync(path.join(tempDir, 'wpnav.config.json'), '{}');
      fs.writeFileSync(path.join(tempDir, 'CLAUDE.md'), '# Old Content');

      const result = performClaudeSetup(tempDir);

      expect(result.claudeMdCreated).toBe(true);
      expect(result.claudeMdOverwritten).toBe(true);

      const content = fs.readFileSync(path.join(tempDir, 'CLAUDE.md'), 'utf8');
      expect(content).toContain('# CLAUDE.md - WP Navigator Project');
      expect(content).not.toContain('# Old Content');
    });

    it('overwrites existing .mcp.json', () => {
      fs.writeFileSync(path.join(tempDir, 'wpnav.config.json'), '{}');
      fs.writeFileSync(path.join(tempDir, '.mcp.json'), '{"old": true}');

      const result = performClaudeSetup(tempDir);

      expect(result.mcpJsonCreated).toBe(true);
      expect(result.mcpJsonOverwritten).toBe(true);

      const content = JSON.parse(fs.readFileSync(path.join(tempDir, '.mcp.json'), 'utf8'));
      expect(content.old).toBeUndefined();
      expect(content.mcpServers).toBeDefined();
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

      performClaudeSetup(tempDir);

      const content = fs.readFileSync(path.join(tempDir, 'CLAUDE.md'), 'utf8');
      expect(content).toContain('**URL**: https://example.com');
    });

    it('handles wpnav.config.json without environments', () => {
      fs.writeFileSync(path.join(tempDir, 'wpnav.config.json'), '{}');

      // Should not throw
      const result = performClaudeSetup(tempDir);
      expect(result.claudeMdCreated).toBe(true);
      expect(result.mcpJsonCreated).toBe(true);
    });

    it('generates CLAUDE.md with Claude-specific content', () => {
      fs.writeFileSync(path.join(tempDir, 'wpnav.config.json'), '{}');

      performClaudeSetup(tempDir);

      const content = fs.readFileSync(path.join(tempDir, 'CLAUDE.md'), 'utf8');
      expect(content).toContain('# CLAUDE.md - WP Navigator Project');
      expect(content).toContain('## Overview');
      expect(content).toContain('.mcp.json');
    });

    it('sets smokeTestPassed to null initially', () => {
      fs.writeFileSync(path.join(tempDir, 'wpnav.config.json'), '{}');

      const result = performClaudeSetup(tempDir);

      expect(result.smokeTestPassed).toBeNull();
    });
  });

  describe('handleClaudeSetup', () => {
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
      const exitCode = await handleClaudeSetup({});

      expect(exitCode).toBe(1);
    });

    it('fails with JSON error when config missing', async () => {
      const exitCode = await handleClaudeSetup({ json: true });

      expect(exitCode).toBe(1);
      expect(consoleLogSpy).toHaveBeenCalled();

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
      expect(output.success).toBe(false);
      expect(output.error.code).toBe('CONFIG_NOT_FOUND');
    });

    it('succeeds when wpnav.config.json exists', async () => {
      fs.writeFileSync(path.join(tempDir, 'wpnav.config.json'), '{}');

      const exitCode = await handleClaudeSetup({});

      expect(exitCode).toBe(0);
      expect(fs.existsSync(path.join(tempDir, 'CLAUDE.md'))).toBe(true);
      expect(fs.existsSync(path.join(tempDir, '.mcp.json'))).toBe(true);
    });

    it('returns JSON output with success data', async () => {
      fs.writeFileSync(path.join(tempDir, 'wpnav.config.json'), '{}');

      const exitCode = await handleClaudeSetup({ json: true });

      expect(exitCode).toBe(0);
      expect(consoleLogSpy).toHaveBeenCalled();

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
      expect(output.success).toBe(true);
      expect(output.command).toBe('claude-setup');
      expect(output.data.claude_md_created).toBe(true);
      expect(output.data.mcp_json_created).toBe(true);
    });

    it('returns claude_md_overwritten true when CLAUDE.md exists', async () => {
      fs.writeFileSync(path.join(tempDir, 'wpnav.config.json'), '{}');
      fs.writeFileSync(path.join(tempDir, 'CLAUDE.md'), '# Old');

      const exitCode = await handleClaudeSetup({ json: true });

      expect(exitCode).toBe(0);
      const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
      expect(output.data.claude_md_overwritten).toBe(true);
    });

    it('returns mcp_json_overwritten true when .mcp.json exists', async () => {
      fs.writeFileSync(path.join(tempDir, 'wpnav.config.json'), '{}');
      fs.writeFileSync(path.join(tempDir, '.mcp.json'), '{}');

      const exitCode = await handleClaudeSetup({ json: true });

      expect(exitCode).toBe(0);
      const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
      expect(output.data.mcp_json_overwritten).toBe(true);
    });

    it('is idempotent (safe to run twice)', async () => {
      fs.writeFileSync(path.join(tempDir, 'wpnav.config.json'), '{}');

      // First run
      const exitCode1 = await handleClaudeSetup({ json: true });
      expect(exitCode1).toBe(0);

      // Second run
      const exitCode2 = await handleClaudeSetup({ json: true });
      expect(exitCode2).toBe(0);

      // Files should still exist and be valid
      expect(fs.existsSync(path.join(tempDir, 'CLAUDE.md'))).toBe(true);
      expect(fs.existsSync(path.join(tempDir, '.mcp.json'))).toBe(true);
    });

    it('includes smoke_test_passed in JSON output', async () => {
      fs.writeFileSync(path.join(tempDir, 'wpnav.config.json'), '{}');

      const exitCode = await handleClaudeSetup({ json: true });

      expect(exitCode).toBe(0);
      const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
      expect('smoke_test_passed' in output.data).toBe(true);
    });
  });

  describe('CLAUDE.md content', () => {
    it('includes required sections for Claude Code users', () => {
      fs.writeFileSync(path.join(tempDir, 'wpnav.config.json'), '{}');

      performClaudeSetup(tempDir);

      const content = fs.readFileSync(path.join(tempDir, 'CLAUDE.md'), 'utf8');

      // Must have these sections
      expect(content).toContain('## Overview');
      expect(content).toContain('## Quick Start');
      expect(content).toContain('## Safety Defaults');
      expect(content).toContain('## Available CLI Commands');
      expect(content).toContain('## MCP Tool Categories');
      expect(content).toContain('## Common Workflows');
      expect(content).toContain('## Project Files');
      expect(content).toContain('## Troubleshooting');
      expect(content).toContain('## Resources');
    });

    it('references .mcp.json in project files table', () => {
      fs.writeFileSync(path.join(tempDir, 'wpnav.config.json'), '{}');

      performClaudeSetup(tempDir);

      const content = fs.readFileSync(path.join(tempDir, 'CLAUDE.md'), 'utf8');
      expect(content).toContain('.mcp.json');
    });

    it('includes all 13 tool categories', () => {
      fs.writeFileSync(path.join(tempDir, 'wpnav.config.json'), '{}');

      performClaudeSetup(tempDir);

      const content = fs.readFileSync(path.join(tempDir, 'CLAUDE.md'), 'utf8');

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
  });

  describe('.mcp.json content', () => {
    it('has correct MCP server configuration', () => {
      fs.writeFileSync(path.join(tempDir, 'wpnav.config.json'), '{}');

      performClaudeSetup(tempDir);

      const mcpJson = JSON.parse(fs.readFileSync(path.join(tempDir, '.mcp.json'), 'utf8'));

      expect(mcpJson.mcpServers.wpnav.command).toBe('npx');
      expect(mcpJson.mcpServers.wpnav.args).toEqual([
        '-y',
        '@littlebearapps/wp-navigator-mcp',
        './wpnav.config.json',
      ]);
    });

    it('sets writes disabled by default', () => {
      fs.writeFileSync(path.join(tempDir, 'wpnav.config.json'), '{}');

      performClaudeSetup(tempDir);

      const mcpJson = JSON.parse(fs.readFileSync(path.join(tempDir, '.mcp.json'), 'utf8'));

      expect(mcpJson.mcpServers.wpnav.env.WPNAV_ENABLE_WRITES).toBe('0');
    });
  });
});
