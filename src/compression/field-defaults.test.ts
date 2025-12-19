import { describe, it, expect } from 'vitest';
import {
  DEFAULT_FIELDS,
  getDefaultFields,
  applyFieldDefaults,
  filterFields,
  filterArrayFields,
  getSupportedResources,
} from './field-defaults.js';

describe('Field Defaults', () => {
  describe('DEFAULT_FIELDS', () => {
    it('defines fields for posts', () => {
      expect(DEFAULT_FIELDS.posts).toBeDefined();
      expect(DEFAULT_FIELDS.posts.list).toContain('id');
      expect(DEFAULT_FIELDS.posts.list).toContain('title');
      expect(DEFAULT_FIELDS.posts.get).toContain('content');
    });

    it('defines fields for pages', () => {
      expect(DEFAULT_FIELDS.pages).toBeDefined();
      expect(DEFAULT_FIELDS.pages.list).toContain('parent');
      expect(DEFAULT_FIELDS.pages.list).toContain('menu_order');
    });

    it('defines fields for plugins', () => {
      expect(DEFAULT_FIELDS.plugins).toBeDefined();
      expect(DEFAULT_FIELDS.plugins.list).toContain('status');
      expect(DEFAULT_FIELDS.plugins.list).toContain('update_available');
    });

    it('defines fields for themes', () => {
      expect(DEFAULT_FIELDS.themes).toBeDefined();
      expect(DEFAULT_FIELDS.themes.list).toContain('stylesheet');
    });

    it('defines fields for users', () => {
      expect(DEFAULT_FIELDS.users).toBeDefined();
      expect(DEFAULT_FIELDS.users.list).toContain('roles');
    });

    it('list fields are subset of get fields for content types', () => {
      const contentTypes = ['posts', 'pages', 'media'];
      for (const type of contentTypes) {
        const listFields = DEFAULT_FIELDS[type].list;
        const getFields = DEFAULT_FIELDS[type].get;
        for (const field of listFields) {
          expect(getFields).toContain(field);
        }
      }
    });
  });

  describe('getDefaultFields', () => {
    it('returns list fields for posts', () => {
      const fields = getDefaultFields('posts', 'list');
      expect(fields).toEqual(DEFAULT_FIELDS.posts.list);
    });

    it('returns get fields for pages', () => {
      const fields = getDefaultFields('pages', 'get');
      expect(fields).toEqual(DEFAULT_FIELDS.pages.get);
    });

    it('returns search fields for media', () => {
      const fields = getDefaultFields('media', 'search');
      expect(fields).toEqual(DEFAULT_FIELDS.media.search);
    });

    it('returns undefined for unknown resource', () => {
      const fields = getDefaultFields('unknown', 'list');
      expect(fields).toBeUndefined();
    });
  });

  describe('applyFieldDefaults', () => {
    it('uses explicit fields when provided', () => {
      const explicit = ['id', 'title'];
      const result = applyFieldDefaults('posts', 'list', explicit);
      expect(result).toEqual(explicit);
    });

    it('uses defaults when no explicit fields', () => {
      const result = applyFieldDefaults('posts', 'list', undefined);
      expect(result).toEqual(DEFAULT_FIELDS.posts.list);
    });

    it('uses defaults for empty array', () => {
      const result = applyFieldDefaults('posts', 'list', []);
      expect(result).toEqual(DEFAULT_FIELDS.posts.list);
    });

    it('returns undefined for unknown resource without explicit', () => {
      const result = applyFieldDefaults('unknown', 'list', undefined);
      expect(result).toBeUndefined();
    });
  });

  describe('filterFields', () => {
    it('filters object to specified fields', () => {
      const data = { id: 1, title: 'Test', content: 'Long content', status: 'publish' };
      const result = filterFields(data, ['id', 'title']);
      expect(result).toEqual({ id: 1, title: 'Test' });
    });

    it('ignores non-existent fields', () => {
      const data = { id: 1, title: 'Test' };
      const result = filterFields(data, ['id', 'nonexistent']);
      expect(result).toEqual({ id: 1 });
    });

    it('returns empty object for empty field list', () => {
      const data = { id: 1, title: 'Test' };
      const result = filterFields(data, []);
      expect(result).toEqual({});
    });
  });

  describe('filterArrayFields', () => {
    it('filters array of objects', () => {
      const items = [
        { id: 1, title: 'One', content: 'Content 1' },
        { id: 2, title: 'Two', content: 'Content 2' },
      ];
      const result = filterArrayFields(items, ['id', 'title']);
      expect(result).toEqual([
        { id: 1, title: 'One' },
        { id: 2, title: 'Two' },
      ]);
    });

    it('handles empty array', () => {
      const result = filterArrayFields([], ['id']);
      expect(result).toEqual([]);
    });
  });

  describe('getSupportedResources', () => {
    it('returns all resource types', () => {
      const resources = getSupportedResources();
      expect(resources).toContain('posts');
      expect(resources).toContain('pages');
      expect(resources).toContain('plugins');
      expect(resources).toContain('themes');
      expect(resources.length).toBeGreaterThan(5);
    });
  });
});
