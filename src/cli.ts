#!/usr/bin/env node

/**
 * WP Navigator CLI
 *
 * Direct command-line interface for WordPress management.
 * Runs independently of MCP protocol - useful for scripting and testing.
 *
 * Usage:
 *   npx wpnav <command> [options]
 *
 * Commands:
 *   call <tool> [--param value]  - Invoke a tool directly
 *   tools [--category <cat>]     - List available tools
 *   status                       - Check WordPress connection
 *   help                         - Show this help message
 *
 * @package WP_Navigator_Pro
 * @since 1.1.0
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  inputPrompt,
  selectPrompt,
  confirmPrompt,
} from './cli/tui/prompts.js';
import {
  success,
  error as errorMessage,
  warning,
  info,
  newline,
  box,
  keyValue,
  createSpinner,
  colorize,
  colors,
  list,
  modeIndicator,
} from './cli/tui/components.js';
import {
  WPNAV_URLS,
  resourceLinks,
  troubleshootLink,
  wpnavLink,
} from './cli/tui/links.js';
import { loadEnvFromArgOrDotEnv, getConfigOrExit, WPConfig } from './config.js';
import {
  loadWpnavConfig,
  toLegacyConfig,
  discoverConfigFile,
  parseConfigFile,
  resolveConfig,
  containsEnvVars,
  ConfigValidationError,
  type ResolvedConfig,
  type WPNavConfigFile,
} from './wpnav-config.js';
import {
  SNAPSHOT_VERSION,
  SNAPSHOT_PATHS,
  type SiteIndexSnapshot,
  type PageSnapshot,
  type PageSummary,
  type PostSummary,
  type PluginInfo,
  type ThemeCustomizerSnapshot,
  type SidebarWidgets,
  type WidgetInstance,
  type SiteIdentitySnapshot,
  type PluginSettingsSnapshot,
  type PluginSettingsExtractionResult,
} from './snapshots/index.js';
import {
  getExtractor,
  getSupportedPlugins,
  hasSpecificExtractor,
} from './plugin-extractors/index.js';
import { parseGutenbergBlocks } from './gutenberg/index.js';
import { loadManifest, type WPNavManifest } from './manifest.js';
import {
  computeDiff,
  formatDiffText,
  formatDiffJson,
  snapshotToWordPressPages,
  snapshotToWordPressPlugins,
  type WordPressPage,
  type WordPressPlugin,
} from './diff.js';
import {
  executeSync,
  formatSyncText,
  formatSyncJson,
} from './sync.js';
import {
  findKeyPosition,
  formatValidationErrorJson,
  type ValidationError as FormattedValidationError,
  type SourcePosition,
} from './validation-errors.js';
import { makeWpRequest } from './http.js';
import { toolRegistry } from './tool-registry/index.js';
import { registerAllTools } from './tools/index.js';
import { logger } from './logger.js';
import { clampText } from './output.js';
import { summarizePageContent, isFirstSnapshot, getFirstSnapshotMessage } from './snapshot-summary.js';
import { checkBackupReminder } from './backup-reminder.js';
import {
  detectPlugin,
  checkMcpCompatibility,
  formatPluginMessage,
  type PluginDetectionResult,
} from './plugin-detection.js';
import {
  generateSyncId,
  createPreSyncSnapshot,
  savePreSyncSnapshot,
  listPreSyncSnapshots,
  loadPreSyncSnapshot,
  executeRollback,
  cleanupOldSnapshots,
  formatRollbackText,
  formatRollbackJson,
} from './rollback.js';
import { handleInit } from './cli/commands/init.js';
import { handleCleanup } from './cli/commands/cleanup.js';
import {
  resolveRole,
  formatRoleInfo,
  discoverRoles,
  listAvailableRoles,
  getRole,
  RoleNotFoundError,
  type LoadedRole,
  type ResolvedRole,
} from './roles/index.js';

// CLI version (matches package.json)
const CLI_VERSION = '2.1.3';

// Dry-run request collector
interface DryRunRequest {
  method: string;
  endpoint: string;
  body?: unknown;
}

let dryRunMode = false;
let dryRunRequests: DryRunRequest[] = [];

/**
 * Create a dry-run wrapper around wpRequest that captures requests instead of executing them
 */
function createDryRunRequest(realWpRequest: (endpoint: string, options?: RequestInit) => Promise<any>) {
  return async function dryRunWpRequest(endpoint: string, options?: RequestInit): Promise<any> {
    const method = (options?.method || 'GET').toUpperCase();
    const isWrite = method !== 'GET' && method !== 'HEAD';

    // For read operations in dry-run mode, execute them to gather context
    if (!isWrite) {
      return realWpRequest(endpoint, options);
    }

    // For write operations, capture the request instead of executing
    let body: unknown = undefined;
    if (options?.body) {
      try {
        body = JSON.parse(String(options.body));
      } catch {
        body = String(options.body);
      }
    }

    dryRunRequests.push({
      method,
      endpoint,
      body,
    });

    // Return a mock response for write operations
    return {
      dry_run: true,
      message: 'Write operation captured - not executed',
    };
  };
}

interface CLIContext {
  config: WPConfig;
  wpRequest: (endpoint: string, options?: RequestInit) => Promise<any>;
  /** Resolved role (if any) */
  role?: LoadedRole;
  /** Source of the resolved role */
  roleSource?: 'cli' | 'env' | 'config' | 'none';
}

/**
 * Parse command-line arguments into command and options
 */
function parseArgs(argv: string[]): { command: string; args: string[]; options: Record<string, string> } {
  // Skip node and script path
  const rawArgs = argv.slice(2);

  if (rawArgs.length === 0) {
    return { command: 'help', args: [], options: {} };
  }

  const command = rawArgs[0];
  const args: string[] = [];
  const options: Record<string, string> = {};

  let i = 1;
  while (i < rawArgs.length) {
    const arg = rawArgs[i];

    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const nextArg = rawArgs[i + 1];

      // Check if next arg is a value (not another flag)
      if (nextArg && !nextArg.startsWith('--')) {
        options[key] = nextArg;
        i += 2;
      } else {
        // Boolean flag
        options[key] = 'true';
        i += 1;
      }
    } else {
      args.push(arg);
      i += 1;
    }
  }

  return { command, args, options };
}

/**
 * Output JSON result to stdout
 */
function outputJSON(data: unknown): void {
  console.log(JSON.stringify(data, null, 2));
}

/**
 * Output error in consistent JSON format
 */
function outputError(code: string, message: string, details?: Record<string, unknown>): void {
  const errorObj: Record<string, unknown> = {
    code,
    message,
  };
  if (details) {
    errorObj.details = details;
  }
  const output = {
    success: false,
    error: errorObj,
  };
  console.error(JSON.stringify(output, null, 2));
}

/**
 * Show help message
 */
function showHelp(): void {
  const help = `
WP Navigator CLI v${CLI_VERSION}

Usage: npx wpnav <command> [options]

Commands:
  init                          Set up a new WP Navigator project (wizard)
  call <tool> [--param value]   Invoke a WordPress tool directly
  tools [--category <cat>]      List available tools
  roles [<name>]                List roles or show role details
  status                        Check WordPress connection status
  snapshot <subcommand>         Capture WordPress state to local files
  diff                          Compare manifest with WordPress state
  sync                          Apply manifest changes to WordPress
  validate                      Validate config and manifest files
  configure                     Set up WordPress connection credentials
  doctor                        Run system diagnostics
  cleanup                       Remove onboarding helper files
  help                          Show this help message

Global Options:
  --config <path>               Path to wpnav.config.json (or legacy wp-config.json)
  --env <name>                  Environment to use (local, staging, production)
  --role <name>                 AI role to use (e.g., content-editor, developer)
  --help                        Show this help message
  --version                     Show version number

Snapshot Subcommands:
  snapshot site                 Capture full site index (pages, posts, plugins)
  snapshot page <slug>          Capture a single page by slug
  snapshot pages                Capture all published pages

Snapshot Options:
  --output <dir>                Output directory (default: ./snapshots)
  --json                        Output results as JSON only (no file writes)

Diff Options:
  --json                        Output results as JSON (for CI/CD)
  --strict                      Flag extra pages in WP as removals
  --snapshot <path>             Use local snapshot instead of live API

Sync Options:
  --dry-run                     Show changes without applying them
  --yes                         Skip confirmation prompt
  --json                        Output results as JSON
  --skip-pages                  Skip page sync operations
  --skip-plugins                Skip plugin sync operations
  --delete                      Delete pages not in manifest (dangerous)

Validate Options:
  --json                        Output results as JSON (default: human-readable)
  --manifest                    Also validate wpnavigator.jsonc manifest
  --manifest-only               Validate only the manifest (skip config)
  --snapshots                   Validate snapshot files in snapshots/
  --strict                      Treat warnings as errors (exit code 1)
  --check-connection            Test connectivity to WordPress site

Configure Options:
  --site <url>                  WordPress site URL
  --user <username>             WordPress username
  --password <pass>             Application Password
  --silent                      Non-interactive mode (requires all options)
  --skip-test                   Skip connection test in silent mode

Doctor Options:
  --json                        Output results as JSON

Init Options:
  --mode <mode>                 Skip entry screen: guided, scaffold, ai-handoff
  --skip-confirm                Skip confirmation for existing projects
  --skip-smoke-test             Skip connection verification after config saved

Cleanup Options:
  --yes                         Skip confirmation prompt

Examples:
  npx wpnav init
  npx wpnav init --mode scaffold
  npx wpnav call wpnav_list_posts --limit 5
  npx wpnav call wpnav_get_post --id 123 --env production
  npx wpnav call wpnav_create_post --role content-editor --title "New Post"
  npx wpnav tools --category content
  npx wpnav roles
  npx wpnav roles content-editor
  npx wpnav roles --json
  npx wpnav status --env staging
  npx wpnav snapshot site
  npx wpnav snapshot page about
  npx wpnav snapshot pages --output ./my-snapshots
  npx wpnav validate
  npx wpnav validate --manifest --snapshots
  npx wpnav validate --manifest-only --json
  npx wpnav validate --check-connection --strict
  npx wpnav configure
  npx wpnav configure --silent --site https://example.com --user admin --password "xxxx xxxx"
  npx wpnav doctor
  npx wpnav doctor --json
  npx wpnav diff
  npx wpnav diff --json
  npx wpnav diff --snapshot ./snapshots/site_index.json
  npx wpnav sync --dry-run
  npx wpnav sync --yes
  npx wpnav sync --skip-plugins
  npx wpnav cleanup
  npx wpnav cleanup --yes

Configuration:
  Create wpnav.config.json in your project root:
  {
    "config_version": "1.0",
    "environments": {
      "local": { "site": "http://localhost:8080", "user": "admin", "password": "$WP_APP_PASS" },
      "production": { "site": "https://example.com", "user": "admin", "password": "$WP_APP_PASS" }
    }
  }

  Or set environment variables:
    WP_BASE_URL, WP_REST_API, WP_APP_USER, WP_APP_PASS, WPNAV_ROLE

  Environment selection (in order of precedence):
    1. --env flag
    2. WPNAV_ENVIRONMENT env var
    3. default_environment in config
    4. "default" if exists, else first environment

  Role selection (in order of precedence):
    1. --role flag
    2. WPNAV_ROLE env var
    3. default_role in config (per-env or global)

Resources:
  Documentation: ${WPNAV_URLS.cliDocs}
  Help:          ${WPNAV_URLS.help}
  Demo:          ${WPNAV_URLS.demo}
`;
  console.log(help.trim());
}

/**
 * Handle 'call' command - invoke a tool directly
 */
async function handleCall(
  args: string[],
  options: Record<string, string>,
  context: CLIContext
): Promise<void> {
  const toolName = args[0];

  if (!toolName) {
    outputError('MISSING_TOOL', 'Tool name required. Usage: npx wpnav call <tool> [--param value]');
    process.exit(1);
  }

  const tool = toolRegistry.getTool(toolName);
  if (!tool) {
    outputError('UNKNOWN_TOOL', `Unknown tool: ${toolName}`, {
      suggestion: 'Run "npx wpnav tools" to see available tools',
    });
    process.exit(1);
  }

  if (!toolRegistry.isEnabled(toolName)) {
    outputError('TOOL_DISABLED', `Tool is disabled: ${toolName}`);
    process.exit(1);
  }

  // Parse --json option for complex parameters
  let toolArgs: Record<string, unknown> = {};

  if (options.json) {
    try {
      toolArgs = JSON.parse(options.json);
    } catch (e) {
      outputError('INVALID_JSON', 'Failed to parse --json parameter', { error: String(e) });
      process.exit(1);
    }
  }

  // Merge simple --key value options (excluding reserved options)
  const reservedOptions = ['json', 'config', 'dry-run', 'help'];
  for (const [key, value] of Object.entries(options)) {
    if (!reservedOptions.includes(key)) {
      // Try to parse as number or boolean
      if (value === 'true') {
        toolArgs[key] = true;
      } else if (value === 'false') {
        toolArgs[key] = false;
      } else if (!isNaN(Number(value)) && value !== '') {
        toolArgs[key] = Number(value);
      } else {
        toolArgs[key] = value;
      }
    }
  }

  // Check for --dry-run flag
  const isDryRun = options['dry-run'] === 'true';

  try {
    // In dry-run mode, use the wrapper that captures write requests
    const wpRequestFn = isDryRun
      ? createDryRunRequest(context.wpRequest)
      : context.wpRequest;

    if (isDryRun) {
      dryRunMode = true;
      dryRunRequests = [];
    }

    const executionContext = {
      wpRequest: wpRequestFn,
      config: context.config,
      logger,
      clampText: (text: string) => clampText(text, context.config),
    };

    const result = await toolRegistry.execute(toolName, toolArgs, executionContext);

    if (isDryRun) {
      // Output dry-run preview
      outputJSON({
        success: true,
        dry_run: true,
        tool: toolName,
        args: toolArgs,
        role: context.role ? { name: context.role.name, source: context.roleSource } : null,
        would_execute: dryRunRequests.length > 0 ? dryRunRequests : null,
        message: dryRunRequests.length > 0
          ? `${dryRunRequests.length} write operation(s) would be executed`
          : 'No write operations would be executed (read-only tool)',
      });
    } else {
      outputJSON({
        success: true,
        tool: toolName,
        role: context.role ? { name: context.role.name, source: context.roleSource } : null,
        result: result.content,
      });
    }
  } catch (error) {
    outputError(
      'EXECUTION_ERROR',
      error instanceof Error ? error.message : String(error),
      { tool: toolName, dry_run: isDryRun }
    );
    process.exit(1);
  }
}

/**
 * Handle 'tools' command - list available tools
 */
async function handleTools(options: Record<string, string>): Promise<void> {
  const allTools = toolRegistry.getAllDefinitions();
  const categoryFilter = options.category?.toLowerCase();

  // Group tools by category
  const toolsByCategory: Record<string, Array<{ name: string; description: string }>> = {};

  for (const tool of allTools) {
    // Get registered tool to access category
    const registeredTool = toolRegistry.getTool(tool.name);
    const category: string = registeredTool?.category ?? 'other';

    if (categoryFilter && category.toLowerCase() !== categoryFilter) {
      continue;
    }

    if (!toolsByCategory[category]) {
      toolsByCategory[category] = [];
    }

    toolsByCategory[category].push({
      name: tool.name,
      description: tool.description ?? '',
    });
  }

  const totalTools = Object.values(toolsByCategory).reduce((sum, tools) => sum + tools.length, 0);

  outputJSON({
    success: true,
    total: totalTools,
    categories: Object.keys(toolsByCategory).length,
    tools: toolsByCategory,
  });
}

/**
 * Handle 'roles' command - list available roles or show role details
 */
async function handleRoles(
  args: string[],
  options: Record<string, string>
): Promise<void> {
  const jsonOutput = options.json === 'true';
  const roleName = args[0];

  // Discover all roles
  const discovered = discoverRoles();

  // If a specific role is requested, show its details
  if (roleName) {
    const role = discovered.roles.get(roleName);
    if (!role) {
      if (jsonOutput) {
        outputError('ROLE_NOT_FOUND', `Role '${roleName}' not found`, {
          available: Array.from(discovered.roles.keys()).sort(),
        });
      } else {
        errorMessage(`Role '${roleName}' not found`);
        const available = listAvailableRoles();
        if (available.length > 0) {
          newline();
          info(`Available roles: ${available.join(', ')}`);
        }
      }
      process.exit(1);
    }

    if (jsonOutput) {
      outputJSON({
        success: true,
        role: {
          name: role.name,
          description: role.description,
          context: role.context,
          source: role.source,
          sourcePath: role.sourcePath,
          focus_areas: role.focus_areas,
          avoid: role.avoid,
          tools: role.tools,
          tags: role.tags,
          author: role.author,
          version: role.version,
        },
      });
    } else {
      box(`Role: ${role.name}`);
      newline();
      keyValue('Description', role.description);
      keyValue('Source', `${role.source} (${role.sourcePath})`);
      if (role.version) {
        keyValue('Version', role.version);
      }
      if (role.author) {
        keyValue('Author', role.author);
      }
      newline();

      if (role.focus_areas && role.focus_areas.length > 0) {
        info('Focus Areas:');
        list(role.focus_areas);
        newline();
      }

      if (role.avoid && role.avoid.length > 0) {
        info('Things to Avoid:');
        list(role.avoid);
        newline();
      }

      if (role.tools) {
        if (role.tools.allowed && role.tools.allowed.length > 0) {
          info(`Allowed Tools (${role.tools.allowed.length}):`);
          // Show first 10, then summary
          const displayTools = role.tools.allowed.slice(0, 10);
          list(displayTools);
          if (role.tools.allowed.length > 10) {
            info(`  ... and ${role.tools.allowed.length - 10} more`);
          }
          newline();
        }
        if (role.tools.denied && role.tools.denied.length > 0) {
          info(`Denied Tools (${role.tools.denied.length}):`);
          list(role.tools.denied);
          newline();
        }
      }

      if (role.tags && role.tags.length > 0) {
        keyValue('Tags', role.tags.join(', '));
      }

      newline();
      info('Context (for AI):');
      console.log(colors.dim + role.context + colors.reset);
    }
    return;
  }

  // List all roles
  const roleNames = Array.from(discovered.roles.keys()).sort();

  if (jsonOutput) {
    const rolesData = roleNames.map((name) => {
      const role = discovered.roles.get(name)!;
      return {
        name: role.name,
        description: role.description,
        source: role.source,
        sourcePath: role.sourcePath,
        tags: role.tags,
      };
    });

    outputJSON({
      success: true,
      count: rolesData.length,
      roles: rolesData,
      sources: {
        bundled: discovered.sources.bundled,
        global: discovered.sources.global,
        project: discovered.sources.project,
      },
    });
  } else {
    if (roleNames.length === 0) {
      warning('No roles found');
      newline();
      info('Roles can be defined in:');
      list([
        './roles/ (project directory)',
        '~/.wpnav/roles/ (global directory)',
        'Bundled with WP Navigator',
      ]);
      return;
    }

    box(`Available Roles (${roleNames.length})`);
    newline();

    for (const name of roleNames) {
      const role = discovered.roles.get(name)!;
      const sourceTag = colors.dim + `[${role.source}]` + colors.reset;
      console.log(`  ${colors.cyan}${name}${colors.reset} ${sourceTag}`);
      console.log(`    ${role.description}`);
    }

    newline();

    // Show source summary
    if (discovered.sources.bundled.length > 0) {
      info(`Bundled: ${discovered.sources.bundled.length} role(s)`);
    }
    if (discovered.sources.global.length > 0) {
      info(`Global (~/.wpnav/roles/): ${discovered.sources.global.length} role(s)`);
    }
    if (discovered.sources.project.length > 0) {
      info(`Project (./roles/): ${discovered.sources.project.length} role(s)`);
    }

    newline();
    info('Use "wpnav roles <name>" to see role details');
  }
}

/**
 * Handle 'status' command - check WordPress connection
 */
async function handleStatus(context: CLIContext): Promise<void> {
  try {
    // Use plugin detection module for comprehensive info
    const detection = await detectPlugin(
      context.config.baseUrl,
      context.config.auth.username,
      context.config.auth.password
    );

    if (!detection.detected) {
      outputError(
        'PLUGIN_NOT_FOUND',
        detection.error || 'WP Navigator plugin not detected',
        { url: context.config.baseUrl }
      );
      process.exit(1);
    }

    // Check MCP compatibility
    let mcpCompatibility: { compatible: boolean; warning?: string } | undefined;
    if (detection.mcpCompat && detection.version) {
      const compatResult = checkMcpCompatibility(detection.mcpCompat, detection.version);
      mcpCompatibility = {
        compatible: compatResult.compatible,
        warning: compatResult.warning,
      };
    }

    // Determine environment from introspect or env
    const environment = detection.fullResponse?.environment || process.env.WPNAV_ENVIRONMENT || 'default';

    // Display TUI status box (human-readable output)
    newline();
    box(
      [
        `Site: ${detection.siteName || context.config.baseUrl}`,
        `Plugin: WP Navigator ${detection.version || 'unknown'} (${detection.edition || 'Free'})`,
      ].join('\n'),
      { title: 'WP Navigator Status' }
    );
    newline();
    modeIndicator(context.config.toggles.enableWrites);
    newline();

    outputJSON({
      success: true,
      connection: 'ok',
      site: {
        url: context.config.baseUrl,
        name: detection.siteName,
      },
      plugin: {
        name: 'WP Navigator',
        version: detection.version,
        edition: detection.edition,
        message: formatPluginMessage(detection),
      },
      auth: {
        user: context.config.auth.username,
        method: 'application_password',
      },
      environment,
      role: context.role
        ? {
            name: context.role.name,
            source: context.roleSource,
            description: context.role.description,
          }
        : null,
      mcp_compatibility: mcpCompatibility,
      policy: detection.policy,
      capabilities: detection.capabilities,
      config: {
        writes_enabled: context.config.toggles.enableWrites,
        timeout_ms: context.config.toggles.toolTimeoutMs,
        max_response_kb: context.config.toggles.maxResponseKb,
      },
    });
  } catch (error) {
    outputError(
      'CONNECTION_FAILED',
      error instanceof Error ? error.message : 'Failed to connect to WordPress',
      { url: context.config.baseUrl }
    );
    process.exit(1);
  }
}

/**
 * Validation result for a single check
 */
interface ValidationCheck {
  name: string;
  status: 'pass' | 'fail' | 'warn' | 'skip';
  message?: string;
  details?: Record<string, unknown>;
  /** Position in file (line:column) for errors */
  position?: { line: number; column: number };
  /** JSON field path for nested errors */
  field?: string;
  /** Expected type/format for validation errors */
  expected?: string;
  /** Actual value found */
  actual?: string;
  /** Suggestion for how to fix */
  suggestion?: string;
}

/**
 * Snapshot validation result
 */
interface SnapshotValidation {
  checked: boolean;
  site_index?: { exists: boolean; valid: boolean; errors: string[] };
  pages: Array<{ file: string; valid: boolean; errors?: string[] }>;
  plugins: Array<{ file: string; valid: boolean; errors?: string[] }>;
}

/**
 * Validate a single snapshot JSON file
 */
function validateSnapshotFile(filePath: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(content);

    // Basic structure validation - must be an object (not array, null, or primitive)
    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
      errors.push('Snapshot must be a JSON object');
    }

    return { valid: errors.length === 0, errors };
  } catch (err) {
    if (err instanceof SyntaxError) {
      errors.push(`Invalid JSON: ${err.message}`);
    } else {
      errors.push(`Cannot read file: ${err instanceof Error ? err.message : 'unknown error'}`);
    }
    return { valid: false, errors };
  }
}

/**
 * Validate snapshots directory structure
 */
function validateSnapshots(cwd: string): SnapshotValidation {
  const snapshotsDir = path.join(cwd, 'snapshots');
  const result: SnapshotValidation = {
    checked: true,
    pages: [],
    plugins: [],
  };

  // Check site_index.json
  const siteIndexPath = path.join(snapshotsDir, 'site_index.json');
  if (fs.existsSync(siteIndexPath)) {
    const validation = validateSnapshotFile(siteIndexPath);
    result.site_index = {
      exists: true,
      valid: validation.valid,
      errors: validation.errors,
    };
  } else {
    result.site_index = {
      exists: false,
      valid: false,
      errors: ['site_index.json not found'],
    };
  }

  // Check pages/*.json
  const pagesDir = path.join(snapshotsDir, 'pages');
  if (fs.existsSync(pagesDir)) {
    try {
      const files = fs.readdirSync(pagesDir).filter((f) => f.endsWith('.json'));
      for (const file of files) {
        const filePath = path.join(pagesDir, file);
        const validation = validateSnapshotFile(filePath);
        result.pages.push({
          file: `snapshots/pages/${file}`,
          valid: validation.valid,
          errors: validation.errors.length > 0 ? validation.errors : undefined,
        });
      }
    } catch {
      // Directory not readable
    }
  }

  // Check plugins/*.json
  const pluginsDir = path.join(snapshotsDir, 'plugins');
  if (fs.existsSync(pluginsDir)) {
    try {
      const files = fs.readdirSync(pluginsDir).filter((f) => f.endsWith('.json'));
      for (const file of files) {
        const filePath = path.join(pluginsDir, file);
        const validation = validateSnapshotFile(filePath);
        result.plugins.push({
          file: `snapshots/plugins/${file}`,
          valid: validation.valid,
          errors: validation.errors.length > 0 ? validation.errors : undefined,
        });
      }
    } catch {
      // Directory not readable
    }
  }

  return result;
}

/**
 * Handle 'validate' command - validate config and manifest files
 */
async function handleValidate(
  options: Record<string, string>,
  context?: CLIContext
): Promise<void> {
  const checks: ValidationCheck[] = [];
  let hasConfigErrors = false;
  let hasManifestErrors = false;
  let hasSnapshotErrors = false;
  let hasWarnings = false;

  // Parse flags
  const isJson = options.json === 'true';
  const checkConnection = options['check-connection'] === 'true';
  const validateManifestFlag = options.manifest === 'true' || options['manifest-only'] === 'true';
  const manifestOnly = options['manifest-only'] === 'true';
  const validateSnapshotsFlag = options.snapshots === 'true';
  const strictMode = options.strict === 'true';
  const envFlag = options.env;
  const envVar = process.env.WPNAV_ENVIRONMENT;
  const environment = envFlag || envVar || undefined;

  // Snapshot validation results (for JSON output)
  let snapshotValidation: SnapshotValidation | undefined;

  // 1. Find and validate config file (skip if --manifest-only)
  if (!manifestOnly) {
    const configPath = options.config;
    const discovery = discoverConfigFile(configPath ? undefined : process.cwd());

    if (configPath) {
      // Explicit config path provided
      try {
        const config = parseConfigFile(configPath);
        checks.push({
          name: 'config_syntax',
          status: 'pass',
          message: `Valid JSON syntax in ${configPath}`,
        });

        // Check schema
        checks.push({
          name: 'config_schema',
          status: 'pass',
          message: `Valid config schema (version ${config.config_version})`,
          details: {
            environments: Object.keys(config.environments),
            default_environment: config.default_environment,
          },
        });

        // Check env var resolution
        const envVarChecks = checkEnvVarResolution(config, configPath, environment);
        checks.push(...envVarChecks);
        if (envVarChecks.some((c) => c.status === 'fail')) {
          hasConfigErrors = true;
        }
        if (envVarChecks.some((c) => c.status === 'warn')) {
          hasWarnings = true;
        }

        // Try to resolve the specified environment
        try {
          const resolved = resolveConfig(config, configPath, environment);
          checks.push({
            name: 'environment_resolution',
            status: 'pass',
            message: `Environment '${resolved.environment}' resolved successfully`,
            details: {
              site: resolved.site,
              user: resolved.user,
            },
          });
        } catch (error) {
          checks.push({
            name: 'environment_resolution',
            status: 'fail',
            message: error instanceof Error ? error.message : String(error),
          });
          hasConfigErrors = true;
        }
      } catch (error) {
        if (error instanceof ConfigValidationError) {
          checks.push({
            name: 'config_validation',
            status: 'fail',
            message: error.message,
            details: { field: error.field, path: error.path },
          });
        } else {
          checks.push({
            name: 'config_syntax',
            status: 'fail',
            message: error instanceof Error ? error.message : String(error),
          });
        }
        hasConfigErrors = true;
      }
    } else if (discovery.found && discovery.path) {
      // Config discovered via walk-up
      checks.push({
        name: 'config_discovery',
        status: 'pass',
        message: `Found config at ${discovery.path}`,
      });

      try {
        const config = parseConfigFile(discovery.path);
        checks.push({
          name: 'config_schema',
          status: 'pass',
          message: `Valid config schema (version ${config.config_version})`,
          details: {
            environments: Object.keys(config.environments),
          },
        });

        // Check env var resolution
        const envVarChecks = checkEnvVarResolution(config, discovery.path, environment);
        checks.push(...envVarChecks);
        if (envVarChecks.some((c) => c.status === 'fail')) {
          hasConfigErrors = true;
        }
        if (envVarChecks.some((c) => c.status === 'warn')) {
          hasWarnings = true;
        }

        // Try to resolve environment
        try {
          const resolved = resolveConfig(config, discovery.path, environment);
          checks.push({
            name: 'environment_resolution',
            status: 'pass',
            message: `Environment '${resolved.environment}' resolved successfully`,
          });
        } catch (error) {
          checks.push({
            name: 'environment_resolution',
            status: 'fail',
            message: error instanceof Error ? error.message : String(error),
          });
          hasConfigErrors = true;
        }
      } catch (error) {
        if (error instanceof ConfigValidationError) {
          checks.push({
            name: 'config_validation',
            status: 'fail',
            message: error.message,
            details: { field: error.field },
          });
        } else {
          checks.push({
            name: 'config_syntax',
            status: 'fail',
            message: error instanceof Error ? error.message : String(error),
          });
        }
        hasConfigErrors = true;
      }
    } else {
      // No config file found - check for env vars
      checks.push({
        name: 'config_discovery',
        status: 'warn',
        message: 'No wpnav.config.json found',
        details: { searched: discovery.searched.slice(0, 3) },
      });
      hasWarnings = true;

      // Check if legacy env vars are set
      const requiredEnvVars = ['WP_BASE_URL', 'WP_REST_API', 'WP_APP_USER', 'WP_APP_PASS'];
      const missingEnvVars = requiredEnvVars.filter((v) => !process.env[v]);

      if (missingEnvVars.length === 0) {
        checks.push({
          name: 'env_vars',
          status: 'pass',
          message: 'Using legacy environment variables',
        });
      } else {
        checks.push({
          name: 'env_vars',
          status: 'fail',
          message: `Missing environment variables: ${missingEnvVars.join(', ')}`,
        });
        hasConfigErrors = true;
      }
    }
  }

  // 2. Validate manifest if requested
  if (validateManifestFlag) {
    const manifestResult = loadManifest();
    if (manifestResult.found) {
      if (manifestResult.manifest) {
        checks.push({
          name: 'manifest_syntax',
          status: 'pass',
          message: `Valid manifest at ${manifestResult.path}`,
        });
        checks.push({
          name: 'manifest_schema',
          status: 'pass',
          message: `Manifest schema version ${manifestResult.manifest.manifest_version}`,
          details: {
            site_name: manifestResult.manifest.meta.name,
            pages: manifestResult.manifest.pages?.length ?? 0,
            plugins: manifestResult.manifest.plugins
              ? Object.keys(manifestResult.manifest.plugins).length
              : 0,
          },
        });
      } else {
        checks.push({
          name: 'manifest_validation',
          status: 'fail',
          message: manifestResult.error || 'Invalid manifest',
          details: manifestResult.errorDetails,
        });
        hasManifestErrors = true;
      }
    } else {
      checks.push({
        name: 'manifest_discovery',
        status: 'skip',
        message: 'No wpnavigator.jsonc found (optional)',
      });
    }
  }

  // 3. Validate snapshots if requested
  if (validateSnapshotsFlag) {
    const cwd = process.cwd();
    const snapshotsDir = path.join(cwd, 'snapshots');

    if (fs.existsSync(snapshotsDir)) {
      snapshotValidation = validateSnapshots(cwd);

      // Check site_index.json
      if (snapshotValidation.site_index) {
        if (snapshotValidation.site_index.exists) {
          if (snapshotValidation.site_index.valid) {
            checks.push({
              name: 'snapshot_site_index',
              status: 'pass',
              message: 'site_index.json is valid',
            });
          } else {
            checks.push({
              name: 'snapshot_site_index',
              status: 'fail',
              message: `site_index.json: ${snapshotValidation.site_index.errors.join(', ')}`,
            });
            hasSnapshotErrors = true;
          }
        } else {
          checks.push({
            name: 'snapshot_site_index',
            status: 'warn',
            message: 'site_index.json not found (optional)',
          });
          hasWarnings = true;
        }
      }

      // Check pages snapshots
      const invalidPages = snapshotValidation.pages.filter((p) => !p.valid);
      const validPages = snapshotValidation.pages.filter((p) => p.valid);
      if (snapshotValidation.pages.length > 0) {
        if (invalidPages.length === 0) {
          checks.push({
            name: 'snapshot_pages',
            status: 'pass',
            message: `${validPages.length} page snapshot(s) valid`,
          });
        } else {
          for (const page of invalidPages) {
            checks.push({
              name: 'snapshot_page',
              status: 'fail',
              message: `${page.file}: ${page.errors?.join(', ') || 'Invalid'}`,
            });
          }
          hasSnapshotErrors = true;
        }
      }

      // Check plugins snapshots
      const invalidPlugins = snapshotValidation.plugins.filter((p) => !p.valid);
      const validPlugins = snapshotValidation.plugins.filter((p) => p.valid);
      if (snapshotValidation.plugins.length > 0) {
        if (invalidPlugins.length === 0) {
          checks.push({
            name: 'snapshot_plugins',
            status: 'pass',
            message: `${validPlugins.length} plugin snapshot(s) valid`,
          });
        } else {
          for (const plugin of invalidPlugins) {
            checks.push({
              name: 'snapshot_plugin',
              status: 'fail',
              message: `${plugin.file}: ${plugin.errors?.join(', ') || 'Invalid'}`,
            });
          }
          hasSnapshotErrors = true;
        }
      }

      // Summary if no snapshots found
      if (snapshotValidation.pages.length === 0 && snapshotValidation.plugins.length === 0) {
        checks.push({
          name: 'snapshots',
          status: 'warn',
          message: 'Snapshots directory exists but no snapshots found',
          suggestion: 'Run wpnav call wpnav_snapshot_page --slug home to create snapshots',
        });
        hasWarnings = true;
      }
    } else {
      checks.push({
        name: 'snapshots',
        status: 'skip',
        message: 'Snapshots directory not found',
        suggestion: 'Create snapshots/ directory and run snapshot tools',
      });
    }
  }

  // 4. Test connection if requested (skip if --manifest-only)
  if (!manifestOnly && checkConnection && context) {
    try {
      const introspect = await context.wpRequest('/introspect');
      checks.push({
        name: 'connection',
        status: 'pass',
        message: `Connected to ${context.config.baseUrl}`,
        details: {
          plugin: introspect.plugin,
          version: introspect.version,
        },
      });
    } catch (error) {
      checks.push({
        name: 'connection',
        status: 'fail',
        message: error instanceof Error ? error.message : 'Connection failed',
        details: { url: context.config.baseUrl },
      });
      hasConfigErrors = true;
    }
  } else if (!manifestOnly && checkConnection && !context) {
    checks.push({
      name: 'connection',
      status: 'skip',
      message: 'Connection test skipped (no valid config)',
    });
  }

  // Calculate summary
  const passCount = checks.filter((c) => c.status === 'pass').length;
  const failCount = checks.filter((c) => c.status === 'fail').length;
  const warnCount = checks.filter((c) => c.status === 'warn').length;
  const skipCount = checks.filter((c) => c.status === 'skip').length;

  // Determine overall success
  const hasErrors = hasConfigErrors || hasManifestErrors || hasSnapshotErrors;
  const strictFail = strictMode && hasWarnings;

  // Output results
  if (isJson) {
    // JSON output
    const output: Record<string, unknown> = {
      success: !hasErrors && !strictFail,
      summary: {
        total: checks.length,
        pass: passCount,
        fail: failCount,
        warn: warnCount,
        skip: skipCount,
      },
      checks,
    };

    // Include snapshot details if validated
    if (snapshotValidation) {
      output.snapshots = snapshotValidation;
    }

    outputJSON(output);
  } else {
    // Human-readable output
    newline();
    box('Validation Results', { title: 'wpnav validate' });
    newline();

    for (const check of checks) {
      const symbol = getStatusSymbol(check.status as DiagnosticCheck['status']);
      const name = check.name.replace(/_/g, ' ').padEnd(24);
      console.error(`  ${symbol} ${name} ${check.message}`);

      // Show suggestion for failures
      if (check.status === 'fail' && check.suggestion) {
        console.error(`    ${colorize('→', 'dim')} ${colorize(check.suggestion, 'cyan')}`);
      }
    }

    newline();

    // Summary line
    const parts: string[] = [];
    if (passCount > 0) parts.push(colorize(`${passCount} passed`, 'green'));
    if (failCount > 0) parts.push(colorize(`${failCount} failed`, 'red'));
    if (warnCount > 0) parts.push(colorize(`${warnCount} warnings`, 'yellow'));
    if (skipCount > 0) parts.push(colorize(`${skipCount} skipped`, 'gray'));

    console.error(`  Summary: ${parts.join(', ')}`);
    newline();

    if (hasErrors) {
      errorMessage('Validation failed');
    } else if (strictFail) {
      errorMessage('Validation failed (strict mode: warnings treated as errors)');
    } else if (hasWarnings) {
      warning('Validation passed with warnings');
    } else {
      success('Validation passed');
    }
  }

  // Exit codes:
  // 0 = success
  // 1 = config errors (or strict mode with warnings)
  // 2 = manifest errors
  // 4 = snapshot errors
  if (hasManifestErrors) {
    process.exit(2);
  } else if (hasSnapshotErrors) {
    process.exit(4);
  } else if (hasConfigErrors || strictFail) {
    process.exit(1);
  }
  // Exit 0 is implicit via handleValidate caller
}

/**
 * Read file source for position finding in errors
 */
function readFileSource(filePath: string): string | undefined {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return undefined;
  }
}

/**
 * Check for unresolved environment variable references in config
 * Enhanced with file:line:column positions
 */
function checkEnvVarResolution(
  config: WPNavConfigFile,
  configPath: string,
  targetEnv?: string,
  source?: string
): ValidationCheck[] {
  const checks: ValidationCheck[] = [];
  const unresolvedDetails: Array<{
    field: string;
    varName: string;
    position?: { line: number; column: number };
  }> = [];

  // Read source for position finding if not provided
  const fileSource = source ?? readFileSource(configPath);

  // Determine which environments to check
  const envsToCheck = targetEnv
    ? [targetEnv]
    : Object.keys(config.environments);

  for (const envName of envsToCheck) {
    const env = config.environments[envName];
    if (!env) continue;

    // Check password field
    if (containsEnvVars(env.password)) {
      const varMatch = env.password.match(/\$\{?([A-Z_][A-Z0-9_]*)\}?/);
      if (varMatch) {
        const varName = varMatch[1];
        if (!process.env[varName]) {
          const fieldPath = `environments.${envName}.password`;
          let position: { line: number; column: number } | undefined;

          if (fileSource) {
            const keyLoc = findKeyPosition(fileSource, fieldPath);
            if (keyLoc) {
              position = { line: keyLoc.position.line, column: keyLoc.position.column };
            }
          }

          unresolvedDetails.push({
            field: fieldPath,
            varName,
            position,
          });
        }
      }
    }
  }

  // Check global safety hmac_secret if present
  if (config.safety?.hmac_secret && containsEnvVars(config.safety.hmac_secret)) {
    const varMatch = config.safety.hmac_secret.match(/\$\{?([A-Z_][A-Z0-9_]*)\}?/);
    if (varMatch) {
      const varName = varMatch[1];
      if (!process.env[varName]) {
        const fieldPath = 'safety.hmac_secret';
        let position: { line: number; column: number } | undefined;

        if (fileSource) {
          const keyLoc = findKeyPosition(fileSource, fieldPath);
          if (keyLoc) {
            position = { line: keyLoc.position.line, column: keyLoc.position.column };
          }
        }

        unresolvedDetails.push({
          field: fieldPath,
          varName,
          position,
        });
      }
    }
  }

  if (unresolvedDetails.length > 0) {
    // Create individual checks for each unresolved variable with position
    for (const detail of unresolvedDetails) {
      checks.push({
        name: 'env_var_resolution',
        status: 'fail',
        message: `Environment variable $${detail.varName} is not set`,
        field: detail.field,
        position: detail.position,
        expected: `$${detail.varName} to be set in environment`,
        suggestion: `Set the ${detail.varName} environment variable or use a literal value`,
      });
    }
  } else {
    checks.push({
      name: 'env_var_resolution',
      status: 'pass',
      message: 'All environment variables resolved',
    });
  }

  return checks;
}

// =============================================================================
// Configure Command
// =============================================================================

/**
 * Path to .wpnav.env file in current directory
 */
function getWpnavEnvPath(): string {
  return path.join(process.cwd(), '.wpnav.env');
}

/**
 * Check if wpnavigator.jsonc exists (indicates WP Navigator project)
 */
function isWpNavigatorProject(): boolean {
  const manifestPath = path.join(process.cwd(), 'wpnavigator.jsonc');
  return fs.existsSync(manifestPath);
}

/**
 * Parse existing .wpnav.env file
 */
function parseWpnavEnv(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    // Skip comments and empty lines
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eqIndex = trimmed.indexOf('=');
    if (eqIndex > 0) {
      const key = trimmed.slice(0, eqIndex).trim();
      let value = trimmed.slice(eqIndex + 1).trim();
      // Remove surrounding quotes
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      result[key] = value;
    }
  }

  return result;
}

/**
 * Generate .wpnav.env content
 */
function generateWpnavEnvContent(
  siteUrl: string,
  username: string,
  password: string
): string {
  const timestamp = new Date().toISOString();
  return `# WP Navigator Connection Settings
# Generated by wpnav configure on ${timestamp}
#
# WARNING: This file contains sensitive credentials.
# Add .wpnav.env to your .gitignore file!

# WordPress Site URL (without trailing slash)
WP_BASE_URL=${siteUrl}

# REST API endpoint (usually <site>/wp-json)
WP_REST_API=${siteUrl}/wp-json

# WP Navigator API base
WPNAV_BASE=${siteUrl}/wp-json/wpnav/v1

# Introspect endpoint for plugin discovery
WPNAV_INTROSPECT=${siteUrl}/wp-json/wpnav/v1/introspect

# Application Password credentials
# Generate at: ${siteUrl}/wp-admin/profile.php#application-passwords
WP_APP_USER=${username}
WP_APP_PASS=${password}
`;
}

/**
 * Validate WordPress URL format
 */
function validateWordPressUrl(url: string): string | null {
  if (!url) return 'URL is required';

  // Must start with http:// or https://
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return 'URL must start with http:// or https://';
  }

  // Basic URL validation
  try {
    const parsed = new URL(url);
    if (!parsed.hostname) return 'Invalid URL format';
  } catch {
    return 'Invalid URL format';
  }

  // No trailing slash
  if (url.endsWith('/')) {
    return 'URL should not end with a slash';
  }

  return null;
}

/**
 * Validate username format
 */
function validateUsername(username: string): string | null {
  if (!username) return 'Username is required';
  if (username.length < 2) return 'Username must be at least 2 characters';
  return null;
}

/**
 * Validate Application Password format
 */
function validatePassword(password: string): string | null {
  if (!password) return 'Password is required';
  // WordPress app passwords are typically 24 characters with spaces (4 groups of 6)
  // But they can also be entered without spaces (24 chars)
  const cleaned = password.replace(/\s/g, '');
  if (cleaned.length < 16) {
    return 'Application password seems too short. Generate one at WordPress Admin → Users → Profile → Application Passwords';
  }
  return null;
}

/**
 * Test connection to WordPress site using ping endpoint
 */
async function testConnection(
  siteUrl: string,
  username: string,
  password: string
): Promise<{ success: boolean; siteName?: string; pluginVersion?: string; error?: string }> {
  const pingUrl = `${siteUrl}/wp-json/wpnav/v1/ping`;
  const introspectUrl = `${siteUrl}/wp-json/wpnav/v1/introspect`;

  // Create Basic auth header
  const auth = Buffer.from(`${username}:${password}`).toString('base64');
  const headers = {
    Authorization: `Basic ${auth}`,
    'Content-Type': 'application/json',
  };

  try {
    // Try ping endpoint first (lighter)
    let response = await fetch(pingUrl, { headers, signal: AbortSignal.timeout(10000) });

    if (response.status === 404) {
      // Plugin might not have ping endpoint, try introspect
      response = await fetch(introspectUrl, { headers, signal: AbortSignal.timeout(10000) });
    }

    if (response.status === 401) {
      return { success: false, error: 'Authentication failed. Check your username and Application Password.' };
    }

    if (response.status === 403) {
      return { success: false, error: 'Access denied. Ensure the user has Administrator permissions.' };
    }

    if (response.status === 404) {
      return { success: false, error: 'WP Navigator plugin not found. Install and activate the plugin first.' };
    }

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}: ${response.statusText}` };
    }

    const data = await response.json();
    return {
      success: true,
      siteName: data.site?.name || data.site_name || data.name || 'WordPress Site',
      pluginVersion: data.plugin?.version || data.version || 'unknown',
    };
  } catch (err) {
    if (err instanceof Error) {
      if (err.name === 'AbortError' || err.message.includes('timeout')) {
        return { success: false, error: 'Connection timed out. Check the URL and network connectivity.' };
      }
      if (err.message.includes('ENOTFOUND') || err.message.includes('getaddrinfo')) {
        return { success: false, error: 'Host not found. Check the URL is correct.' };
      }
      if (err.message.includes('ECONNREFUSED')) {
        return { success: false, error: 'Connection refused. Is the WordPress server running?' };
      }
      if (err.message.includes('certificate')) {
        return { success: false, error: 'SSL certificate error. Try using http:// for local development.' };
      }
      return { success: false, error: err.message };
    }
    return { success: false, error: 'Unknown connection error' };
  }
}

/**
 * Write .wpnav.env file with atomic write (temp file + rename)
 */
function writeWpnavEnvAtomic(filePath: string, content: string): void {
  const tempPath = `${filePath}.${process.pid}.tmp`;

  try {
    // Write to temp file first
    fs.writeFileSync(tempPath, content, { encoding: 'utf8', mode: 0o600 });
    // Atomic rename
    fs.renameSync(tempPath, filePath);
  } catch (err) {
    // Clean up temp file if it exists
    try {
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
    } catch {
      // Ignore cleanup errors
    }
    throw err;
  }
}

/**
 * Mask password for display (show first 4 chars, rest as dots)
 */
function maskPassword(password: string): string {
  if (password.length <= 4) return '****';
  return password.slice(0, 4) + '•'.repeat(Math.min(password.length - 4, 16));
}

/**
 * Handle 'configure' command - interactive WordPress connection setup
 */
async function handleConfigure(options: Record<string, string>): Promise<void> {
  const isSilent = options.silent === 'true';
  const envFilePath = getWpnavEnvPath();
  const envFileExists = fs.existsSync(envFilePath);

  // Check if this is a WP Navigator project (has wpnavigator.jsonc)
  const isProject = isWpNavigatorProject();

  if (!isProject && !envFileExists) {
    // Not a WP Navigator project - warn but allow creation
    if (!isSilent) {
      warning('No wpnavigator.jsonc found in current directory.');
      info('This command creates WordPress connection credentials.');
      newline();
    }
  }

  // Silent mode - require all options to be provided
  if (isSilent) {
    const siteUrl = options.site || options.url;
    const username = options.user || options.username;
    const password = options.password || options.pass;

    if (!siteUrl || !username || !password) {
      outputError('MISSING_OPTIONS', 'Silent mode requires --site, --user, and --password options', {
        provided: {
          site: !!siteUrl,
          user: !!username,
          password: !!password,
        },
      });
      process.exit(1);
    }

    // Validate inputs
    const urlError = validateWordPressUrl(siteUrl);
    if (urlError) {
      outputError('INVALID_URL', urlError);
      process.exit(1);
    }

    const userError = validateUsername(username);
    if (userError) {
      outputError('INVALID_USERNAME', userError);
      process.exit(1);
    }

    const passError = validatePassword(password);
    if (passError) {
      outputError('INVALID_PASSWORD', passError);
      process.exit(1);
    }

    // Test connection if not skipped
    if (options['skip-test'] !== 'true') {
      const testResult = await testConnection(siteUrl, username, password);
      if (!testResult.success) {
        outputError('CONNECTION_FAILED', testResult.error || 'Connection test failed');
        process.exit(1);
      }
    }

    // Write the file
    const content = generateWpnavEnvContent(siteUrl, username, password);
    try {
      writeWpnavEnvAtomic(envFilePath, content);
      outputJSON({
        success: true,
        file: envFilePath,
        site: siteUrl,
      });
    } catch (err) {
      outputError('WRITE_FAILED', err instanceof Error ? err.message : 'Failed to write .wpnav.env');
      process.exit(1);
    }
    return;
  }

  // Interactive mode
  newline();
  box('WP Navigator Configuration', { title: 'wpnav configure' });
  newline();

  // If existing file, ask what to do
  let existingConfig: Record<string, string> = {};
  if (envFileExists) {
    info(`Found existing configuration at: ${envFilePath}`);
    newline();

    try {
      const existingContent = fs.readFileSync(envFilePath, 'utf8');
      existingConfig = parseWpnavEnv(existingContent);

      // Show current settings
      if (existingConfig.WP_BASE_URL) {
        keyValue('Site URL', existingConfig.WP_BASE_URL);
      }
      if (existingConfig.WP_APP_USER) {
        keyValue('Username', existingConfig.WP_APP_USER);
      }
      if (existingConfig.WP_APP_PASS) {
        keyValue('Password', maskPassword(existingConfig.WP_APP_PASS));
      }
      newline();
    } catch {
      warning('Could not read existing configuration');
    }

    const action = await selectPrompt({
      message: 'What would you like to do?',
      choices: [
        { label: 'Edit existing settings', value: 'edit' },
        { label: 'Replace with new settings', value: 'replace', recommended: true },
        { label: 'Cancel', value: 'cancel' },
      ],
    });

    if (action === 'cancel') {
      info('Configuration cancelled');
      return;
    }

    if (action === 'replace') {
      existingConfig = {}; // Clear existing values
    }
  }

  // Collect WordPress URL
  newline();
  info('Enter your WordPress site URL (without trailing slash)');
  info('Example: https://mysite.com or http://localhost:8080');
  newline();

  const siteUrl = await inputPrompt({
    message: 'WordPress URL',
    defaultValue: existingConfig.WP_BASE_URL,
    validate: validateWordPressUrl,
    transform: (url) => url.replace(/\/+$/, ''), // Remove trailing slashes
  });

  // Collect username
  newline();
  info('Enter your WordPress username (must have Administrator role)');
  newline();

  const username = await inputPrompt({
    message: 'Username',
    defaultValue: existingConfig.WP_APP_USER,
    validate: validateUsername,
  });

  // Collect Application Password
  newline();
  info('Enter your Application Password');
  info(`Generate one at: ${siteUrl}/wp-admin/profile.php#application-passwords`);
  info('Copy the password shown (with or without spaces)');
  newline();

  const password = await inputPrompt({
    message: 'Application Password',
    defaultValue: existingConfig.WP_APP_PASS,
    validate: validatePassword,
    secret: true,
  });

  // Show summary
  newline();
  info('Configuration summary:');
  keyValue('Site URL', siteUrl);
  keyValue('Username', username);
  keyValue('Password', maskPassword(password));
  newline();

  // Confirm before testing
  const confirmTest = await confirmPrompt({
    message: 'Test connection now?',
    defaultValue: true,
  });

  let connectionSuccess = false;
  let siteName = '';
  let pluginVersion = '';

  if (confirmTest) {
    newline();
    const spinner = createSpinner({ text: 'Testing connection...' });

    const testResult = await testConnection(siteUrl, username, password);

    if (testResult.success) {
      spinner.succeed('Connection successful!');
      connectionSuccess = true;
      siteName = testResult.siteName || 'WordPress Site';
      pluginVersion = testResult.pluginVersion || 'unknown';

      newline();
      keyValue('Site Name', siteName);
      keyValue('Plugin Version', pluginVersion);
    } else {
      spinner.fail('Connection failed');
      newline();
      errorMessage(testResult.error || 'Unknown error');
      newline();

      // Offer troubleshooting tips
      info('Troubleshooting tips:');
      console.error('  • Verify the URL is correct and accessible');
      console.error('  • Check that WP Navigator plugin is installed and activated');
      console.error('  • Ensure the username has Administrator role');
      console.error('  • Regenerate the Application Password if expired');
      console.error('  • For local development, try http:// instead of https://');
      newline();
    }
  }

  // Confirm save
  newline();
  const confirmSave = await confirmPrompt({
    message: connectionSuccess
      ? 'Save configuration to .wpnav.env?'
      : 'Save configuration anyway? (connection test failed)',
    defaultValue: connectionSuccess,
  });

  if (!confirmSave) {
    info('Configuration not saved');
    return;
  }

  // Write the file
  newline();
  const content = generateWpnavEnvContent(siteUrl, username, password);

  try {
    writeWpnavEnvAtomic(envFilePath, content);
    success(`Configuration saved to: ${envFilePath}`);
  } catch (err) {
    errorMessage('Failed to write configuration', err instanceof Error ? err.message : undefined);
    process.exit(1);
  }

  // Next steps
  newline();
  info('Next steps:');
  console.error('  1. Add .wpnav.env to your .gitignore file');
  console.error('  2. Run: npx wpnav status');
  if (!isProject) {
    console.error('  3. Create wpnavigator.jsonc to define your site configuration');
  } else {
    console.error('  3. Run: npx wpnav validate --check-connection');
  }
  newline();

  if (connectionSuccess) {
    success(`Ready to manage ${siteName}!`);
  }
}

// =============================================================================
// Doctor Command
// =============================================================================

/**
 * Diagnostic check result
 */
interface DiagnosticCheck {
  name: string;
  label: string;
  status: 'pass' | 'fail' | 'warn' | 'skip';
  message: string;
  details?: Record<string, unknown>;
  fix?: string; // Suggested fix command
}

/**
 * Run all diagnostic checks
 */
async function runDiagnostics(options: Record<string, string>): Promise<DiagnosticCheck[]> {
  const checks: DiagnosticCheck[] = [];
  const cwd = process.cwd();

  // 1. Check .wpnav.env presence
  const envFilePath = path.join(cwd, '.wpnav.env');
  const envFileExists = fs.existsSync(envFilePath);

  if (envFileExists) {
    try {
      const content = fs.readFileSync(envFilePath, 'utf8');
      const parsed = parseWpnavEnv(content);
      const hasRequiredKeys = parsed.WP_BASE_URL && parsed.WP_APP_USER && parsed.WP_APP_PASS;

      if (hasRequiredKeys) {
        checks.push({
          name: 'env_file',
          label: '.wpnav.env',
          status: 'pass',
          message: 'Credentials file found and valid',
          details: { path: envFilePath, site: parsed.WP_BASE_URL },
        });
      } else {
        checks.push({
          name: 'env_file',
          label: '.wpnav.env',
          status: 'warn',
          message: 'Credentials file missing required keys',
          details: {
            hasUrl: !!parsed.WP_BASE_URL,
            hasUser: !!parsed.WP_APP_USER,
            hasPass: !!parsed.WP_APP_PASS,
          },
          fix: 'npx wpnav configure',
        });
      }
    } catch (err) {
      checks.push({
        name: 'env_file',
        label: '.wpnav.env',
        status: 'fail',
        message: `Cannot read credentials file: ${err instanceof Error ? err.message : 'unknown error'}`,
        fix: 'npx wpnav configure',
      });
    }
  } else {
    checks.push({
      name: 'env_file',
      label: '.wpnav.env',
      status: 'fail',
      message: 'Credentials file not found',
      fix: 'npx wpnav configure',
    });
  }

  // 2. Check wpnavigator.jsonc manifest
  const manifestPath = path.join(cwd, 'wpnavigator.jsonc');
  const manifestExists = fs.existsSync(manifestPath);

  if (manifestExists) {
    const manifestResult = loadManifest(cwd);
    if (manifestResult.manifest) {
      checks.push({
        name: 'manifest',
        label: 'wpnavigator.jsonc',
        status: 'pass',
        message: `Manifest valid (${manifestResult.manifest.meta.name})`,
        details: {
          path: manifestPath,
          siteName: manifestResult.manifest.meta.name,
          schemaVersion: manifestResult.manifest.schema_version,
          pages: manifestResult.manifest.pages?.length ?? 0,
        },
      });
    } else {
      checks.push({
        name: 'manifest',
        label: 'wpnavigator.jsonc',
        status: 'fail',
        message: manifestResult.error || 'Invalid manifest',
        details: manifestResult.errorDetails,
        fix: 'npx wpnav validate --manifest',
      });
    }
  } else {
    checks.push({
      name: 'manifest',
      label: 'wpnavigator.jsonc',
      status: 'warn',
      message: 'Manifest file not found (optional)',
      fix: 'Create wpnavigator.jsonc to define site configuration',
    });
  }

  // 3. Check config file (wpnav.config.json or env vars)
  const configResult = loadWpnavConfig({
    configPath: options.config,
    environment: options.env,
    fallbackToEnv: true,
  });

  if (configResult.success && configResult.config) {
    checks.push({
      name: 'config',
      label: 'Configuration',
      status: 'pass',
      message: `Config loaded (${configResult.source === 'file' ? 'file' : 'env vars'})`,
      details: {
        source: configResult.source,
        environment: configResult.config.environment,
        site: configResult.config.site,
      },
    });

    // 4. Test WordPress connectivity (only if config loaded)
    const spinner = !options.json ? createSpinner({ text: 'Testing WordPress connection...' }) : null;

    try {
      const testResult = await testConnection(
        configResult.config.site,
        configResult.config.user,
        configResult.config.password
      );

      if (testResult.success) {
        spinner?.succeed('WordPress connection OK');
        checks.push({
          name: 'connection',
          label: 'WordPress Connection',
          status: 'pass',
          message: `Connected to ${testResult.siteName}`,
          details: {
            siteName: testResult.siteName,
            pluginVersion: testResult.pluginVersion,
          },
        });

        // 5. Plugin version check
        checks.push({
          name: 'plugin',
          label: 'WP Navigator Plugin',
          status: 'pass',
          message: `Plugin version ${testResult.pluginVersion}`,
          details: { version: testResult.pluginVersion },
        });
      } else {
        spinner?.fail('WordPress connection failed');
        checks.push({
          name: 'connection',
          label: 'WordPress Connection',
          status: 'fail',
          message: testResult.error || 'Connection failed',
          fix: 'npx wpnav configure',
        });

        checks.push({
          name: 'plugin',
          label: 'WP Navigator Plugin',
          status: 'skip',
          message: 'Skipped (connection failed)',
        });
      }
    } catch (err) {
      spinner?.fail('Connection test error');
      checks.push({
        name: 'connection',
        label: 'WordPress Connection',
        status: 'fail',
        message: err instanceof Error ? err.message : 'Unknown error',
        fix: 'npx wpnav configure',
      });

      checks.push({
        name: 'plugin',
        label: 'WP Navigator Plugin',
        status: 'skip',
        message: 'Skipped (connection failed)',
      });
    }
  } else {
    checks.push({
      name: 'config',
      label: 'Configuration',
      status: 'fail',
      message: configResult.error || 'No valid configuration found',
      fix: 'npx wpnav configure',
    });

    checks.push({
      name: 'connection',
      label: 'WordPress Connection',
      status: 'skip',
      message: 'Skipped (no configuration)',
    });

    checks.push({
      name: 'plugin',
      label: 'WP Navigator Plugin',
      status: 'skip',
      message: 'Skipped (no configuration)',
    });
  }

  // 6. Check snapshots directory
  const snapshotsDir = path.join(cwd, 'snapshots');
  const snapshotsDirExists = fs.existsSync(snapshotsDir);

  if (snapshotsDirExists) {
    try {
      const files = fs.readdirSync(snapshotsDir);
      const jsonFiles = files.filter((f) => f.endsWith('.json'));

      if (jsonFiles.length > 0) {
        checks.push({
          name: 'snapshots',
          label: 'Snapshots Directory',
          status: 'pass',
          message: `${jsonFiles.length} snapshot file(s) found`,
          details: {
            path: snapshotsDir,
            count: jsonFiles.length,
            files: jsonFiles.slice(0, 5), // Show first 5
          },
        });
      } else {
        checks.push({
          name: 'snapshots',
          label: 'Snapshots Directory',
          status: 'warn',
          message: 'Directory exists but no snapshots found',
          details: { path: snapshotsDir },
          fix: 'npx wpnav call wpnav_snapshot_page --slug home',
        });
      }
    } catch (err) {
      checks.push({
        name: 'snapshots',
        label: 'Snapshots Directory',
        status: 'fail',
        message: `Cannot read snapshots directory: ${err instanceof Error ? err.message : 'unknown'}`,
      });
    }
  } else {
    checks.push({
      name: 'snapshots',
      label: 'Snapshots Directory',
      status: 'warn',
      message: 'Snapshots directory not found (optional)',
      details: { expectedPath: snapshotsDir },
      fix: 'mkdir snapshots',
    });
  }

  return checks;
}

/**
 * Get status symbol for check result
 */
function getStatusSymbol(status: DiagnosticCheck['status']): string {
  switch (status) {
    case 'pass':
      return colorize('✔', 'green');
    case 'fail':
      return colorize('✖', 'red');
    case 'warn':
      return colorize('⚠', 'yellow');
    case 'skip':
      return colorize('○', 'gray');
  }
}

/**
 * Handle 'doctor' command - run system diagnostics
 */
async function handleDoctor(options: Record<string, string>): Promise<void> {
  const isJson = options.json === 'true';

  if (!isJson) {
    newline();
    box('WP Navigator Diagnostics', { title: 'wpnav doctor' });
    newline();
  }

  const checks = await runDiagnostics(options);

  // Calculate summary
  const passCount = checks.filter((c) => c.status === 'pass').length;
  const failCount = checks.filter((c) => c.status === 'fail').length;
  const warnCount = checks.filter((c) => c.status === 'warn').length;
  const skipCount = checks.filter((c) => c.status === 'skip').length;

  if (isJson) {
    // JSON output
    outputJSON({
      success: failCount === 0,
      summary: {
        total: checks.length,
        pass: passCount,
        fail: failCount,
        warn: warnCount,
        skip: skipCount,
      },
      checks: checks.map((c) => ({
        name: c.name,
        label: c.label,
        status: c.status,
        message: c.message,
        details: c.details,
        fix: c.fix,
      })),
    });
  } else {
    // Human-readable output
    for (const check of checks) {
      const symbol = getStatusSymbol(check.status);
      const label = check.label.padEnd(22);
      console.error(`  ${symbol} ${label} ${check.message}`);

      // Show fix suggestion for failures
      if (check.status === 'fail' && check.fix) {
        console.error(`    ${colorize('→', 'dim')} Fix: ${colorize(check.fix, 'cyan')}`);
      }
    }

    newline();

    // Summary
    if (failCount === 0 && warnCount === 0) {
      success('All checks passed!');
    } else if (failCount === 0) {
      warning(`${warnCount} warning(s), but no critical issues`);
    } else {
      errorMessage(`${failCount} check(s) failed`);
      newline();
      info('Run suggested fix commands above to resolve issues');
      console.error(`  ${troubleshootLink()}`);
    }
  }

  // Exit with error code if any checks failed
  if (failCount > 0) {
    process.exit(1);
  }
}

// =============================================================================
// Snapshot Command
// =============================================================================

/**
 * Ensure snapshots directory exists
 */
function ensureSnapshotsDir(outputDir: string): void {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
}

/**
 * Write snapshot to file with atomic write
 */
function writeSnapshotFile(filePath: string, data: unknown): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const tempPath = `${filePath}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), { encoding: 'utf8' });
    fs.renameSync(tempPath, filePath);
  } catch (err) {
    try {
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
    } catch {
      // Ignore cleanup errors
    }
    throw err;
  }
}

/**
 * Merge extracted plugin settings into wpnavigator.jsonc manifest
 * Creates the plugins section if it doesn't exist
 */
async function mergePluginsIntoManifest(
  extraction: PluginSettingsExtractionResult,
  isJson: boolean
): Promise<void> {
  const manifestPath = path.join(process.cwd(), 'wpnavigator.jsonc');

  // Check if manifest exists
  if (!fs.existsSync(manifestPath)) {
    if (!isJson) {
      warning('No wpnavigator.jsonc found - skipping merge');
      info('Run "wpnav init" to create a manifest first');
    }
    return;
  }

  try {
    // Read existing manifest
    const content = fs.readFileSync(manifestPath, 'utf8');

    // Parse JSONC (strip comments)
    const stripped = content
      .replace(/\/\/.*$/gm, '')
      .replace(/\/\*[\s\S]*?\*\//g, '');
    const manifest = JSON.parse(stripped);

    // Initialize plugins section if needed
    if (!manifest.plugins) {
      manifest.plugins = {};
    }

    // Merge extracted plugin settings
    for (const [slug, snapshot] of Object.entries(extraction.plugins)) {
      manifest.plugins[slug] = {
        enabled: snapshot.enabled,
        version: snapshot.version,
        settings: snapshot.settings,
      };
    }

    // Write back (pretty-printed JSON, not JSONC - comments will be lost)
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

    if (!isJson) {
      success('Merged plugin settings into wpnavigator.jsonc');
      warning('Note: Comments in the manifest file have been removed');
    }
  } catch (err) {
    if (!isJson) {
      errorMessage(`Failed to merge into manifest: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}

/**
 * Capture site index snapshot
 */
async function captureSiteSnapshot(context: CLIContext): Promise<SiteIndexSnapshot> {
  const { wpRequest, config } = context;

  const [siteSettings, activeTheme, plugins, pages, posts, media, introspect, themeMods, widgets, sidebars] = await Promise.all([
    wpRequest('/wp/v2/settings').catch(() => ({})),
    wpRequest('/wp/v2/themes?status=active').catch(() => []),
    wpRequest('/wp/v2/plugins').catch(() => []),
    wpRequest('/wp/v2/pages?per_page=100&status=any').catch(() => []),
    wpRequest('/wp/v2/posts?per_page=100&status=any').catch(() => []),
    wpRequest('/wp/v2/media?per_page=1').catch(() => []),
    wpRequest('/introspect').catch(() => ({})),
    // Theme customizer data (v2.1.0 - task-81.11)
    wpRequest('/wpnav/v1/theme_mods').catch(() => ({})),
    wpRequest('/wp/v2/widgets').catch(() => []),       // WP 5.8+
    wpRequest('/wp/v2/sidebars').catch(() => []),      // WP 5.8+
  ]);

  const theme = Array.isArray(activeTheme) && activeTheme.length > 0 ? activeTheme[0] : null;

  const pageSummaries: PageSummary[] = (Array.isArray(pages) ? pages : []).map((p: any) => ({
    id: p.id,
    slug: p.slug,
    title: p.title?.rendered || p.title || '',
    status: p.status,
    template: p.template || undefined,
    modified: p.modified,
  }));

  const postSummaries: PostSummary[] = (Array.isArray(posts) ? posts : []).map((p: any) => ({
    id: p.id,
    slug: p.slug,
    title: p.title?.rendered || p.title || '',
    status: p.status,
    type: p.type || 'post',
    modified: p.modified,
  }));

  const pluginList = Array.isArray(plugins) ? plugins : [];
  const activePlugins: PluginInfo[] = pluginList
    .filter((p: any) => p.status === 'active')
    .map((p: any) => ({
      slug: p.plugin?.split('/')[0] || p.plugin || '',
      name: p.name?.rendered || p.name || '',
      version: p.version || '',
      update_available: p.update?.version ? true : undefined,
    }));
  const inactivePlugins: PluginInfo[] = pluginList
    .filter((p: any) => p.status !== 'active')
    .map((p: any) => ({
      slug: p.plugin?.split('/')[0] || p.plugin || '',
      name: p.name?.rendered || p.name || '',
      version: p.version || '',
    }));

  // Build theme customizer snapshot (v2.1.0 - task-81.11)
  const wpVersion = parseFloat(introspect.wordpress?.version || '0');
  const hasWidgetsApi = wpVersion >= 5.8;

  // Build site identity from settings
  const siteIdentity: SiteIdentitySnapshot = {
    blogname: siteSettings.title || undefined,
    blogdescription: siteSettings.description || undefined,
    site_icon: siteSettings.site_icon || undefined,
    site_icon_url: siteSettings.site_icon_url || undefined,
  };

  // Build theme customizer snapshot
  const customizer: ThemeCustomizerSnapshot = {
    theme_mods: themeMods || {},
    custom_css: themeMods?.custom_css_post_id ? undefined : undefined, // Custom CSS handled via theme_mods
    site_identity: siteIdentity,
  };

  // Build widgets by sidebar (WP 5.8+ only)
  let sidebarWidgets: SidebarWidgets | undefined;
  if (hasWidgetsApi && Array.isArray(widgets) && widgets.length > 0) {
    sidebarWidgets = {};
    const sidebarList = Array.isArray(sidebars) ? sidebars : [];

    // Initialize sidebars
    for (const sidebar of sidebarList) {
      if (sidebar.id) {
        sidebarWidgets[sidebar.id] = [];
      }
    }

    // Map widgets to their sidebars
    for (const w of widgets) {
      const widgetInstance: WidgetInstance = {
        id: w.id || '',
        widget: w.id_base || w.widget_type || '',
        settings: w.instance?.raw || w.settings || {},
      };
      const sidebarId = w.sidebar || 'inactive-widgets';
      if (!sidebarWidgets[sidebarId]) {
        sidebarWidgets[sidebarId] = [];
      }
      sidebarWidgets[sidebarId].push(widgetInstance);
    }
  }

  const snapshot: SiteIndexSnapshot = {
    snapshot_version: SNAPSHOT_VERSION,
    captured_at: new Date().toISOString(),
    site: {
      name: siteSettings.title || '',
      url: config.baseUrl,
      wordpress_version: introspect.wordpress?.version || '',
      php_version: introspect.php?.version || undefined,
      theme: {
        name: theme?.name?.rendered || theme?.stylesheet || '',
        slug: theme?.stylesheet || '',
        version: theme?.version || '',
        parent: theme?.template && theme.template !== theme.stylesheet ? theme.name?.rendered : undefined,
        parent_slug: theme?.template && theme.template !== theme.stylesheet ? theme.template : undefined,
        customizer,
        widgets: sidebarWidgets,
      },
      tagline: siteSettings.description || undefined,
      admin_email: siteSettings.email || undefined,
      timezone: siteSettings.timezone_string || undefined,
      language: siteSettings.language || undefined,
    },
    content: {
      pages: pageSummaries,
      posts: postSummaries,
      media: { count: Array.isArray(media) ? media.length : 0 },
    },
    plugins: { active: activePlugins, inactive: inactivePlugins },
    wpnav: introspect.plugin ? {
      version: introspect.plugin.version || introspect.version || '',
      tier: introspect.plugin.tier || undefined,
    } : undefined,
  };

  return snapshot;
}

/**
 * Capture single page snapshot
 */
async function capturePageSnapshot(context: CLIContext, slug: string): Promise<PageSnapshot> {
  const { wpRequest } = context;
  const pages = await wpRequest(`/wp/v2/pages?slug=${encodeURIComponent(slug)}&context=edit`);

  if (!Array.isArray(pages) || pages.length === 0) {
    throw new Error(`Page not found: ${slug}`);
  }

  const page = pages[0];
  let authorName = '';
  if (page.author) {
    try {
      const author = await wpRequest(`/wp/v2/users/${page.author}?_fields=name`);
      authorName = author.name || '';
    } catch { /* Author not accessible */ }
  }

  let featuredImage: { url?: string; id?: number } | undefined;
  if (page.featured_media && page.featured_media > 0) {
    try {
      const media = await wpRequest(`/wp/v2/media/${page.featured_media}`);
      featuredImage = { url: media.source_url, id: media.id };
    } catch {
      featuredImage = { id: page.featured_media };
    }
  }

  const rawContent = page.content?.raw || page.content?.rendered || '';
  const blocks = parseGutenbergBlocks(rawContent);

  let seo: PageSnapshot['meta']['seo'] | undefined;
  if (page.yoast_head_json) {
    seo = {
      title: page.yoast_head_json.title,
      description: page.yoast_head_json.description,
      og_title: page.yoast_head_json.og_title,
      og_description: page.yoast_head_json.og_description,
      og_image: page.yoast_head_json.og_image?.[0]?.url,
    };
  } else if (page.rank_math) {
    seo = { title: page.rank_math.title, description: page.rank_math.description };
  }

  const snapshot: PageSnapshot = {
    snapshot_version: SNAPSHOT_VERSION,
    captured_at: new Date().toISOString(),
    page: {
      id: page.id,
      slug: page.slug,
      title: page.title?.rendered || page.title?.raw || '',
      status: page.status,
      author: authorName,
      author_id: page.author || 0,
      template: page.template || '',
      parent: page.parent || 0,
      menu_order: page.menu_order || 0,
      date: page.date || '',
      modified: page.modified || '',
      link: page.link || '',
    },
    content: { blocks, raw: rawContent, rendered: page.content?.rendered },
    meta: {
      featured_image: featuredImage?.url,
      featured_image_id: featuredImage?.id,
      seo,
      comment_status: page.comment_status,
      ping_status: page.ping_status,
    },
  };

  return snapshot;
}

/**
 * Handle 'snapshot' command - capture WordPress state
 */
async function handleSnapshot(
  args: string[],
  options: Record<string, string>,
  context: CLIContext
): Promise<void> {
  const subcommand = args[0];
  const isJson = options.json === 'true';
  const outputDir = options.output || path.join(process.cwd(), SNAPSHOT_PATHS.ROOT);

  if (!subcommand) {
    outputError('MISSING_SUBCOMMAND', 'Snapshot subcommand required: site, page <slug>, or pages');
    process.exit(1);
  }

  switch (subcommand) {
    case 'site': {
      // Check if this is the first snapshot
      const firstSnapshot = !isJson && isFirstSnapshot(outputDir);

      if (!isJson) {
        newline();
        box('Site Snapshot', { title: 'wpnav snapshot site' });
        newline();
      }
      const spinner = !isJson ? createSpinner({ text: 'Taking snapshot of site index...' }) : null;
      try {
        const snapshot = await captureSiteSnapshot(context);
        spinner?.succeed('Site data captured');
        if (isJson) {
          outputJSON({ success: true, snapshot });
        } else {
          ensureSnapshotsDir(outputDir);
          const filePath = path.join(outputDir, 'site_index.json');
          writeSnapshotFile(filePath, snapshot);
          success(`${filePath} created`);
          newline();
          keyValue('Site', snapshot.site.name);
          keyValue('WordPress', snapshot.site.wordpress_version || 'unknown');
          keyValue('Theme', snapshot.site.theme.name);
          keyValue('Pages', String(snapshot.content.pages.length));
          keyValue('Posts', String(snapshot.content.posts.length));
          keyValue('Active Plugins', String(snapshot.plugins.active.length));
          newline();
          if (firstSnapshot) {
            info(getFirstSnapshotMessage());
            newline();
          }
        }
      } catch (error) {
        spinner?.fail('Failed to capture site snapshot');
        outputError('SNAPSHOT_FAILED', error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
      break;
    }

    case 'page': {
      const slug = args[1];
      if (!slug) {
        outputError('MISSING_SLUG', 'Page slug required: wpnav snapshot page <slug>');
        process.exit(1);
      }
      // Check if this is the first snapshot
      const firstSnapshot = !isJson && isFirstSnapshot(outputDir);

      if (!isJson) {
        newline();
        box(`Page Snapshot: ${slug}`, { title: 'wpnav snapshot page' });
        newline();
      }
      const spinner = !isJson ? createSpinner({ text: `Taking snapshot of "${slug}"...` }) : null;
      try {
        const snapshot = await capturePageSnapshot(context, slug);
        spinner?.succeed(`Page "${slug}" captured`);
        if (isJson) {
          outputJSON({ success: true, snapshot });
        } else {
          const pagesDir = path.join(outputDir, 'pages');
          ensureSnapshotsDir(pagesDir);
          const filePath = path.join(pagesDir, `${slug}.json`);
          writeSnapshotFile(filePath, snapshot);
          success(`${filePath} created`);
          newline();

          // Generate and display content summary
          const summary = summarizePageContent(snapshot);
          if (summary.summaryLines.length > 0) {
            console.error(colorize(`Your "${snapshot.page.title}" page contains:`, 'bold'));
            list(summary.summaryLines);
            newline();
          }

          keyValue('Title', snapshot.page.title);
          keyValue('Status', snapshot.page.status);
          keyValue('Total Blocks', String(summary.totalBlocks));
          keyValue('Modified', snapshot.page.modified);
          newline();

          if (firstSnapshot) {
            info(getFirstSnapshotMessage());
            newline();
          }
        }
      } catch (error) {
        spinner?.fail(`Failed to capture page "${slug}"`);
        outputError('SNAPSHOT_FAILED', error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
      break;
    }

    case 'pages': {
      // Check if this is the first snapshot
      const firstSnapshot = !isJson && isFirstSnapshot(outputDir);

      if (!isJson) {
        newline();
        box('All Pages Snapshot', { title: 'wpnav snapshot pages' });
        newline();
      }
      const spinner = !isJson ? createSpinner({ text: 'Fetching page list...' }) : null;
      try {
        const pages = await context.wpRequest('/wp/v2/pages?per_page=100&status=publish');
        if (!Array.isArray(pages) || pages.length === 0) {
          spinner?.warn('No published pages found');
          if (isJson) { outputJSON({ success: true, pages: [], count: 0 }); }
          else { warning('No published pages found'); }
          return;
        }
        spinner?.succeed(`Found ${pages.length} pages`);

        const pagesDir = path.join(outputDir, 'pages');
        ensureSnapshotsDir(pagesDir);
        const results: Array<{ slug: string; file: string; blocks: number }> = [];
        const errors: Array<{ slug: string; error: string }> = [];

        // Capture each page with progress
        for (let i = 0; i < pages.length; i++) {
          const page = pages[i];
          const pageSpinner = !isJson ? createSpinner({
            text: `[${i + 1}/${pages.length}] Taking snapshot of "${page.slug}"...`
          }) : null;
          try {
            const snapshot = await capturePageSnapshot(context, page.slug);
            const filePath = path.join(pagesDir, `${page.slug}.json`);
            if (!isJson) { writeSnapshotFile(filePath, snapshot); }
            results.push({ slug: page.slug, file: filePath, blocks: snapshot.content.blocks.length });
            pageSpinner?.succeed(`pages/${page.slug}.json created`);
          } catch (err) {
            errors.push({ slug: page.slug, error: err instanceof Error ? err.message : String(err) });
            pageSpinner?.fail(`Failed: ${page.slug}`);
          }
        }

        if (isJson) {
          outputJSON({ success: errors.length === 0, count: results.length, pages: results, errors: errors.length > 0 ? errors : undefined });
        } else {
          newline();
          keyValue('Total Pages', String(results.length));
          keyValue('Output Dir', pagesDir);
          if (errors.length > 0) {
            newline();
            warning(`${errors.length} page(s) failed:`);
            for (const err of errors) { console.error(`  • ${err.slug}: ${err.error}`); }
          }
          newline();
          success(`${results.length} page snapshots saved`);

          if (firstSnapshot) {
            newline();
            info(getFirstSnapshotMessage());
          }
        }
      } catch (error) {
        spinner?.fail('Failed to fetch pages');
        outputError('SNAPSHOT_FAILED', error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
      break;
    }

    case 'plugins': {
      const targetSlug = args[1]; // Optional specific plugin slug
      const merge = options.merge === 'true';

      if (!isJson) {
        newline();
        box(targetSlug ? `Plugin Settings: ${targetSlug}` : 'Plugin Settings Snapshot', { title: 'wpnav snapshot plugins' });
        newline();
      }

      const spinner = !isJson ? createSpinner({ text: 'Fetching plugin list...' }) : null;

      try {
        // Get list of active plugins
        const plugins = await context.wpRequest('/wp/v2/plugins');
        const activePlugins = (Array.isArray(plugins) ? plugins : [])
          .filter((p: any) => p.status === 'active')
          .map((p: any) => ({
            slug: p.plugin?.split('/')[0] || p.plugin || '',
            name: p.name?.rendered || p.name || '',
            version: p.version || '',
            pluginFile: p.plugin || '',
          }));

        if (activePlugins.length === 0) {
          spinner?.warn('No active plugins found');
          if (isJson) { outputJSON({ success: true, plugins: {}, count: 0 }); }
          else { warning('No active plugins found'); }
          return;
        }

        // Filter to target plugin if specified
        const pluginsToExtract = targetSlug
          ? activePlugins.filter(p => p.slug === targetSlug || p.slug.includes(targetSlug))
          : activePlugins;

        if (targetSlug && pluginsToExtract.length === 0) {
          spinner?.fail(`Plugin not found: ${targetSlug}`);
          outputError('PLUGIN_NOT_FOUND', `No active plugin matching "${targetSlug}"`, { available: activePlugins.map(p => p.slug) });
          process.exit(1);
        }

        spinner?.succeed(`Found ${pluginsToExtract.length} plugin(s) to extract`);

        const result: PluginSettingsExtractionResult = {
          plugins: {},
          errors: [],
          captured_at: new Date().toISOString(),
        };

        // Extract settings for each plugin
        for (const plugin of pluginsToExtract) {
          const extractSpinner = !isJson ? createSpinner({
            text: `Extracting settings for "${plugin.name}"...`
          }) : null;

          try {
            const { extractor, isGeneric } = getExtractor(plugin.slug, plugin.name);

            // Fetch options with all prefixes
            let allOptions: Record<string, unknown> = {};
            for (const prefix of extractor.optionPrefixes) {
              try {
                const options = await context.wpRequest(`/wpnav/v1/options?prefix=${encodeURIComponent(prefix)}`);
                if (options && typeof options === 'object') {
                  allOptions = { ...allOptions, ...options };
                }
              } catch {
                // Prefix might not have any options
              }
            }

            // Extract and transform settings
            const settings = extractor.extract(allOptions);

            const snapshot: PluginSettingsSnapshot = {
              slug: plugin.slug,
              name: plugin.name,
              version: plugin.version,
              enabled: true,
              settings,
              option_prefixes: extractor.optionPrefixes,
              extraction_note: isGeneric ? 'Generic prefix-based extraction' : undefined,
            };

            result.plugins[plugin.slug] = snapshot;
            extractSpinner?.succeed(`${plugin.name}: ${Object.keys(settings).length} settings extracted`);
          } catch (err) {
            result.errors.push({
              slug: plugin.slug,
              error: err instanceof Error ? err.message : String(err),
            });
            extractSpinner?.fail(`${plugin.name}: extraction failed`);
          }
        }

        // Output results
        if (isJson) {
          outputJSON({ success: result.errors.length === 0, ...result });
        } else {
          // Write to file
          const pluginsDir = path.join(outputDir, 'plugins');
          ensureSnapshotsDir(pluginsDir);
          const filePath = path.join(pluginsDir, 'settings.json');
          writeSnapshotFile(filePath, result);

          newline();
          success(`${filePath} created`);
          newline();
          keyValue('Plugins Extracted', String(Object.keys(result.plugins).length));
          keyValue('Supported Plugins', getSupportedPlugins().join(', '));

          if (result.errors.length > 0) {
            newline();
            warning(`${result.errors.length} plugin(s) failed:`);
            for (const err of result.errors) {
              console.error(`  • ${err.slug}: ${err.error}`);
            }
          }

          // Merge into manifest if requested
          if (merge) {
            newline();
            await mergePluginsIntoManifest(result, isJson);
          }
        }
      } catch (error) {
        spinner?.fail('Failed to extract plugin settings');
        outputError('SNAPSHOT_FAILED', error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
      break;
    }

    default:
      outputError('UNKNOWN_SUBCOMMAND', `Unknown snapshot subcommand: ${subcommand}`, { available: ['site', 'page', 'pages', 'plugins'] });
      process.exit(1);
  }
}

/**
 * Load configuration using new wpnav-config loader with fallback to legacy
 *
 * Priority:
 * 1. Try wpnav.config.json (new format) with directory walk-up
 * 2. Fall back to legacy config loading (wp-config.json / env vars)
 */
function loadConfiguration(options: Record<string, string>): { config: WPConfig; resolved?: ResolvedConfig } {
  // Determine environment from --env flag or WPNAV_ENVIRONMENT
  const envFlag = options.env;
  const envVar = process.env.WPNAV_ENVIRONMENT;
  const environment = envFlag || envVar || undefined;

  // Try new wpnav.config.json first
  const result = loadWpnavConfig({
    configPath: options.config,
    environment,
    fallbackToEnv: false, // Don't fallback yet, try legacy loader
  });

  if (result.success && result.config) {
    // Log config source
    if (result.source === 'file') {
      console.error(`✓ Loaded config from: ${result.config.config_path}`);
      console.error(`  Environment: ${result.config.environment}`);
    }
    return {
      config: toLegacyConfig(result.config),
      resolved: result.config,
    };
  }

  // Fall back to legacy config loading
  try {
    loadEnvFromArgOrDotEnv(options.config);
    const config = getConfigOrExit();
    return { config };
  } catch {
    // If legacy also fails, report the wpnav-config error
    if (result.error) {
      throw new Error(result.error);
    }
    throw new Error('Failed to load configuration');
  }
}

/**
 * Handle diff command - compare manifest with WordPress state
 */
async function handleDiff(
  options: Record<string, string>,
  context: CLIContext
): Promise<void> {
  const isJson = options.json === 'true';
  const strictMode = options.strict === 'true';
  const snapshotPath = options.snapshot;

  // Load manifest (required for diff)
  const manifestResult = loadManifest();
  if (!manifestResult.found) {
    if (isJson) {
      outputError('MANIFEST_NOT_FOUND', 'wpnavigator.jsonc manifest not found', {
        hint: 'Create a wpnavigator.jsonc file with pages to compare',
      });
    } else {
      errorMessage('Manifest not found: wpnavigator.jsonc');
      info('Create a wpnavigator.jsonc file with pages to compare');
    }
    process.exit(1);
  }

  if (manifestResult.error || !manifestResult.manifest) {
    if (isJson) {
      outputError('MANIFEST_INVALID', manifestResult.error || 'Failed to load manifest');
    } else {
      errorMessage(`Manifest error: ${manifestResult.error}`);
    }
    process.exit(1);
  }

  const manifest = manifestResult.manifest;

  // Get WordPress state
  let wpPages: WordPressPage[] = [];
  let wpPlugins: WordPressPlugin[] = [];

  if (snapshotPath) {
    // Use local snapshot
    try {
      const snapshotContent = fs.readFileSync(snapshotPath, 'utf8');
      const snapshot = JSON.parse(snapshotContent) as SiteIndexSnapshot;

      wpPages = snapshotToWordPressPages(snapshot);
      wpPlugins = snapshotToWordPressPlugins(snapshot);

      if (!isJson) {
        info(`Using snapshot: ${snapshotPath}`);
      }
    } catch (err) {
      if (isJson) {
        outputError('SNAPSHOT_ERROR', `Failed to load snapshot: ${err instanceof Error ? err.message : String(err)}`);
      } else {
        errorMessage(`Failed to load snapshot: ${err instanceof Error ? err.message : String(err)}`);
      }
      process.exit(1);
    }
  } else {
    // Fetch live from WordPress
    if (!isJson) {
      newline();
      box('Diff: Manifest vs WordPress', { title: 'wpnav diff' });
      newline();
    }

    const spinner = !isJson ? createSpinner({ text: 'Fetching WordPress state...' }) : null;

    try {
      // Fetch pages
      const pagesResponse = await context.wpRequest('/wp/v2/pages?per_page=100&status=any');
      wpPages = pagesResponse.map((page: any) => ({
        id: page.id,
        slug: page.slug,
        title: page.title?.rendered || page.title || '',
        status: page.status,
        template: page.template || '',
        parent: page.parent || 0,
        menu_order: page.menu_order || 0,
      }));

      // Fetch plugins if manifest has plugin config
      if (manifest.plugins && Object.keys(manifest.plugins).length > 0) {
        try {
          const pluginsResponse = await context.wpRequest('/wp/v2/plugins');
          wpPlugins = pluginsResponse.map((plugin: any) => ({
            slug: plugin.plugin?.split('/')[0] || plugin.plugin || '',
            name: plugin.name || '',
            active: plugin.status === 'active',
            version: plugin.version || '',
          }));
        } catch {
          // Plugins endpoint may require auth or be unavailable
          if (!isJson) {
            spinner?.update('Could not fetch plugins (endpoint may require elevated permissions)');
          }
        }
      }

      spinner?.stop();
    } catch (err) {
      spinner?.stop();
      if (isJson) {
        outputError('FETCH_ERROR', `Failed to fetch WordPress state: ${err instanceof Error ? err.message : String(err)}`);
      } else {
        errorMessage(`Failed to fetch WordPress state: ${err instanceof Error ? err.message : String(err)}`);
      }
      process.exit(1);
    }
  }

  // Compute diff
  const diff = computeDiff(manifest, wpPages, wpPlugins, {
    strictMode,
    includeMatches: false,
    includePlugins: true,
  });

  // Add manifest path to result
  diff.manifestPath = manifestResult.path;
  if (snapshotPath) {
    diff.snapshotPath = snapshotPath;
  }

  // Output result
  if (isJson) {
    console.log(formatDiffJson(diff));
  } else {
    console.log(formatDiffText(diff));

    // Exit code based on differences
    if (diff.summary.hasDifferences) {
      info(`Run 'wpnav sync' to apply manifest changes to WordPress`);
    }
  }

  // Exit with code 1 if there are differences (useful for CI/CD)
  if (strictMode && diff.summary.hasDifferences) {
    process.exit(1);
  }
}

/**
 * Handle 'sync' command
 * Apply wpnavigator.jsonc manifest to WordPress
 */
async function handleSync(
  options: Record<string, string>,
  context: CLIContext
): Promise<void> {
  const isJson = options.json === 'true';
  const dryRun = options['dry-run'] === 'true';
  const skipConfirm = options.yes === 'true';
  const skipPages = options['skip-pages'] === 'true';
  const skipPlugins = options['skip-plugins'] === 'true';
  const syncDeletions = options.delete === 'true';

  // Load manifest (required)
  const manifestResult = loadManifest(process.cwd());
  if (!manifestResult.found) {
    if (isJson) {
      outputError('MANIFEST_NOT_FOUND', 'wpnavigator.jsonc manifest not found', {
        hint: 'Create a wpnavigator.jsonc file with desired WordPress state',
      });
    } else {
      errorMessage('Manifest not found: wpnavigator.jsonc');
      info(`Create wpnavigator.jsonc in your project root to define desired state.`);
    }
    process.exit(1);
  }

  if (manifestResult.error || !manifestResult.manifest) {
    if (isJson) {
      outputError('MANIFEST_INVALID', manifestResult.error || 'Failed to load manifest');
    } else {
      errorMessage(`Manifest error: ${manifestResult.error}`);
    }
    process.exit(1);
  }

  const manifest = manifestResult.manifest;

  // Check backup reminder (before any sync operations)
  if (!isJson && !dryRun) {
    const reminderResult = await checkBackupReminder(manifest, process.cwd(), skipConfirm);
    if (!reminderResult.confirmed) {
      warning('Sync cancelled.');
      process.exit(0);
    }
  }

  // Fetch current WordPress state
  let wpPages: WordPressPage[] = [];
  let wpPlugins: WordPressPlugin[] = [];

  if (!isJson) {
    newline();
    box('Sync: Manifest → WordPress', { title: 'wpnav sync' });
    newline();
  }

  const spinner = !isJson ? createSpinner({ text: 'Analyzing changes...' }) : null;

  try {
    // Fetch pages
    const pagesResponse = await context.wpRequest('/wp/v2/pages?per_page=100&status=any');
    wpPages = pagesResponse.map((page: any) => ({
      id: page.id,
      slug: page.slug,
      title: page.title?.rendered || page.title || '',
      status: page.status,
      template: page.template || '',
      parent: page.parent || 0,
      menu_order: page.menu_order || 0,
    }));

    // Try to fetch plugins (may fail if no plugin management capability)
    try {
      const pluginsResponse = await context.wpRequest('/wp/v2/plugins');
      if (Array.isArray(pluginsResponse)) {
        wpPlugins = pluginsResponse.map((plugin: any) => ({
          slug: plugin.plugin?.split('/')[0] || plugin.textdomain || '',
          name: plugin.name || '',
          active: plugin.status === 'active',
          version: plugin.version || '',
        }));
      }
    } catch {
      // Plugin API not available - continue without plugin data
      if (!isJson) {
        spinner?.update('Plugin API unavailable, continuing with pages only...');
      }
    }

    spinner?.succeed('WordPress state fetched');
  } catch (err) {
    spinner?.fail('Failed to fetch WordPress state');
    if (isJson) {
      outputError('FETCH_FAILED', err instanceof Error ? err.message : 'Failed to fetch WordPress state');
    } else {
      errorMessage(`Failed to fetch WordPress state: ${err instanceof Error ? err.message : err}`);
    }
    process.exit(1);
  }

  // Compute diff to determine what needs to change
  const diff = computeDiff(manifest, wpPages, wpPlugins, {
    strictMode: syncDeletions,
    includePlugins: !skipPlugins,
  });

  // If no differences, nothing to do
  if (!diff.summary.hasDifferences) {
    if (isJson) {
      const result = {
        success: true,
        message: 'WordPress is already in sync with manifest',
        summary: { total: 0, succeeded: 0, failed: 0, skipped: 0 },
        operations: [],
        dryRun,
      };
      console.log(JSON.stringify(result, null, 2));
    } else {
      success('WordPress is already in sync with manifest');
    }
    return;
  }

  // Show diff preview
  if (!isJson && !dryRun) {
    console.log(formatDiffText(diff));
  }

  // Ask for confirmation (unless --yes or --dry-run)
  if (!skipConfirm && !dryRun && !isJson) {
    const operationCount = diff.summary.additions + diff.summary.removals + diff.summary.modifications;
    const confirmed = await confirmPrompt({
      message: `Apply ${operationCount} change(s) to WordPress?`,
      defaultValue: false,
    });

    if (!confirmed) {
      warning('Sync cancelled by user');
      process.exit(0);
    }
  }

  // Create pre-sync snapshot for rollback (only if not dry-run)
  let syncId: string | undefined;
  if (!dryRun) {
    syncId = generateSyncId();
    const preSyncSnapshot = createPreSyncSnapshot(diff, wpPages, wpPlugins, syncId);

    // Only save if there are actual changes to rollback
    if (preSyncSnapshot.pages.length > 0 || preSyncSnapshot.plugins.length > 0) {
      const snapshotPath = savePreSyncSnapshot(process.cwd(), preSyncSnapshot);
      if (!isJson) {
        info(`Pre-sync snapshot saved: ${path.basename(snapshotPath)}`);
      }

      // Cleanup old snapshots (keep last 10)
      cleanupOldSnapshots(process.cwd(), 10);
    }
  }

  // Execute sync
  const syncSpinner = !isJson && !dryRun ? createSpinner({ text: 'Applying changes...' }) : null;

  const syncResult = await executeSync(diff, manifest, context.wpRequest, {
    dryRun,
    skipPages,
    skipPlugins,
    syncDeletions,
  });

  if (dryRun) {
    syncSpinner?.succeed('Dry run complete');
  } else if (syncResult.success) {
    syncSpinner?.succeed('Sync complete');
  } else {
    syncSpinner?.fail('Sync completed with errors');
  }

  // Output result
  if (isJson) {
    console.log(formatSyncJson(syncResult));
  } else {
    console.log(formatSyncText(syncResult));
  }

  // Exit with error code if sync failed
  if (!syncResult.success && !dryRun) {
    process.exit(1);
  }
}

/**
 * Handle 'rollback' command
 * Restore WordPress state from a pre-sync snapshot
 */
async function handleRollback(
  args: string[],
  options: Record<string, string>,
  context: CLIContext
): Promise<void> {
  const isJson = options.json === 'true';
  const dryRun = options['dry-run'] === 'true';
  const listOnly = options.list === 'true';
  const syncId = args[0];

  // List available snapshots
  if (listOnly || !syncId) {
    const snapshots = listPreSyncSnapshots(process.cwd());

    if (snapshots.length === 0) {
      if (isJson) {
        console.log(JSON.stringify({ snapshots: [] }));
      } else {
        info('No pre-sync snapshots available for rollback.');
        info('Snapshots are created automatically before each sync operation.');
      }
      return;
    }

    if (isJson) {
      console.log(JSON.stringify({
        snapshots: snapshots.map(s => ({
          syncId: s.syncId,
          capturedAt: s.capturedAt.toISOString(),
          pages: s.summary.pages,
          plugins: s.summary.plugins,
        })),
      }, null, 2));
    } else {
      newline();
      box('Available Rollback Points', { title: 'wpnav rollback' });
      newline();

      for (const snapshot of snapshots) {
        const date = snapshot.capturedAt.toLocaleString();
        const resources = [];
        if (snapshot.summary.pages > 0) resources.push(`${snapshot.summary.pages} page(s)`);
        if (snapshot.summary.plugins > 0) resources.push(`${snapshot.summary.plugins} plugin(s)`);
        const resourceStr = resources.length > 0 ? ` - ${resources.join(', ')}` : '';

        keyValue(snapshot.syncId, `${date}${resourceStr}`);
      }

      newline();
      info('Usage: wpnav rollback <sync-id>');
      info('       wpnav rollback <sync-id> --dry-run');
    }
    return;
  }

  // Load the specified snapshot
  const snapshot = loadPreSyncSnapshot(process.cwd(), syncId);
  if (!snapshot) {
    if (isJson) {
      outputError('SNAPSHOT_NOT_FOUND', `Pre-sync snapshot not found: ${syncId}`);
    } else {
      errorMessage(`Pre-sync snapshot not found: ${syncId}`);
      info('Use `wpnav rollback --list` to see available snapshots.');
    }
    process.exit(1);
  }

  // Show what will be rolled back
  if (!isJson) {
    newline();
    box('Rollback', { title: dryRun ? 'Preview' : 'Executing' });
    newline();

    keyValue('Sync ID', snapshot.sync_id);
    keyValue('Captured At', new Date(snapshot.captured_at).toLocaleString());
    newline();

    if (snapshot.pages.length > 0) {
      info('Pages to restore:');
      for (const page of snapshot.pages) {
        const operation = page.planned_operation === 'create' ? 'delete (was created)'
          : page.planned_operation === 'update' ? `restore "${page.title}"`
          : `recreate "${page.title}"`;
        console.error(`  • ${page.slug}: ${operation}`);
      }
      newline();
    }

    if (snapshot.plugins.length > 0) {
      info('Plugins to restore:');
      for (const plugin of snapshot.plugins) {
        const targetState = plugin.wasActive ? 'activate' : 'deactivate';
        console.error(`  • ${plugin.slug}: ${targetState}`);
      }
      newline();
    }
  }

  // Confirm rollback (unless --yes or --dry-run)
  const skipConfirm = options.yes === 'true';
  if (!skipConfirm && !dryRun && !isJson) {
    const totalResources = snapshot.pages.length + snapshot.plugins.length;
    const confirmed = await confirmPrompt({
      message: `Restore ${totalResources} resource(s) to pre-sync state?`,
      defaultValue: false,
    });

    if (!confirmed) {
      warning('Rollback cancelled by user');
      process.exit(0);
    }
  }

  // Execute rollback
  const rollbackSpinner = !isJson && !dryRun ? createSpinner({ text: 'Restoring state...' }) : null;

  const result = await executeRollback(snapshot, context.wpRequest, { dryRun });

  if (dryRun) {
    rollbackSpinner?.succeed('Dry run complete');
  } else if (result.success) {
    rollbackSpinner?.succeed('Rollback complete');
  } else {
    rollbackSpinner?.fail('Rollback completed with errors');
  }

  // Output result
  if (isJson) {
    console.log(formatRollbackJson(result));
  } else {
    console.log(formatRollbackText(result, dryRun));
  }

  // Exit with error code if rollback failed
  if (!result.success && !dryRun) {
    process.exit(1);
  }
}

/**
 * Main CLI entry point
 */
async function main(): Promise<void> {
  const { command, args, options } = parseArgs(process.argv);

  // Handle help early (no config needed)
  if (command === 'help' || options.help) {
    showHelp();
    process.exit(0);
  }

  // Handle version flag
  if (options.version) {
    console.log(CLI_VERSION);
    process.exit(0);
  }

  // Check for known commands before loading config
  const knownCommands = ['init', 'call', 'tools', 'roles', 'status', 'validate', 'configure', 'doctor', 'snapshot', 'diff', 'sync', 'rollback', 'cleanup'];
  if (!knownCommands.includes(command)) {
    outputError('UNKNOWN_COMMAND', `Unknown command: ${command}`, {
      available: [...knownCommands, 'help'],
    });
    process.exit(1);
  }

  // Handle init command separately (doesn't require valid config)
  if (command === 'init') {
    const exitCode = await handleInit({
      mode: options.mode as 'guided' | 'scaffold' | 'ai-handoff' | undefined,
      skipConfirm: options['skip-confirm'] === 'true',
      skipSmokeTest: options['skip-smoke-test'] === 'true',
      json: options.json === 'true',
      express: options.express === 'true',
      siteUrl: options.site,
      username: options.user,
      password: options.password,
    });
    process.exit(exitCode);
  }

  // Handle validate command separately (doesn't require valid config)
  if (command === 'validate') {
    // Try to load config for connection test using only the new loader (no process.exit on failure)
    let context: CLIContext | undefined;
    const envFlag = options.env;
    const envVar = process.env.WPNAV_ENVIRONMENT;
    const environment = envFlag || envVar || undefined;

    const result = loadWpnavConfig({
      configPath: options.config,
      environment,
      fallbackToEnv: true,
    });

    if (result.success && result.config) {
      registerAllTools();
      const legacyConfig = toLegacyConfig(result.config);
      const wpRequest = makeWpRequest(legacyConfig);
      context = { config: legacyConfig, wpRequest };
    }
    // If config loading failed, validate will report this via its own checks
    await handleValidate(options, context);
    process.exit(0);
  }

  // Handle configure command separately (doesn't require valid config)
  if (command === 'configure') {
    await handleConfigure(options);
    process.exit(0);
  }

  // Handle doctor command separately (runs its own config loading)
  if (command === 'doctor') {
    await handleDoctor(options);
    process.exit(0);
  }

  // Handle cleanup command separately (doesn't require valid config)
  if (command === 'cleanup') {
    const exitCode = await handleCleanup({
      yes: options.yes === 'true',
      json: options.json === 'true',
    });
    process.exit(exitCode);
  }

  // Handle roles command separately (doesn't require valid config)
  if (command === 'roles') {
    await handleRoles(args, options);
    process.exit(0);
  }

  // Load configuration (new wpnav-config or legacy)
  let config: WPConfig;
  // resolvedConfig available for future use (environment info, config path)
  let _resolvedConfig: ResolvedConfig | undefined;
  try {
    const loaded = loadConfiguration(options);
    config = loaded.config;
    _resolvedConfig = loaded.resolved;
  } catch (error) {
    outputError('CONFIG_ERROR', 'Failed to load configuration', {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  }

  // Initialize tools
  registerAllTools();

  // Configure feature flags
  toolRegistry.setFeatureFlag('WORKFLOWS_ENABLED', config.featureFlags.workflowsEnabled);
  toolRegistry.setFeatureFlag('WP_BULK_VALIDATOR_ENABLED', config.featureFlags.bulkValidatorEnabled);
  toolRegistry.setFeatureFlag('WP_SEO_AUDIT_ENABLED', config.featureFlags.seoAuditEnabled);
  toolRegistry.setFeatureFlag('WP_CONTENT_REVIEWER_ENABLED', config.featureFlags.contentReviewerEnabled);
  toolRegistry.setFeatureFlag('WP_MIGRATION_PLANNER_ENABLED', config.featureFlags.migrationPlannerEnabled);
  toolRegistry.setFeatureFlag('WP_PERFORMANCE_ANALYZER_ENABLED', config.featureFlags.performanceAnalyzerEnabled);

  // Resolve role (CLI > env > config)
  let resolvedRoleResult: ResolvedRole | undefined;
  try {
    resolvedRoleResult = resolveRole({
      cliRole: options.role,
      configDefaultRole: _resolvedConfig?.default_role,
    });
  } catch (error) {
    if (error instanceof RoleNotFoundError) {
      errorMessage(`Role not found: ${error.roleName}`);
      info(`Available roles: ${error.availableRoles.join(', ') || '(none)'}`);
      process.exit(1);
    }
    throw error;
  }

  // Create context
  const wpRequest = makeWpRequest(config);
  const context: CLIContext = {
    config,
    wpRequest,
    role: resolvedRoleResult?.role ?? undefined,
    roleSource: resolvedRoleResult?.source,
  };

  // Route command
  switch (command) {
    case 'call':
      await handleCall(args, options, context);
      break;

    case 'tools':
      await handleTools(options);
      break;

    case 'status':
      await handleStatus(context);
      break;

    case 'snapshot':
      await handleSnapshot(args, options, context);
      break;

    case 'diff':
      await handleDiff(options, context);
      break;

    case 'sync':
      await handleSync(options, context);
      break;

    case 'rollback':
      await handleRollback(args, options, context);
      break;

    default:
      outputError('UNKNOWN_COMMAND', `Unknown command: ${command}`, {
        available: ['init', 'call', 'tools', 'status', 'snapshot', 'diff', 'sync', 'rollback', 'validate', 'configure', 'doctor', 'cleanup', 'help'],
      });
      process.exit(1);
  }
}

// Run CLI
main().catch((error) => {
  outputError('FATAL', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
