import { describe, it, expect } from 'vitest';
import { generateSummary } from './summarizer.js';

describe('generateSummary', () => {
  describe('posts', () => {
    it('generates summary for posts', () => {
      const posts = [
        { id: 1, title: { rendered: 'Post 1' }, category_name: 'Blog', date: '2024-01-01' },
        { id: 2, title: { rendered: 'Post 2' }, category_name: 'Blog', date: '2024-01-02' },
        { id: 3, title: { rendered: 'Post 3' }, category_name: 'News', date: '2024-01-03' },
      ];

      const summary = generateSummary(posts, { contentType: 'posts' });

      expect(summary).toContain('3 posts found');
      expect(summary).toContain('Blog');
    });

    it('handles empty posts', () => {
      const summary = generateSummary([], { contentType: 'posts' });
      expect(summary).toBe('No posts found.');
    });
  });

  describe('pages', () => {
    it('generates summary for pages', () => {
      const pages = [
        { id: 1, title: { rendered: 'Home' }, parent: 0 },
        { id: 2, title: { rendered: 'About' }, parent: 0 },
        { id: 3, title: { rendered: 'Team' }, parent: 2 },
      ];

      const summary = generateSummary(pages, { contentType: 'pages' });

      expect(summary).toContain('3 pages found');
      expect(summary).toContain('2 top-level');
      expect(summary).toContain('1 child');
    });
  });

  describe('plugins', () => {
    it('generates summary for plugins', () => {
      const plugins = [
        { name: 'Plugin 1', status: 'active' },
        { name: 'Plugin 2', status: 'active' },
        { name: 'Plugin 3', status: 'inactive', update: true },
      ];

      const summary = generateSummary(plugins, { contentType: 'plugins' });

      expect(summary).toContain('3 plugins found');
      expect(summary).toContain('2 active');
      expect(summary).toContain('1 inactive');
      expect(summary).toContain('1 with updates');
    });
  });

  describe('themes', () => {
    it('generates summary for themes', () => {
      const themes = [
        { name: 'Theme 1', status: 'active', stylesheet: 'theme1', template: 'theme1' },
        { name: 'Theme 2', status: 'inactive' },
      ];

      const summary = generateSummary(themes, { contentType: 'themes' });

      expect(summary).toContain('2 themes available');
      expect(summary).toContain('Active: Theme 1');
    });

    it('detects child themes', () => {
      const themes = [
        { name: 'Child Theme', status: 'active', stylesheet: 'child', template: 'parent' },
      ];

      const summary = generateSummary(themes, { contentType: 'themes' });

      expect(summary).toContain('child theme');
    });
  });

  describe('users', () => {
    it('generates summary for users', () => {
      const users = [
        { name: 'Admin', roles: ['administrator'] },
        { name: 'Editor', roles: ['editor'] },
        { name: 'Author', roles: ['author'] },
      ];

      const summary = generateSummary(users, { contentType: 'users' });

      expect(summary).toContain('3 users found');
      expect(summary).toContain('Roles:');
    });
  });

  describe('categories', () => {
    it('generates summary for categories', () => {
      const categories = [
        { name: 'Blog', count: 10 },
        { name: 'News', count: 5 },
      ];

      const summary = generateSummary(categories, { contentType: 'categories' });

      expect(summary).toContain('2 categories found');
      expect(summary).toContain('Blog (10)');
    });
  });

  describe('media', () => {
    it('generates summary for media', () => {
      const media = [
        { id: 1, media_type: 'image' },
        { id: 2, media_type: 'image' },
        { id: 3, media_type: 'file' },
      ];

      const summary = generateSummary(media, { contentType: 'media' });

      expect(summary).toContain('3 media items found');
      expect(summary).toContain('image (2)');
    });
  });

  describe('tags', () => {
    it('generates summary for tags', () => {
      const tags = [
        { name: 'Tag A', count: 5 },
        { name: 'Tag B', count: 3 },
      ];

      const summary = generateSummary(tags, { contentType: 'tags' });

      expect(summary).toContain('2 tags found');
      expect(summary).toContain('Tag A (5)');
    });
  });

  describe('comments', () => {
    it('generates summary for comments with status breakdown', () => {
      const comments = [
        { id: 1, status: 'approve' },
        { id: 2, status: 'approve' },
        { id: 3, status: 'hold' },
      ];

      const summary = generateSummary(comments, { contentType: 'comments' });

      expect(summary).toContain('3 comments found');
      expect(summary).toContain('approve (2)');
      expect(summary).toContain('hold (1)');
    });
  });

  describe('generic type', () => {
    it('falls back to generic summary for unknown type', () => {
      const items = [{ id: 1 }, { id: 2 }];

      const summary = generateSummary(items, { contentType: 'cookbooks' as any });

      expect(summary).toBe('2 cookbooks found.');
    });
  });
});
