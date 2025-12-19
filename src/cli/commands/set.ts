/**
 * WP Navigator Set Command
 *
 * CLI command for updating config values in wpnav.config.json:
 * - `wpnav set <key> <value>` - Set a config value
 * - `wpnav set --list` - Show current configuration
 *
 * Supports dot notation for nested values (e.g., safety.mode).
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
import {
  discoverConfigFile,
  parseConfigFile,
  type WPNavConfigFile,
  type SafetyConfig,
  type FeaturesConfig,
} from '../../wpnav-config.js';

// =============================================================================
// Types
// =============================================================================

export interface SetCommandOptions {
  /** Output JSON instead of TUI */
  json?: boolean;
  /** List current configuration */
  list?: boolean;
}

export interface SetResult {
  success: boolean;
  key?: string;
  value?: unknown;
  previous?: unknown;
  message: string;
  config_path?: string;
}

// =============================================================================
// Schema Definition
// =============================================================================

type ValueType = 'string' | 'number' | 'boolean';

interface SettableKey {
  path: string[];
  type: ValueType;
  description: string;
}

/**
 * Schema for settable config keys
 * Maps dot-notation keys to their types and paths
 */
const SETTABLE_KEYS: Record<string, SettableKey> = {
  // Top-level keys
  default_environment: {
    path: ['default_environment'],
    type: 'string',
    description: 'Default environment to use',
  },
  default_role: {
    path: ['default_role'],
    type: 'string',
    description: 'Default AI role for context',
  },

  // Safety settings
  'safety.enable_writes': {
    path: ['safety', 'enable_writes'],
    type: 'boolean',
    description: 'Enable write operations',
  },
  'safety.allow_insecure_http': {
    path: ['safety', 'allow_insecure_http'],
    type: 'boolean',
    description: 'Allow HTTP for localhost development',
  },
  'safety.tool_timeout_ms': {
    path: ['safety', 'tool_timeout_ms'],
    type: 'number',
    description: 'Per-tool timeout in milliseconds',
  },
  'safety.max_response_kb': {
    path: ['safety', 'max_response_kb'],
    type: 'number',
    description: 'Maximum response size in KB',
  },
  'safety.sign_headers': {
    path: ['safety', 'sign_headers'],
    type: 'boolean',
    description: 'Enable HMAC request signing',
  },
  'safety.hmac_secret': {
    path: ['safety', 'hmac_secret'],
    type: 'string',
    description: 'HMAC secret for request signing',
  },
  'safety.ca_bundle': {
    path: ['safety', 'ca_bundle'],
    type: 'string',
    description: 'Custom CA bundle path',
  },

  // Feature flags
  'features.workflows': {
    path: ['features', 'workflows'],
    type: 'boolean',
    description: 'Enable AI workflows',
  },
  'features.bulk_validator': {
    path: ['features', 'bulk_validator'],
    type: 'boolean',
    description: 'Enable bulk content validator',
  },
  'features.seo_audit': {
    path: ['features', 'seo_audit'],
    type: 'boolean',
    description: 'Enable SEO audit tool',
  },
  'features.content_reviewer': {
    path: ['features', 'content_reviewer'],
    type: 'boolean',
    description: 'Enable content reviewer',
  },
  'features.migration_planner': {
    path: ['features', 'migration_planner'],
    type: 'boolean',
    description: 'Enable migration planner',
  },
  'features.performance_analyzer': {
    path: ['features', 'performance_analyzer'],
    type: 'boolean',
    description: 'Enable performance analyzer',
  },
};

// =============================================================================
// Output Helpers
// =============================================================================

function outputJSON(data: unknown): void {
  console.log(JSON.stringify(data, null, 2));
}

// =============================================================================
// Value Parsing and Validation
// =============================================================================

/**
 * Parse a string value to the expected type
 */
function parseValue(value: string, type: ValueType): unknown {
  switch (type) {
    case 'boolean':
      const lower = value.toLowerCase();
      if (lower === 'true' || lower === '1' || lower === 'yes' || lower === 'on') {
        return true;
      }
      if (lower === 'false' || lower === '0' || lower === 'no' || lower === 'off') {
        return false;
      }
      throw new Error(`Invalid boolean value: ${value}. Use true/false, yes/no, or 1/0.`);

    case 'number':
      const num = parseInt(value, 10);
      if (isNaN(num)) {
        throw new Error(`Invalid number value: ${value}`);
      }
      if (num < 0) {
        throw new Error(`Value must be a positive number: ${value}`);
      }
      return num;

    case 'string':
      return value;

    default:
      return value;
  }
}

/**
 * Get a value from nested object using path array
 */
function getNestedValue(obj: Record<string, unknown>, path: string[]): unknown {
  let current: unknown = obj;
  for (const key of path) {
    if (current === undefined || current === null || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

/**
 * Set a value in nested object using path array, creating intermediate objects as needed
 */
function setNestedValue(obj: Record<string, unknown>, path: string[], value: unknown): void {
  let current: Record<string, unknown> = obj;
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i];
    if (current[key] === undefined || current[key] === null || typeof current[key] !== 'object') {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }
  current[path[path.length - 1]] = value;
}

// =============================================================================
// Command Handlers
// =============================================================================

/**
 * Handle `wpnav set --list`
 * Shows current configuration values
 */
export async function handleSetList(options: SetCommandOptions = {}): Promise<number> {
  const discovery = discoverConfigFile();

  if (!discovery.found || !discovery.path) {
    if (options.json) {
      outputJSON({
        success: false,
        command: 'set --list',
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
        command: 'set --list',
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

  // Build current values map
  const currentValues: Record<string, unknown> = {};
  for (const [key, schema] of Object.entries(SETTABLE_KEYS)) {
    currentValues[key] = getNestedValue(config as unknown as Record<string, unknown>, schema.path);
  }

  if (options.json) {
    outputJSON({
      success: true,
      command: 'set --list',
      data: {
        values: currentValues,
        config_path: discovery.path,
        settable_keys: Object.entries(SETTABLE_KEYS).map(([key, schema]) => ({
          key,
          type: schema.type,
          description: schema.description,
        })),
      },
    });
    return 0;
  }

  // TUI output
  newline();
  box('Current Configuration');
  newline();

  // Group by category
  const categories: Record<string, string[]> = {
    General: ['default_environment', 'default_role'],
    Safety: Object.keys(SETTABLE_KEYS).filter((k) => k.startsWith('safety.')),
    Features: Object.keys(SETTABLE_KEYS).filter((k) => k.startsWith('features.')),
  };

  for (const [category, keys] of Object.entries(categories)) {
    info(colorize(`${category}:`, 'cyan'));
    for (const key of keys) {
      const value = currentValues[key];
      const displayValue = value === undefined ? colorize('(not set)', 'dim') : String(value);
      console.error(`  ${key}: ${displayValue}`);
    }
    newline();
  }

  keyValue('Config', discovery.path);
  newline();
  info('Use "wpnav set <key> <value>" to update a value.');

  return 0;
}

/**
 * Handle `wpnav set <key> <value>`
 * Updates a config value with validation
 */
export async function handleSetValue(
  key: string,
  value: string,
  options: SetCommandOptions = {}
): Promise<number> {
  // Validate key is settable
  const schema = SETTABLE_KEYS[key];
  if (!schema) {
    const availableKeys = Object.keys(SETTABLE_KEYS).join(', ');
    if (options.json) {
      outputJSON({
        success: false,
        command: 'set',
        error: {
          code: 'INVALID_KEY',
          message: `Unknown config key: ${key}`,
          available_keys: Object.keys(SETTABLE_KEYS),
        },
      });
    } else {
      errorMessage(`Unknown config key: ${key}`);
      newline();
      info('Available keys:');
      for (const [k, s] of Object.entries(SETTABLE_KEYS)) {
        console.error(`  ${colorize(k, 'cyan')} (${s.type}) - ${s.description}`);
      }
    }
    return 1;
  }

  // Parse and validate value
  let parsedValue: unknown;
  try {
    parsedValue = parseValue(value, schema.type);
  } catch (err) {
    if (options.json) {
      outputJSON({
        success: false,
        command: 'set',
        error: {
          code: 'INVALID_VALUE',
          message: err instanceof Error ? err.message : String(err),
          key,
          expected_type: schema.type,
        },
      });
    } else {
      errorMessage(err instanceof Error ? err.message : String(err));
      newline();
      info(`Key "${key}" expects a ${schema.type} value.`);
    }
    return 1;
  }

  // Discover and load config
  const discovery = discoverConfigFile();

  if (!discovery.found || !discovery.path) {
    if (options.json) {
      outputJSON({
        success: false,
        command: 'set',
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
        command: 'set',
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

  // Get previous value
  const previousValue = getNestedValue(config as unknown as Record<string, unknown>, schema.path);

  // Check if value is the same
  if (previousValue === parsedValue) {
    if (options.json) {
      outputJSON({
        success: true,
        command: 'set',
        data: {
          key,
          value: parsedValue,
          previous: previousValue,
          message: 'Value unchanged',
          config_path: discovery.path,
        },
      });
    } else {
      info(`Value unchanged: ${key} = ${String(parsedValue)}`);
    }
    return 0;
  }

  // Validate special cases
  if (key === 'default_environment') {
    const environments = Object.keys(config.environments);
    if (!environments.includes(value)) {
      if (options.json) {
        outputJSON({
          success: false,
          command: 'set',
          error: {
            code: 'ENVIRONMENT_NOT_FOUND',
            message: `Environment not found: ${value}`,
            available: environments,
          },
        });
      } else {
        errorMessage(`Environment not found: ${value}`);
        newline();
        info('Available environments:');
        for (const env of environments) {
          console.error(`  ${env}`);
        }
      }
      return 1;
    }
  }

  // Update the config
  setNestedValue(config as unknown as Record<string, unknown>, schema.path, parsedValue);

  // Write updated config
  try {
    fs.writeFileSync(discovery.path, JSON.stringify(config, null, 2) + '\n', 'utf8');
  } catch (err) {
    if (options.json) {
      outputJSON({
        success: false,
        command: 'set',
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

  if (options.json) {
    outputJSON({
      success: true,
      command: 'set',
      data: {
        key,
        value: parsedValue,
        previous: previousValue,
        message: 'Configuration updated successfully',
        config_path: discovery.path,
      },
    });
    return 0;
  }

  // TUI output
  newline();
  success(`Updated: ${colorize(key, 'cyan')}`);
  newline();
  keyValue('New value', String(parsedValue));
  if (previousValue !== undefined) {
    keyValue('Previous', String(previousValue));
  }
  keyValue('Config', discovery.path);

  return 0;
}

/**
 * Main set command handler
 */
export async function handleSet(args: string[], options: SetCommandOptions = {}): Promise<number> {
  // Handle --list flag
  if (options.list) {
    return handleSetList(options);
  }

  // Validate arguments
  const key = args[0];
  const value = args[1];

  if (!key) {
    if (options.json) {
      outputJSON({
        success: false,
        command: 'set',
        error: {
          code: 'MISSING_KEY',
          message: 'Key required',
          available_keys: Object.keys(SETTABLE_KEYS),
        },
      });
    } else {
      errorMessage('Key required. Usage: wpnav set <key> <value>');
      newline();
      info('Use "wpnav set --list" to see available keys and current values.');
    }
    return 1;
  }

  if (value === undefined) {
    if (options.json) {
      outputJSON({
        success: false,
        command: 'set',
        error: {
          code: 'MISSING_VALUE',
          message: 'Value required',
          key,
        },
      });
    } else {
      errorMessage('Value required. Usage: wpnav set <key> <value>');
      newline();
      const schema = SETTABLE_KEYS[key];
      if (schema) {
        info(`Key "${key}" expects a ${schema.type} value.`);
      }
    }
    return 1;
  }

  return handleSetValue(key, value, options);
}

export default handleSet;
