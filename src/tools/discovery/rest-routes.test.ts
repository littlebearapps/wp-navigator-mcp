import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the tool registry before importing
vi.mock('../../tool-registry/index.js', () => ({
  toolRegistry: {
    register: vi.fn(),
  },
  ToolCategory: {
    DISCOVERY: 'discovery',
  },
}));

import { registerRestRoutesTools } from './rest-routes.js';
import { toolRegistry } from '../../tool-registry/index.js';

describe('REST Routes Tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('registerRestRoutesTools', () => {
    it('registers wpnav_list_rest_routes tool', () => {
      registerRestRoutesTools();

      const calls = vi.mocked(toolRegistry.register).mock.calls;
      const restRoutes = calls.find((c) => c[0].definition.name === 'wpnav_list_rest_routes');

      expect(restRoutes).toBeDefined();
      expect(restRoutes![0].category).toBe('discovery');
    });

    it('has correct input schema', () => {
      registerRestRoutesTools();

      const calls = vi.mocked(toolRegistry.register).mock.calls;
      const restRoutes = calls.find((c) => c[0].definition.name === 'wpnav_list_rest_routes');
      const schema = restRoutes![0].definition.inputSchema;

      expect(schema.properties).toHaveProperty('namespace');
      expect(schema.properties).toHaveProperty('include_methods');
      expect(schema.properties).toHaveProperty('include_args');
    });
  });

  describe('wpnav_list_rest_routes handler', () => {
    it('calls wpRequest with correct endpoint', async () => {
      registerRestRoutesTools();

      const calls = vi.mocked(toolRegistry.register).mock.calls;
      const restRoutes = calls.find((c) => c[0].definition.name === 'wpnav_list_rest_routes');
      const handler = restRoutes![0].handler;

      const mockContext = {
        wpRequest: vi.fn().mockResolvedValue({
          routes: [{ route: '/wp/v2/posts', namespace: 'wp/v2', methods: ['GET', 'POST'] }],
          summary: { total_routes: 1, namespaces: ['wp/v2'] },
        }),
        clampText: (t: string) => t,
        config: {},
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
      };

      await handler({}, mockContext as any);

      expect(mockContext.wpRequest).toHaveBeenCalledWith('/wpnav/v1/discovery/routes');
    });

    it('passes namespace filter correctly', async () => {
      registerRestRoutesTools();

      const calls = vi.mocked(toolRegistry.register).mock.calls;
      const restRoutes = calls.find((c) => c[0].definition.name === 'wpnav_list_rest_routes');
      const handler = restRoutes![0].handler;

      const mockContext = {
        wpRequest: vi.fn().mockResolvedValue({ routes: [], summary: { total_routes: 0 } }),
        clampText: (t: string) => t,
        config: {},
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
      };

      await handler({ namespace: 'wc/v3' }, mockContext as any);

      const calledUrl = mockContext.wpRequest.mock.calls[0][0];
      expect(calledUrl).toContain('namespace=wc%2Fv3');
    });

    it('passes include_args parameter correctly', async () => {
      registerRestRoutesTools();

      const calls = vi.mocked(toolRegistry.register).mock.calls;
      const restRoutes = calls.find((c) => c[0].definition.name === 'wpnav_list_rest_routes');
      const handler = restRoutes![0].handler;

      const mockContext = {
        wpRequest: vi.fn().mockResolvedValue({ routes: [], summary: { total_routes: 0 } }),
        clampText: (t: string) => t,
        config: {},
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
      };

      await handler({ include_methods: true, include_args: true }, mockContext as any);

      const calledUrl = mockContext.wpRequest.mock.calls[0][0];
      expect(calledUrl).toContain('include_methods=true');
      expect(calledUrl).toContain('include_args=true');
    });
  });
});
