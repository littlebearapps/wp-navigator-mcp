/**
 * CLI Error Handler
 *
 * Handles errors in CLI mode with proper exit codes.
 *
 * @package WP_Navigator_Pro
 * @since 2.8.0
 */

import { WPNavError, ErrorCode, ErrorCategory, ERROR_CATEGORIES, getExitCode } from './types.js';
import { formatErrorForCLI, formatErrorForMCP } from './formatter.js';

export interface CLIErrorOptions {
  /** Output in JSON format instead of human-readable */
  json?: boolean;
  /** Whether to call process.exit (default: true) */
  exit?: boolean;
}

/**
 * Handle error in CLI context
 *
 * @param error - The WPNavError to handle
 * @param options - Output and exit options
 * @returns The exit code that would be/was used
 */
export function handleCLIError(error: WPNavError, options: CLIErrorOptions = {}): number {
  const exitCode = getExitCode(error);

  if (options.json) {
    console.log(JSON.stringify(formatErrorForMCP(error), null, 2));
  } else {
    console.error(formatErrorForCLI(error));
  }

  if (options.exit !== false) {
    process.exit(exitCode);
  }

  return exitCode;
}

/**
 * Type guard to check if an error is a WPNavError
 */
export function isWPNavError(err: unknown): err is WPNavError {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    'category' in err &&
    'message' in err
  );
}

/**
 * Convert unknown error to WPNavError
 */
export function toWPNavError(err: unknown): WPNavError {
  if (isWPNavError(err)) {
    return err;
  }

  const message = err instanceof Error ? err.message : String(err);

  return {
    code: ErrorCode.UNKNOWN_ERROR,
    category: ERROR_CATEGORIES[ErrorCode.UNKNOWN_ERROR],
    message: 'An unexpected error occurred.',
    explanation: message,
    suggestions: ['Try the operation again.', 'If the problem persists, check the logs.'],
    commands: ['wpnav doctor'],
    docs_url: 'https://wpnav.ai/docs/troubleshooting',
  };
}

/**
 * Wrap async CLI command with error handling
 *
 * @param fn - The async function to wrap
 * @param options - Error handling options
 * @returns Wrapped function with error handling
 */
export function withErrorHandler<T extends (...args: unknown[]) => Promise<void>>(
  fn: T,
  options: CLIErrorOptions = {}
): T {
  return (async (...args: Parameters<T>) => {
    try {
      await fn(...args);
    } catch (err) {
      const wpnavError = toWPNavError(err);
      handleCLIError(wpnavError, options);
    }
  }) as T;
}

/**
 * Create a CLI error handler for synchronous operations
 *
 * @param fn - The sync function to wrap
 * @param options - Error handling options
 * @returns Wrapped function with error handling
 */
export function withSyncErrorHandler<T extends (...args: unknown[]) => void>(
  fn: T,
  options: CLIErrorOptions = {}
): T {
  return ((...args: Parameters<T>) => {
    try {
      fn(...args);
    } catch (err) {
      const wpnavError = toWPNavError(err);
      handleCLIError(wpnavError, options);
    }
  }) as T;
}
