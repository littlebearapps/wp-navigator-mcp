/**
 * Cosine Similarity Tests
 *
 * @package WP_Navigator_MCP
 * @since 2.7.0
 */

import { describe, it, expect } from 'vitest';
import { cosineSimilarity, normalize, dotProduct, euclideanDistance, magnitude } from './cosine.js';

describe('cosineSimilarity', () => {
  it('returns 1 for identical vectors', () => {
    const a = [1, 2, 3];
    const b = [1, 2, 3];
    expect(cosineSimilarity(a, b)).toBeCloseTo(1, 5);
  });

  it('returns 0 for orthogonal vectors', () => {
    const a = [1, 0, 0];
    const b = [0, 1, 0];
    expect(cosineSimilarity(a, b)).toBeCloseTo(0, 5);
  });

  it('returns -1 for opposite vectors', () => {
    const a = [1, 2, 3];
    const b = [-1, -2, -3];
    expect(cosineSimilarity(a, b)).toBeCloseTo(-1, 5);
  });

  it('handles vectors with different magnitudes', () => {
    const a = [1, 2, 3];
    const b = [2, 4, 6]; // Same direction, different magnitude
    expect(cosineSimilarity(a, b)).toBeCloseTo(1, 5);
  });

  it('throws error for vectors of different lengths', () => {
    const a = [1, 2, 3];
    const b = [1, 2];
    expect(() => cosineSimilarity(a, b)).toThrow('Vector length mismatch');
  });

  it('returns 0 for empty vectors', () => {
    expect(cosineSimilarity([], [])).toBe(0);
  });

  it('returns 0 for zero vectors', () => {
    const a = [0, 0, 0];
    const b = [1, 2, 3];
    expect(cosineSimilarity(a, b)).toBe(0);
  });

  it('works with high-dimensional vectors', () => {
    const dim = 384; // Same as embedding dimension
    const a = new Array(dim).fill(0).map((_, i) => Math.sin(i));
    const b = new Array(dim).fill(0).map((_, i) => Math.sin(i + 0.1));
    // Similar but not identical
    const similarity = cosineSimilarity(a, b);
    expect(similarity).toBeGreaterThan(0.9);
    expect(similarity).toBeLessThan(1);
  });
});

describe('normalize', () => {
  it('normalizes a vector to unit length', () => {
    const v = [3, 4]; // 3-4-5 triangle
    const normalized = normalize(v);
    expect(normalized[0]).toBeCloseTo(0.6, 5);
    expect(normalized[1]).toBeCloseTo(0.8, 5);
    expect(magnitude(normalized)).toBeCloseTo(1, 5);
  });

  it('returns empty array for empty input', () => {
    expect(normalize([])).toEqual([]);
  });

  it('handles zero vector', () => {
    const v = [0, 0, 0];
    const normalized = normalize(v);
    expect(normalized).toEqual([0, 0, 0]);
  });

  it('handles negative values', () => {
    const v = [-3, -4];
    const normalized = normalize(v);
    expect(magnitude(normalized)).toBeCloseTo(1, 5);
  });
});

describe('dotProduct', () => {
  it('calculates dot product correctly', () => {
    const a = [1, 2, 3];
    const b = [4, 5, 6];
    // 1*4 + 2*5 + 3*6 = 4 + 10 + 18 = 32
    expect(dotProduct(a, b)).toBe(32);
  });

  it('returns 0 for orthogonal vectors', () => {
    const a = [1, 0];
    const b = [0, 1];
    expect(dotProduct(a, b)).toBe(0);
  });

  it('throws error for vectors of different lengths', () => {
    expect(() => dotProduct([1], [1, 2])).toThrow('Vector length mismatch');
  });
});

describe('euclideanDistance', () => {
  it('returns 0 for identical vectors', () => {
    const a = [1, 2, 3];
    expect(euclideanDistance(a, a)).toBe(0);
  });

  it('calculates distance correctly', () => {
    const a = [0, 0];
    const b = [3, 4];
    expect(euclideanDistance(a, b)).toBe(5); // 3-4-5 triangle
  });

  it('throws error for vectors of different lengths', () => {
    expect(() => euclideanDistance([1], [1, 2])).toThrow('Vector length mismatch');
  });
});

describe('magnitude', () => {
  it('calculates magnitude correctly', () => {
    expect(magnitude([3, 4])).toBe(5);
    expect(magnitude([1, 0, 0])).toBe(1);
    expect(magnitude([0, 0, 0])).toBe(0);
  });

  it('handles high-dimensional vectors', () => {
    const v = new Array(384).fill(1);
    expect(magnitude(v)).toBeCloseTo(Math.sqrt(384), 5);
  });
});
