/**
 * WP Navigator MCP Config Command
 *
 * Generates copy-paste ready MCP configuration snippets for various platforms.
 * Supports Claude Code, OpenAI Codex, and Google Gemini CLI.
 *
 * @package WP_Navigator_MCP
 * @since 2.3.0
 */

import * as fs from 'fs';
import * as path from 'path';
import { selectPrompt } from '../tui/prompts.js';
import { success, error as errorMessage, info, newline, colorize, box } from '../tui/components.js';

// =============================================================================
// Types
// =============================================================================

export type Platform = 'claude' | 'codex' | 'gemini';

export interface McpConfigOptions {
  claude?: boolean;
  codex?: boolean;
  gemini?: boolean;
  all?: boolean;
  json?: boolean;
}

// =============================================================================
// Config Generators
// =============================================================================

/**
 * Get the config file path relative to current directory
 * Prefers wpnav.config.json if exists, falls back to wp-config.json
 */
function getConfigPath(cwd: string): string {
  const wpnavPath = path.join(cwd, 'wpnav.config.json');
  const wpConfigPath = path.join(cwd, 'wp-config.json');

  if (fs.existsSync(wpnavPath)) {
    return './wpnav.config.json';
  }
  if (fs.existsSync(wpConfigPath)) {
    return './wp-config.json';
  }
  // Default to wpnav.config.json (the new format)
  return './wpnav.config.json';
}

/**
 * Generate Claude Code MCP configuration (.mcp.json)
 */
export function generateClaudeConfig(configPath: string): string {
  const config = {
    mcpServers: {
      wpnav: {
        command: 'npx',
        args: ['-y', '@littlebearapps/wp-navigator-mcp', configPath],
      },
    },
  };

  return JSON.stringify(config, null, 2);
}

/**
 * Generate OpenAI Codex TOML configuration (config.toml)
 */
export function generateCodexConfig(configPath: string): string {
  const lines = [
    '[mcp_servers.wpnav]',
    'command = "npx"',
    `args = ["-y", "@littlebearapps/wp-navigator-mcp", "${configPath}"]`,
  ];

  return lines.join('\n');
}

/**
 * Generate Google Gemini CLI configuration (settings.json)
 */
export function generateGeminiConfig(configPath: string): string {
  const config = {
    mcpServers: {
      wpnav: {
        command: 'npx',
        args: ['-y', '@littlebearapps/wp-navigator-mcp', configPath],
      },
    },
  };

  return JSON.stringify(config, null, 2);
}

// =============================================================================
// Platform Metadata
// =============================================================================

interface PlatformInfo {
  name: string;
  file: string;
  description: string;
  generate: (configPath: string) => string;
}

const PLATFORMS: Record<Platform, PlatformInfo> = {
  claude: {
    name: 'Claude Code',
    file: '.mcp.json',
    description: 'Anthropic Claude Code CLI',
    generate: generateClaudeConfig,
  },
  codex: {
    name: 'OpenAI Codex',
    file: 'config.toml',
    description: 'OpenAI Codex CLI',
    generate: generateCodexConfig,
  },
  gemini: {
    name: 'Google Gemini CLI',
    file: 'settings.json',
    description: 'Google Gemini CLI',
    generate: generateGeminiConfig,
  },
};

// =============================================================================
// Output Helpers
// =============================================================================

function outputJSON(data: unknown): void {
  console.log(JSON.stringify(data, null, 2));
}

function displayPlatformConfig(platform: Platform, configPath: string): void {
  const info = PLATFORMS[platform];
  const config = info.generate(configPath);

  newline();
  console.error(colorize(`${info.name} (${info.file})`, 'bold'));
  console.error(colorize(`─`.repeat(40), 'dim'));
  newline();
  console.log(config);
  newline();
}

function displayAllConfigs(configPath: string): void {
  const platforms: Platform[] = ['claude', 'codex', 'gemini'];

  console.error(colorize('MCP Configuration Snippets', 'bold'));
  console.error(colorize('Copy the appropriate snippet to your platform config file.', 'dim'));

  for (const platform of platforms) {
    displayPlatformConfig(platform, configPath);
  }
}

// =============================================================================
// Main Handler
// =============================================================================

/**
 * Handle the mcp-config command
 * @returns Exit code: 0 for success, 11 for platform setup failure
 */
export async function handleMcpConfig(options: McpConfigOptions = {}): Promise<number> {
  const cwd = process.cwd();
  const isJson = options.json === true;

  // Get config path
  const configPath = getConfigPath(cwd);

  // Check if any config file exists
  const configExists =
    fs.existsSync(path.join(cwd, 'wpnav.config.json')) ||
    fs.existsSync(path.join(cwd, 'wp-config.json'));

  if (!configExists) {
    if (isJson) {
      outputJSON({
        success: false,
        command: 'mcp-config',
        error: {
          code: 'CONFIG_NOT_FOUND',
          message: 'No configuration file found. Run "wpnav init" first.',
        },
      });
    } else {
      errorMessage('Configuration not found', 'Run "wpnav init" first to initialize your project.');
    }
    return 11;
  }

  // Determine which platform(s) to show
  let platforms: Platform[] = [];

  if (options.all) {
    platforms = ['claude', 'codex', 'gemini'];
  } else if (options.claude) {
    platforms = ['claude'];
  } else if (options.codex) {
    platforms = ['codex'];
  } else if (options.gemini) {
    platforms = ['gemini'];
  }

  // If no platform specified, prompt for selection (unless JSON mode)
  if (platforms.length === 0) {
    if (isJson) {
      // In JSON mode, default to all platforms
      platforms = ['claude', 'codex', 'gemini'];
    } else {
      // Interactive mode - prompt for platform
      newline();
      console.error(colorize('MCP Configuration Generator', 'bold'));
      newline();

      const selectedPlatform = await selectPrompt({
        message: 'Select your AI platform:',
        choices: [
          { value: 'claude', label: 'Claude Code (Anthropic)' },
          { value: 'codex', label: 'OpenAI Codex' },
          { value: 'gemini', label: 'Google Gemini CLI' },
        ],
      });

      if (!selectedPlatform) {
        // User cancelled
        return 0;
      }

      platforms = [selectedPlatform as Platform];
    }
  }

  // Generate and output configurations
  if (isJson) {
    const configs: Record<string, { file: string; config: string }> = {};
    for (const platform of platforms) {
      const info = PLATFORMS[platform];
      configs[platform] = {
        file: info.file,
        config: info.generate(configPath),
      };
    }

    outputJSON({
      success: true,
      command: 'mcp-config',
      data: {
        config_path: configPath,
        platforms: configs,
      },
    });
  } else {
    if (platforms.length === 1) {
      displayPlatformConfig(platforms[0], configPath);
      const platformInfo = PLATFORMS[platforms[0]];
      info('Copy the above configuration to your ' + platformInfo.file + ' file.');
    } else {
      displayAllConfigs(configPath);
    }
  }

  return 0;
}

export default handleMcpConfig;
