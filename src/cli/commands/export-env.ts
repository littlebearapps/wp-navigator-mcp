/**
 * WP Navigator Export Environment Variables Command
 *
 * Exports configuration as environment variables in various formats.
 * Supports shell, docker, and github formats.
 *
 * @package WP_Navigator_MCP
 * @since 2.3.0
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  loadWpnavConfig,
  type ResolvedConfig,
} from '../../wpnav-config.js';
import {
  success,
  error as errorMessage,
  info,
  newline,
  colorize,
  warning,
} from '../tui/components.js';

// =============================================================================
// Types
// =============================================================================

export type ExportFormat = 'shell' | 'docker' | 'github';

export interface ExportEnvOptions {
  format?: ExportFormat;
  json?: boolean;
  config?: string; // Config file path
  env?: string; // Environment name
}

export interface ExportEnvResult {
  format: ExportFormat;
  output: string;
  variables: Record<string, string>;
}

// =============================================================================
// Environment Variable Mapping
// =============================================================================

/**
 * Map ResolvedConfig to environment variables
 */
export function configToEnvVars(config: ResolvedConfig): Record<string, string> {
  const vars: Record<string, string> = {};

  // Core connection variables
  vars.WP_BASE_URL = config.site;
  vars.WP_REST_API = config.rest_api;
  vars.WPNAV_BASE = config.wpnav_base;
  vars.WPNAV_INTROSPECT = config.wpnav_introspect;
  vars.WP_APP_USER = config.user;
  vars.WP_APP_PASS = config.password;

  // Safety settings
  vars.WPNAV_ENABLE_WRITES = config.safety.enable_writes ? '1' : '0';
  vars.ALLOW_INSECURE_HTTP = config.safety.allow_insecure_http ? '1' : '0';
  vars.WPNAV_TOOL_TIMEOUT_MS = String(config.safety.tool_timeout_ms);
  vars.WPNAV_MAX_RESPONSE_KB = String(config.safety.max_response_kb);

  // Optional safety settings
  if (config.safety.sign_headers) {
    vars.WPNAV_SIGN_HEADERS = '1';
  }
  if (config.safety.hmac_secret) {
    vars.WPNAV_HMAC_SECRET = config.safety.hmac_secret;
  }
  if (config.safety.ca_bundle) {
    vars.WPNAV_CA_BUNDLE = config.safety.ca_bundle;
  }

  // Feature flags
  if (config.features.workflows) {
    vars.WPNAV_FLAG_WORKFLOWS_ENABLED = '1';
  }
  if (config.features.bulk_validator) {
    vars.WPNAV_FLAG_WP_BULK_VALIDATOR_ENABLED = '1';
  }
  if (config.features.seo_audit) {
    vars.WPNAV_FLAG_WP_SEO_AUDIT_ENABLED = '1';
  }
  if (config.features.content_reviewer) {
    vars.WPNAV_FLAG_WP_CONTENT_REVIEWER_ENABLED = '1';
  }
  if (config.features.migration_planner) {
    vars.WPNAV_FLAG_WP_MIGRATION_PLANNER_ENABLED = '1';
  }
  if (config.features.performance_analyzer) {
    vars.WPNAV_FLAG_WP_PERFORMANCE_ANALYZER_ENABLED = '1';
  }

  // Environment and role
  if (config.environment) {
    vars.WPNAV_ENVIRONMENT = config.environment;
  }
  if (config.default_role) {
    vars.WPNAV_ROLE = config.default_role;
  }

  return vars;
}

// =============================================================================
// Format Functions
// =============================================================================

/**
 * Format as shell export statements
 */
export function formatAsShell(vars: Record<string, string>, configPath?: string): string {
  const lines: string[] = [
    '# WP Navigator Environment Variables',
    `# Generated from ${configPath || 'wpnav.config.json'}`,
    '',
  ];

  for (const [key, value] of Object.entries(vars)) {
    // Quote values that contain spaces or special characters
    const quotedValue = value.includes(' ') || value.includes('$') || value.includes('!')
      ? `"${value.replace(/"/g, '\\"')}"`
      : `"${value}"`;
    lines.push(`export ${key}=${quotedValue}`);
  }

  return lines.join('\n') + '\n';
}

/**
 * Format as Dockerfile ENV statements
 */
export function formatAsDocker(vars: Record<string, string>, configPath?: string): string {
  const lines: string[] = [
    '# WP Navigator Environment Variables',
    `# Generated from ${configPath || 'wpnav.config.json'}`,
    '',
  ];

  for (const [key, value] of Object.entries(vars)) {
    // Docker ENV values don't need quotes unless they contain spaces
    const formattedValue = value.includes(' ') ? `"${value}"` : value;
    lines.push(`ENV ${key}=${formattedValue}`);
  }

  return lines.join('\n') + '\n';
}

/**
 * Format as GitHub Actions environment
 */
export function formatAsGitHub(vars: Record<string, string>, configPath?: string): string {
  const lines: string[] = [
    '# WP Navigator Environment Variables',
    `# Generated from ${configPath || 'wpnav.config.json'}`,
    '# Add to .github/workflows/*.yml under env: section',
    '',
    'env:',
  ];

  for (const [key, value] of Object.entries(vars)) {
    // YAML values should be quoted if they contain special characters
    const quotedValue = `"${value.replace(/"/g, '\\"')}"`;
    lines.push(`  ${key}: ${quotedValue}`);
  }

  return lines.join('\n') + '\n';
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
 * Handle the export-env command
 * @returns Exit code: 0 for success, 1 for errors
 */
export async function handleExportEnv(options: ExportEnvOptions = {}): Promise<number> {
  const isJson = options.json === true;
  const format: ExportFormat = options.format || 'shell';

  // Validate format
  if (!['shell', 'docker', 'github'].includes(format)) {
    if (isJson) {
      outputJSON({
        success: false,
        command: 'export-env',
        error: {
          code: 'INVALID_FORMAT',
          message: `Invalid format: "${format}". Supported formats: shell, docker, github`,
        },
      });
    } else {
      errorMessage('Invalid format', `Supported formats: shell, docker, github`);
    }
    return 1;
  }

  // Load configuration
  const result = loadWpnavConfig({
    configPath: options.config,
    environment: options.env,
    fallbackToEnv: false, // Don't fall back to env vars - we want to read from config file
  });

  if (!result.success || !result.config) {
    if (isJson) {
      outputJSON({
        success: false,
        command: 'export-env',
        error: {
          code: 'CONFIG_NOT_FOUND',
          message: result.error || 'No wpnav.config.json found. Run "wpnav init" first.',
          details: result.errorDetails,
        },
      });
    } else {
      errorMessage('Configuration not found', result.error || 'Run "wpnav init" first to initialize your project.');
    }
    return 1;
  }

  const config = result.config;

  // Convert config to environment variables
  const vars = configToEnvVars(config);

  // Format output
  let output: string;
  const configPath = config.config_path;

  switch (format) {
    case 'docker':
      output = formatAsDocker(vars, configPath);
      break;
    case 'github':
      output = formatAsGitHub(vars, configPath);
      break;
    case 'shell':
    default:
      output = formatAsShell(vars, configPath);
      break;
  }

  // Output
  if (isJson) {
    outputJSON({
      success: true,
      command: 'export-env',
      data: {
        format,
        config_path: configPath,
        environment: config.environment,
        variable_count: Object.keys(vars).length,
        output,
      },
    });
  } else {
    // Output directly to stdout for piping
    console.log(output);
  }

  return 0;
}

export default handleExportEnv;
