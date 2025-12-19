import { describe, it, expect } from 'vitest';
import {
  createActionHint,
  getPostCreationHints,
  getPageCreationHints,
  getMediaUploadHints,
  getUpdateHints,
  getDeleteHints,
} from './hints.js';

describe('Tool Chaining Hints', () => {
  describe('createActionHint', () => {
    it('creates hint without args', () => {
      const hint = createActionHint('wpnav_list_posts', 'View all posts');
      expect(hint.tool).toBe('wpnav_list_posts');
      expect(hint.reason).toBe('View all posts');
      expect(hint.args).toBeUndefined();
    });

    it('creates hint with args', () => {
      const hint = createActionHint('wpnav_update_post', 'Publish', { id: 1, status: 'publish' });
      expect(hint.args).toEqual({ id: 1, status: 'publish' });
    });
  });

  describe('getPostCreationHints', () => {
    it('suggests publish for drafts', () => {
      const hints = getPostCreationHints(123, 'draft');
      expect(hints.next_actions).toContainEqual(
        expect.objectContaining({ tool: 'wpnav_update_post', args: { id: 123, status: 'publish' } })
      );
    });

    it('suggests media upload', () => {
      const hints = getPostCreationHints(123, 'publish');
      expect(hints.next_actions).toContainEqual(
        expect.objectContaining({ tool: 'wpnav_upload_media_from_url' })
      );
    });

    it('includes common followups', () => {
      const hints = getPostCreationHints(123, 'draft');
      expect(hints.common_followups).toContain('wpnav_list_posts');
      expect(hints.common_followups).toContain('wpnav_get_post');
    });
  });

  describe('getPageCreationHints', () => {
    it('suggests block listing', () => {
      const hints = getPageCreationHints(456, 'publish');
      expect(hints.next_actions).toContainEqual(
        expect.objectContaining({ tool: 'wpnav_gutenberg_list_blocks' })
      );
    });
  });

  describe('getMediaUploadHints', () => {
    it('suggests featured image and insert block', () => {
      const hints = getMediaUploadHints(789);
      expect(hints.next_actions).toHaveLength(2);
      expect(hints.next_actions![0].tool).toBe('wpnav_update_page');
      expect(hints.next_actions![1].tool).toBe('wpnav_gutenberg_insert_block');
    });
  });

  describe('getUpdateHints', () => {
    it('suggests verification', () => {
      const hints = getUpdateHints('post', 123);
      expect(hints.next_actions![0].tool).toBe('wpnav_get_post');
      expect(hints.next_actions![0].args).toEqual({ id: 123 });
    });
  });

  describe('getDeleteHints', () => {
    it('suggests listing remaining items', () => {
      const hints = getDeleteHints('page');
      expect(hints.next_actions![0].tool).toBe('wpnav_list_pages');
    });
  });
});
