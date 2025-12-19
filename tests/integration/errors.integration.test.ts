/**
 * Error System Integration Tests
 *
 * Tests standardized error codes, categories, and exit codes work together.
 *
 * @package WP_Navigator_Pro
 * @since 2.8.0
 */

import { describe, it, expect } from 'vitest';
import {
  ErrorCode,
  ErrorCategory,
  createError,
  getExitCode,
  EXIT_CODES,
  ERROR_CATEGORIES,
  type WPNavError,
} from '../../src/errors/index.js';

describe('Error System Integration', () => {
  describe('Error Code Coverage', () => {
    it('all error codes have categories', () => {
      for (const code of Object.values(ErrorCode)) {
        expect(ERROR_CATEGORIES[code], `Missing category for ${code}`).toBeDefined();
      }
    });

    it('all categories have exit codes', () => {
      for (const category of Object.values(ErrorCategory)) {
        expect(EXIT_CODES[category], `Missing exit code for ${category}`).toBeDefined();
      }
    });

    it('exit codes are in valid range (0-9)', () => {
      for (const [category, exitCode] of Object.entries(EXIT_CODES)) {
        expect(exitCode, `Exit code for ${category} should be >= 0`).toBeGreaterThanOrEqual(0);
        expect(exitCode, `Exit code for ${category} should be <= 9`).toBeLessThanOrEqual(9);
      }
    });

    it('exit codes are unique per category', () => {
      const usedCodes = new Set<number>();
      for (const [category, exitCode] of Object.entries(EXIT_CODES)) {
        expect(usedCodes.has(exitCode), `Duplicate exit code ${exitCode} for ${category}`).toBe(
          false
        );
        usedCodes.add(exitCode);
      }
    });
  });

  describe('createError', () => {
    it('creates error with all required fields', () => {
      const error = createError(ErrorCode.AUTH_FAILED, 'Authentication failed');

      expect(error.code).toBe(ErrorCode.AUTH_FAILED);
      expect(error.category).toBe(ErrorCategory.AUTH);
      expect(error.message).toBe('Authentication failed');
    });

    it('derives category from error code', () => {
      const testCases: Array<[ErrorCode, ErrorCategory]> = [
        [ErrorCode.CONNECTION_FAILED, ErrorCategory.NETWORK],
        [ErrorCode.AUTH_FAILED, ErrorCategory.AUTH],
        [ErrorCode.CONFIG_MISSING, ErrorCategory.CONFIG],
        [ErrorCode.SNAPSHOT_FAILED, ErrorCategory.SNAPSHOT],
        [ErrorCode.SYNC_FAILED, ErrorCategory.SYNC],
        [ErrorCode.VALIDATION_ERROR, ErrorCategory.VALIDATION],
        [ErrorCode.WRITES_DISABLED, ErrorCategory.PERMISSION],
        [ErrorCode.NOT_FOUND, ErrorCategory.RESOURCE],
      ];

      for (const [code, expectedCategory] of testCases) {
        const error = createError(code, 'test');
        expect(error.category, `Wrong category for ${code}`).toBe(expectedCategory);
      }
    });

    it('includes optional fields when provided', () => {
      const error = createError(ErrorCode.CONFIG_INVALID, 'Invalid config', {
        explanation: 'The configuration file has syntax errors',
        suggestions: ['Check JSON syntax', 'Run wpnav validate'],
        commands: ['wpnav validate', 'wpnav doctor'],
        docs_url: 'https://wpnav.ai/docs/config',
        context: { file: 'wpnav.config.json', line: 42 },
      });

      expect(error.explanation).toBe('The configuration file has syntax errors');
      expect(error.suggestions).toHaveLength(2);
      expect(error.commands).toContain('wpnav validate');
      expect(error.docs_url).toBe('https://wpnav.ai/docs/config');
      expect(error.context?.file).toBe('wpnav.config.json');
    });
  });

  describe('getExitCode', () => {
    it('returns correct exit code for each error category', () => {
      const testCases: Array<[ErrorCode, number]> = [
        [ErrorCode.UNKNOWN_ERROR, 1], // general
        [ErrorCode.CONFIG_MISSING, 2], // config
        [ErrorCode.CONNECTION_FAILED, 3], // network
        [ErrorCode.SNAPSHOT_FAILED, 4], // snapshot
        [ErrorCode.SYNC_FAILED, 5], // sync
        [ErrorCode.AUTH_FAILED, 6], // auth
        [ErrorCode.WRITES_DISABLED, 7], // permission
        [ErrorCode.VALIDATION_ERROR, 8], // validation
        [ErrorCode.NOT_FOUND, 9], // resource
      ];

      for (const [code, expectedExitCode] of testCases) {
        const error = createError(code, 'test');
        expect(getExitCode(error), `Wrong exit code for ${code}`).toBe(expectedExitCode);
      }
    });

    it('defaults to 1 for unknown category', () => {
      const error: WPNavError = {
        code: ErrorCode.UNKNOWN_ERROR,
        category: 'nonexistent' as ErrorCategory,
        message: 'test',
      };

      expect(getExitCode(error)).toBe(1);
    });
  });

  describe('Error Flow Integration', () => {
    it('creates parseable error for AI agents', () => {
      const error = createError(ErrorCode.PLUGIN_NOT_FOUND, 'WP Navigator plugin not detected', {
        explanation: 'The WP Navigator plugin must be installed and activated.',
        suggestions: ['Install WP Navigator from WordPress.org', 'Activate the plugin in wp-admin'],
        commands: ['wpnav doctor'],
      });

      // Serialize and parse to simulate AI agent consumption
      const serialized = JSON.stringify(error);
      const parsed = JSON.parse(serialized);

      expect(parsed.code).toBe('PLUGIN_NOT_FOUND');
      expect(parsed.category).toBe('config');
      expect(parsed.suggestions).toHaveLength(2);
      expect(getExitCode(parsed as WPNavError)).toBe(2);
    });

    it('supports network errors with timeout', () => {
      const error = createError(ErrorCode.TIMEOUT, 'Request timed out', {
        context: { url: 'https://example.com/wp-json', timeout_ms: 30000 },
        suggestions: ['Check network connectivity', 'Increase timeout'],
      });

      expect(error.category).toBe(ErrorCategory.NETWORK);
      expect(getExitCode(error)).toBe(3);
    });

    it('supports permission errors with policy details', () => {
      const error = createError(ErrorCode.POLICY_DENY, 'Operation blocked by policy', {
        context: { policy: 'writes_disabled', operation: 'update_post' },
        commands: ['export WPNAV_ENABLE_WRITES=1'],
      });

      expect(error.category).toBe(ErrorCategory.PERMISSION);
      expect(getExitCode(error)).toBe(7);
    });
  });
});
