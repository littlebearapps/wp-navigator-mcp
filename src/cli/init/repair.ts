/**
 * WP Navigator Init Repair Mode
 *
 * Provides idempotent repair functionality for wpnav init.
 * Detects existing configuration, validates files, and offers
 * to fix/regenerate broken or missing components.
 *
 * @package WP_Navigator_Pro
 * @since 2.4.5
 */

import * as fs from 'fs';
import * as path from 'path';
import { confirmPrompt, selectPrompt } from '../tui/prompts.js';
import {
  success,
  error as errorMessage,
  warning,
  info,
  newline,
  keyValue,
  createSpinner,
  colorize,
  list,
  divider,
  symbols,
} from '../tui/components.js';
import {
  generateClaudeMd,
  generateAgentsMd,
  generateGeminiMd,
  generateMcpJson,
  getDefaultClaudeMdContext,
} from './generators.js';
import { generateGitignore, generateGitignoreAppend } from './gitignore.js';
import { loadWpnavConfig, toLegacyConfig } from '../../wpnav-config.js';
import { makeWpRequest } from '../../http.js';

// =============================================================================
// Types
// =============================================================================

export type FileStatus = 'valid' | 'missing' | 'invalid' | 'outdated';

export interface FileCheckResult {
  path: string;
  name: string;
  status: FileStatus;
  message?: string;
  canRegenerate: boolean;
}

export interface CredentialCheckResult {
  exists: boolean;
  valid: boolean;
  message?: string;
  siteUrl?: string;
  username?: string;
}

export interface RepairState {
  hasExistingConfig: boolean;
  files: FileCheckResult[];
  credentials: CredentialCheckResult;
  needsRepair: boolean;
  missingFiles: string[];
  invalidFiles: string[];
}

export interface RepairResult {
  success: boolean;
  filesRepaired: string[];
  filesSkipped: string[];
  errors: string[];
}

// =============================================================================
// File Definitions
// =============================================================================

/**
 * List of files managed by wpnav init with their validation functions
 */
const MANAGED_FILES = [
  {
    name: 'wpnavigator.jsonc',
    path: 'wpnavigator.jsonc',
    required: true,
    canRegenerate: true,
    validate: validateManifest,
  },
  {
    name: 'wpnav.config.json',
    path: 'wpnav.config.json',
    required: false,
    canRegenerate: true,
    validate: validateWpnavConfig,
  },
  {
    name: '.wpnav.env',
    path: '.wpnav.env',
    required: false,
    canRegenerate: false, // Contains credentials - don't regenerate
    validate: validateEnvFile,
  },
  {
    name: 'CLAUDE.md',
    path: 'CLAUDE.md',
    required: false,
    canRegenerate: true,
    validate: validateClaudeMd,
  },
  {
    name: 'AGENTS.md',
    path: 'AGENTS.md',
    required: false,
    canRegenerate: true,
    validate: validateAgentsMd,
  },
  {
    name: 'GEMINI.md',
    path: 'GEMINI.md',
    required: false,
    canRegenerate: true,
    validate: validateGeminiMd,
  },
  {
    name: '.mcp.json',
    path: '.mcp.json',
    required: false,
    canRegenerate: true,
    validate: validateMcpJson,
  },
  {
    name: '.gitignore',
    path: '.gitignore',
    required: false,
    canRegenerate: true,
    validate: validateGitignore,
  },
  {
    name: 'docs/README.md',
    path: 'docs/README.md',
    required: false,
    canRegenerate: true,
    validate: validateDocsReadme,
  },
] as const;

/**
 * Required directories for project structure
 */
const REQUIRED_DIRS = ['snapshots', 'snapshots/pages', 'roles', 'docs', 'sample-prompts'];

// =============================================================================
// Validation Functions
// =============================================================================

function validateManifest(content: string): { valid: boolean; message?: string } {
  try {
    // Remove JSONC comments for parsing
    // Be careful not to remove // in URLs - only match // at start of line or after whitespace
    const jsonContent = content
      .replace(/^\s*\/\/.*$/gm, '') // Line comments at start of line
      .replace(/,\s*\/\/.*$/gm, ',') // Line comments after commas
      .replace(/\/\*[\s\S]*?\*\//g, ''); // Block comments
    const parsed = JSON.parse(jsonContent);

    if (!parsed.schema_version) {
      return { valid: false, message: 'Missing schema_version field' };
    }
    if (!parsed.site) {
      return { valid: false, message: 'Missing site section' };
    }
    return { valid: true };
  } catch (err) {
    return {
      valid: false,
      message: `Invalid JSON: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

function validateWpnavConfig(content: string): { valid: boolean; message?: string } {
  try {
    const parsed = JSON.parse(content);

    if (!parsed.config_version) {
      return { valid: false, message: 'Missing config_version field' };
    }
    if (!parsed.environments) {
      return { valid: false, message: 'Missing environments section' };
    }
    return { valid: true };
  } catch (err) {
    return {
      valid: false,
      message: `Invalid JSON: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

function validateEnvFile(content: string): { valid: boolean; message?: string } {
  const hasBaseUrl = content.includes('WP_BASE_URL=');
  const hasUser = content.includes('WP_APP_USER=');
  const hasPass = content.includes('WP_APP_PASS=');

  if (!hasBaseUrl) {
    return { valid: false, message: 'Missing WP_BASE_URL' };
  }
  if (!hasUser) {
    return { valid: false, message: 'Missing WP_APP_USER' };
  }
  if (!hasPass) {
    return { valid: false, message: 'Missing WP_APP_PASS' };
  }

  // Check if credentials are actually filled in (not just empty)
  const baseUrlMatch = content.match(/WP_BASE_URL=(.+)/);
  if (baseUrlMatch && baseUrlMatch[1].trim() === '') {
    return { valid: false, message: 'WP_BASE_URL is empty' };
  }

  return { valid: true };
}

function validateClaudeMd(content: string): { valid: boolean; message?: string } {
  // Check for WP Navigator header
  if (!content.includes('WP Navigator')) {
    return { valid: false, message: 'Not a WP Navigator CLAUDE.md file' };
  }
  // Check for essential sections
  if (!content.includes('Quick Reference') && !content.includes('Commands')) {
    return { valid: false, message: 'Missing essential sections' };
  }
  return { valid: true };
}

function validateAgentsMd(content: string): { valid: boolean; message?: string } {
  if (!content.includes('WP Navigator')) {
    return { valid: false, message: 'Not a WP Navigator AGENTS.md file' };
  }
  return { valid: true };
}

function validateGeminiMd(content: string): { valid: boolean; message?: string } {
  if (!content.includes('WP Navigator')) {
    return { valid: false, message: 'Not a WP Navigator GEMINI.md file' };
  }
  return { valid: true };
}

function validateMcpJson(content: string): { valid: boolean; message?: string } {
  try {
    const parsed = JSON.parse(content);
    if (!parsed.mcpServers?.wpnav) {
      return { valid: false, message: 'Missing wpnav server configuration' };
    }
    return { valid: true };
  } catch (err) {
    return {
      valid: false,
      message: `Invalid JSON: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

function validateGitignore(content: string): { valid: boolean; message?: string } {
  // Check for essential patterns
  const essentialPatterns = ['.wpnav.env', 'wp-config.json'];
  const missingPatterns = essentialPatterns.filter((p) => !content.includes(p));

  if (missingPatterns.length > 0) {
    return { valid: false, message: `Missing patterns: ${missingPatterns.join(', ')}` };
  }
  return { valid: true };
}

function validateDocsReadme(content: string): { valid: boolean; message?: string } {
  if (!content.includes('WP Navigator')) {
    return { valid: false, message: 'Not a WP Navigator docs/README.md file' };
  }
  return { valid: true };
}

// =============================================================================
// Detection Functions
// =============================================================================

/**
 * Detect if this directory has an existing WP Navigator configuration
 */
export function detectExistingConfig(cwd: string): boolean {
  const indicators = [
    'wpnavigator.jsonc',
    'wpnav.config.json',
    '.wpnav.env',
    'snapshots/site_index.json',
  ];

  return indicators.some((file) => fs.existsSync(path.join(cwd, file)));
}

/**
 * Check all managed files and directories
 */
export function checkProjectFiles(cwd: string): FileCheckResult[] {
  const results: FileCheckResult[] = [];

  for (const fileDef of MANAGED_FILES) {
    const filePath = path.join(cwd, fileDef.path);
    const result: FileCheckResult = {
      path: fileDef.path,
      name: fileDef.name,
      status: 'missing',
      canRegenerate: fileDef.canRegenerate,
    };

    if (fs.existsSync(filePath)) {
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        const validation = fileDef.validate(content);

        if (validation.valid) {
          result.status = 'valid';
        } else {
          result.status = 'invalid';
          result.message = validation.message;
        }
      } catch (err) {
        result.status = 'invalid';
        result.message = `Cannot read file: ${err instanceof Error ? err.message : String(err)}`;
      }
    }

    results.push(result);
  }

  // Check directories
  for (const dir of REQUIRED_DIRS) {
    const dirPath = path.join(cwd, dir);
    results.push({
      path: dir + '/',
      name: dir,
      status: fs.existsSync(dirPath) ? 'valid' : 'missing',
      canRegenerate: true,
    });
  }

  return results;
}

/**
 * Check credential validity by testing connection
 */
export async function checkCredentials(cwd: string): Promise<CredentialCheckResult> {
  const envPath = path.join(cwd, '.wpnav.env');

  if (!fs.existsSync(envPath)) {
    return {
      exists: false,
      valid: false,
      message: 'No credentials file (.wpnav.env)',
    };
  }

  // Parse env file to extract credentials
  const content = fs.readFileSync(envPath, 'utf8');
  const siteUrlMatch = content.match(/WP_BASE_URL=(.+)/);
  const usernameMatch = content.match(/WP_APP_USER=(.+)/);
  const passwordMatch = content.match(/WP_APP_PASS=(.+)/);

  const siteUrl = siteUrlMatch?.[1]?.trim();
  const username = usernameMatch?.[1]?.trim();
  const password = passwordMatch?.[1]?.trim();

  if (!siteUrl || !username || !password) {
    return {
      exists: true,
      valid: false,
      message: 'Credentials file is incomplete',
      siteUrl,
      username,
    };
  }

  // Try to test connection
  try {
    const result = loadWpnavConfig({
      fallbackToEnv: true,
    });

    if (result.success && result.config) {
      const legacyConfig = toLegacyConfig(result.config);
      const wpRequest = makeWpRequest(legacyConfig);

      // Test with introspect endpoint
      await wpRequest('wpnav/v1/introspect');

      return {
        exists: true,
        valid: true,
        siteUrl,
        username,
      };
    }
  } catch {
    // Connection failed, but credentials exist
  }

  return {
    exists: true,
    valid: false,
    message: 'Connection test failed (credentials may be invalid or site unreachable)',
    siteUrl,
    username,
  };
}

/**
 * Build complete repair state for the project
 */
export async function buildRepairState(cwd: string): Promise<RepairState> {
  const hasExistingConfig = detectExistingConfig(cwd);
  const files = checkProjectFiles(cwd);
  const credentials = await checkCredentials(cwd);

  const missingFiles = files.filter((f) => f.status === 'missing').map((f) => f.name);
  const invalidFiles = files.filter((f) => f.status === 'invalid').map((f) => f.name);

  const needsRepair = missingFiles.length > 0 || invalidFiles.length > 0 || !credentials.valid;

  return {
    hasExistingConfig,
    files,
    credentials,
    needsRepair,
    missingFiles,
    invalidFiles,
  };
}

// =============================================================================
// Display Functions
// =============================================================================

/**
 * Display repair state to user
 */
export function displayRepairState(state: RepairState): void {
  newline();
  info('Checking configuration...');
  newline();

  for (const file of state.files) {
    const statusSymbol = getStatusSymbol(file.status);
    const statusColor = getStatusColor(file.status);
    const statusText = colorize(statusSymbol, statusColor);

    let line = `  ${statusText} ${file.name}`;
    if (file.status === 'invalid' && file.message) {
      line += ` - ${colorize(file.message, 'dim')}`;
    }
    console.error(line);
  }

  // Credentials status
  newline();
  if (state.credentials.exists) {
    if (state.credentials.valid) {
      console.error(`  ${colorize(symbols.success, 'green')} Credentials - working`);
    } else {
      console.error(
        `  ${colorize(symbols.error, 'red')} Credentials - ${state.credentials.message || 'invalid'}`
      );
    }
  } else {
    console.error(`  ${colorize(symbols.error, 'red')} Credentials - not configured`);
  }
  newline();
}

function getStatusSymbol(status: FileStatus): string {
  switch (status) {
    case 'valid':
      return symbols.success;
    case 'missing':
      return symbols.error;
    case 'invalid':
      return symbols.error;
    case 'outdated':
      return symbols.warning;
    default:
      return symbols.dash;
  }
}

function getStatusColor(status: FileStatus): 'green' | 'red' | 'yellow' | 'dim' {
  switch (status) {
    case 'valid':
      return 'green';
    case 'missing':
    case 'invalid':
      return 'red';
    case 'outdated':
      return 'yellow';
    default:
      return 'dim';
  }
}

// =============================================================================
// Repair Functions
// =============================================================================

/**
 * Regenerate a specific file
 */
function regenerateFile(cwd: string, fileName: string): boolean {
  const context = getDefaultClaudeMdContext();

  try {
    switch (fileName) {
      case 'CLAUDE.md': {
        const content = generateClaudeMd(context);
        fs.writeFileSync(path.join(cwd, 'CLAUDE.md'), content, 'utf8');
        return true;
      }

      case 'AGENTS.md': {
        const content = generateAgentsMd(context);
        fs.writeFileSync(path.join(cwd, 'AGENTS.md'), content, 'utf8');
        return true;
      }

      case 'GEMINI.md': {
        const content = generateGeminiMd(context);
        fs.writeFileSync(path.join(cwd, 'GEMINI.md'), content, 'utf8');
        return true;
      }

      case '.mcp.json': {
        const content = generateMcpJson({ enableWrites: false });
        fs.writeFileSync(path.join(cwd, '.mcp.json'), content, 'utf8');
        return true;
      }

      case '.gitignore': {
        const gitignorePath = path.join(cwd, '.gitignore');
        if (fs.existsSync(gitignorePath)) {
          // Append missing patterns
          const existing = fs.readFileSync(gitignorePath, 'utf8');
          const appendContent = generateGitignoreAppend(existing);
          if (appendContent) {
            fs.appendFileSync(gitignorePath, appendContent);
          }
        } else {
          fs.writeFileSync(gitignorePath, generateGitignore(), 'utf8');
        }
        return true;
      }

      case 'docs/README.md': {
        const docsDir = path.join(cwd, 'docs');
        if (!fs.existsSync(docsDir)) {
          fs.mkdirSync(docsDir, { recursive: true });
        }
        fs.writeFileSync(path.join(cwd, 'docs', 'README.md'), generateDocsReadme(), 'utf8');
        return true;
      }

      case 'wpnavigator.jsonc': {
        fs.writeFileSync(path.join(cwd, 'wpnavigator.jsonc'), generateManifestTemplate(), 'utf8');
        return true;
      }

      case 'wpnav.config.json': {
        fs.writeFileSync(path.join(cwd, 'wpnav.config.json'), generateConfigTemplate(), 'utf8');
        return true;
      }

      default:
        // Handle directories
        if (fileName.endsWith('/') || REQUIRED_DIRS.includes(fileName)) {
          const dirName = fileName.replace(/\/$/, '');
          const dirPath = path.join(cwd, dirName);
          if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
          }
          return true;
        }
        return false;
    }
  } catch {
    return false;
  }
}

/**
 * Generate minimal wpnavigator.jsonc template
 */
function generateManifestTemplate(): string {
  return `{
  // WP Navigator Site Manifest
  // This file defines what you WANT your site to look like.
  // AI assistants read this file to understand your intent.
  //
  // Schema version: 1
  "$schema": "https://wpnav.ai/schemas/wpnavigator.schema.json",
  "schema_version": 1,

  // Site identity
  "site": {
    "name": "",
    "tagline": "",
    "url": ""
  },

  // Brand guidelines (optional - for Full Setup)
  "brand": {
    // "primary_color": "#0073aa",
    // "secondary_color": "#23282d",
    // "heading_font": "System UI",
    // "body_font": "System UI"
  },

  // Pages to manage
  "pages": [
    // Example:
    // {
    //   "slug": "home",
    //   "title": "Home",
    //   "template": "front-page"
    // }
  ],

  // Plugins configuration
  "plugins": {
    // "woocommerce": { "status": "active" }
  }
}
`;
}

/**
 * Generate minimal wpnav.config.json template
 */
function generateConfigTemplate(): string {
  return JSON.stringify(
    {
      config_version: '1.0',
      default_environment: 'local',
      environments: {
        local: {
          site: '',
          user: '',
          password: '$WP_APP_PASS',
        },
      },
    },
    null,
    2
  );
}

/**
 * Generate docs/README.md content
 */
function generateDocsReadme(): string {
  return `# WP Navigator Project

This folder contains your WP Navigator project files.

## How WP Navigator Works

1. **Your WordPress site** – Where your real content and pages live.

2. **This project folder** – Stores:
   - \`snapshots/\` – What your site looks like now (read from WordPress)
   - \`wpnavigator.jsonc\` – What you WANT your site to look like (your intent)

3. **Your AI assistant** (Claude, Codex, etc.) – Reads these files, helps you plan changes, and WP Navigator applies them safely.

The AI never talks directly to your live site – it only edits files in this folder.
You stay in control.

## Quick Start

1. Open this folder in Claude Code or Codex Cloud
2. Show it:
   - \`wpnavigator.jsonc\`
   - \`snapshots/site_index.json\`
   - \`snapshots/pages/home.json\`
3. Ask: "Help me review my WP Navigator setup"
4. When ready, run: \`npx wpnav sync\`

## Commands

\`\`\`bash
npx wpnav status          # Check WordPress connection
npx wpnav snapshot site   # Update site snapshot
npx wpnav diff            # Compare manifest vs WordPress
npx wpnav sync --dry-run  # Preview changes before applying
npx wpnav sync            # Apply changes to WordPress
\`\`\`

## Links

- Demo: https://wpnav.ai/start/demo
- Help: https://wpnav.ai/help
- Docs: https://wpnav.ai/docs
`;
}

/**
 * Execute repair based on user selection
 */
export async function executeRepair(
  cwd: string,
  state: RepairState,
  options: { all?: boolean; files?: string[] }
): Promise<RepairResult> {
  const result: RepairResult = {
    success: true,
    filesRepaired: [],
    filesSkipped: [],
    errors: [],
  };

  // Determine which files to repair
  const filesToRepair: string[] = options.all
    ? state.files
        .filter((f) => (f.status === 'missing' || f.status === 'invalid') && f.canRegenerate)
        .map((f) => f.name)
    : options.files || [];

  for (const fileName of filesToRepair) {
    const fileInfo = state.files.find((f) => f.name === fileName);

    if (!fileInfo) {
      result.filesSkipped.push(fileName);
      continue;
    }

    if (!fileInfo.canRegenerate) {
      result.filesSkipped.push(fileName);
      continue;
    }

    const success = regenerateFile(cwd, fileName);
    if (success) {
      result.filesRepaired.push(fileName);
    } else {
      result.errors.push(`Failed to regenerate ${fileName}`);
      result.success = false;
    }
  }

  return result;
}

// =============================================================================
// Main Repair Handler
// =============================================================================

/**
 * Handle repair mode for wpnav init
 * @returns Exit code: 0 for success, 1 for errors
 */
export async function handleRepairMode(cwd: string): Promise<number> {
  newline();
  info('Existing WP Navigator configuration detected.');
  newline();

  const spinner = createSpinner({ text: 'Checking configuration...' });
  const state = await buildRepairState(cwd);
  spinner.stop();

  displayRepairState(state);

  if (!state.needsRepair) {
    success('Configuration is complete and valid!');
    newline();
    info('Your WP Navigator setup is ready to use.');
    newline();
    list([
      'Run "npx wpnav status" to check connection',
      'Run "npx wpnav snapshot site" to update snapshots',
      'Run "npx wpnav diff" to compare manifest vs WordPress',
    ]);
    return 0;
  }

  // Ask user what to do
  const repairableFiles = state.files
    .filter((f) => (f.status === 'missing' || f.status === 'invalid') && f.canRegenerate)
    .map((f) => f.name);

  if (repairableFiles.length === 0) {
    warning('No files can be automatically repaired.');
    if (!state.credentials.valid) {
      newline();
      info('To fix credentials, run: npx wpnav configure');
    }
    return 0;
  }

  const action = await selectPrompt({
    message: 'How would you like to proceed?',
    choices: [
      {
        label: `Regenerate all missing/broken files (${repairableFiles.length})`,
        value: 'all',
        recommended: true,
      },
      {
        label: 'Choose which files to regenerate',
        value: 'select',
      },
      {
        label: 'Skip repair (exit)',
        value: 'skip',
      },
    ],
  });

  if (action === 'skip') {
    info('Repair skipped. Run "npx wpnav init --repair" anytime to try again.');
    return 0;
  }

  let filesToRepair: string[] = [];

  if (action === 'all') {
    filesToRepair = repairableFiles;
  } else {
    // Let user select specific files
    for (const file of repairableFiles) {
      const repair = await confirmPrompt({
        message: `Regenerate ${file}?`,
        defaultValue: true,
      });
      if (repair) {
        filesToRepair.push(file);
      }
    }
  }

  if (filesToRepair.length === 0) {
    info('No files selected for repair.');
    return 0;
  }

  // Execute repair
  newline();
  const repairSpinner = createSpinner({ text: 'Repairing configuration...' });
  const repairResult = await executeRepair(cwd, state, { files: filesToRepair });
  repairSpinner.stop();

  // Display results
  if (repairResult.filesRepaired.length > 0) {
    newline();
    success('Repaired:');
    for (const file of repairResult.filesRepaired) {
      console.error(`  ${colorize(symbols.success, 'green')} ${file}`);
    }
  }

  if (repairResult.errors.length > 0) {
    newline();
    errorMessage('Errors:');
    for (const err of repairResult.errors) {
      console.error(`  ${colorize(symbols.error, 'red')} ${err}`);
    }
  }

  newline();
  if (repairResult.success) {
    success('Configuration repaired!');
  } else {
    warning('Some files could not be repaired.');
  }

  // Remind about credentials if needed
  if (!state.credentials.valid) {
    newline();
    info('Note: Credentials need attention. Run "npx wpnav configure" to set up.');
  }

  return repairResult.success ? 0 : 1;
}

/**
 * Check if repair mode should be offered (for auto-detection)
 */
export function shouldOfferRepair(cwd: string): boolean {
  return detectExistingConfig(cwd);
}
