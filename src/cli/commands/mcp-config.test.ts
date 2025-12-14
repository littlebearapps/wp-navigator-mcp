/**
 * MCP Config Command Tests
 *
 * @package WP_Navigator_MCP
 * @since 2.3.0
 */

import { describe, it, expect } from 'vitest';
import { generateClaudeConfig, generateCodexConfig, generateGeminiConfig } from './mcp-config.js';

describe('mcp-config', () => {
  const configPath = './wpnav.config.json';

  describe('generateClaudeConfig', () => {
    it('generates valid Claude Code .mcp.json config', () => {
      const config = generateClaudeConfig(configPath);
      const parsed = JSON.parse(config);

      expect(parsed.mcpServers).toBeDefined();
      expect(parsed.mcpServers.wpnav).toBeDefined();
      expect(parsed.mcpServers.wpnav.command).toBe('npx');
      expect(parsed.mcpServers.wpnav.args).toEqual([
        '-y',
        '@littlebearapps/wp-navigator-mcp',
        './wpnav.config.json',
      ]);
    });

    it('uses provided config path', () => {
      const config = generateClaudeConfig('./custom/path.json');
      const parsed = JSON.parse(config);

      expect(parsed.mcpServers.wpnav.args[2]).toBe('./custom/path.json');
    });

    it('produces pretty-printed JSON', () => {
      const config = generateClaudeConfig(configPath);

      // Should have newlines and indentation
      expect(config).toContain('\n');
      expect(config).toContain('  ');
    });
  });

  describe('generateCodexConfig', () => {
    it('generates valid TOML config for Codex', () => {
      const config = generateCodexConfig(configPath);

      expect(config).toContain('[mcp_servers.wpnav]');
      expect(config).toContain('command = "npx"');
      expect(config).toContain(
        'args = ["-y", "@littlebearapps/wp-navigator-mcp", "./wpnav.config.json"]'
      );
    });

    it('uses provided config path', () => {
      const config = generateCodexConfig('./custom/path.json');

      expect(config).toContain('./custom/path.json');
    });
  });

  describe('generateGeminiConfig', () => {
    it('generates valid Gemini settings.json config', () => {
      const config = generateGeminiConfig(configPath);
      const parsed = JSON.parse(config);

      expect(parsed.mcpServers).toBeDefined();
      expect(parsed.mcpServers.wpnav).toBeDefined();
      expect(parsed.mcpServers.wpnav.command).toBe('npx');
      expect(parsed.mcpServers.wpnav.args).toEqual([
        '-y',
        '@littlebearapps/wp-navigator-mcp',
        './wpnav.config.json',
      ]);
    });

    it('uses provided config path', () => {
      const config = generateGeminiConfig('./custom/path.json');
      const parsed = JSON.parse(config);

      expect(parsed.mcpServers.wpnav.args[2]).toBe('./custom/path.json');
    });
  });

  describe('config format consistency', () => {
    it('Claude and Gemini generate same structure', () => {
      const claude = JSON.parse(generateClaudeConfig(configPath));
      const gemini = JSON.parse(generateGeminiConfig(configPath));

      // Both should have same structure (mcpServers.wpnav)
      expect(claude.mcpServers.wpnav.command).toBe(gemini.mcpServers.wpnav.command);
      expect(claude.mcpServers.wpnav.args).toEqual(gemini.mcpServers.wpnav.args);
    });

    it('all configs use npx command', () => {
      const claude = JSON.parse(generateClaudeConfig(configPath));
      const gemini = JSON.parse(generateGeminiConfig(configPath));
      const codex = generateCodexConfig(configPath);

      expect(claude.mcpServers.wpnav.command).toBe('npx');
      expect(gemini.mcpServers.wpnav.command).toBe('npx');
      expect(codex).toContain('command = "npx"');
    });

    it('all configs use -y flag for auto-install', () => {
      const claude = JSON.parse(generateClaudeConfig(configPath));
      const gemini = JSON.parse(generateGeminiConfig(configPath));
      const codex = generateCodexConfig(configPath);

      expect(claude.mcpServers.wpnav.args[0]).toBe('-y');
      expect(gemini.mcpServers.wpnav.args[0]).toBe('-y');
      expect(codex).toContain('"-y"');
    });
  });
});
