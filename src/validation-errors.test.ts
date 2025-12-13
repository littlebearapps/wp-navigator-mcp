/**
 * Tests for validation error formatting
 *
 * @package WP_Navigator_MCP
 */

import { describe, it, expect } from 'vitest';
import {
  offsetToPosition,
  findKeyPosition,
  formatValidationError,
  formatValidationErrors,
  formatValidationErrorJson,
  createValidationError,
  parseJsonSyntaxError,
  isValidHexColor,
  isValidUrl,
  isValidVersion,
  getTypeName,
  type ValidationError,
  type SourcePosition,
} from './validation-errors.js';

// =============================================================================
// offsetToPosition Tests
// =============================================================================

describe('offsetToPosition', () => {
  it('should return line 1 column 1 for offset 0', () => {
    const source = 'hello world';
    const pos = offsetToPosition(source, 0);
    expect(pos.line).toBe(1);
    expect(pos.column).toBe(1);
  });

  it('should count characters correctly on single line', () => {
    const source = 'hello world';
    const pos = offsetToPosition(source, 5);
    expect(pos.line).toBe(1);
    expect(pos.column).toBe(6); // "hello" = 5 chars, column is 1-based
  });

  it('should handle newlines correctly', () => {
    const source = 'line1\nline2\nline3';
    // Position at start of line 2 (after newline)
    const pos = offsetToPosition(source, 6);
    expect(pos.line).toBe(2);
    expect(pos.column).toBe(1);
  });

  it('should handle position in middle of line 2', () => {
    const source = 'line1\nline2\nline3';
    const pos = offsetToPosition(source, 8); // "li" of line2
    expect(pos.line).toBe(2);
    expect(pos.column).toBe(3);
  });

  it('should handle Windows line endings', () => {
    const source = 'line1\r\nline2';
    // Position at 'l' of line2 (after \r\n)
    const pos = offsetToPosition(source, 7);
    expect(pos.line).toBe(2);
    expect(pos.column).toBe(1);
  });

  it('should handle empty source', () => {
    const source = '';
    const pos = offsetToPosition(source, 0);
    expect(pos.line).toBe(1);
    expect(pos.column).toBe(1);
  });
});

// =============================================================================
// findKeyPosition Tests
// =============================================================================

describe('findKeyPosition', () => {
  const simpleJson = `{
  "name": "test",
  "version": "1.0"
}`;

  it('should find top-level key', () => {
    const result = findKeyPosition(simpleJson, 'name');
    expect(result).toBeDefined();
    expect(result!.position.line).toBe(2);
    expect(result!.position.column).toBe(3);
  });

  it('should find second top-level key', () => {
    const result = findKeyPosition(simpleJson, 'version');
    expect(result).toBeDefined();
    expect(result!.position.line).toBe(3);
  });

  it('should return undefined for missing key', () => {
    const result = findKeyPosition(simpleJson, 'missing');
    expect(result).toBeUndefined();
  });

  const nestedJson = `{
  "brand": {
    "palette": {
      "primary": "#1a73e8"
    }
  }
}`;

  it('should find nested key with dot notation', () => {
    const result = findKeyPosition(nestedJson, 'brand.palette.primary');
    expect(result).toBeDefined();
    expect(result!.position.line).toBe(4);
  });

  it('should find intermediate nested key', () => {
    const result = findKeyPosition(nestedJson, 'brand.palette');
    expect(result).toBeDefined();
    expect(result!.position.line).toBe(3);
  });

  const arrayJson = `{
  "pages": [
    { "slug": "home", "title": "Home" },
    { "slug": "about", "title": "About" }
  ]
}`;

  it('should find array element by index', () => {
    const result = findKeyPosition(arrayJson, 'pages[0]');
    expect(result).toBeDefined();
    expect(result!.position.line).toBe(3);
  });

  it('should find nested key in array element', () => {
    const result = findKeyPosition(arrayJson, 'pages[1].slug');
    expect(result).toBeDefined();
    expect(result!.position.line).toBe(4);
  });

  it('should handle compact JSON', () => {
    const compact = '{"name":"test","value":123}';
    const result = findKeyPosition(compact, 'value');
    expect(result).toBeDefined();
    expect(result!.position.column).toBeGreaterThan(1);
  });
});

// =============================================================================
// formatValidationError Tests
// =============================================================================

describe('formatValidationError', () => {
  it('should format error with position', () => {
    const error: ValidationError = {
      code: 'INVALID_TYPE',
      message: 'Invalid type',
      filePath: 'wpnavigator.jsonc',
      position: { line: 15, column: 5, offset: 100 },
      fieldPath: 'brand.palette.primary',
      expected: 'string',
      actual: '123',
    };

    const formatted = formatValidationError(error);
    expect(formatted).toContain('wpnavigator.jsonc:15:5');
    expect(formatted).toContain('brand.palette.primary');
    expect(formatted).toContain('Invalid type');
    expect(formatted).toContain('Expected: string');
    expect(formatted).toContain('Got: 123');
  });

  it('should format error without position', () => {
    const error: ValidationError = {
      code: 'MISSING_REQUIRED',
      message: 'Missing required field',
      filePath: 'config.json',
      fieldPath: 'meta.name',
    };

    const formatted = formatValidationError(error);
    expect(formatted).toContain('Error: config.json');
    // Should NOT have line:column format (just "Error: config.json" not "Error: config.json:5:10")
    expect(formatted).not.toMatch(/config\.json:\d+:\d+/);
    expect(formatted).toContain('meta.name');
  });

  it('should include suggestion when provided', () => {
    const error: ValidationError = {
      code: 'INVALID_COLOR',
      message: 'Invalid color format',
      filePath: 'manifest.jsonc',
      fieldPath: 'brand.palette.primary',
      expected: 'Hex color (#RRGGBB)',
      actual: '"blue"',
      suggestion: 'Use a hex color like "#1a73e8"',
    };

    const formatted = formatValidationError(error);
    expect(formatted).toContain('Suggestion: Use a hex color like "#1a73e8"');
  });

  it('should format error without field path', () => {
    const error: ValidationError = {
      code: 'INVALID_JSON',
      message: 'Unexpected token',
      filePath: 'broken.json',
      position: { line: 5, column: 10, offset: 50 },
    };

    const formatted = formatValidationError(error);
    expect(formatted).toContain('broken.json:5:10');
    expect(formatted).toContain('Unexpected token');
  });
});

// =============================================================================
// formatValidationErrors Tests
// =============================================================================

describe('formatValidationErrors', () => {
  it('should format multiple errors separated by blank lines', () => {
    const errors: ValidationError[] = [
      {
        code: 'ERROR1',
        message: 'First error',
        filePath: 'file.json',
      },
      {
        code: 'ERROR2',
        message: 'Second error',
        filePath: 'file.json',
      },
    ];

    const formatted = formatValidationErrors(errors);
    expect(formatted).toContain('First error');
    expect(formatted).toContain('Second error');
    expect(formatted.split('\n\n').length).toBe(2);
  });

  it('should handle single error', () => {
    const errors: ValidationError[] = [
      {
        code: 'ONLY',
        message: 'Only error',
        filePath: 'file.json',
      },
    ];

    const formatted = formatValidationErrors(errors);
    expect(formatted).toContain('Only error');
  });

  it('should handle empty array', () => {
    const formatted = formatValidationErrors([]);
    expect(formatted).toBe('');
  });
});

// =============================================================================
// formatValidationErrorJson Tests
// =============================================================================

describe('formatValidationErrorJson', () => {
  it('should convert error to JSON structure', () => {
    const error: ValidationError = {
      code: 'INVALID_TYPE',
      message: 'Invalid type',
      filePath: 'config.json',
      position: { line: 10, column: 5, offset: 100 },
      fieldPath: 'meta.name',
      expected: 'string',
      actual: 'number',
      suggestion: 'Use a string value',
    };

    const json = formatValidationErrorJson(error);
    expect(json.code).toBe('INVALID_TYPE');
    expect(json.message).toBe('Invalid type');
    expect(json.file).toBe('config.json');
    expect(json.position).toEqual({ line: 10, column: 5 });
    expect(json.field).toBe('meta.name');
    expect(json.expected).toBe('string');
    expect(json.actual).toBe('number');
    expect(json.suggestion).toBe('Use a string value');
  });

  it('should omit position when not present', () => {
    const error: ValidationError = {
      code: 'ERROR',
      message: 'Error message',
      filePath: 'file.json',
    };

    const json = formatValidationErrorJson(error);
    expect(json.position).toBeUndefined();
  });
});

// =============================================================================
// createValidationError Tests
// =============================================================================

describe('createValidationError', () => {
  const source = `{
  "meta": {
    "name": "Test Site"
  },
  "brand": {
    "palette": {
      "primary": "blue"
    }
  }
}`;

  it('should create error with found position', () => {
    const error = createValidationError(
      'INVALID_COLOR',
      'Invalid color format',
      'manifest.jsonc',
      source,
      'brand.palette.primary',
      {
        expected: 'Hex color (#RRGGBB)',
        actual: '"blue"',
        suggestion: 'Use #1a73e8',
      }
    );

    expect(error.code).toBe('INVALID_COLOR');
    expect(error.filePath).toBe('manifest.jsonc');
    expect(error.fieldPath).toBe('brand.palette.primary');
    expect(error.position).toBeDefined();
    expect(error.position!.line).toBe(7); // Line where "primary" is
    expect(error.expected).toBe('Hex color (#RRGGBB)');
    expect(error.actual).toBe('"blue"');
    expect(error.suggestion).toBe('Use #1a73e8');
  });

  it('should create error without position for unfound field', () => {
    const error = createValidationError(
      'MISSING_REQUIRED',
      'Missing field',
      'manifest.jsonc',
      source,
      'nonexistent.field'
    );

    expect(error.code).toBe('MISSING_REQUIRED');
    expect(error.fieldPath).toBe('nonexistent.field');
    expect(error.position).toBeUndefined();
  });

  it('should create error without fieldPath', () => {
    const error = createValidationError(
      'INVALID_JSON',
      'Syntax error',
      'broken.json',
      '{invalid}'
    );

    expect(error.code).toBe('INVALID_JSON');
    expect(error.fieldPath).toBeUndefined();
    expect(error.position).toBeUndefined();
  });
});

// =============================================================================
// parseJsonSyntaxError Tests
// =============================================================================

describe('parseJsonSyntaxError', () => {
  it('should parse "at position N" format', () => {
    const error = new Error('Unexpected token at position 25');
    const source = '{\n  "name": "test\n}'; // Missing quote

    const result = parseJsonSyntaxError(error, source);
    expect(result.message).toContain('Unexpected token');
    expect(result.position).toBeDefined();
    // Position 25 would be somewhere on line 2-3
    expect(result.position!.line).toBeGreaterThanOrEqual(2);
  });

  it('should parse "line N column N" format', () => {
    const error = new Error('Unexpected token at line 3 column 5');
    const source = '{}';

    const result = parseJsonSyntaxError(error, source);
    expect(result.position).toBeDefined();
    expect(result.position!.line).toBe(3);
    expect(result.position!.column).toBe(5);
  });

  it('should return message only when no position found', () => {
    const error = new Error('Some generic error');
    const source = '{}';

    const result = parseJsonSyntaxError(error, source);
    expect(result.message).toBe('Some generic error');
    expect(result.position).toBeUndefined();
  });
});

// =============================================================================
// Validation Helper Tests
// =============================================================================

describe('isValidHexColor', () => {
  it('should accept valid 6-digit hex colors', () => {
    expect(isValidHexColor('#1a73e8')).toBe(true);
    expect(isValidHexColor('#FFFFFF')).toBe(true);
    expect(isValidHexColor('#000000')).toBe(true);
    expect(isValidHexColor('#AbCdEf')).toBe(true);
  });

  it('should accept valid 3-digit hex colors', () => {
    expect(isValidHexColor('#fff')).toBe(true);
    expect(isValidHexColor('#F00')).toBe(true);
    expect(isValidHexColor('#abc')).toBe(true);
  });

  it('should reject invalid colors', () => {
    expect(isValidHexColor('blue')).toBe(false);
    expect(isValidHexColor('#ff')).toBe(false);
    expect(isValidHexColor('#1234567')).toBe(false);
    expect(isValidHexColor('1a73e8')).toBe(false); // Missing #
    expect(isValidHexColor('#gggggg')).toBe(false); // Invalid chars
    expect(isValidHexColor('rgb(0,0,0)')).toBe(false);
  });
});

describe('isValidUrl', () => {
  it('should accept valid HTTP/HTTPS URLs', () => {
    expect(isValidUrl('https://example.com')).toBe(true);
    expect(isValidUrl('http://localhost:8080')).toBe(true);
    expect(isValidUrl('https://sub.domain.com/path?query=1')).toBe(true);
  });

  it('should reject invalid URLs', () => {
    expect(isValidUrl('example.com')).toBe(false); // No protocol
    expect(isValidUrl('ftp://example.com')).toBe(false); // Wrong protocol
    expect(isValidUrl('not a url')).toBe(false);
    expect(isValidUrl('')).toBe(false);
  });
});

describe('isValidVersion', () => {
  it('should accept valid version strings', () => {
    expect(isValidVersion('1.0')).toBe(true);
    expect(isValidVersion('1.0.0')).toBe(true);
    expect(isValidVersion('2.15')).toBe(true);
    expect(isValidVersion('10.20.30')).toBe(true);
  });

  it('should reject invalid version strings', () => {
    expect(isValidVersion('1')).toBe(false);
    expect(isValidVersion('v1.0')).toBe(false);
    expect(isValidVersion('1.0.0.0')).toBe(false);
    expect(isValidVersion('1.0-beta')).toBe(false);
    expect(isValidVersion('')).toBe(false);
  });
});

describe('getTypeName', () => {
  it('should return correct type names', () => {
    expect(getTypeName('hello')).toBe('string');
    expect(getTypeName(123)).toBe('number');
    expect(getTypeName(true)).toBe('boolean');
    expect(getTypeName({})).toBe('object');
    expect(getTypeName([])).toBe('array');
    expect(getTypeName(null)).toBe('null');
    expect(getTypeName(undefined)).toBe('undefined');
  });
});
