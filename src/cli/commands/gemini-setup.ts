/**
 * WP Navigator Gemini Setup Command
 *
 * Adds Google Gemini CLI support to existing WP Navigator projects.
 * Creates GEMINI.md and .gemini/ directory for Gemini integration.
 *
 * @package WP_Navigator_MCP
 * @since 2.3.0
 */

import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import {
  generateGeminiMd,
  getDefaultClaudeMdContext,
  type ClaudeMdContext,
} from '../init/generators.js';
import { success, error as errorMessage, info, newline, colorize, box } from '../tui/components.js';

// =============================================================================
// Types
// =============================================================================

export interface GeminiSetupOptions {
  yes?: boolean; // Skip confirmation
  json?: boolean; // Output JSON instead of TUI
}

export interface GeminiSetupResult {
  geminiMdCreated: boolean;
  geminiMdOverwritten: boolean;
  geminiDirCreated: boolean;
  configSnippet: string;
  copiedToClipboard: boolean;
}

// =============================================================================
// Constants
// =============================================================================

const GEMINI_CONFIG_SNIPPET = `{
  "mcpServers": {
    "wpnav": {
      "command": "npx",
      "args": ["-y", "@littlebearapps/wp-navigator-mcp", "./wpnav.config.json"]
    }
  }
}`;

// =============================================================================
// Clipboard Utilities
// =============================================================================

/**
 * Copy text to system clipboard (cross-platform)
 * Uses spawn to pipe text to clipboard commands
 */
function copyToClipboard(text: string): Promise<boolean> {
  return new Promise((resolve) => {
    let cmd: string;
    let args: string[];

    if (process.platform === 'darwin') {
      // macOS: use pbcopy
      cmd = 'pbcopy';
      args = [];
    } else if (process.platform === 'linux') {
      // Linux: use xclip
      cmd = 'xclip';
      args = ['-selection', 'clipboard'];
    } else if (process.platform === 'win32') {
      // Windows: use clip.exe
      cmd = 'clip';
      args = [];
    } else {
      resolve(false);
      return;
    }

    try {
      const proc = spawn(cmd, args, { stdio: ['pipe', 'ignore', 'ignore'] });

      proc.on('error', () => {
        resolve(false);
      });

      proc.on('close', (code) => {
        resolve(code === 0);
      });

      proc.stdin.write(text);
      proc.stdin.end();
    } catch {
      resolve(false);
    }
  });
}

// =============================================================================
// Setup Functions
// =============================================================================

/**
 * Read site info from wpnav.config.json if available
 */
function readSiteInfo(cwd: string): Partial<ClaudeMdContext> {
  const configPath = path.join(cwd, 'wpnav.config.json');
  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const result: Partial<ClaudeMdContext> = {};

    // Try to get site URL from environments.default or environments.local
    const envConfig = config.environments?.default || config.environments?.local;
    if (envConfig?.site_url) {
      result.site_url = envConfig.site_url;
    }

    // Try to get site name from manifest reference or environment
    if (envConfig?.site_name) {
      result.site_name = envConfig.site_name;
    }

    // Try to get environment
    if (config.default_environment) {
      result.environment = config.default_environment;
    }

    return result;
  } catch {
    return {};
  }
}

/**
 * Perform the Gemini setup
 */
export function performGeminiSetup(cwd: string): GeminiSetupResult {
  const result: GeminiSetupResult = {
    geminiMdCreated: false,
    geminiMdOverwritten: false,
    geminiDirCreated: false,
    configSnippet: GEMINI_CONFIG_SNIPPET,
    copiedToClipboard: false,
  };

  // Build context for template
  const siteInfo = readSiteInfo(cwd);
  const context = getDefaultClaudeMdContext(siteInfo);

  // Generate GEMINI.md
  const geminiMdPath = path.join(cwd, 'GEMINI.md');
  const geminiMdExists = fs.existsSync(geminiMdPath);

  const geminiMdContent = generateGeminiMd(context);
  fs.writeFileSync(geminiMdPath, geminiMdContent, 'utf8');

  result.geminiMdCreated = true;
  result.geminiMdOverwritten = geminiMdExists;

  // Create .gemini/ directory
  const geminiDir = path.join(cwd, '.gemini');
  if (!fs.existsSync(geminiDir)) {
    fs.mkdirSync(geminiDir, { recursive: true });
    result.geminiDirCreated = true;
  }

  return result;
}

// =============================================================================
// Display Functions
// =============================================================================

/**
 * Display the settings.json snippet
 */
function displayConfigSnippet(): void {
  newline();
  info('Add this to your ~/.gemini/settings.json:');
  newline();
  box(GEMINI_CONFIG_SNIPPET, { title: 'settings.json' });
}

/**
 * Display setup results
 */
function displayResults(result: GeminiSetupResult): void {
  if (result.geminiMdCreated) {
    if (result.geminiMdOverwritten) {
      success('Updated GEMINI.md');
    } else {
      success('Created GEMINI.md');
    }
  }

  if (result.geminiDirCreated) {
    success('Created .gemini/ directory');
  }
}

// =============================================================================
// Main Handler
// =============================================================================

/**
 * Output JSON result to stdout
 */
function outputJSON(data: unknown): void {
  console.log(JSON.stringify(data, null, 2));
}

/**
 * Handle the gemini-setup command
 * @returns Exit code: 0 for success, 1 for errors
 */
export async function handleGeminiSetup(options: GeminiSetupOptions = {}): Promise<number> {
  const cwd = process.cwd();
  const isJson = options.json === true;

  // Check for existing wpnav.config.json (require prior init)
  const configPath = path.join(cwd, 'wpnav.config.json');
  if (!fs.existsSync(configPath)) {
    if (isJson) {
      outputJSON({
        success: false,
        command: 'gemini-setup',
        error: {
          code: 'CONFIG_NOT_FOUND',
          message: 'No wpnav.config.json found. Run "wpnav init" first.',
        },
      });
    } else {
      errorMessage(
        'No wpnav.config.json found.',
        'Run "wpnav init" first to initialize your project.'
      );
    }
    return 1;
  }

  // Perform setup
  let result: GeminiSetupResult;
  try {
    result = performGeminiSetup(cwd);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    if (isJson) {
      outputJSON({
        success: false,
        command: 'gemini-setup',
        error: {
          code: 'SETUP_FAILED',
          message: errorMsg,
        },
      });
    } else {
      errorMessage('Setup failed', errorMsg);
    }
    return 1;
  }

  // Try to copy to clipboard
  result.copiedToClipboard = await copyToClipboard(GEMINI_CONFIG_SNIPPET);

  // Output results
  if (isJson) {
    outputJSON({
      success: true,
      command: 'gemini-setup',
      data: {
        gemini_md_created: result.geminiMdCreated,
        gemini_md_overwritten: result.geminiMdOverwritten,
        gemini_dir_created: result.geminiDirCreated,
        config_snippet: result.configSnippet,
        copied_to_clipboard: result.copiedToClipboard,
      },
    });
  } else {
    // TUI mode
    newline();
    console.error(`${colorize('Gemini Setup', 'bold')}`);
    newline();

    displayResults(result);
    displayConfigSnippet();

    newline();
    if (result.copiedToClipboard) {
      success('Copied to clipboard!');
    } else {
      info('Copy the snippet above to your config file');
    }

    newline();
    success('Google Gemini CLI is ready!');
    info('Open this project in Gemini CLI to start using WP Navigator.');
  }

  return 0;
}

export default handleGeminiSetup;
