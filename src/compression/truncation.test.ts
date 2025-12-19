import { describe, it, expect } from 'vitest';
import {
  truncateContent,
  truncateObjectContent,
  truncateArrayContent,
  TruncationOptions,
} from './truncation.js';

describe('truncateContent', () => {
  it('returns original content when under limit', () => {
    const result = truncateContent('Short content', { maxLength: 500 });

    expect(result.content).toBe('Short content');
    expect(result.content_length).toBe(13);
    expect(result.content_truncated).toBe(false);
  });

  it('truncates long content with suffix', () => {
    const longContent = 'a'.repeat(1000);
    const result = truncateContent(longContent, { maxLength: 100 });

    expect(result.content).toContain('...[truncated, 1000 chars]');
    expect(result.content_length).toBe(1000);
    expect(result.content_truncated).toBe(true);
  });

  it('preserves word boundaries', () => {
    const content = 'Hello world this is a test of word boundary preservation';
    const result = truncateContent(content, { maxLength: 20, preserveWords: true });

    expect(result.content).not.toContain('worl '); // Should not cut mid-word at boundary
    expect(result.content_truncated).toBe(true);
  });

  it('handles null content', () => {
    const result = truncateContent(null);

    expect(result.content).toBe('');
    expect(result.content_length).toBe(0);
    expect(result.content_truncated).toBe(false);
  });

  it('handles undefined content', () => {
    const result = truncateContent(undefined);

    expect(result.content).toBe('');
    expect(result.content_length).toBe(0);
    expect(result.content_truncated).toBe(false);
  });

  it('handles empty string', () => {
    const result = truncateContent('');

    expect(result.content).toBe('');
    expect(result.content_length).toBe(0);
    expect(result.content_truncated).toBe(false);
  });

  it('respects suffix option', () => {
    const longContent = 'a'.repeat(100);
    const result = truncateContent(longContent, { maxLength: 50, suffix: false });

    expect(result.content).not.toContain('truncated');
    expect(result.content_truncated).toBe(true);
  });

  it('handles unicode content safely', () => {
    const unicodeContent = '\u{1F600}'.repeat(100); // 100 emoji characters
    const result = truncateContent(unicodeContent, { maxLength: 50 });

    // Should not produce invalid UTF-8
    expect(() => JSON.stringify(result.content)).not.toThrow();
    expect(result.content_truncated).toBe(true);
  });

  it('handles surrogate pairs correctly', () => {
    // Mix of regular chars and emoji
    const content = 'Hello ' + '\u{1F600}'.repeat(50) + ' world';
    const result = truncateContent(content, { maxLength: 20 });

    // Should not produce invalid string
    expect(() => JSON.stringify(result.content)).not.toThrow();
  });
});

describe('truncateObjectContent', () => {
  it('truncates content field and adds metadata', () => {
    const obj = {
      id: 1,
      title: 'Test',
      content: 'a'.repeat(1000),
    };

    const result = truncateObjectContent(obj, { maxLength: 100 });

    expect(result.content_truncated).toBe(true);
    expect(result.content_length).toBe(1000);
    expect(result.id).toBe(1);
    expect(result.title).toBe('Test');
  });

  it('handles WordPress rendered content structure', () => {
    const obj = {
      id: 1,
      content: {
        rendered: 'a'.repeat(1000),
        protected: false,
      },
    };

    const result = truncateObjectContent(obj, { maxLength: 100 });

    expect(result.content_truncated).toBe(true);
    expect(result.content.rendered).toContain('truncated');
  });

  it('returns unchanged object when no content field', () => {
    const obj = {
      id: 1,
      title: 'Test',
    };

    const result = truncateObjectContent(obj as any);

    expect(result).toEqual(obj);
    expect((result as any).content_truncated).toBeUndefined();
  });

  it('handles null object', () => {
    const result = truncateObjectContent(null as any);
    expect(result).toBeNull();
  });
});

describe('truncateArrayContent', () => {
  it('truncates content in array of objects', () => {
    const items = [
      { id: 1, content: 'a'.repeat(1000) },
      { id: 2, content: 'short' },
      { id: 3, content: 'b'.repeat(800) },
    ];

    const results = truncateArrayContent(items, { maxLength: 100 });

    expect(results[0].content_truncated).toBe(true);
    expect(results[1].content_truncated).toBe(false);
    expect(results[2].content_truncated).toBe(true);
  });

  it('handles empty array', () => {
    const results = truncateArrayContent([] as any[]);
    expect(results).toEqual([]);
  });
});
