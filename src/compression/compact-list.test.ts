import { describe, it, expect } from 'vitest';
import {
  generateListSummary,
  selectTopItems,
  createCompactListResponse,
  createSummaryOnlyListResponse,
} from './compact-list.js';

describe('Compact List Response', () => {
  describe('generateListSummary', () => {
    it('generates summary for non-empty list', () => {
      const items = [1, 2, 3, 4, 5, 6, 7];
      const summary = generateListSummary('posts', items);
      expect(summary).toBe('Found 7 posts. Showing top 5.');
    });

    it('generates summary for empty list', () => {
      const summary = generateListSummary('pages', []);
      expect(summary).toBe('No pages found.');
    });

    it('includes context in summary', () => {
      const items = [1, 2, 3];
      const summary = generateListSummary('posts', items, { status: 'draft' });
      expect(summary).toContain('status: draft');
    });
  });

  describe('selectTopItems', () => {
    it('returns first N items', () => {
      const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      expect(selectTopItems(items, 5)).toEqual([1, 2, 3, 4, 5]);
    });

    it('returns all items if fewer than N', () => {
      const items = [1, 2, 3];
      expect(selectTopItems(items, 5)).toEqual([1, 2, 3]);
    });
  });

  describe('createCompactListResponse', () => {
    it('creates full compact response', () => {
      const items = [
        { id: 1, title: 'A' },
        { id: 2, title: 'B' },
        { id: 3, title: 'C' },
        { id: 4, title: 'D' },
        { id: 5, title: 'E' },
        { id: 6, title: 'F' },
      ];
      const response = createCompactListResponse('posts', items);

      expect(response.ai_summary).toContain('Found 6 posts');
      expect(response.items).toHaveLength(5);
      expect(response.full_count).toBe(6);
      expect(response.has_more).toBe(true);
      expect(response._meta.compact).toBe(true);
      expect(response._meta.token_estimate).toBeGreaterThan(0);
    });

    it('sets has_more to false when all items shown', () => {
      const items = [{ id: 1 }, { id: 2 }];
      const response = createCompactListResponse('pages', items);

      expect(response.has_more).toBe(false);
      expect(response.items).toHaveLength(2);
    });
  });

  describe('createSummaryOnlyListResponse', () => {
    it('creates summary-only response with metadata', () => {
      const items = [
        { id: 1, title: 'A' },
        { id: 2, title: 'B' },
        { id: 3, title: 'C' },
      ];

      const response = createSummaryOnlyListResponse('posts', items);

      expect(response.ai_summary).toContain('posts');
      expect(response.full_count).toBe(3);
      expect(response._meta.compact).toBe(true);
      expect(response._meta.summary_only).toBe(true);
      expect(response._meta.token_estimate).toBeGreaterThan(0);
    });
  });
});
