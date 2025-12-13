/**
 * Shared Utilities Tests
 *
 * @package WP_Navigator_Pro
 * @since 1.3.0
 */

import { describe, it, expect } from 'vitest';
import {
  validateRequired,
  buildQueryString,
  extractSummary,
  normalizeStatus,
  validatePagination,
  validateId,
  parseBoolean,
  validateArray,
  validateEnum,
} from './utils.js';

describe('utils', () => {
  describe('validateRequired', () => {
    it('should pass for all required fields present', () => {
      expect(() => {
        validateRequired({ name: 'test', id: 123 }, ['name', 'id']);
      }).not.toThrow();
    });

    it('should throw for missing fields', () => {
      expect(() => {
        validateRequired({ name: 'test' }, ['name', 'id']);
      }).toThrow('Missing required fields: id');
    });

    it('should throw for empty string fields', () => {
      expect(() => {
        validateRequired({ name: '' }, ['name']);
      }).toThrow('Missing required fields: name');
    });
  });

  describe('buildQueryString', () => {
    it('should build query string from params', () => {
      const qs = buildQueryString({ page: 1, per_page: 10, status: 'publish' });
      expect(qs).toBe('page=1&per_page=10&status=publish');
    });

    it('should skip undefined and null values', () => {
      const qs = buildQueryString({ page: 1, search: undefined, filter: null });
      expect(qs).toBe('page=1');
    });
  });

  describe('extractSummary', () => {
    it('should extract flat fields', () => {
      const obj = { id: 123, name: 'test', extra: 'ignore' };
      const summary = extractSummary(obj, ['id', 'name']);
      expect(summary).toEqual({ id: 123, name: 'test' });
    });

    it('should extract nested fields', () => {
      const obj = { title: { rendered: 'Test Title' }, id: 123 };
      const summary = extractSummary(obj, ['id', 'title.rendered']);
      expect(summary).toEqual({ id: 123, 'title.rendered': 'Test Title' });
    });
  });

  describe('normalizeStatus', () => {
    it('should normalize valid status', () => {
      expect(normalizeStatus('PUBLISH')).toBe('publish');
      expect(normalizeStatus('Draft')).toBe('draft');
    });

    it('should throw for invalid status', () => {
      expect(() => normalizeStatus('invalid')).toThrow('Invalid status');
    });

    it('should default to publish for undefined', () => {
      expect(normalizeStatus()).toBe('publish');
    });
  });

  describe('validatePagination', () => {
    it('should validate and normalize pagination', () => {
      expect(validatePagination({ page: 2, per_page: 50 })).toEqual({
        page: 2,
        per_page: 50,
      });
    });

    it('should enforce minimum values', () => {
      expect(validatePagination({ page: 0, per_page: 0 })).toEqual({
        page: 1,
        per_page: 1,
      });
    });

    it('should enforce maximum per_page', () => {
      expect(validatePagination({ per_page: 500 })).toEqual({
        page: 1,
        per_page: 250,
      });
    });

    it('should use defaults for undefined', () => {
      expect(validatePagination({})).toEqual({ page: 1, per_page: 10 });
    });
  });

  describe('validateId', () => {
    it('should validate positive integer ID', () => {
      expect(validateId(123)).toBe(123);
      expect(validateId('456')).toBe(456);
    });

    it('should throw for invalid ID', () => {
      expect(() => validateId(0)).toThrow('ID must be a positive integer');
      expect(() => validateId(-1)).toThrow('ID must be a positive integer');
      expect(() => validateId('abc')).toThrow('ID must be a positive integer');
    });

    it('should use custom entity name in error', () => {
      expect(() => validateId(0, 'Page')).toThrow('Page ID must be a positive integer');
    });
  });

  describe('parseBoolean', () => {
    it('should parse boolean values', () => {
      expect(parseBoolean(true)).toBe(true);
      expect(parseBoolean(false)).toBe(false);
    });

    it('should parse string values', () => {
      expect(parseBoolean('true')).toBe(true);
      expect(parseBoolean('TRUE')).toBe(true);
      expect(parseBoolean('1')).toBe(true);
      expect(parseBoolean('yes')).toBe(true);
      expect(parseBoolean('on')).toBe(true);
      expect(parseBoolean('false')).toBe(false);
      expect(parseBoolean('0')).toBe(false);
    });

    it('should parse number values', () => {
      expect(parseBoolean(1)).toBe(true);
      expect(parseBoolean(0)).toBe(false);
    });
  });

  describe('validateArray', () => {
    it('should accept arrays', () => {
      expect(validateArray(['a', 'b', 'c'], 'tags')).toEqual(['a', 'b', 'c']);
    });

    it('should parse comma-separated strings', () => {
      expect(validateArray('a, b, c', 'tags')).toEqual(['a', 'b', 'c']);
    });

    it('should throw for invalid input', () => {
      expect(() => validateArray(123, 'tags')).toThrow('tags must be an array');
    });
  });

  describe('validateEnum', () => {
    const validValues = ['red', 'green', 'blue'] as const;

    it('should validate enum value', () => {
      expect(validateEnum('red', validValues, 'color')).toBe('red');
    });

    it('should throw for invalid value', () => {
      expect(() => validateEnum('yellow', validValues, 'color')).toThrow(
        'Invalid color: yellow. Valid values: red, green, blue'
      );
    });

    it('should use default value', () => {
      expect(validateEnum(undefined, validValues, 'color', 'blue')).toBe('blue');
    });

    it('should throw for missing required value', () => {
      expect(() => validateEnum(undefined, validValues, 'color')).toThrow(
        'color is required'
      );
    });
  });
});
