/**
 * Error Formatter
 *
 * Formats errors for CLI and MCP output.
 *
 * @package WP_Navigator_Pro
 * @since 2.8.0
 */

import { WPNavError, ErrorCode, ErrorCategory } from './types.js';

/**
 * Format error for CLI output (human-readable)
 */
export function formatErrorForCLI(error: WPNavError): string {
  const lines: string[] = [];

  // Error headline with prefix
  lines.push(`✖ ${error.message}`);
  lines.push('');

  // Friendly explanation
  if (error.explanation) {
    lines.push(error.explanation);
    lines.push('');
  }

  // Suggestions
  if (error.suggestions && error.suggestions.length > 0) {
    lines.push('Tips:');
    for (const tip of error.suggestions) {
      lines.push(`• ${tip}`);
    }
    lines.push('');
  }

  // Commands
  if (error.commands && error.commands.length > 0) {
    lines.push('Try:');
    for (const cmd of error.commands) {
      lines.push(`  ${cmd}`);
    }
    lines.push('');
  }

  // Documentation link
  if (error.docs_url) {
    lines.push(`Docs: ${error.docs_url}`);
  }

  return lines.join('\n').trimEnd();
}

/**
 * Format error for MCP/JSON output (machine-readable)
 */
export function formatErrorForMCP(error: WPNavError): object {
  return {
    error: error.code,
    category: error.category,
    message: error.message,
    suggestions: error.suggestions,
    commands: error.commands,
    docs_url: error.docs_url,
    context: error.context,
  };
}

/**
 * Common error templates for quick creation
 */
export const ErrorTemplates = {
  connectionFailed: (url: string): WPNavError => ({
    code: ErrorCode.CONNECTION_FAILED,
    category: ErrorCategory.NETWORK,
    message: "WP Navigator couldn't connect to your site.",
    explanation: `Unable to reach ${url}. The site may be down or the URL may be incorrect.`,
    suggestions: [
      'Check that the plugin is installed and activated.',
      'Make sure your URL is correct.',
      'Verify the site is accessible in a browser.',
    ],
    commands: ['wpnav doctor', 'wpnav configure'],
    docs_url: 'https://wpnav.ai/docs/errors/connection-failed',
  }),

  authFailed: (): WPNavError => ({
    code: ErrorCode.AUTH_FAILED,
    category: ErrorCategory.AUTH,
    message: 'Authentication failed.',
    explanation: 'Your username or application password is incorrect.',
    suggestions: [
      'Regenerate your Application Password in WordPress.',
      'Re-run the configure command with updated credentials.',
    ],
    commands: ['wpnav configure'],
    docs_url: 'https://wpnav.ai/docs/errors/auth-failed',
  }),

  pluginNotFound: (): WPNavError => ({
    code: ErrorCode.PLUGIN_NOT_FOUND,
    category: ErrorCategory.CONFIG,
    message: 'WP Navigator plugin not found.',
    explanation:
      'The WP Navigator plugin needs to be installed and activated on your WordPress site.',
    suggestions: [
      'Install WP Navigator from WordPress.org.',
      'Activate the plugin in WordPress admin.',
    ],
    commands: ['wpnav doctor'],
    docs_url: 'https://wpnav.ai/docs/errors/plugin-not-found',
  }),

  writesDisabled: (): WPNavError => ({
    code: ErrorCode.WRITES_DISABLED,
    category: ErrorCategory.PERMISSION,
    message: 'Write operations are disabled.',
    explanation: 'This environment is configured for read-only access.',
    suggestions: [
      'Enable writes in your configuration if intended.',
      'Use --dry-run to preview changes without applying.',
    ],
    docs_url: 'https://wpnav.ai/docs/errors/writes-disabled',
    context: { safety_mode: 'read-only' },
  }),

  validationError: (field: string, reason: string): WPNavError => ({
    code: ErrorCode.VALIDATION_ERROR,
    category: ErrorCategory.VALIDATION,
    message: `Validation failed: ${field}`,
    explanation: reason,
    suggestions: ['Check the input format and try again.'],
    docs_url: 'https://wpnav.ai/docs/errors/validation-error',
  }),

  notFound: (resource: string, id: string | number): WPNavError => ({
    code: ErrorCode.NOT_FOUND,
    category: ErrorCategory.RESOURCE,
    message: `${resource} not found.`,
    explanation: `Could not find ${resource} with ID ${id}.`,
    suggestions: ['Verify the ID is correct.', 'List available items first.'],
    docs_url: 'https://wpnav.ai/docs/errors/not-found',
  }),

  configMissing: (): WPNavError => ({
    code: ErrorCode.CONFIG_MISSING,
    category: ErrorCategory.CONFIG,
    message: 'No configuration file found.',
    explanation: 'WP Navigator needs a configuration file to connect to your WordPress site.',
    suggestions: [
      'Run wpnav init to create a new configuration.',
      'Provide a path to your wp-config.json file.',
    ],
    commands: ['wpnav init', 'wpnav configure'],
    docs_url: 'https://wpnav.ai/docs/errors/config-missing',
  }),

  configInvalid: (reason: string): WPNavError => ({
    code: ErrorCode.CONFIG_INVALID,
    category: ErrorCategory.CONFIG,
    message: 'Configuration is invalid.',
    explanation: reason,
    suggestions: ['Check your configuration file for errors.', 'Re-run the configure command.'],
    commands: ['wpnav validate', 'wpnav configure'],
    docs_url: 'https://wpnav.ai/docs/errors/config-invalid',
  }),

  timeout: (operation: string): WPNavError => ({
    code: ErrorCode.TIMEOUT,
    category: ErrorCategory.NETWORK,
    message: `Operation timed out: ${operation}`,
    explanation: 'The request took too long to complete.',
    suggestions: [
      'Check your network connection.',
      'Try again in a few moments.',
      'The WordPress server may be under heavy load.',
    ],
    commands: ['wpnav doctor'],
    docs_url: 'https://wpnav.ai/docs/errors/timeout',
  }),

  sslError: (url: string): WPNavError => ({
    code: ErrorCode.SSL_ERROR,
    category: ErrorCategory.NETWORK,
    message: 'SSL certificate error.',
    explanation: `Could not establish a secure connection to ${url}.`,
    suggestions: [
      'Verify the SSL certificate is valid.',
      'For local development, use allow_insecure_http setting.',
    ],
    commands: ['wpnav doctor'],
    docs_url: 'https://wpnav.ai/docs/errors/ssl-error',
  }),

  rateLimited: (): WPNavError => ({
    code: ErrorCode.RATE_LIMITED,
    category: ErrorCategory.NETWORK,
    message: 'Rate limit exceeded.',
    explanation: 'Too many requests have been made in a short time.',
    suggestions: ['Wait a few moments before retrying.', 'Reduce the frequency of requests.'],
    docs_url: 'https://wpnav.ai/docs/errors/rate-limited',
  }),

  snapshotFailed: (reason: string): WPNavError => ({
    code: ErrorCode.SNAPSHOT_FAILED,
    category: ErrorCategory.SNAPSHOT,
    message: 'Snapshot operation failed.',
    explanation: reason,
    suggestions: ['Check the site connection.', 'Verify you have permission to read the content.'],
    commands: ['wpnav doctor', 'wpnav snapshot --help'],
    docs_url: 'https://wpnav.ai/docs/errors/snapshot-failed',
  }),

  syncFailed: (reason: string): WPNavError => ({
    code: ErrorCode.SYNC_FAILED,
    category: ErrorCategory.SYNC,
    message: 'Sync operation failed.',
    explanation: reason,
    suggestions: [
      'Check your manifest for errors.',
      'Ensure writes are enabled.',
      'Use --dry-run to preview changes first.',
    ],
    commands: ['wpnav validate', 'wpnav sync --dry-run'],
    docs_url: 'https://wpnav.ai/docs/errors/sync-failed',
  }),

  rollbackFailed: (reason: string): WPNavError => ({
    code: ErrorCode.ROLLBACK_FAILED,
    category: ErrorCategory.SYNC,
    message: 'Rollback failed.',
    explanation: reason,
    suggestions: ['Check if the backup snapshot exists.', 'Verify you have write permissions.'],
    commands: ['wpnav rollback --list'],
    docs_url: 'https://wpnav.ai/docs/errors/rollback-failed',
  }),

  insufficientPermissions: (action: string): WPNavError => ({
    code: ErrorCode.INSUFFICIENT_PERMISSIONS,
    category: ErrorCategory.PERMISSION,
    message: `Insufficient permissions for: ${action}`,
    explanation: 'Your WordPress user does not have permission to perform this action.',
    suggestions: ['Use an administrator account.', 'Check user capabilities in WordPress.'],
    docs_url: 'https://wpnav.ai/docs/errors/insufficient-permissions',
  }),

  policyDeny: (policy: string): WPNavError => ({
    code: ErrorCode.POLICY_DENY,
    category: ErrorCategory.PERMISSION,
    message: `Action denied by policy: ${policy}`,
    explanation: 'This action is blocked by a security policy.',
    suggestions: [
      'Review your configuration security settings.',
      'Contact your administrator if you need access.',
    ],
    docs_url: 'https://wpnav.ai/docs/errors/policy-deny',
  }),

  conflict: (resource: string, reason: string): WPNavError => ({
    code: ErrorCode.CONFLICT,
    category: ErrorCategory.RESOURCE,
    message: `Conflict detected: ${resource}`,
    explanation: reason,
    suggestions: ['Refresh your local data.', 'Resolve the conflict manually.'],
    docs_url: 'https://wpnav.ai/docs/errors/conflict',
  }),

  manifestInvalid: (reason: string): WPNavError => ({
    code: ErrorCode.MANIFEST_INVALID,
    category: ErrorCategory.CONFIG,
    message: 'Manifest file is invalid.',
    explanation: reason,
    suggestions: [
      'Check your wpnavigator.jsonc file for syntax errors.',
      'Run wpnav validate to see detailed errors.',
    ],
    commands: ['wpnav validate --manifest'],
    docs_url: 'https://wpnav.ai/docs/errors/manifest-invalid',
  }),

  missingRequired: (field: string): WPNavError => ({
    code: ErrorCode.MISSING_REQUIRED,
    category: ErrorCategory.VALIDATION,
    message: `Missing required field: ${field}`,
    explanation: `The field "${field}" is required but was not provided.`,
    suggestions: ['Provide the missing field and try again.'],
    docs_url: 'https://wpnav.ai/docs/errors/missing-required',
  }),

  invalidInput: (field: string, reason: string): WPNavError => ({
    code: ErrorCode.INVALID_INPUT,
    category: ErrorCategory.VALIDATION,
    message: `Invalid input: ${field}`,
    explanation: reason,
    suggestions: ['Check the input format and constraints.'],
    docs_url: 'https://wpnav.ai/docs/errors/invalid-input',
  }),

  unknownError: (message: string): WPNavError => ({
    code: ErrorCode.UNKNOWN_ERROR,
    category: ErrorCategory.GENERAL,
    message: 'An unexpected error occurred.',
    explanation: message,
    suggestions: ['Try the operation again.', 'If the problem persists, check the logs.'],
    commands: ['wpnav doctor'],
    docs_url: 'https://wpnav.ai/docs/troubleshooting',
  }),
};
