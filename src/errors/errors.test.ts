import { describe, it, expect, vi } from 'vitest';
import {
  ErrorCode,
  ErrorCategory,
  ERROR_CATEGORIES,
  EXIT_CODES,
  createError,
  getExitCode,
  WPNavError,
} from './types.js';
import { formatErrorForCLI, formatErrorForMCP, ErrorTemplates } from './formatter.js';
import {
  isWPNavError,
  toWPNavError,
  handleCLIError,
  withErrorHandler,
  withSyncErrorHandler,
} from './cli-handler.js';

describe('Error Types', () => {
  describe('createError', () => {
    it('creates error with code, message, and auto-derived category', () => {
      const error = createError(ErrorCode.CONNECTION_FAILED, 'Connection failed');

      expect(error.code).toBe(ErrorCode.CONNECTION_FAILED);
      expect(error.message).toBe('Connection failed');
      expect(error.category).toBe(ErrorCategory.NETWORK);
    });

    it('includes optional fields', () => {
      const error = createError(ErrorCode.AUTH_FAILED, 'Auth failed', {
        explanation: 'Bad password',
        suggestions: ['Try again'],
        commands: ['wpnav configure'],
        docs_url: 'https://wpnav.ai/docs/errors/auth-failed',
      });

      expect(error.explanation).toBe('Bad password');
      expect(error.suggestions).toEqual(['Try again']);
      expect(error.commands).toEqual(['wpnav configure']);
      expect(error.docs_url).toBe('https://wpnav.ai/docs/errors/auth-failed');
      expect(error.category).toBe(ErrorCategory.AUTH);
    });
  });
});

describe('Error Categories', () => {
  it('maps error codes to correct categories', () => {
    expect(ERROR_CATEGORIES[ErrorCode.AUTH_FAILED]).toBe(ErrorCategory.AUTH);
    expect(ERROR_CATEGORIES[ErrorCode.CONNECTION_FAILED]).toBe(ErrorCategory.NETWORK);
    expect(ERROR_CATEGORIES[ErrorCode.CONFIG_MISSING]).toBe(ErrorCategory.CONFIG);
    expect(ERROR_CATEGORIES[ErrorCode.SNAPSHOT_FAILED]).toBe(ErrorCategory.SNAPSHOT);
    expect(ERROR_CATEGORIES[ErrorCode.SYNC_FAILED]).toBe(ErrorCategory.SYNC);
    expect(ERROR_CATEGORIES[ErrorCode.WRITES_DISABLED]).toBe(ErrorCategory.PERMISSION);
    expect(ERROR_CATEGORIES[ErrorCode.VALIDATION_ERROR]).toBe(ErrorCategory.VALIDATION);
    expect(ERROR_CATEGORIES[ErrorCode.NOT_FOUND]).toBe(ErrorCategory.RESOURCE);
    expect(ERROR_CATEGORIES[ErrorCode.UNKNOWN_ERROR]).toBe(ErrorCategory.GENERAL);
  });

  it('has a mapping for every error code', () => {
    const errorCodes = Object.values(ErrorCode);
    for (const code of errorCodes) {
      expect(ERROR_CATEGORIES[code]).toBeDefined();
    }
  });
});

describe('Exit Codes', () => {
  it('returns correct exit code for auth error', () => {
    const error = createError(ErrorCode.AUTH_FAILED, 'Auth failed');
    expect(getExitCode(error)).toBe(6);
  });

  it('returns correct exit code for config error', () => {
    const error = createError(ErrorCode.CONFIG_MISSING, 'No config');
    expect(getExitCode(error)).toBe(2);
  });

  it('returns correct exit code for network error', () => {
    const error = createError(ErrorCode.CONNECTION_FAILED, 'Connection failed');
    expect(getExitCode(error)).toBe(3);
  });

  it('returns correct exit code for snapshot error', () => {
    const error = createError(ErrorCode.SNAPSHOT_FAILED, 'Snapshot failed');
    expect(getExitCode(error)).toBe(4);
  });

  it('returns correct exit code for sync error', () => {
    const error = createError(ErrorCode.SYNC_FAILED, 'Sync failed');
    expect(getExitCode(error)).toBe(5);
  });

  it('returns correct exit code for permission error', () => {
    const error = createError(ErrorCode.WRITES_DISABLED, 'Writes disabled');
    expect(getExitCode(error)).toBe(7);
  });

  it('returns correct exit code for validation error', () => {
    const error = createError(ErrorCode.VALIDATION_ERROR, 'Invalid');
    expect(getExitCode(error)).toBe(8);
  });

  it('returns correct exit code for resource error', () => {
    const error = createError(ErrorCode.NOT_FOUND, 'Not found');
    expect(getExitCode(error)).toBe(9);
  });

  it('returns 1 for general/unknown error', () => {
    const error = createError(ErrorCode.UNKNOWN_ERROR, 'Unknown');
    expect(getExitCode(error)).toBe(1);
  });

  it('has an exit code for every category', () => {
    const categories = Object.values(ErrorCategory);
    for (const category of categories) {
      expect(EXIT_CODES[category]).toBeDefined();
      expect(typeof EXIT_CODES[category]).toBe('number');
    }
  });
});

describe('Error Formatter', () => {
  describe('formatErrorForCLI', () => {
    it('formats error with all components', () => {
      const error: WPNavError = {
        code: ErrorCode.CONNECTION_FAILED,
        category: ErrorCategory.NETWORK,
        message: 'Connection failed',
        explanation: 'Site unreachable',
        suggestions: ['Check URL', 'Check network'],
        commands: ['wpnav doctor'],
        docs_url: 'https://wpnav.ai/docs/errors/connection-failed',
      };

      const output = formatErrorForCLI(error);

      expect(output).toContain('✖ Connection failed');
      expect(output).toContain('Site unreachable');
      expect(output).toContain('Tips:');
      expect(output).toContain('• Check URL');
      expect(output).toContain('Try:');
      expect(output).toContain('wpnav doctor');
      expect(output).toContain('Docs: https://wpnav.ai/docs/errors/connection-failed');
    });

    it('handles minimal error', () => {
      const error: WPNavError = {
        code: ErrorCode.UNKNOWN_ERROR,
        category: ErrorCategory.GENERAL,
        message: 'Something went wrong',
      };

      const output = formatErrorForCLI(error);

      expect(output).toBe('✖ Something went wrong');
    });

    it('omits docs_url when not provided', () => {
      const error: WPNavError = {
        code: ErrorCode.UNKNOWN_ERROR,
        category: ErrorCategory.GENERAL,
        message: 'Error',
        suggestions: ['Try again'],
      };

      const output = formatErrorForCLI(error);

      expect(output).not.toContain('Docs:');
    });
  });

  describe('formatErrorForMCP', () => {
    it('returns machine-readable object with category and docs_url', () => {
      const error: WPNavError = {
        code: ErrorCode.VALIDATION_ERROR,
        category: ErrorCategory.VALIDATION,
        message: 'Invalid input',
        suggestions: ['Fix it'],
        docs_url: 'https://wpnav.ai/docs/errors/validation-error',
        context: { field: 'title' },
      };

      const output = formatErrorForMCP(error);

      expect(output).toEqual({
        error: 'VALIDATION_ERROR',
        category: 'validation',
        message: 'Invalid input',
        suggestions: ['Fix it'],
        commands: undefined,
        docs_url: 'https://wpnav.ai/docs/errors/validation-error',
        context: { field: 'title' },
      });
    });

    it('includes category from template errors', () => {
      const error = ErrorTemplates.authFailed();
      const output = formatErrorForMCP(error) as Record<string, unknown>;

      expect(output.category).toBe(ErrorCategory.AUTH);
      expect(output.docs_url).toBeDefined();
    });
  });
});

describe('Error Templates', () => {
  it('connectionFailed includes URL', () => {
    const error = ErrorTemplates.connectionFailed('https://example.com');

    expect(error.code).toBe(ErrorCode.CONNECTION_FAILED);
    expect(error.explanation).toContain('example.com');
    expect(error.commands).toContain('wpnav doctor');
  });

  it('authFailed has correct structure', () => {
    const error = ErrorTemplates.authFailed();

    expect(error.code).toBe(ErrorCode.AUTH_FAILED);
    expect(error.commands).toContain('wpnav configure');
  });

  it('writesDisabled includes safety context', () => {
    const error = ErrorTemplates.writesDisabled();

    expect(error.code).toBe(ErrorCode.WRITES_DISABLED);
    expect(error.context?.safety_mode).toBe('read-only');
  });

  it('notFound formats resource and id', () => {
    const error = ErrorTemplates.notFound('Post', 123);

    expect(error.message).toBe('Post not found.');
    expect(error.explanation).toContain('123');
  });

  it('validationError includes field and reason', () => {
    const error = ErrorTemplates.validationError('title', 'Cannot be empty');

    expect(error.code).toBe(ErrorCode.VALIDATION_ERROR);
    expect(error.message).toContain('title');
    expect(error.explanation).toBe('Cannot be empty');
  });
});

describe('CLI Error Handler', () => {
  describe('isWPNavError', () => {
    it('returns true for valid WPNavError', () => {
      const error: WPNavError = {
        code: ErrorCode.AUTH_FAILED,
        category: ErrorCategory.AUTH,
        message: 'Auth failed',
      };

      expect(isWPNavError(error)).toBe(true);
    });

    it('returns true for error created with createError', () => {
      const error = createError(ErrorCode.CONNECTION_FAILED, 'Connection failed');

      expect(isWPNavError(error)).toBe(true);
    });

    it('returns true for ErrorTemplate error', () => {
      const error = ErrorTemplates.authFailed();

      expect(isWPNavError(error)).toBe(true);
    });

    it('returns false for plain Error', () => {
      const error = new Error('Something went wrong');

      expect(isWPNavError(error)).toBe(false);
    });

    it('returns false for object missing category', () => {
      const error = {
        code: ErrorCode.AUTH_FAILED,
        message: 'Auth failed',
      };

      expect(isWPNavError(error)).toBe(false);
    });

    it('returns false for object missing code', () => {
      const error = {
        category: ErrorCategory.AUTH,
        message: 'Auth failed',
      };

      expect(isWPNavError(error)).toBe(false);
    });

    it('returns false for object missing message', () => {
      const error = {
        code: ErrorCode.AUTH_FAILED,
        category: ErrorCategory.AUTH,
      };

      expect(isWPNavError(error)).toBe(false);
    });

    it('returns false for null', () => {
      expect(isWPNavError(null)).toBe(false);
    });

    it('returns false for undefined', () => {
      expect(isWPNavError(undefined)).toBe(false);
    });

    it('returns false for string', () => {
      expect(isWPNavError('error message')).toBe(false);
    });

    it('returns false for number', () => {
      expect(isWPNavError(42)).toBe(false);
    });
  });

  describe('toWPNavError', () => {
    it('returns original error if already WPNavError', () => {
      const error = createError(ErrorCode.AUTH_FAILED, 'Auth failed', {
        explanation: 'Bad password',
        suggestions: ['Try again'],
      });

      const result = toWPNavError(error);

      expect(result).toBe(error);
      expect(result.code).toBe(ErrorCode.AUTH_FAILED);
      expect(result.explanation).toBe('Bad password');
    });

    it('converts plain Error to WPNavError', () => {
      const error = new Error('Something went wrong');

      const result = toWPNavError(error);

      expect(result.code).toBe(ErrorCode.UNKNOWN_ERROR);
      expect(result.category).toBe(ErrorCategory.GENERAL);
      expect(result.message).toBe('An unexpected error occurred.');
      expect(result.explanation).toBe('Something went wrong');
      expect(result.suggestions).toBeDefined();
      expect(result.commands).toContain('wpnav doctor');
      expect(result.docs_url).toBeDefined();
    });

    it('converts string to WPNavError', () => {
      const result = toWPNavError('string error');

      expect(result.code).toBe(ErrorCode.UNKNOWN_ERROR);
      expect(result.category).toBe(ErrorCategory.GENERAL);
      expect(result.explanation).toBe('string error');
    });

    it('converts number to WPNavError', () => {
      const result = toWPNavError(404);

      expect(result.code).toBe(ErrorCode.UNKNOWN_ERROR);
      expect(result.explanation).toBe('404');
    });

    it('converts object without required fields to WPNavError', () => {
      const result = toWPNavError({ foo: 'bar' });

      expect(result.code).toBe(ErrorCode.UNKNOWN_ERROR);
      expect(result.category).toBe(ErrorCategory.GENERAL);
    });
  });

  describe('handleCLIError', () => {
    it('outputs formatted error to stderr and returns exit code', () => {
      const error = createError(ErrorCode.AUTH_FAILED, 'Auth failed');
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const exitCode = handleCLIError(error, { exit: false });

      expect(exitCode).toBe(6); // AUTH exit code
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Auth failed'));

      consoleSpy.mockRestore();
    });

    it('outputs JSON when json option is true', () => {
      const error = createError(ErrorCode.CONFIG_MISSING, 'No config');
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const exitCode = handleCLIError(error, { json: true, exit: false });

      expect(exitCode).toBe(2); // CONFIG exit code
      const output = JSON.parse(consoleSpy.mock.calls[0][0]);
      expect(output.error).toBe('CONFIG_MISSING');
      expect(output.category).toBe('config');

      consoleSpy.mockRestore();
    });

    it('returns correct exit code for each category', () => {
      const testCases = [
        { code: ErrorCode.UNKNOWN_ERROR, expectedExit: 1 },
        { code: ErrorCode.CONFIG_MISSING, expectedExit: 2 },
        { code: ErrorCode.CONNECTION_FAILED, expectedExit: 3 },
        { code: ErrorCode.SNAPSHOT_FAILED, expectedExit: 4 },
        { code: ErrorCode.SYNC_FAILED, expectedExit: 5 },
        { code: ErrorCode.AUTH_FAILED, expectedExit: 6 },
        { code: ErrorCode.WRITES_DISABLED, expectedExit: 7 },
        { code: ErrorCode.VALIDATION_ERROR, expectedExit: 8 },
        { code: ErrorCode.NOT_FOUND, expectedExit: 9 },
      ];

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      for (const { code, expectedExit } of testCases) {
        const error = createError(code, `Test ${code}`);
        const exitCode = handleCLIError(error, { exit: false });
        expect(exitCode).toBe(expectedExit);
      }

      consoleSpy.mockRestore();
    });
  });

  describe('withErrorHandler', () => {
    it('passes through when no error is thrown', async () => {
      const fn = vi.fn().mockResolvedValue(undefined);
      const wrapped = withErrorHandler(fn, { exit: false });

      await wrapped('arg1', 'arg2');

      expect(fn).toHaveBeenCalledWith('arg1', 'arg2');
    });

    it('catches and handles WPNavError', async () => {
      const error = createError(ErrorCode.AUTH_FAILED, 'Auth failed');
      const fn = vi.fn().mockRejectedValue(error);
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const wrapped = withErrorHandler(fn, { exit: false });

      await wrapped();

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Auth failed'));

      consoleSpy.mockRestore();
    });

    it('catches and converts plain Error', async () => {
      const error = new Error('Plain error');
      const fn = vi.fn().mockRejectedValue(error);
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const wrapped = withErrorHandler(fn, { exit: false });

      await wrapped();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('An unexpected error occurred')
      );

      consoleSpy.mockRestore();
    });

    it('outputs JSON when json option is true', async () => {
      const error = createError(ErrorCode.CONFIG_INVALID, 'Invalid config');
      const fn = vi.fn().mockRejectedValue(error);
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const wrapped = withErrorHandler(fn, { json: true, exit: false });

      await wrapped();

      const output = JSON.parse(consoleSpy.mock.calls[0][0]);
      expect(output.error).toBe('CONFIG_INVALID');

      consoleSpy.mockRestore();
    });
  });

  describe('withSyncErrorHandler', () => {
    it('passes through when no error is thrown', () => {
      const fn = vi.fn();
      const wrapped = withSyncErrorHandler(fn, { exit: false });

      wrapped('arg1', 'arg2');

      expect(fn).toHaveBeenCalledWith('arg1', 'arg2');
    });

    it('catches and handles WPNavError', () => {
      const error = createError(ErrorCode.VALIDATION_ERROR, 'Validation failed');
      const fn = vi.fn().mockImplementation(() => {
        throw error;
      });
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const wrapped = withSyncErrorHandler(fn, { exit: false });

      wrapped();

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Validation failed'));

      consoleSpy.mockRestore();
    });

    it('catches and converts plain Error', () => {
      const fn = vi.fn().mockImplementation(() => {
        throw new Error('Sync error');
      });
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const wrapped = withSyncErrorHandler(fn, { exit: false });

      wrapped();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('An unexpected error occurred')
      );

      consoleSpy.mockRestore();
    });

    it('outputs JSON when json option is true', () => {
      const error = createError(ErrorCode.NOT_FOUND, 'Not found');
      const fn = vi.fn().mockImplementation(() => {
        throw error;
      });
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const wrapped = withSyncErrorHandler(fn, { json: true, exit: false });

      wrapped();

      const output = JSON.parse(consoleSpy.mock.calls[0][0]);
      expect(output.error).toBe('NOT_FOUND');
      expect(output.category).toBe('resource');

      consoleSpy.mockRestore();
    });
  });
});
