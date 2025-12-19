/**
 * Token Usage Benchmarks
 *
 * Lightweight benchmark harness to assert expected token
 * savings for key compression scenarios.
 */

import { describe, it, expect } from 'vitest';
import { compactResponse } from '../../src/compression/compact.js';
import { truncateObjectContent } from '../../src/compression/truncation.js';
import { wrapWithMeta } from '../../src/compression/metadata.js';
import { createDelta } from '../../src/compression/delta.js';
import {
  createMockPostsResponse,
  estimateTokens as estimateTokensJson,
} from '../../src/integration/test-utils.ts';

interface BenchmarkResult {
  scenario: string;
  full_mode: {
    tokens: number;
    response_size_bytes: number;
    response_time_ms: number;
  };
  compact_mode: {
    tokens: number;
    response_size_bytes: number;
    response_time_ms: number;
  };
  savings_percent: number;
}

function measureScenario(
  scenario: string,
  buildFull: () => unknown,
  buildCompact: () => unknown
): BenchmarkResult {
  const startFull = Date.now();
  const fullPayload = buildFull();
  const endFull = Date.now();

  const fullJson = JSON.stringify(fullPayload);
  const fullTokens = estimateTokensJson(fullPayload);

  const startCompact = Date.now();
  const compactPayload = buildCompact();
  const endCompact = Date.now();

  const compactJson = JSON.stringify(compactPayload);
  const compactTokens = estimateTokensJson(compactPayload);

  const savings = ((fullTokens - compactTokens) / fullTokens) * 100;

  return {
    scenario,
    full_mode: {
      tokens: fullTokens,
      response_size_bytes: Buffer.byteLength(fullJson, 'utf8'),
      response_time_ms: endFull - startFull,
    },
    compact_mode: {
      tokens: compactTokens,
      response_size_bytes: Buffer.byteLength(compactJson, 'utf8'),
      response_time_ms: endCompact - startCompact,
    },
    savings_percent: savings,
  };
}

describe('Token Usage Benchmarks', () => {
  it('list 50 posts achieves 60-80% savings', () => {
    const posts = createMockPostsResponse(50);

    const result = measureScenario(
      'list_50_posts',
      () => wrapWithMeta(posts, { compression: 'full' }),
      () =>
        wrapWithMeta(
          compactResponse(posts as any[], { enabled: true, maxItems: 5, generateSummary: true }),
          { compression: 'compact', totalAvailable: posts.length }
        )
    );

    expect(result.compact_mode.tokens).toBeLessThan(result.full_mode.tokens);
    expect(result.savings_percent).toBeGreaterThanOrEqual(60);
  });

  it('get long post content achieves 40-60% savings', () => {
    const longContent = 'Word '.repeat(4000);
    const post = {
      id: 1,
      title: { rendered: 'Long Post' },
      content: { rendered: longContent },
      status: 'publish',
    };

    const result = measureScenario(
      'get_long_post',
      () => wrapWithMeta(post, { compression: 'full' }),
      () =>
        wrapWithMeta(truncateObjectContent(post, { maxLength: 1500 }), {
          compression: 'compact',
          truncatedFields: ['content'],
        })
    );

    expect(result.compact_mode.tokens).toBeLessThan(result.full_mode.tokens);
    expect(result.savings_percent).toBeGreaterThanOrEqual(40);
  });

  it('create post workflow achieves 50-70% savings', () => {
    const createdPost = {
      id: 999,
      title: 'Benchmark Post',
      status: 'draft',
      content: 'Content '.repeat(3000),
      categories: [1, 2, 3],
    };

    const result = measureScenario(
      'create_post_workflow',
      () => wrapWithMeta(createdPost, { compression: 'full' }),
      () =>
        wrapWithMeta(
          createDelta('post', createdPost.id, createdPost.title, createdPost.status, {
            posts: 101,
            drafts: 5,
          }),
          { compression: 'compact' }
        )
    );

    expect(result.compact_mode.tokens).toBeLessThan(result.full_mode.tokens);
    expect(result.savings_percent).toBeGreaterThanOrEqual(50);
  });

  it('multi-operation session stays within target overall savings', () => {
    const posts = createMockPostsResponse(25);
    const longContent = 'Block '.repeat(3000);
    const post = {
      id: 500,
      title: { rendered: 'Session Benchmark' },
      content: { rendered: longContent },
      status: 'draft',
    };

    const result = measureScenario(
      'multi_operation_session',
      () => {
        const list1 = wrapWithMeta(posts, { compression: 'full' });
        const get = wrapWithMeta(post, { compression: 'full' });
        const update = wrapWithMeta(
          createDelta('post', post.id, 'Updated', 'publish', { posts: 26 }),
          { compression: 'full' }
        );
        const list2 = wrapWithMeta(posts, { compression: 'full' });
        return { list1, get, update, list2 };
      },
      () => {
        const list1 = wrapWithMeta(
          compactResponse(posts as any[], { enabled: true, maxItems: 5, generateSummary: true }),
          { compression: 'compact', totalAvailable: posts.length }
        );
        const get = wrapWithMeta(truncateObjectContent(post, { maxLength: 1500 }), {
          compression: 'compact',
          truncatedFields: ['content'],
        });
        const update = wrapWithMeta(
          createDelta('post', post.id, 'Updated', 'publish', { posts: 26 }),
          { compression: 'compact' }
        );
        const list2 = wrapWithMeta(
          compactResponse(posts as any[], { enabled: true, maxItems: 5, generateSummary: true }),
          { compression: 'compact', totalAvailable: posts.length }
        );
        return { list1, get, update, list2 };
      }
    );

    expect(result.compact_mode.tokens).toBeLessThan(result.full_mode.tokens);
    expect(result.savings_percent).toBeGreaterThanOrEqual(50);
  });
});
