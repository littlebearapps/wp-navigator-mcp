/**
 * Site Health Tools Integration Tests
 *
 * Tests wpnav_site_health with mocked WordPress REST responses.
 *
 * @package WP_Navigator_Pro
 * @since 2.8.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { toolRegistry } from '../../src/tool-registry/index.js';
import { registerHealthTools } from '../../src/tools/analytics/health.js';

describe('Site Health Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registerHealthTools();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * Helper to create a mock context with wpRequest
   */
  function createMockContext(response: any) {
    return {
      wpRequest: vi.fn().mockResolvedValue(response),
      clampText: (text: string) => text,
    };
  }

  describe('wpnav_site_health', () => {
    it('returns full health check with tests and info', async () => {
      const mockContext = createMockContext({
        tests: [
          {
            label: 'PHP Version',
            status: 'good',
            badge: { label: 'Security', color: 'green' },
            description: 'Your PHP version is up to date.',
          },
          {
            label: 'Plugin Updates',
            status: 'critical',
            badge: { label: 'Security', color: 'red' },
            description: 'Some plugins need updating.',
          },
        ],
        info: {
          wordpress: { version: '6.4.2' },
          php: { version: '8.2.0' },
        },
        recommendations: [{ message: 'Update your plugins', priority: 'high' }],
      });

      const tool = toolRegistry.getTool('wpnav_site_health');
      expect(tool).toBeDefined();

      const result = await tool!.handler({}, mockContext);

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.tests).toHaveLength(2);
      expect(parsed.info.wordpress.version).toBe('6.4.2');
      expect(parsed.recommendations).toHaveLength(1);
    });

    it('passes include flags to endpoint', async () => {
      const mockContext = createMockContext({ tests: [], info: {} });

      const tool = toolRegistry.getTool('wpnav_site_health');
      await tool!.handler(
        {
          include_tests: true,
          include_info: false,
          include_recommendations: true,
        },
        mockContext
      );

      expect(mockContext.wpRequest).toHaveBeenCalledWith(
        expect.stringContaining('include_tests=true')
      );
      expect(mockContext.wpRequest).toHaveBeenCalledWith(
        expect.stringContaining('include_info=false')
      );
      expect(mockContext.wpRequest).toHaveBeenCalledWith(
        expect.stringContaining('include_recommendations=true')
      );
    });

    it('filters by test categories', async () => {
      const mockContext = createMockContext({
        tests: [{ label: 'PHP Version', status: 'good', badge: 'security' }],
      });

      const tool = toolRegistry.getTool('wpnav_site_health');
      await tool!.handler({ test_categories: ['security', 'performance'] }, mockContext);

      // URL-encoded comma: %2C
      expect(mockContext.wpRequest).toHaveBeenCalledWith(
        expect.stringContaining('test_categories=security%2Cperformance')
      );
    });

    it('ignores invalid test categories', async () => {
      const mockContext = createMockContext({ tests: [] });

      const tool = toolRegistry.getTool('wpnav_site_health');
      await tool!.handler({ test_categories: ['security', 'invalid_category'] }, mockContext);

      expect(mockContext.wpRequest).toHaveBeenCalledWith(
        expect.stringContaining('test_categories=security')
      );
      expect(mockContext.wpRequest).toHaveBeenCalledWith(
        expect.not.stringContaining('invalid_category')
      );
    });

    it('defaults include flags to true', async () => {
      const mockContext = createMockContext({ tests: [] });

      const tool = toolRegistry.getTool('wpnav_site_health');
      await tool!.handler({}, mockContext);

      const url = mockContext.wpRequest.mock.calls[0][0] as string;
      expect(url).toContain('include_tests=true');
      expect(url).toContain('include_info=true');
      expect(url).toContain('include_recommendations=true');
    });

    it('handles empty health response', async () => {
      const mockContext = createMockContext({});

      const tool = toolRegistry.getTool('wpnav_site_health');
      const result = await tool!.handler({}, mockContext);

      expect(result.content[0].type).toBe('text');
      expect(() => JSON.parse(result.content[0].text)).not.toThrow();
    });

    it('handles critical status tests', async () => {
      const mockContext = createMockContext({
        tests: [
          {
            label: 'Database Version',
            status: 'critical',
            badge: { label: 'Performance' },
            description: 'Database upgrade required.',
          },
        ],
      });

      const tool = toolRegistry.getTool('wpnav_site_health');
      const result = await tool!.handler({}, mockContext);

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.tests[0].status).toBe('critical');
    });
  });
});
