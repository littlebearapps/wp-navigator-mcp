/**
 * Node.js Version Check Module
 *
 * Checks Node.js version on CLI startup and provides platform-specific
 * upgrade instructions when requirements aren't met.
 *
 * @package WP_Navigator_Pro
 * @since 2.4.0
 */

import { execFileSync } from 'child_process';
import { error, info, newline, list, colorize, symbols } from '../tui/components.js';

// =============================================================================
// Constants
// =============================================================================

/** Minimum required Node.js version (from package.json engines) */
export const REQUIRED_NODE_VERSION = { major: 18, minor: 0, patch: 0 };

/** Exit code for Node.js version errors */
export const EXIT_CODE_NODE_VERSION = 10;

// =============================================================================
// Types
// =============================================================================

export interface NodeVersion {
  major: number;
  minor: number;
  patch: number;
  raw: string;
}

export type InstallMethod = 'brew' | 'nvm' | 'fnm' | 'volta' | 'asdf' | 'system' | 'unknown';

export interface NodeCheckResult {
  ok: boolean;
  current: NodeVersion;
  required: NodeVersion;
  installMethod: InstallMethod;
  platform: NodeJS.Platform;
  instructions?: string[];
}

// =============================================================================
// Version Parsing
// =============================================================================

/**
 * Parse Node.js version string into components
 */
export function parseNodeVersion(versionString: string): NodeVersion {
  // Handle 'v' prefix (e.g., 'v18.17.0')
  const clean = versionString.replace(/^v/, '');
  const parts = clean.split('.');

  return {
    major: parseInt(parts[0] || '0', 10),
    minor: parseInt(parts[1] || '0', 10),
    patch: parseInt(parts[2] || '0', 10),
    raw: versionString,
  };
}

/**
 * Get current Node.js version
 */
export function getNodeVersion(): NodeVersion {
  return parseNodeVersion(process.version);
}

/**
 * Compare two versions, returns:
 * - negative if a < b
 * - zero if a == b
 * - positive if a > b
 */
export function compareVersions(a: NodeVersion, b: NodeVersion): number {
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  return a.patch - b.patch;
}

/**
 * Check if current version meets requirements
 */
export function meetsRequirements(current: NodeVersion, required: NodeVersion): boolean {
  return compareVersions(current, required) >= 0;
}

// =============================================================================
// Platform Detection
// =============================================================================

/**
 * Detect how Node.js was installed on the system
 *
 * Uses environment variables and safe execFileSync calls (not exec with shell).
 */
export function detectInstallMethod(): InstallMethod {
  // Check for version managers via environment variables
  if (process.env.NVM_DIR) {
    return 'nvm';
  }

  if (process.env.FNM_DIR || process.env.FNM_MULTISHELL_PATH) {
    return 'fnm';
  }

  if (process.env.VOLTA_HOME) {
    return 'volta';
  }

  if (process.env.ASDF_DIR) {
    return 'asdf';
  }

  // Check for Homebrew on macOS using safe execFileSync (no shell injection)
  if (process.platform === 'darwin') {
    try {
      // Use execFileSync with array args - safe from shell injection
      const brewList = execFileSync('brew', ['list', 'node'], {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      if (brewList.includes('node')) {
        return 'brew';
      }
    } catch {
      // Homebrew not installed or node not managed by brew
    }
  }

  // Check if we can determine it's a system install
  const nodePath = process.execPath;
  if (nodePath.includes('/usr/local/') || nodePath.includes('/usr/bin/')) {
    return 'system';
  }

  return 'unknown';
}

/**
 * Get platform-specific upgrade instructions
 */
export function getPlatformInstructions(
  method: InstallMethod,
  platform: NodeJS.Platform
): string[] {
  const instructions: string[] = [];

  switch (method) {
    case 'brew':
      instructions.push('brew upgrade node');
      break;

    case 'nvm':
      instructions.push('nvm install 20');
      instructions.push('nvm use 20');
      break;

    case 'fnm':
      instructions.push('fnm install 20');
      instructions.push('fnm use 20');
      break;

    case 'volta':
      instructions.push('volta install node@20');
      break;

    case 'asdf':
      instructions.push('asdf install nodejs 20.18.0');
      instructions.push('asdf global nodejs 20.18.0');
      break;

    case 'system':
    case 'unknown':
    default:
      // Provide platform-specific fallback instructions
      switch (platform) {
        case 'darwin':
          instructions.push('# Option 1: Using Homebrew');
          instructions.push('brew install node');
          instructions.push('');
          instructions.push('# Option 2: Using nvm (recommended)');
          instructions.push(
            'curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash'
          );
          instructions.push('nvm install 20');
          break;

        case 'win32':
          instructions.push('Download Node.js 20 LTS from: https://nodejs.org/');
          instructions.push('Run the installer and follow the prompts');
          break;

        case 'linux':
          instructions.push('# Option 1: Using apt (Debian/Ubuntu)');
          instructions.push('curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -');
          instructions.push('sudo apt-get install -y nodejs');
          instructions.push('');
          instructions.push('# Option 2: Using nvm (recommended)');
          instructions.push(
            'curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash'
          );
          instructions.push('nvm install 20');
          break;

        default:
          instructions.push('Download Node.js 20 LTS from: https://nodejs.org/');
      }
  }

  return instructions;
}

// =============================================================================
// Main Check Function
// =============================================================================

/**
 * Check Node.js version and return result
 */
export function checkNodeVersion(): NodeCheckResult {
  const current = getNodeVersion();
  const required = REQUIRED_NODE_VERSION as NodeVersion & { raw?: string };
  required.raw = `v${required.major}.${required.minor}.${required.patch}`;

  const installMethod = detectInstallMethod();
  const platform = process.platform;
  const ok = meetsRequirements(current, required);

  const result: NodeCheckResult = {
    ok,
    current,
    required,
    installMethod,
    platform,
  };

  if (!ok) {
    result.instructions = getPlatformInstructions(installMethod, platform);
  }

  return result;
}

// =============================================================================
// Display Functions
// =============================================================================

/**
 * Format version for display
 */
function formatVersion(v: NodeVersion): string {
  return `v${v.major}.${v.minor}.${v.patch}`;
}

/**
 * Display Node.js version error with upgrade instructions
 */
export function displayNodeVersionError(result: NodeCheckResult): void {
  newline();
  error(
    `Node.js ${formatVersion(result.required)}+ required (found: ${formatVersion(result.current)})`
  );
  newline();

  // Show detected install method
  const methodLabels: Record<InstallMethod, string> = {
    brew: 'Homebrew',
    nvm: 'nvm',
    fnm: 'fnm',
    volta: 'Volta',
    asdf: 'asdf',
    system: 'System',
    unknown: 'Unknown',
  };

  info(`Detected install method: ${methodLabels[result.installMethod]}`);
  newline();

  // Show upgrade instructions
  console.error(colorize('To upgrade Node.js:', 'bold'));
  newline();

  if (result.instructions && result.instructions.length > 0) {
    for (const instruction of result.instructions) {
      if (instruction === '') {
        console.error('');
      } else if (instruction.startsWith('#')) {
        // Comment line
        console.error(colorize(`  ${instruction}`, 'dim'));
      } else {
        console.error(`  ${colorize(symbols.arrow, 'cyan')} ${colorize(instruction, 'cyan')}`);
      }
    }
  }

  newline();
  info(`After upgrading, run your command again.`);
  newline();

  // Show helpful links
  console.error(colorize('More info:', 'dim'));
  list([
    'Node.js downloads: https://nodejs.org/',
    'nvm (recommended): https://github.com/nvm-sh/nvm',
  ]);
}
