/**
 * Compression Integration Tests
 *
 * End-to-end style tests for compact mode, truncation, metadata,
 * and delta responses working together on realistic payloads.
 */

import { describe, it, expect } from 'vitest';
import { compactResponse } from '../../src/compression/compact.js';
import {
  truncateObjectContent,
  truncateArrayContent as truncateArray,
} from '../../src/compression/truncation.js';
import { wrapWithMeta } from '../../src/compression/metadata.js';
import { createDelta, updateDelta } from '../../src/compression/delta.js';
import {
  createMockPostsResponse,
  estimateTokens as estimateTokensJson,
} from '../../src/integration/test-utils.ts';

describe('Compression Integration', () => {
  describe('List 50 posts - full vs compact', () => {
    it('produces significantly fewer tokens in compact mode', () => {
      const posts = createMockPostsResponse(50);

      // Full mode: raw posts wrapped with metadata
      const fullEnvelope = wrapWithMeta(posts, {
        compression: 'full',
      });
      const fullTokens = estimateTokensJson(fullEnvelope);

      // Compact mode: truncate + compactResponse + metadata
      const truncated = truncateArray(posts, { maxLength: 120 });
      const compact = compactResponse(truncated as any[], {
        enabled: true,
        maxItems: 5,
        generateSummary: true,
      });
      const compactEnvelope = wrapWithMeta(compact, {
        compression: 'compact',
        totalAvailable: posts.length,
      });
      const compactTokens = estimateTokensJson(compactEnvelope);

      const savings = ((fullTokens - compactTokens) / fullTokens) * 100;

      expect(compact._compact.summary).toBeDefined();
      expect(compact.items.length).toBeLessThan(posts.length);
      expect(compactTokens).toBeLessThan(fullTokens);
      expect(savings).toBeGreaterThan(60);
      expect(savings).toBeLessThanOrEqual(95);
    });
  });

  describe('Single post get - full vs truncated', () => {
    it('reduces token usage with truncation', () => {
      const longContent = 'Word '.repeat(5000); // ~25k chars
      const post = {
        id: 1,
        title: { rendered: 'Long Post' },
        content: { rendered: longContent },
        status: 'publish',
      };

      const fullEnvelope = wrapWithMeta(post, { compression: 'full' });
      const fullTokens = estimateTokensJson(fullEnvelope);

      const truncatedPost = truncateObjectContent(post, {
        maxLength: 1000,
        preserveWords: true,
      });
      const compactEnvelope = wrapWithMeta(truncatedPost, {
        compression: 'compact',
        truncatedFields: ['content'],
      });
      const compactTokens = estimateTokensJson(compactEnvelope);

      const savings = ((fullTokens - compactTokens) / fullTokens) * 100;

      expect(truncatedPost.content_truncated).toBe(true);
      expect(compactTokens).toBeLessThan(fullTokens);
      expect(savings).toBeGreaterThan(40);
    });
  });

  describe('Create post workflow - full vs delta response', () => {
    it('delta response is much smaller than full object', () => {
      const createdPost = {
        id: 123,
        title: 'Holiday Sale',
        status: 'draft',
        content: 'Post content '.repeat(500),
        categories: [1, 2],
      };

      const fullEnvelope = wrapWithMeta(createdPost, { compression: 'full' });
      const fullTokens = estimateTokensJson(fullEnvelope);

      const delta = createDelta('post', createdPost.id, createdPost.title, createdPost.status, {
        posts: 48,
        drafts: 12,
      });
      const deltaEnvelope = wrapWithMeta(delta, { compression: 'compact' });
      const deltaTokens = estimateTokensJson(deltaEnvelope);

      const savings = ((fullTokens - deltaTokens) / fullTokens) * 100;

      expect(delta.operation).toBe('create');
      expect(deltaTokens).toBeLessThan(fullTokens);
      expect(savings).toBeGreaterThan(50);
      expect(savings).toBeLessThanOrEqual(95);
    });
  });

  describe('Multi-operation session - cumulative token usage', () => {
    it('compact strategies reduce total tokens across session', () => {
      const posts = createMockPostsResponse(30);
      const longContent = 'Block '.repeat(4000);
      const post = {
        id: 200,
        title: { rendered: 'Session Post' },
        content: { rendered: longContent },
        status: 'draft',
      };

      // Full mode session: list -> get -> update -> list
      const fullList1 = wrapWithMeta(posts, { compression: 'full' });
      const fullGet = wrapWithMeta(post, { compression: 'full' });
      const fullUpdate = wrapWithMeta(
        updateDelta('post', post.id, 'Updated Title', {
          title: { from: 'Session Post', to: 'Updated Title' },
          status: { from: 'draft', to: 'publish' },
        }),
        { compression: 'full' }
      );
      const fullList2 = wrapWithMeta(posts, { compression: 'full' });

      const fullTotalTokens =
        estimateTokensJson(fullList1) +
        estimateTokensJson(fullGet) +
        estimateTokensJson(fullUpdate) +
        estimateTokensJson(fullList2);

      // Compact session: compact lists + truncated get + delta update
      const compactList1 = wrapWithMeta(
        compactResponse(posts as any[], { enabled: true, maxItems: 5, generateSummary: true }),
        { compression: 'compact', totalAvailable: posts.length }
      );
      const truncatedGet = wrapWithMeta(truncateObjectContent(post, { maxLength: 1500 }), {
        compression: 'compact',
        truncatedFields: ['content'],
      });
      const compactUpdate = wrapWithMeta(
        updateDelta('post', post.id, 'Updated Title', {
          title: { from: 'Session Post', to: 'Updated Title' },
        }),
        { compression: 'compact' }
      );
      const compactList2 = wrapWithMeta(
        compactResponse(posts as any[], { enabled: true, maxItems: 5, generateSummary: true }),
        { compression: 'compact', totalAvailable: posts.length }
      );

      const compactTotalTokens =
        estimateTokensJson(compactList1) +
        estimateTokensJson(truncatedGet) +
        estimateTokensJson(compactUpdate) +
        estimateTokensJson(compactList2);

      const savings = ((fullTotalTokens - compactTotalTokens) / fullTotalTokens) * 100;

      expect(compactTotalTokens).toBeLessThan(fullTotalTokens);
      expect(savings).toBeGreaterThan(50);
      expect(savings).toBeLessThanOrEqual(95);
    });
  });
});
