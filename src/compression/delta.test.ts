import { describe, it, expect } from 'vitest';
import { createDelta, updateDelta, deleteDelta, errorDelta, extractChanges } from './delta.js';

describe('Delta Response System', () => {
  describe('createDelta', () => {
    it('creates delta for new post', () => {
      const delta = createDelta('post', 68, 'Holiday Sale', 'draft', { posts: 48, drafts: 12 });
      expect(delta.result).toBe('success');
      expect(delta.operation).toBe('create');
      expect(delta.entity_type).toBe('post');
      expect(delta.entity_id).toBe(68);
      expect(delta.delta).toBe("+1 post: 'Holiday Sale' (id:68, status:draft)");
      expect(delta.new_totals).toEqual({ posts: 48, drafts: 12 });
      expect(delta.follow_up).toContain('wpnav_get_post');
    });

    it('creates delta without status', () => {
      const delta = createDelta('category', 5, 'News');
      expect(delta.delta).toBe("+1 category: 'News' (id:5)");
    });
  });

  describe('updateDelta', () => {
    it('creates delta for updated post', () => {
      const changes = {
        title: { from: 'Old Title', to: 'New Title' },
        status: { from: 'draft', to: 'publish' },
      };
      const delta = updateDelta('post', 42, 'New Title', changes);
      expect(delta.result).toBe('success');
      expect(delta.operation).toBe('update');
      expect(delta.delta).toBe("~1 post: 'New Title' (id:42) updated [title, status]");
      expect(delta.changes).toEqual(changes);
      expect(delta.follow_up).toContain('wpnav_get_post');
    });
  });

  describe('deleteDelta', () => {
    it('creates delta for deleted post', () => {
      const delta = deleteDelta('post', 15, 'Old Post', { posts: 47 });
      expect(delta.result).toBe('success');
      expect(delta.operation).toBe('delete');
      expect(delta.delta).toBe("-1 post: 'Old Post' (id:15) deleted");
      expect(delta.new_totals).toEqual({ posts: 47 });
      expect(delta.follow_up).toContain('wpnav_list_posts');
    });
  });

  describe('errorDelta', () => {
    it('creates error delta with id', () => {
      const delta = errorDelta('update', 'post', 99, 'Post not found');
      expect(delta.result).toBe('error');
      expect(delta.delta).toBe('Failed to update post (id:99): Post not found');
    });

    it('creates error delta without id', () => {
      const delta = errorDelta('create', 'page', undefined, 'Invalid data');
      expect(delta.delta).toBe('Failed to create page: Invalid data');
      expect(delta.entity_id).toBe('unknown');
    });
  });

  describe('extractChanges', () => {
    it('extracts changed fields', () => {
      const oldObj = { title: 'Old', status: 'draft', content: 'Hello' };
      const newObj = { title: 'New', status: 'publish', content: 'Hello' };
      const changes = extractChanges(oldObj, newObj);
      expect(changes).toEqual({
        title: { from: 'Old', to: 'New' },
        status: { from: 'draft', to: 'publish' },
      });
      expect((changes as any).content).toBeUndefined();
    });

    it('compares only specified fields', () => {
      const oldObj = { title: 'Old', status: 'draft' };
      const newObj = { title: 'New', status: 'publish' };
      const changes = extractChanges(oldObj, newObj, ['title']);
      expect(Object.keys(changes)).toEqual(['title']);
    });

    it('returns empty for no changes', () => {
      const obj = { title: 'Same', status: 'draft' };
      const changes = extractChanges(obj, obj);
      expect(changes).toEqual({});
    });
  });
});
