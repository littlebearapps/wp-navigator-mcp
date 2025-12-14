/**
 * WP Navigator Claude Setup Command
 *
 * Adds Claude Code support to existing WP Navigator projects.
 * Creates CLAUDE.md and .mcp.json for Claude Code integration.
 *
 * @package WP_Navigator_MCP
 * @since 2.3.0
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  generateClaudeMd,
  generateMcpJson,
  getDefaultClaudeMdContext,
  type ClaudeMdContext,
} from '../init/generators.js';
import {
  success,
  error as errorMessage,
  info,
  newline,
  colorize,
} from '../tui/components.js';

// =============================================================================
// Types
// =============================================================================

export interface ClaudeSetupOptions {
  yes?: boolean; // Skip confirmation
  json?: boolean; // Output JSON instead of TUI
}

export interface ClaudeSetupResult {
  claudeMdCreated: boolean;
  claudeMdOverwritten: boolean;
  mcpJsonCreated: boolean;
  mcpJsonOverwritten: boolean;
  smokeTestPassed: boolean | null; // null = not run (no credentials)
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
 * Run a simple smoke test to verify WordPress connection
 * Returns true if connection works, false if failed, null if can't test (no credentials)
 */
async function runSmokeTest(cwd: string): Promise<boolean | null> {
  try {
    // Try to load .wpnav.env or wpnav.config.json for connection info
    const envPath = path.join(cwd, '.wpnav.env');
    const configPath = path.join(cwd, 'wpnav.config.json');

    let siteUrl: string | undefined;
    let username: string | undefined;
    let password: string | undefined;

    // Check .wpnav.env first
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      const lines = envContent.split('\n');
      for (const line of lines) {
        const [key, ...valueParts] = line.split('=');
        const value = valueParts.join('=').trim();
        if (key === 'WP_BASE_URL') siteUrl = value;
        if (key === 'WP_APP_USER') username = value;
        if (key === 'WP_APP_PASS') password = value;
      }
    }

    // Fall back to config environments
    if (!siteUrl && fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      const envConfig = config.environments?.default || config.environments?.local;
      if (envConfig?.site_url) siteUrl = envConfig.site_url;
      if (envConfig?.username) username = envConfig.username;
      if (envConfig?.app_password) password = envConfig.app_password;
    }

    // Can't test without credentials
    if (!siteUrl || !username || !password) {
      return null;
    }

    // Try a simple request to the site (just check if reachable)
    const restUrl = siteUrl.replace(/\/$/, '') + '/wp-json';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(restUrl, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`,
        },
      });
      clearTimeout(timeout);
      return response.ok || response.status === 401; // 401 means auth is required but site is reachable
    } catch {
      clearTimeout(timeout);
      return false;
    }
  } catch {
    return null;
  }
}

/**
 * Perform the Claude setup
 */
export function performClaudeSetup(cwd: string): ClaudeSetupResult {
  const result: ClaudeSetupResult = {
    claudeMdCreated: false,
    claudeMdOverwritten: false,
    mcpJsonCreated: false,
    mcpJsonOverwritten: false,
    smokeTestPassed: null,
  };

  // Build context for template
  const siteInfo = readSiteInfo(cwd);
  const context = getDefaultClaudeMdContext(siteInfo);

  // Generate CLAUDE.md
  const claudeMdPath = path.join(cwd, 'CLAUDE.md');
  const claudeMdExists = fs.existsSync(claudeMdPath);

  const claudeMdContent = generateClaudeMd(context);
  fs.writeFileSync(claudeMdPath, claudeMdContent, 'utf8');

  result.claudeMdCreated = true;
  result.claudeMdOverwritten = claudeMdExists;

  // Generate .mcp.json
  const mcpJsonPath = path.join(cwd, '.mcp.json');
  const mcpJsonExists = fs.existsSync(mcpJsonPath);

  const mcpJsonContent = generateMcpJson({
    configPath: './wpnav.config.json',
    enableWrites: false, // Safe by default
  });
  fs.writeFileSync(mcpJsonPath, mcpJsonContent, 'utf8');

  result.mcpJsonCreated = true;
  result.mcpJsonOverwritten = mcpJsonExists;

  return result;
}

// =============================================================================
// Display Functions
// =============================================================================

/**
 * Display setup results
 */
function displayResults(result: ClaudeSetupResult): void {
  if (result.claudeMdCreated) {
    if (result.claudeMdOverwritten) {
      success('Updated CLAUDE.md');
    } else {
      success('Created CLAUDE.md');
    }
  }

  if (result.mcpJsonCreated) {
    if (result.mcpJsonOverwritten) {
      success('Updated .mcp.json');
    } else {
      success('Created .mcp.json');
    }
  }
}

/**
 * Display smoke test result
 */
function displaySmokeTestResult(passed: boolean | null): void {
  if (passed === true) {
    success('Connection verified!');
  } else if (passed === false) {
    info('Could not verify connection (site may be unreachable)');
  }
  // null = credentials not available, don't display anything
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
 * Handle the claude-setup command
 * @returns Exit code: 0 for success, 1 for errors
 */
export async function handleClaudeSetup(options: ClaudeSetupOptions = {}): Promise<number> {
  const cwd = process.cwd();
  const isJson = options.json === true;

  // Check for existing wpnav.config.json (require prior init)
  const configPath = path.join(cwd, 'wpnav.config.json');
  if (!fs.existsSync(configPath)) {
    if (isJson) {
      outputJSON({
        success: false,
        command: 'claude-setup',
        error: {
          code: 'CONFIG_NOT_FOUND',
          message: 'No wpnav.config.json found. Run "wpnav init" first.',
        },
      });
    } else {
      errorMessage('No wpnav.config.json found.', 'Run "wpnav init" first to initialize your project.');
    }
    return 1;
  }

  // Perform setup
  let result: ClaudeSetupResult;
  try {
    result = performClaudeSetup(cwd);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    if (isJson) {
      outputJSON({
        success: false,
        command: 'claude-setup',
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

  // Run smoke test
  result.smokeTestPassed = await runSmokeTest(cwd);

  // Output results
  if (isJson) {
    outputJSON({
      success: true,
      command: 'claude-setup',
      data: {
        claude_md_created: result.claudeMdCreated,
        claude_md_overwritten: result.claudeMdOverwritten,
        mcp_json_created: result.mcpJsonCreated,
        mcp_json_overwritten: result.mcpJsonOverwritten,
        smoke_test_passed: result.smokeTestPassed,
      },
    });
  } else {
    // TUI mode
    newline();
    console.error(`${colorize('Claude Setup', 'bold')}`);
    newline();

    displayResults(result);
    displaySmokeTestResult(result.smokeTestPassed);

    newline();
    success('Claude Code is ready!');
    info('Start a new Claude Code session in this directory.');
  }

  return 0;
}

export default handleClaudeSetup;
