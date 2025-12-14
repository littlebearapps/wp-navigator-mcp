/**
 * Integration tests for content creation via Plan→Diff→Apply
 *
 * Tests the applyContentCreation() function with various scenarios
 * including Gutenberg blocks support.
 */

import { describe, it, expect } from 'vitest';
import { applyContentCreation } from '../src/safety.js';
import type { WPConfig } from '../src/config.js';

// Mock configuration (adjust for your test environment)
const testConfig: WPConfig = {
  baseUrl: process.env.WP_BASE_URL || 'http://localhost:8888',
  restApi: process.env.WP_REST_API || 'http://localhost:8888/wp-json',
  wpnavBase: process.env.WPNAV_BASE || 'http://localhost:8888/wp-json/wpnav/v1',
  username: process.env.WP_APP_USER || 'admin',
  appPassword: process.env.WP_APP_PASS || '',
};

// Mock wpRequest function
const mockWpRequest = async (endpoint: string, options?: any) => {
  // In a real test, this would make actual HTTP requests
  // For now, return mock responses
  const mockPlanId = `plan-${Date.now()}`;

  if (endpoint.includes('/content/plan')) {
    return {
      plan_id: mockPlanId,
      post_id: 0,
      post_type: options?.body ? JSON.parse(options.body).post_type : 'post',
      is_create: true,
      operations: options?.body ? JSON.parse(options.body).operations : [],
      risk_analysis: {
        overall_risk: 'medium',
        recommendations: ['Creating draft post - safe to preview before publishing'],
      },
    };
  }

  if (endpoint.includes('/content/diff')) {
    return {
      diff: {
        changes: [
          { type: 'add', path: '/title', value: 'Test Title' },
          { type: 'add', path: '/content', value: 'Test content' },
        ],
      },
      format: 'json',
    };
  }

  if (endpoint.includes('/content/apply')) {
    return {
      applied: true,
      is_create: true,
      post_id: 123,
      post_type: 'post',
      plan_id: mockPlanId,
      message: 'Post created successfully',
    };
  }

  throw new Error(`Unexpected endpoint: ${endpoint}`);
};

describe('Content Creation - applyContentCreation()', () => {
  describe('Basic Post Creation', () => {
    it('should create a post with title only', async () => {
      const result = await applyContentCreation(mockWpRequest, testConfig, {
        postType: 'post',
        title: 'Test Post Title',
      });

      expect(result).toHaveProperty('plan');
      expect(result).toHaveProperty('diff');
      expect(result).toHaveProperty('apply');

      expect(result.plan.is_create).toBe(true);
      expect(result.plan.post_type).toBe('post');
      expect(result.apply.applied).toBe(true);
      expect(result.apply.post_id).toBeGreaterThan(0);
    });

    it('should create a post with title and content', async () => {
      const result = await applyContentCreation(mockWpRequest, testConfig, {
        postType: 'post',
        title: 'Post with Content',
        content: 'This is the post content.',
      });

      expect(result.plan.operations).toHaveLength(2); // title + content
      expect(result.apply.applied).toBe(true);
    });

    it('should create a post with title, content, and excerpt', async () => {
      const result = await applyContentCreation(mockWpRequest, testConfig, {
        postType: 'post',
        title: 'Post with Excerpt',
        content: 'Full content here.',
        excerpt: 'This is the excerpt.',
      });

      expect(result.plan.operations).toHaveLength(3); // title + content + excerpt
      expect(result.apply.applied).toBe(true);
    });

    it('should create a post with custom status', async () => {
      const result = await applyContentCreation(mockWpRequest, testConfig, {
        postType: 'post',
        title: 'Published Post',
        content: 'Content',
        status: 'publish',
      });

      expect(result.plan.operations).toContainEqual(
        expect.objectContaining({
          op: 'replace',
          path: '/status',
          value: 'publish',
        })
      );
      expect(result.apply.applied).toBe(true);
    });
  });

  describe('Page Creation', () => {
    it('should create a page', async () => {
      const result = await applyContentCreation(mockWpRequest, testConfig, {
        postType: 'page',
        title: 'Test Page',
        content: 'Page content',
      });

      expect(result.plan.post_type).toBe('page');
      expect(result.apply.applied).toBe(true);
    });
  });

  describe('Gutenberg Blocks Support', () => {
    it('should create a post with single Gutenberg block', async () => {
      const result = await applyContentCreation(mockWpRequest, testConfig, {
        postType: 'post',
        title: 'Post with Block',
        blocks: [
          {
            blockName: 'core/paragraph',
            attrs: { content: 'Hello from Gutenberg!' },
          },
        ],
      });

      expect(result.plan.operations).toContainEqual(
        expect.objectContaining({
          op: 'insert',
          path: '/blocks/0',
          value: expect.objectContaining({
            blockName: 'core/paragraph',
          }),
        })
      );
      expect(result.apply.applied).toBe(true);
    });

    it('should create a post with multiple Gutenberg blocks', async () => {
      const result = await applyContentCreation(mockWpRequest, testConfig, {
        postType: 'post',
        title: 'Post with Multiple Blocks',
        blocks: [
          {
            blockName: 'core/heading',
            attrs: { level: 2, content: 'Section Heading' },
          },
          {
            blockName: 'core/paragraph',
            attrs: { content: 'First paragraph' },
          },
          {
            blockName: 'core/paragraph',
            attrs: { content: 'Second paragraph' },
          },
        ],
      });

      expect(result.plan.operations).toContainEqual(expect.objectContaining({ path: '/blocks/0' }));
      expect(result.plan.operations).toContainEqual(expect.objectContaining({ path: '/blocks/1' }));
      expect(result.plan.operations).toContainEqual(expect.objectContaining({ path: '/blocks/2' }));
      expect(result.apply.applied).toBe(true);
    });

    it('should create a post with nested blocks', async () => {
      const result = await applyContentCreation(mockWpRequest, testConfig, {
        postType: 'post',
        title: 'Post with Nested Blocks',
        blocks: [
          {
            blockName: 'core/group',
            attrs: {},
            innerBlocks: [
              {
                blockName: 'core/heading',
                attrs: { level: 2, content: 'Group Heading' },
              },
              {
                blockName: 'core/paragraph',
                attrs: { content: 'Nested paragraph' },
              },
            ],
          },
        ],
      });

      const groupBlock = result.plan.operations.find((op: any) => op.path === '/blocks/0');

      expect(groupBlock?.value.blockName).toBe('core/group');
      expect(groupBlock?.value.innerBlocks).toHaveLength(2);
      expect(result.apply.applied).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle plan creation failure', async () => {
      const failingWpRequest = async (endpoint: string) => {
        if (endpoint.includes('/content/plan')) {
          throw new Error('PLAN_FAILED: Validation error');
        }
        return {};
      };

      await expect(
        applyContentCreation(failingWpRequest as any, testConfig, {
          postType: 'post',
          title: 'Test',
        })
      ).rejects.toThrow('PLAN_FAILED');
    });

    it('should handle missing plan_id in response', async () => {
      const badWpRequest = async (endpoint: string) => {
        if (endpoint.includes('/content/plan')) {
          return {
            /* no plan_id */
          };
        }
        return {};
      };

      await expect(
        applyContentCreation(badWpRequest as any, testConfig, {
          postType: 'post',
          title: 'Test',
        })
      ).rejects.toThrow('Could not retrieve plan_id');
    });

    it('should handle diff generation failure', async () => {
      const failingDiffRequest = async (endpoint: string, options?: any) => {
        if (endpoint.includes('/content/plan')) {
          return { plan_id: 'test-plan-id' };
        }
        if (endpoint.includes('/content/diff')) {
          throw new Error('DIFF_FAILED: Could not generate diff');
        }
        return {};
      };

      await expect(
        applyContentCreation(failingDiffRequest as any, testConfig, {
          postType: 'post',
          title: 'Test',
        })
      ).rejects.toThrow('DIFF_FAILED');
    });

    it('should handle apply failure', async () => {
      const failingApplyRequest = async (endpoint: string, options?: any) => {
        if (endpoint.includes('/content/plan')) {
          return { plan_id: 'test-plan-id' };
        }
        if (endpoint.includes('/content/diff')) {
          return { diff: {}, format: 'json' };
        }
        if (endpoint.includes('/content/apply')) {
          throw new Error('APPLY_FAILED: Permission denied');
        }
        return {};
      };

      await expect(
        applyContentCreation(failingApplyRequest as any, testConfig, {
          postType: 'post',
          title: 'Test',
        })
      ).rejects.toThrow('APPLY_FAILED');
    });
  });

  describe('Idempotency', () => {
    it('should generate unique idempotency keys for each call', async () => {
      const requestBodies: any[] = [];

      const trackingWpRequest = async (endpoint: string, options?: any) => {
        if (endpoint.includes('/content/plan') && options?.body) {
          requestBodies.push(JSON.parse(options.body));
        }

        // Return mock responses
        return mockWpRequest(endpoint, options);
      };

      // Make two separate calls
      await applyContentCreation(trackingWpRequest as any, testConfig, {
        postType: 'post',
        title: 'First Post',
      });

      await applyContentCreation(trackingWpRequest as any, testConfig, {
        postType: 'post',
        title: 'Second Post',
      });

      expect(requestBodies).toHaveLength(2);
      expect(requestBodies[0].idempotency_key).toBeDefined();
      expect(requestBodies[1].idempotency_key).toBeDefined();
      expect(requestBodies[0].idempotency_key).not.toBe(requestBodies[1].idempotency_key);
    });
  });

  describe('Operations Structure', () => {
    it('should build operations array correctly for minimal post', async () => {
      const result = await applyContentCreation(mockWpRequest, testConfig, {
        postType: 'post',
        title: 'Minimal Post',
      });

      expect(result.plan.operations).toHaveLength(1); // title only
      expect(result.plan.operations[0]).toMatchObject({
        op: 'replace',
        path: '/title',
        value: 'Minimal Post',
      });
    });

    it('should build operations array correctly for full post with blocks', async () => {
      const result = await applyContentCreation(mockWpRequest, testConfig, {
        postType: 'post',
        title: 'Full Post',
        content: 'Legacy content',
        excerpt: 'Excerpt',
        status: 'draft',
        blocks: [{ blockName: 'core/paragraph', attrs: { content: 'Block content' } }],
      });

      // Should have: title + content + excerpt + status + 1 block = 5 operations
      expect(result.plan.operations).toHaveLength(5);

      // Verify operation types
      const opPaths = result.plan.operations.map((op: any) => op.path);
      expect(opPaths).toContain('/title');
      expect(opPaths).toContain('/content');
      expect(opPaths).toContain('/excerpt');
      expect(opPaths).toContain('/status');
      expect(opPaths).toContain('/blocks/0');
    });
  });
});
