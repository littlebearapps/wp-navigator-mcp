import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the tool registry before importing
vi.mock('../../tool-registry/index.js', () => ({
  toolRegistry: {
    register: vi.fn(),
  },
  ToolCategory: {
    ANALYTICS: 'analytics',
  },
}));

import { registerHealthTools } from './health.js';
import { toolRegistry } from '../../tool-registry/index.js';

describe('Health Tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('registerHealthTools', () => {
    it('registers wpnav_site_health tool', () => {
      registerHealthTools();

      const calls = vi.mocked(toolRegistry.register).mock.calls;
      const siteHealth = calls.find((c) => c[0].definition.name === 'wpnav_site_health');

      expect(siteHealth).toBeDefined();
      expect(siteHealth![0].category).toBe('analytics');
    });

    it('has correct input schema with all properties', () => {
      registerHealthTools();

      const calls = vi.mocked(toolRegistry.register).mock.calls;
      const siteHealth = calls.find((c) => c[0].definition.name === 'wpnav_site_health');

      const schema = siteHealth![0].definition.inputSchema;
      expect(schema.properties).toHaveProperty('include_tests');
      expect(schema.properties).toHaveProperty('include_info');
      expect(schema.properties).toHaveProperty('include_recommendations');
      expect(schema.properties).toHaveProperty('test_categories');
      expect(schema.required).toEqual([]);
    });

    it('test_categories schema has correct enum values', () => {
      registerHealthTools();

      const calls = vi.mocked(toolRegistry.register).mock.calls;
      const siteHealth = calls.find((c) => c[0].definition.name === 'wpnav_site_health');

      const testCategories = siteHealth![0].definition.inputSchema.properties!.test_categories as {
        type: string;
        items: { enum: string[] };
      };
      expect(testCategories.type).toBe('array');
      expect(testCategories.items.enum).toContain('security');
      expect(testCategories.items.enum).toContain('performance');
      expect(testCategories.items.enum).toContain('database');
      expect(testCategories.items.enum).toContain('plugins');
      expect(testCategories.items.enum).toContain('themes');
    });
  });

  describe('wpnav_site_health handler', () => {
    it('calls wpRequest with default parameters (all true)', async () => {
      registerHealthTools();

      const calls = vi.mocked(toolRegistry.register).mock.calls;
      const siteHealth = calls.find((c) => c[0].definition.name === 'wpnav_site_health');
      const handler = siteHealth![0].handler;

      const mockContext = {
        wpRequest: vi.fn().mockResolvedValue({
          success: true,
          summary: { status: 'good', score: 85 },
        }),
        clampText: (t: string) => t,
        config: {},
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
      };

      await handler({}, mockContext as any);

      expect(mockContext.wpRequest).toHaveBeenCalledWith(
        '/wpnav/v1/health?include_tests=true&include_info=true&include_recommendations=true'
      );
    });

    it('respects include_tests=false parameter', async () => {
      registerHealthTools();

      const calls = vi.mocked(toolRegistry.register).mock.calls;
      const siteHealth = calls.find((c) => c[0].definition.name === 'wpnav_site_health');
      const handler = siteHealth![0].handler;

      const mockContext = {
        wpRequest: vi.fn().mockResolvedValue({ success: true }),
        clampText: (t: string) => t,
        config: {},
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
      };

      await handler({ include_tests: false }, mockContext as any);

      expect(mockContext.wpRequest).toHaveBeenCalledWith(
        expect.stringContaining('include_tests=false')
      );
    });

    it('respects include_info=false parameter', async () => {
      registerHealthTools();

      const calls = vi.mocked(toolRegistry.register).mock.calls;
      const siteHealth = calls.find((c) => c[0].definition.name === 'wpnav_site_health');
      const handler = siteHealth![0].handler;

      const mockContext = {
        wpRequest: vi.fn().mockResolvedValue({ success: true }),
        clampText: (t: string) => t,
        config: {},
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
      };

      await handler({ include_info: false }, mockContext as any);

      expect(mockContext.wpRequest).toHaveBeenCalledWith(
        expect.stringContaining('include_info=false')
      );
    });

    it('respects include_recommendations=false parameter', async () => {
      registerHealthTools();

      const calls = vi.mocked(toolRegistry.register).mock.calls;
      const siteHealth = calls.find((c) => c[0].definition.name === 'wpnav_site_health');
      const handler = siteHealth![0].handler;

      const mockContext = {
        wpRequest: vi.fn().mockResolvedValue({ success: true }),
        clampText: (t: string) => t,
        config: {},
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
      };

      await handler({ include_recommendations: false }, mockContext as any);

      expect(mockContext.wpRequest).toHaveBeenCalledWith(
        expect.stringContaining('include_recommendations=false')
      );
    });

    it('adds test_categories filter when provided', async () => {
      registerHealthTools();

      const calls = vi.mocked(toolRegistry.register).mock.calls;
      const siteHealth = calls.find((c) => c[0].definition.name === 'wpnav_site_health');
      const handler = siteHealth![0].handler;

      const mockContext = {
        wpRequest: vi.fn().mockResolvedValue({ success: true }),
        clampText: (t: string) => t,
        config: {},
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
      };

      await handler({ test_categories: ['security', 'performance'] }, mockContext as any);

      expect(mockContext.wpRequest).toHaveBeenCalledWith(
        expect.stringContaining('test_categories=security%2Cperformance')
      );
    });

    it('filters out invalid test categories', async () => {
      registerHealthTools();

      const calls = vi.mocked(toolRegistry.register).mock.calls;
      const siteHealth = calls.find((c) => c[0].definition.name === 'wpnav_site_health');
      const handler = siteHealth![0].handler;

      const mockContext = {
        wpRequest: vi.fn().mockResolvedValue({ success: true }),
        clampText: (t: string) => t,
        config: {},
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
      };

      await handler({ test_categories: ['security', 'invalid_category'] }, mockContext as any);

      // Should only include valid 'security' category
      const callArg = mockContext.wpRequest.mock.calls[0][0];
      expect(callArg).toContain('test_categories=security');
      expect(callArg).not.toContain('invalid_category');
    });

    it('does not add test_categories when array is empty after filtering', async () => {
      registerHealthTools();

      const calls = vi.mocked(toolRegistry.register).mock.calls;
      const siteHealth = calls.find((c) => c[0].definition.name === 'wpnav_site_health');
      const handler = siteHealth![0].handler;

      const mockContext = {
        wpRequest: vi.fn().mockResolvedValue({ success: true }),
        clampText: (t: string) => t,
        config: {},
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
      };

      await handler({ test_categories: ['invalid1', 'invalid2'] }, mockContext as any);

      expect(mockContext.wpRequest).toHaveBeenCalledWith(
        expect.not.stringContaining('test_categories')
      );
    });

    it('returns formatted JSON result', async () => {
      registerHealthTools();

      const calls = vi.mocked(toolRegistry.register).mock.calls;
      const siteHealth = calls.find((c) => c[0].definition.name === 'wpnav_site_health');
      const handler = siteHealth![0].handler;

      const mockResponse = {
        success: true,
        summary: {
          status: 'good',
          score: 85,
          tests_passed: 10,
          tests_failed: 2,
          recommendations: 3,
        },
      };

      const mockContext = {
        wpRequest: vi.fn().mockResolvedValue(mockResponse),
        clampText: (t: string) => t,
        config: {},
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
      };

      const result = await handler({}, mockContext as any);

      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
      expect(JSON.parse(result.content[0].text!)).toEqual(mockResponse);
    });

    it('uses clampText for output', async () => {
      registerHealthTools();

      const calls = vi.mocked(toolRegistry.register).mock.calls;
      const siteHealth = calls.find((c) => c[0].definition.name === 'wpnav_site_health');
      const handler = siteHealth![0].handler;

      const mockContext = {
        wpRequest: vi.fn().mockResolvedValue({ success: true }),
        clampText: vi.fn().mockReturnValue('clamped'),
        config: {},
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
      };

      const result = await handler({}, mockContext as any);

      expect(mockContext.clampText).toHaveBeenCalled();
      expect(result.content[0].text).toBe('clamped');
    });
  });
});
