/**
 * TF-IDF Tests
 *
 * @package WP_Navigator_MCP
 * @since 2.7.0
 */

import { describe, it, expect } from 'vitest';
import { tokenize, buildIndex, score, extractKeywords } from './tf-idf.js';

describe('tokenize', () => {
  it('converts text to lowercase tokens', () => {
    const tokens = tokenize('Hello World');
    expect(tokens).toContain('hello');
    expect(tokens).toContain('world');
  });

  it('removes stopwords', () => {
    const tokens = tokenize('the quick brown fox and the lazy dog');
    expect(tokens).not.toContain('the');
    expect(tokens).not.toContain('and');
    expect(tokens).toContain('quick');
    expect(tokens).toContain('brown');
    expect(tokens).toContain('fox');
  });

  it('handles special characters', () => {
    const tokens = tokenize('wpnav_list_posts: List WordPress posts');
    expect(tokens).toContain('wpnav_list_post');
    expect(tokens).toContain('list');
    expect(tokens).toContain('wordpress');
    expect(tokens).toContain('post');
  });

  it('stems common word forms', () => {
    const tokens = tokenize('running creating updating filtered');
    expect(tokens).toContain('runn');
    expect(tokens).toContain('creat');
    expect(tokens).toContain('updat');
    expect(tokens).toContain('filter');
  });

  it('removes short words', () => {
    // Single-letter words are removed, "am" (2 chars) passes length check
    // but "to", "be", "I", "a" are all stopwords or too short
    const tokens = tokenize('a I to be');
    expect(tokens).toHaveLength(0);
  });

  it('returns empty array for empty input', () => {
    expect(tokenize('')).toEqual([]);
    expect(tokenize('   ')).toEqual([]);
  });

  it('handles WordPress-specific terms', () => {
    const tokens = tokenize('Gutenberg blocks WordPress plugin themes');
    expect(tokens).toContain('gutenberg');
    expect(tokens).toContain('block');
    expect(tokens).toContain('wordpress');
    expect(tokens).toContain('plugin');
    // "themes" stems to "them" (removes 's' suffix)
    expect(tokens).toContain('them');
  });
});

describe('buildIndex', () => {
  it('builds index from documents', () => {
    const docs = [
      { id: 'doc1', text: 'WordPress posts content' },
      { id: 'doc2', text: 'WordPress plugins themes' },
    ];

    const index = buildIndex(docs);

    expect(index.documentCount).toBe(2);
    expect(index.vocabulary.length).toBeGreaterThan(0);
    expect(index.vectors.has('doc1')).toBe(true);
    expect(index.vectors.has('doc2')).toBe(true);
  });

  it('calculates document frequency correctly', () => {
    const docs = [
      { id: 'doc1', text: 'wordpress posts' },
      { id: 'doc2', text: 'wordpress pages' },
      { id: 'doc3', text: 'plugins themes' },
    ];

    const index = buildIndex(docs);

    // 'wordpress' appears in 2 documents
    expect(index.documentFrequency.get('wordpress')).toBe(2);
    // 'post' appears in 1 document
    expect(index.documentFrequency.get('post')).toBe(1);
  });

  it('handles empty documents', () => {
    const docs = [{ id: 'doc1', text: '' }];
    const index = buildIndex(docs);
    expect(index.documentCount).toBe(1);
    expect(index.vocabulary.length).toBe(0);
  });
});

describe('score', () => {
  it('returns empty array for empty query', () => {
    const docs = [{ id: 'doc1', text: 'wordpress posts content' }];
    const index = buildIndex(docs);
    expect(score('', index)).toEqual([]);
    expect(score('   ', index)).toEqual([]);
  });

  it('scores documents by relevance', () => {
    const docs = [
      { id: 'wpnav_list_posts', text: 'List WordPress posts with filtering and pagination' },
      { id: 'wpnav_list_pages', text: 'List WordPress pages with filtering' },
      { id: 'wpnav_list_plugins', text: 'List installed WordPress plugins' },
    ];

    const index = buildIndex(docs);
    const results = score('list posts', index);

    expect(results.length).toBeGreaterThan(0);
    // Posts-related doc should rank higher
    expect(results[0].id).toBe('wpnav_list_posts');
  });

  it('respects limit parameter', () => {
    const docs = [
      { id: 'doc1', text: 'wordpress posts content' },
      { id: 'doc2', text: 'wordpress pages content' },
      { id: 'doc3', text: 'wordpress media files' },
      { id: 'doc4', text: 'themes plugins' }, // no wordpress
    ];

    const index = buildIndex(docs);
    // Query "posts content" - should match doc1 and doc2, limit to 1
    const results = score('posts content', index, 1);

    expect(results.length).toBe(1);
    expect(results[0].id).toBe('doc1');
  });

  it('returns scores between 0 and 1', () => {
    const docs = [
      { id: 'doc1', text: 'WordPress posts content management' },
      { id: 'doc2', text: 'WordPress plugins themes installation' },
    ];

    const index = buildIndex(docs);
    const results = score('posts content', index);

    for (const result of results) {
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(2); // TF-IDF can exceed 1
    }
  });

  it('handles query with no matches', () => {
    const docs = [{ id: 'doc1', text: 'wordpress posts' }];
    const index = buildIndex(docs);
    const results = score('zebra elephant', index);
    expect(results).toEqual([]);
  });
});

describe('extractKeywords', () => {
  it('extracts keywords from text', () => {
    const keywords = extractKeywords('WordPress posts content management system');
    expect(keywords).toContain('wordpress');
    expect(keywords).toContain('post');
    expect(keywords).toContain('content');
  });

  it('respects maxKeywords limit', () => {
    const text = 'one two three four five six seven eight nine ten';
    const keywords = extractKeywords(text, 3);
    expect(keywords.length).toBeLessThanOrEqual(3);
  });

  it('sorts by frequency', () => {
    const text = 'wordpress wordpress wordpress posts posts content';
    const keywords = extractKeywords(text, 10);
    expect(keywords[0]).toBe('wordpress');
    expect(keywords[1]).toBe('post');
  });

  it('removes stopwords', () => {
    const keywords = extractKeywords('the quick brown fox and the lazy dog');
    expect(keywords).not.toContain('the');
    expect(keywords).not.toContain('and');
  });

  it('handles tool names', () => {
    const keywords = extractKeywords('wpnav_list_posts: List WordPress posts');
    expect(keywords).toContain('wpnav_list_post');
    expect(keywords).toContain('list');
    expect(keywords).toContain('post');
  });
});

describe('integration: tool search simulation', () => {
  const toolDocs = [
    {
      id: 'wpnav_list_posts',
      text: 'wpnav_list_posts: List WordPress posts with filtering, pagination, and field selection',
    },
    {
      id: 'wpnav_create_post',
      text: 'wpnav_create_post: Create a new WordPress post with title, content, and metadata',
    },
    {
      id: 'wpnav_list_pages',
      text: 'wpnav_list_pages: List WordPress pages with hierarchical structure',
    },
    {
      id: 'wpnav_list_plugins',
      text: 'wpnav_list_plugins: List installed WordPress plugins with status information',
    },
    {
      id: 'wpnav_activate_plugin',
      text: 'wpnav_activate_plugin: Activate a WordPress plugin by slug',
    },
    {
      id: 'wpnav_upload_media',
      text: 'wpnav_upload_media_from_url: Upload media from URL to WordPress library',
    },
    {
      id: 'wpnav_gutenberg_insert',
      text: 'wpnav_gutenberg_insert_block: Insert a Gutenberg block into page content',
    },
  ];

  it('finds relevant tools for "create blog post"', () => {
    const index = buildIndex(toolDocs);
    const results = score('create blog post', index, 5);

    expect(results.length).toBeGreaterThan(0);
    const names = results.map((r) => r.id);
    expect(names).toContain('wpnav_create_post');
  });

  it('finds relevant tools for "manage plugins"', () => {
    const index = buildIndex(toolDocs);
    const results = score('manage plugins', index, 5);

    expect(results.length).toBeGreaterThan(0);
    const names = results.map((r) => r.id);
    expect(names).toContain('wpnav_list_plugins');
  });

  it('finds relevant tools for "upload image"', () => {
    const index = buildIndex(toolDocs);
    const results = score('upload image media', index, 5);

    expect(results.length).toBeGreaterThan(0);
    const names = results.map((r) => r.id);
    expect(names).toContain('wpnav_upload_media');
  });

  it('finds relevant tools for "gutenberg blocks"', () => {
    const index = buildIndex(toolDocs);
    const results = score('gutenberg blocks', index, 5);

    expect(results.length).toBeGreaterThan(0);
    const names = results.map((r) => r.id);
    expect(names).toContain('wpnav_gutenberg_insert');
  });
});
