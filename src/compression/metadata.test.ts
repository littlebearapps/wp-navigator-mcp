import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  estimateTokens,
  countItems,
  generateMeta,
  wrapWithMeta,
  addMetadata,
  type ResponseMeta,
} from './metadata.js';

describe('estimateTokens', () => {
  it('estimates tokens from string', () => {
    // 20 chars should be ~5 tokens
    const result = estimateTokens('12345678901234567890');
    expect(result).toBe(5);
  });

  it('estimates tokens from object', () => {
    const obj = { name: 'test', value: 123 };
    const result = estimateTokens(obj);
    // JSON.stringify adds quotes and formatting
    expect(result).toBeGreaterThan(0);
  });

  it('rounds up partial tokens', () => {
    // 5 chars = 1.25 tokens, should round to 2
    const result = estimateTokens('12345');
    expect(result).toBe(2);
  });

  it('handles empty string', () => {
    const result = estimateTokens('');
    expect(result).toBe(0);
  });
});

describe('countItems', () => {
  it('counts array items', () => {
    expect(countItems([1, 2, 3])).toBe(3);
  });

  it('counts items in object.items', () => {
    expect(countItems({ items: [1, 2] })).toBe(2);
  });

  it('counts items in object.data', () => {
    expect(countItems({ data: [1, 2, 3, 4] })).toBe(4);
  });

  it('counts items in object.posts', () => {
    expect(countItems({ posts: [{ id: 1 }] })).toBe(1);
  });

  it('returns 1 for single object', () => {
    expect(countItems({ id: 1, title: 'Test' })).toBe(1);
  });

  it('returns 0 for null', () => {
    expect(countItems(null)).toBe(0);
  });

  it('returns 0 for primitive', () => {
    expect(countItems('string')).toBe(0);
    expect(countItems(123)).toBe(0);
  });
});

describe('generateMeta', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-01T12:00:00.500Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('generates complete metadata', () => {
    const data = [{ id: 1 }, { id: 2 }];
    const startTime = Date.now() - 100; // 100ms ago

    const meta = generateMeta(data, {
      startTime,
      totalAvailable: 50,
      compression: 'compact',
      truncatedFields: ['content'],
      cached: false,
    });

    expect(meta.items_returned).toBe(2);
    expect(meta.items_available).toBe(50);
    expect(meta.compression).toBe('compact');
    expect(meta.truncated_fields).toEqual(['content']);
    expect(meta.cached).toBe(false);
    expect(meta.response_time_ms).toBe(100);
    expect(meta.token_estimate).toBeGreaterThan(0);
  });

  it('uses defaults when options not provided', () => {
    const data = [{ id: 1 }];
    const meta = generateMeta(data);

    expect(meta.items_returned).toBe(1);
    expect(meta.items_available).toBe(1); // defaults to items_returned
    expect(meta.compression).toBe('none');
    expect(meta.truncated_fields).toEqual([]);
    expect(meta.cached).toBe(false);
    expect(meta.response_time_ms).toBe(0); // no startTime
  });
});

describe('wrapWithMeta', () => {
  it('wraps data with _meta block', () => {
    const data = { posts: [{ id: 1 }] };
    const result = wrapWithMeta(data, { compression: 'full' });

    expect(result.data).toEqual(data);
    expect(result._meta).toBeDefined();
    expect(result._meta.compression).toBe('full');
  });

  it('preserves original data structure', () => {
    const data = [1, 2, 3];
    const result = wrapWithMeta(data);

    expect(result.data).toEqual([1, 2, 3]);
    expect(result._meta.items_returned).toBe(3);
  });
});

describe('addMetadata', () => {
  it('attaches hints when provided', () => {
    const data = { id: 1 };
    const hints = {
      common_followups: ['wpnav_list_posts'],
      next_actions: [
        {
          tool: 'wpnav_get_post',
          reason: 'View the created post',
          args: { id: 1 },
        },
      ],
    };

    const wrapped = addMetadata(data, { hints });

    expect(wrapped.data).toEqual(data);
    expect(wrapped._meta._hints).toBeDefined();
    expect(wrapped._meta._hints?.common_followups).toContain('wpnav_list_posts');
    expect(wrapped._meta._hints?.next_actions?.[0].tool).toBe('wpnav_get_post');
  });

  it('omits hints when not provided', () => {
    const data = { id: 1 };
    const wrapped = addMetadata(data);

    expect(wrapped._meta._hints).toBeUndefined();
  });
});
