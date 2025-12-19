import { describe, it, expect } from 'vitest';
import { compactResponse, shouldCompact, extractCompactOptions } from './compact.js';
import type { CompactOptions } from './types.js';

describe('compactResponse', () => {
  const sampleData = [
    { id: 1, title: 'Post 1', content: 'Long content...' },
    { id: 2, title: 'Post 2', content: 'Long content...' },
    { id: 3, title: 'Post 3', content: 'Long content...' },
    { id: 4, title: 'Post 4', content: 'Long content...' },
    { id: 5, title: 'Post 5', content: 'Long content...' },
    { id: 6, title: 'Post 6', content: 'Long content...' },
    { id: 7, title: 'Post 7', content: 'Long content...' },
  ];

  it('returns all data when compact mode is disabled', () => {
    const result = compactResponse(sampleData, { enabled: false });

    expect(result.items).toHaveLength(7);
    expect(result._compact.compacted).toBe(false);
    expect(result._compact.total_count).toBe(7);
    expect(result._compact.has_more).toBe(false);
  });

  it('truncates to maxItems when compact mode enabled', () => {
    const result = compactResponse(sampleData, { enabled: true, maxItems: 3 });

    expect(result.items).toHaveLength(3);
    expect(result._compact.compacted).toBe(true);
    expect(result._compact.total_count).toBe(7);
    expect(result._compact.returned_count).toBe(3);
    expect(result._compact.has_more).toBe(true);
  });

  it('uses default maxItems of 5', () => {
    const result = compactResponse(sampleData, { enabled: true });

    expect(result.items).toHaveLength(5);
    expect(result._compact.has_more).toBe(true);
  });

  it('filters fields when specified', () => {
    const result = compactResponse(sampleData, {
      enabled: true,
      maxItems: 2,
      fields: ['id', 'title'],
    });

    expect(result.items[0]).toEqual({ id: 1, title: 'Post 1' });
    expect(result.items[0]).not.toHaveProperty('content');
  });

  it('generates summary when enabled', () => {
    const result = compactResponse(sampleData, { enabled: true, generateSummary: true });

    expect(result._compact.summary).toBeDefined();
    expect(result._compact.summary).toContain('5 of 7');
  });

  it('handles empty data gracefully', () => {
    const result = compactResponse([], { enabled: true });

    expect(result.items).toHaveLength(0);
    expect(result._compact.total_count).toBe(0);
    expect(result._compact.has_more).toBe(false);
  });

  it('does not show has_more when all items fit', () => {
    const smallData = sampleData.slice(0, 3);
    const result = compactResponse(smallData, { enabled: true, maxItems: 5 });

    expect(result._compact.has_more).toBe(false);
    expect(result._compact.total_count).toBe(3);
  });
});

describe('shouldCompact', () => {
  it('returns true when compact is true', () => {
    expect(shouldCompact({ compact: true })).toBe(true);
  });

  it('returns false when compact is false', () => {
    expect(shouldCompact({ compact: false })).toBe(false);
  });

  it('returns false when compact is undefined', () => {
    expect(shouldCompact({})).toBe(false);
  });
});

describe('extractCompactOptions', () => {
  it('extracts compact options from args', () => {
    const args = {
      compact: true,
      compact_limit: 10,
      fields: ['id', 'title'],
    };

    const options = extractCompactOptions(args);

    expect(options.enabled).toBe(true);
    expect(options.maxItems).toBe(10);
    expect(options.fields).toEqual(['id', 'title']);
  });

  it('falls back to limit if compact_limit not set', () => {
    const args = { compact: true, limit: 20 };
    const options = extractCompactOptions(args);

    expect(options.maxItems).toBe(20);
  });
});
