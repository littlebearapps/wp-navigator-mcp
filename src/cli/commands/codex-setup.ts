/**
 * WP Navigator Codex Setup Command
 *
 * Adds OpenAI Codex support to existing WP Navigator projects.
 * Creates AGENTS.md and .codex/ directory for Codex integration.
 *
 * @package WP_Navigator_Pro
 * @since 2.3.0
 */

import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import {
  generateAgentsMd,
  getDefaultClaudeMdContext,
  type ClaudeMdContext,
} from '../init/generators.js';
import {
  success,
  error as errorMessage,
  warning,
  info,
  newline,
  colorize,
  colors,
  box,
} from '../tui/components.js';

// =============================================================================
// Types
// =============================================================================

export interface CodexSetupOptions {
  yes?: boolean; // Skip confirmation
  json?: boolean; // Output JSON instead of TUI
}

export interface CodexSetupResult {
  agentsMdCreated: boolean;
  agentsMdOverwritten: boolean;
  codexDirCreated: boolean;
  configSnippet: string;
  copiedToClipboard: boolean;
}

// =============================================================================
// Constants
// =============================================================================

const CODEX_CONFIG_SNIPPET = `[mcp_servers.wpnav]
command = "npx"
args = ["-y", "@littlebearapps/wp-navigator-mcp", "./wpnav.config.json"]`;

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
 * Perform the Codex setup
 */
export function performCodexSetup(cwd: string): CodexSetupResult {
  const result: CodexSetupResult = {
    agentsMdCreated: false,
    agentsMdOverwritten: false,
    codexDirCreated: false,
    configSnippet: CODEX_CONFIG_SNIPPET,
    copiedToClipboard: false,
  };

  // Build context for template
  const siteInfo = readSiteInfo(cwd);
  const context = getDefaultClaudeMdContext(siteInfo);

  // Generate AGENTS.md
  const agentsMdPath = path.join(cwd, 'AGENTS.md');
  const agentsMdExists = fs.existsSync(agentsMdPath);

  const agentsMdContent = generateAgentsMd(context);
  fs.writeFileSync(agentsMdPath, agentsMdContent, 'utf8');

  result.agentsMdCreated = true;
  result.agentsMdOverwritten = agentsMdExists;

  // Create .codex/ directory
  const codexDir = path.join(cwd, '.codex');
  if (!fs.existsSync(codexDir)) {
    fs.mkdirSync(codexDir, { recursive: true });
    result.codexDirCreated = true;
  }

  return result;
}

// =============================================================================
// Display Functions
// =============================================================================

/**
 * Display the config.toml snippet
 */
function displayConfigSnippet(): void {
  newline();
  info('Add this to your ~/.codex/config.toml:');
  newline();
  box(CODEX_CONFIG_SNIPPET, { title: 'config.toml' });
}

/**
 * Display setup results
 */
function displayResults(result: CodexSetupResult): void {
  if (result.agentsMdCreated) {
    if (result.agentsMdOverwritten) {
      success('Updated AGENTS.md');
    } else {
      success('Created AGENTS.md');
    }
  }

  if (result.codexDirCreated) {
    success('Created .codex/ directory');
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
 * Handle the codex-setup command
 * @returns Exit code: 0 for success, 1 for errors
 */
export async function handleCodexSetup(options: CodexSetupOptions = {}): Promise<number> {
  const cwd = process.cwd();
  const isJson = options.json === true;

  // Check for existing wpnav.config.json (require prior init)
  const configPath = path.join(cwd, 'wpnav.config.json');
  if (!fs.existsSync(configPath)) {
    if (isJson) {
      outputJSON({
        success: false,
        command: 'codex-setup',
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
  let result: CodexSetupResult;
  try {
    result = performCodexSetup(cwd);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    if (isJson) {
      outputJSON({
        success: false,
        command: 'codex-setup',
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
  result.copiedToClipboard = await copyToClipboard(CODEX_CONFIG_SNIPPET);

  // Output results
  if (isJson) {
    outputJSON({
      success: true,
      command: 'codex-setup',
      data: {
        agents_md_created: result.agentsMdCreated,
        agents_md_overwritten: result.agentsMdOverwritten,
        codex_dir_created: result.codexDirCreated,
        config_snippet: result.configSnippet,
        copied_to_clipboard: result.copiedToClipboard,
      },
    });
  } else {
    // TUI mode
    newline();
    console.error(`${colorize('Codex Setup', 'bold')}`);
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
    success('OpenAI Codex is ready!');
    info('Open this project in Codex to start using WP Navigator.');
  }

  return 0;
}

export default handleCodexSetup;
