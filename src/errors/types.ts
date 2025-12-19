/**
 * Standardized Error Types
 *
 * Machine-parseable error codes for AI agent consumption.
 *
 * @package WP_Navigator_Pro
 * @since 2.8.0
 */

/**
 * Error categories for grouping and exit codes
 */
export enum ErrorCategory {
  GENERAL = 'general',
  CONFIG = 'config',
  NETWORK = 'network',
  SNAPSHOT = 'snapshot',
  SYNC = 'sync',
  AUTH = 'auth',
  PERMISSION = 'permission',
  VALIDATION = 'validation',
  RESOURCE = 'resource',
}

/**
 * Error category codes for AI parsing
 */
export enum ErrorCode {
  // Connection errors
  CONNECTION_FAILED = 'CONNECTION_FAILED',
  AUTH_FAILED = 'AUTH_FAILED',
  PLUGIN_NOT_FOUND = 'PLUGIN_NOT_FOUND',
  SSL_ERROR = 'SSL_ERROR',
  TIMEOUT = 'TIMEOUT',

  // Configuration errors
  MANIFEST_INVALID = 'MANIFEST_INVALID',
  CONFIG_MISSING = 'CONFIG_MISSING',
  CONFIG_INVALID = 'CONFIG_INVALID',

  // Operation errors
  SNAPSHOT_FAILED = 'SNAPSHOT_FAILED',
  SYNC_FAILED = 'SYNC_FAILED',
  ROLLBACK_FAILED = 'ROLLBACK_FAILED',

  // Validation errors
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  MISSING_REQUIRED = 'MISSING_REQUIRED',
  INVALID_INPUT = 'INVALID_INPUT',

  // Permission errors
  WRITES_DISABLED = 'WRITES_DISABLED',
  POLICY_DENY = 'POLICY_DENY',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',

  // Resource errors
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  RATE_LIMITED = 'RATE_LIMITED',

  // Generic
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/**
 * Map error codes to categories
 */
export const ERROR_CATEGORIES: Record<ErrorCode, ErrorCategory> = {
  [ErrorCode.CONNECTION_FAILED]: ErrorCategory.NETWORK,
  [ErrorCode.AUTH_FAILED]: ErrorCategory.AUTH,
  [ErrorCode.PLUGIN_NOT_FOUND]: ErrorCategory.CONFIG,
  [ErrorCode.SSL_ERROR]: ErrorCategory.NETWORK,
  [ErrorCode.TIMEOUT]: ErrorCategory.NETWORK,
  [ErrorCode.MANIFEST_INVALID]: ErrorCategory.CONFIG,
  [ErrorCode.CONFIG_MISSING]: ErrorCategory.CONFIG,
  [ErrorCode.CONFIG_INVALID]: ErrorCategory.CONFIG,
  [ErrorCode.SNAPSHOT_FAILED]: ErrorCategory.SNAPSHOT,
  [ErrorCode.SYNC_FAILED]: ErrorCategory.SYNC,
  [ErrorCode.ROLLBACK_FAILED]: ErrorCategory.SYNC,
  [ErrorCode.VALIDATION_ERROR]: ErrorCategory.VALIDATION,
  [ErrorCode.MISSING_REQUIRED]: ErrorCategory.VALIDATION,
  [ErrorCode.INVALID_INPUT]: ErrorCategory.VALIDATION,
  [ErrorCode.WRITES_DISABLED]: ErrorCategory.PERMISSION,
  [ErrorCode.POLICY_DENY]: ErrorCategory.PERMISSION,
  [ErrorCode.INSUFFICIENT_PERMISSIONS]: ErrorCategory.PERMISSION,
  [ErrorCode.NOT_FOUND]: ErrorCategory.RESOURCE,
  [ErrorCode.CONFLICT]: ErrorCategory.RESOURCE,
  [ErrorCode.RATE_LIMITED]: ErrorCategory.NETWORK,
  [ErrorCode.UNKNOWN_ERROR]: ErrorCategory.GENERAL,
};

/**
 * CLI exit codes aligned with error categories
 */
export const EXIT_CODES: Record<ErrorCategory, number> = {
  [ErrorCategory.GENERAL]: 1,
  [ErrorCategory.CONFIG]: 2,
  [ErrorCategory.NETWORK]: 3,
  [ErrorCategory.SNAPSHOT]: 4,
  [ErrorCategory.SYNC]: 5,
  [ErrorCategory.AUTH]: 6,
  [ErrorCategory.PERMISSION]: 7,
  [ErrorCategory.VALIDATION]: 8,
  [ErrorCategory.RESOURCE]: 9,
};

/**
 * Structured error for AI consumption
 */
export interface WPNavError {
  /** Machine-parseable error code */
  code: ErrorCode;
  /** Error category (derived from code) */
  category: ErrorCategory;
  /** One-line summary */
  message: string;
  /** Friendly explanation */
  explanation?: string;
  /** Suggested next steps */
  suggestions?: string[];
  /** Specific commands to try */
  commands?: string[];
  /** Documentation URL */
  docs_url?: string;
  /** Additional context */
  context?: Record<string, unknown>;
}

/**
 * Create a standardized error object
 */
export function createError(
  code: ErrorCode,
  message: string,
  options?: Partial<Omit<WPNavError, 'code' | 'message' | 'category'>>
): WPNavError {
  return {
    code,
    category: ERROR_CATEGORIES[code],
    message,
    ...options,
  };
}

/**
 * Get exit code for an error
 */
export function getExitCode(error: WPNavError): number {
  return EXIT_CODES[error.category] ?? 1;
}
