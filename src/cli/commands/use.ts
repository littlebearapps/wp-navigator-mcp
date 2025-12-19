/**
 * WP Navigator Use Command
 *
 * CLI command for switching active environment in wpnav.config.json:
 * - `wpnav use <env>` - Switch to specified environment
 * - `wpnav use --list` - List available environments
 *
 * This enables config-first workflow where users don't need CLI flags.
 *
 * @package WP_Navigator_MCP
 * @since 2.8.0
 */

import * as fs from 'fs';
import {
  success,
  error as errorMessage,
  info,
  newline,
  box,
  keyValue,
  colorize,
} from '../tui/components.js';
import { discoverConfigFile, parseConfigFile, type WPNavConfigFile } from '../../wpnav-config.js';

// =============================================================================
// Types
// =============================================================================

export interface UseCommandOptions {
  /** Output JSON instead of TUI */
  json?: boolean;
  /** List available environments */
  list?: boolean;
}

export interface UseResult {
  success: boolean;
  environment?: string;
  previous?: string | null;
  message: string;
  config_path?: string;
}

export interface UseListResult {
  environments: string[];
  active: string | null;
  config_path: string;
}

// =============================================================================
// Output Helpers
// =============================================================================

function outputJSON(data: unknown): void {
  console.log(JSON.stringify(data, null, 2));
}

// =============================================================================
// Command Handlers
// =============================================================================

/**
 * Handle `wpnav use --list`
 * Lists all available environments from the config file
 */
export async function handleUseList(options: UseCommandOptions = {}): Promise<number> {
  const discovery = discoverConfigFile();

  if (!discovery.found || !discovery.path) {
    if (options.json) {
      outputJSON({
        success: false,
        command: 'use --list',
        error: {
          code: 'CONFIG_NOT_FOUND',
          message: 'No wpnav.config.json found',
          searched: discovery.searched,
        },
      });
    } else {
      errorMessage('No wpnav.config.json found');
      newline();
      info('Run "wpnav init" to create one.');
    }
    return 1;
  }

  let config: WPNavConfigFile;
  try {
    config = parseConfigFile(discovery.path);
  } catch (err) {
    if (options.json) {
      outputJSON({
        success: false,
        command: 'use --list',
        error: {
          code: 'CONFIG_INVALID',
          message: err instanceof Error ? err.message : String(err),
          path: discovery.path,
        },
      });
    } else {
      errorMessage(`Failed to parse config: ${err instanceof Error ? err.message : String(err)}`);
    }
    return 1;
  }

  const environments = Object.keys(config.environments);
  const activeEnv = config.default_environment || null;

  if (options.json) {
    outputJSON({
      success: true,
      command: 'use --list',
      data: {
        environments,
        active: activeEnv,
        config_path: discovery.path,
      },
    });
    return 0;
  }

  // TUI output
  newline();
  box('Available Environments');
  newline();

  if (activeEnv) {
    info(`Active: ${colorize(activeEnv, 'cyan')}`);
    newline();
  } else {
    info('No active environment set (will use first available)');
    newline();
  }

  for (const env of environments) {
    const isActive = env === activeEnv;
    const marker = isActive ? colorize('→ ', 'green') : '  ';
    const name = isActive ? colorize(env, 'green') : env;
    const envConfig = config.environments[env];
    console.error(`${marker}${name}`);
    console.error(`    Site: ${colorize(envConfig.site, 'dim')}`);
    console.error(`    User: ${colorize(envConfig.user, 'dim')}`);
    console.error('');
  }

  keyValue('Total', String(environments.length));
  keyValue('Config', discovery.path);

  return 0;
}

/**
 * Handle `wpnav use <env>`
 * Switches the active environment by updating default_environment in config
 */
export async function handleUseSwitch(
  envName: string,
  options: UseCommandOptions = {}
): Promise<number> {
  if (!envName) {
    if (options.json) {
      outputJSON({
        success: false,
        command: 'use',
        error: {
          code: 'MISSING_ENVIRONMENT',
          message: 'Environment name required',
        },
      });
    } else {
      errorMessage('Environment name required. Usage: wpnav use <env>');
      newline();
      info('Use "wpnav use --list" to see available environments.');
    }
    return 1;
  }

  const discovery = discoverConfigFile();

  if (!discovery.found || !discovery.path) {
    if (options.json) {
      outputJSON({
        success: false,
        command: 'use',
        error: {
          code: 'CONFIG_NOT_FOUND',
          message: 'No wpnav.config.json found',
          searched: discovery.searched,
        },
      });
    } else {
      errorMessage('No wpnav.config.json found');
      newline();
      info('Run "wpnav init" to create one.');
    }
    return 1;
  }

  let config: WPNavConfigFile;
  try {
    config = parseConfigFile(discovery.path);
  } catch (err) {
    if (options.json) {
      outputJSON({
        success: false,
        command: 'use',
        error: {
          code: 'CONFIG_INVALID',
          message: err instanceof Error ? err.message : String(err),
          path: discovery.path,
        },
      });
    } else {
      errorMessage(`Failed to parse config: ${err instanceof Error ? err.message : String(err)}`);
    }
    return 1;
  }

  // Validate environment exists
  const environments = Object.keys(config.environments);
  if (!environments.includes(envName)) {
    if (options.json) {
      outputJSON({
        success: false,
        command: 'use',
        error: {
          code: 'ENVIRONMENT_NOT_FOUND',
          message: `Environment not found: ${envName}`,
          available: environments,
        },
      });
    } else {
      errorMessage(`Environment not found: ${envName}`);
      newline();
      info('Available environments:');
      for (const env of environments) {
        console.error(`  ${env}`);
      }
      newline();
      info('Use "wpnav use --list" for more details.');
    }
    return 1;
  }

  // Check if already using this environment
  const previousEnv = config.default_environment || null;
  if (previousEnv === envName) {
    if (options.json) {
      outputJSON({
        success: true,
        command: 'use',
        data: {
          environment: envName,
          previous: previousEnv,
          message: 'Already using this environment',
          config_path: discovery.path,
        },
      });
    } else {
      info(`Already using environment: ${colorize(envName, 'cyan')}`);
    }
    return 0;
  }

  // Update config file
  config.default_environment = envName;

  try {
    fs.writeFileSync(discovery.path, JSON.stringify(config, null, 2) + '\n', 'utf8');
  } catch (err) {
    if (options.json) {
      outputJSON({
        success: false,
        command: 'use',
        error: {
          code: 'WRITE_FAILED',
          message: `Failed to update config: ${err instanceof Error ? err.message : String(err)}`,
          path: discovery.path,
        },
      });
    } else {
      errorMessage(`Failed to update config: ${err instanceof Error ? err.message : String(err)}`);
    }
    return 1;
  }

  const envConfig = config.environments[envName];

  if (options.json) {
    outputJSON({
      success: true,
      command: 'use',
      data: {
        environment: envName,
        previous: previousEnv,
        site: envConfig.site,
        user: envConfig.user,
        message: 'Environment switched successfully',
        config_path: discovery.path,
      },
    });
    return 0;
  }

  // TUI output
  newline();
  success(`Switched to environment: ${colorize(envName, 'cyan')}`);
  newline();
  keyValue('Site', envConfig.site);
  keyValue('User', envConfig.user);
  if (previousEnv) {
    keyValue('Previous', previousEnv);
  }
  keyValue('Config', discovery.path);
  newline();
  info('New sessions will use this environment by default.');

  return 0;
}

/**
 * Main use command handler
 */
export async function handleUse(args: string[], options: UseCommandOptions = {}): Promise<number> {
  // Handle --list flag
  if (options.list) {
    return handleUseList(options);
  }

  // Handle environment switch
  const envName = args[0];
  return handleUseSwitch(envName, options);
}

export default handleUse;
