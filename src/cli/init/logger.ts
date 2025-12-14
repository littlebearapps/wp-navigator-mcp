/**
 * Init Wizard Logger
 *
 * Logs wizard events to .wpnav/init.log for debugging and recovery.
 * Redacts sensitive information like passwords.
 *
 * @package WP_Navigator_Pro
 * @since 2.5.0
 *
 * @example
 * import { createInitLogger } from './logger.js';
 *
 * const logger = createInitLogger();
 * logger.start();
 * logger.step(1, 'Welcome', 'completed');
 * logger.step(2, 'Site URL', 'started');
 * logger.action('User entered: https://example.com');
 * logger.step(2, 'Site URL', 'completed');
 * logger.end(true);
 */

import * as fs from 'fs';
import * as path from 'path';

// =============================================================================
// Types
// =============================================================================

/**
 * Step status for logging
 */
export type StepStatus = 'started' | 'completed' | 'failed' | 'skipped';

/**
 * Init logger interface
 */
export interface InitLogger {
  /** Log wizard start */
  start(): void;
  /** Log step event */
  step(num: number, name: string, status: StepStatus, detail?: string): void;
  /** Log user action (navigation key pressed, etc.) */
  action(action: string): void;
  /** Log informational message */
  info(message: string): void;
  /** Log error */
  error(message: string): void;
  /** Log wizard end */
  end(success: boolean): void;
  /** Get path to log file */
  getLogPath(): string;
  /** Force flush pending writes */
  flush(): void;
}

/**
 * Options for logger creation
 */
export interface InitLoggerOptions {
  /** Base directory for .wpnav folder (default: cwd) */
  baseDir?: string;
  /** Maximum log file size in bytes before rotation (default: 1MB) */
  maxSize?: number;
  /** Whether to disable logging (for testing/CI) */
  disabled?: boolean;
}

// =============================================================================
// Constants
// =============================================================================

/** Default max log file size (1MB) */
const DEFAULT_MAX_SIZE = 1024 * 1024;

/** Log file name */
const LOG_FILE_NAME = 'init.log';

/** Backup log file name */
const BACKUP_LOG_FILE_NAME = 'init.log.1';

/** .wpnav directory name */
const WPNAV_DIR = '.wpnav';

/** Patterns to redact from log output */
const REDACT_PATTERNS = [
  // Application passwords (typically 4 groups of 4 chars)
  /([a-zA-Z0-9]{4}\s+){3}[a-zA-Z0-9]{4}/g,
  // Password fields in key-value format
  /password['":\s]*[=:]\s*['"]?[^\s'"]+['"]?/gi,
  /pass['":\s]*[=:]\s*['"]?[^\s'"]+['"]?/gi,
  // Bearer tokens
  /bearer\s+[a-zA-Z0-9._-]+/gi,
  // Basic auth headers
  /basic\s+[a-zA-Z0-9+/=]+/gi,
  // Generic API keys
  /api[_-]?key['":\s]*[=:]\s*['"]?[^\s'"]+['"]?/gi,
  // Secret fields
  /secret['":\s]*[=:]\s*['"]?[^\s'"]+['"]?/gi,
];

/** Replacement text for redacted content */
const REDACTED = '[REDACTED]';

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Get ISO 8601 timestamp
 */
function getTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Redact sensitive information from a string
 *
 * @param text - Text to redact
 * @returns Text with sensitive information replaced
 */
export function redactSensitive(text: string): string {
  let redacted = text;
  for (const pattern of REDACT_PATTERNS) {
    redacted = redacted.replace(pattern, REDACTED);
  }
  return redacted;
}

/**
 * Format a log entry
 *
 * @param level - Log level
 * @param message - Message to log
 * @returns Formatted log line
 */
function formatLogEntry(level: string, message: string): string {
  return `[${getTimestamp()}] [${level.toUpperCase().padEnd(5)}] ${message}\n`;
}

// =============================================================================
// Logger Factory
// =============================================================================

/**
 * Create a new init logger instance
 *
 * @param options - Logger configuration
 * @returns InitLogger instance
 */
export function createInitLogger(options: InitLoggerOptions = {}): InitLogger {
  const { baseDir = process.cwd(), maxSize = DEFAULT_MAX_SIZE, disabled = false } = options;

  const wpnavDir = path.join(baseDir, WPNAV_DIR);
  const logPath = path.join(wpnavDir, LOG_FILE_NAME);
  const backupPath = path.join(wpnavDir, BACKUP_LOG_FILE_NAME);

  // Buffer for writes
  let writeBuffer = '';
  let initialized = false;

  /**
   * Ensure .wpnav directory exists
   */
  function ensureDirectory(): boolean {
    if (disabled) return false;

    try {
      if (!fs.existsSync(wpnavDir)) {
        fs.mkdirSync(wpnavDir, { recursive: true });
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check and rotate log file if too large
   */
  function rotateIfNeeded(): void {
    if (disabled) return;

    try {
      if (fs.existsSync(logPath)) {
        const stats = fs.statSync(logPath);
        if (stats.size >= maxSize) {
          // Remove old backup if exists
          if (fs.existsSync(backupPath)) {
            fs.unlinkSync(backupPath);
          }
          // Rename current to backup
          fs.renameSync(logPath, backupPath);
        }
      }
    } catch {
      // Ignore rotation errors
    }
  }

  /**
   * Write to log file
   */
  function write(entry: string): void {
    if (disabled) return;

    writeBuffer += entry;

    // Initialize on first write
    if (!initialized) {
      if (!ensureDirectory()) return;
      rotateIfNeeded();
      initialized = true;
    }

    // Flush buffer to disk
    try {
      fs.appendFileSync(logPath, writeBuffer);
      writeBuffer = '';
    } catch {
      // Keep in buffer if write fails
    }
  }

  /**
   * Log wizard start
   */
  function start(): void {
    write('\n' + '='.repeat(60) + '\n');
    write(formatLogEntry('INFO', '=== WP Navigator Init Started ==='));
    write(formatLogEntry('INFO', `Working directory: ${baseDir}`));
    write(formatLogEntry('INFO', `Node version: ${process.version}`));
  }

  /**
   * Log step event
   */
  function step(num: number, name: string, status: StepStatus, detail?: string): void {
    const statusText = status.toUpperCase();
    let message = `Step ${num}: ${name} - ${statusText}`;
    if (detail) {
      message += ` - ${redactSensitive(detail)}`;
    }
    write(formatLogEntry('STEP', message));
  }

  /**
   * Log user action
   */
  function action(actionText: string): void {
    write(formatLogEntry('ACTION', redactSensitive(actionText)));
  }

  /**
   * Log informational message
   */
  function info(message: string): void {
    write(formatLogEntry('INFO', redactSensitive(message)));
  }

  /**
   * Log error
   */
  function error(message: string): void {
    write(formatLogEntry('ERROR', redactSensitive(message)));
  }

  /**
   * Log wizard end
   */
  function end(success: boolean): void {
    const status = success ? 'Completed Successfully' : 'Failed/Aborted';
    write(formatLogEntry('INFO', `=== WP Navigator Init ${status} ===`));
    write('='.repeat(60) + '\n');
    flush();
  }

  /**
   * Get path to log file
   */
  function getLogPath(): string {
    return logPath;
  }

  /**
   * Force flush pending writes
   */
  function flush(): void {
    if (disabled || writeBuffer.length === 0) return;

    try {
      if (!initialized) {
        if (!ensureDirectory()) return;
        rotateIfNeeded();
        initialized = true;
      }
      fs.appendFileSync(logPath, writeBuffer);
      writeBuffer = '';
    } catch {
      // Ignore flush errors
    }
  }

  return {
    start,
    step,
    action,
    info,
    error,
    end,
    getLogPath,
    flush,
  };
}

// =============================================================================
// No-op Logger (for testing)
// =============================================================================

/**
 * Create a no-op logger that doesn't write to disk
 * Useful for testing or when logging is disabled
 *
 * @returns InitLogger instance that does nothing
 */
export function createNoopLogger(): InitLogger {
  return {
    start: () => {},
    step: () => {},
    action: () => {},
    info: () => {},
    error: () => {},
    end: () => {},
    getLogPath: () => '',
    flush: () => {},
  };
}

// =============================================================================
// Memory Logger (for testing)
// =============================================================================

/**
 * Logger that stores entries in memory
 * Useful for testing log output without filesystem
 */
export interface MemoryLogger extends InitLogger {
  /** Get all logged entries */
  getEntries(): string[];
  /** Clear all entries */
  clearEntries(): void;
}

/**
 * Create a logger that stores entries in memory
 *
 * @returns MemoryLogger instance
 */
export function createMemoryLogger(): MemoryLogger {
  const entries: string[] = [];

  function addEntry(entry: string): void {
    entries.push(entry.trim());
  }

  return {
    start: () => addEntry('=== WP Navigator Init Started ==='),
    step: (num, name, status, detail) => {
      let msg = `Step ${num}: ${name} - ${status.toUpperCase()}`;
      if (detail) msg += ` - ${redactSensitive(detail)}`;
      addEntry(msg);
    },
    action: (action) => addEntry(`ACTION: ${redactSensitive(action)}`),
    info: (message) => addEntry(`INFO: ${redactSensitive(message)}`),
    error: (message) => addEntry(`ERROR: ${redactSensitive(message)}`),
    end: (success) => addEntry(`=== Init ${success ? 'Completed' : 'Failed'} ===`),
    getLogPath: () => ':memory:',
    flush: () => {},
    getEntries: () => [...entries],
    clearEntries: () => {
      entries.length = 0;
    },
  };
}
