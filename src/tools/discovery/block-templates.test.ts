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

import { registerBlockTemplatesTools } from './block-templates.js';
import { toolRegistry } from '../../tool-registry/index.js';

describe('Block Templates Tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('registerBlockTemplatesTools', () => {
    it('registers wpnav_list_block_templates tool', () => {
      registerBlockTemplatesTools();

      const calls = vi.mocked(toolRegistry.register).mock.calls;
      const templates = calls.find((c) => c[0].definition.name === 'wpnav_list_block_templates');

      expect(templates).toBeDefined();
      expect(templates![0].category).toBe('discovery');
    });

    it('has correct input schema', () => {
      registerBlockTemplatesTools();

      const calls = vi.mocked(toolRegistry.register).mock.calls;
      const templates = calls.find((c) => c[0].definition.name === 'wpnav_list_block_templates');
      const schema = templates![0].definition.inputSchema;

      expect(schema.properties).toHaveProperty('type');
      expect(schema.properties).toHaveProperty('area');
      expect(schema.properties).toHaveProperty('search');
      expect(schema.properties).toHaveProperty('include_content');
    });
  });

  describe('wpnav_list_block_templates handler', () => {
    it('calls wpRequest with correct endpoint', async () => {
      registerBlockTemplatesTools();

      const calls = vi.mocked(toolRegistry.register).mock.calls;
      const templates = calls.find((c) => c[0].definition.name === 'wpnav_list_block_templates');
      const handler = templates![0].handler;

      const mockContext = {
        wpRequest: vi.fn().mockResolvedValue({
          templates: [{ id: 'theme//header', title: 'Header' }],
          total: 1,
        }),
        clampText: (t: string) => t,
        config: {},
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
      };

      await handler({}, mockContext as any);

      expect(mockContext.wpRequest).toHaveBeenCalledWith('/wpnav/v1/discovery/templates');
    });

    it('passes type and area filters correctly', async () => {
      registerBlockTemplatesTools();

      const calls = vi.mocked(toolRegistry.register).mock.calls;
      const templates = calls.find((c) => c[0].definition.name === 'wpnav_list_block_templates');
      const handler = templates![0].handler;

      const mockContext = {
        wpRequest: vi.fn().mockResolvedValue({ templates: [], total: 0 }),
        clampText: (t: string) => t,
        config: {},
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
      };

      await handler({ type: 'wp_template_part', area: 'header' }, mockContext as any);

      const calledUrl = mockContext.wpRequest.mock.calls[0][0];
      expect(calledUrl).toContain('type=wp_template_part');
      expect(calledUrl).toContain('area=header');
    });

    it('passes search and include_content parameters', async () => {
      registerBlockTemplatesTools();

      const calls = vi.mocked(toolRegistry.register).mock.calls;
      const templates = calls.find((c) => c[0].definition.name === 'wpnav_list_block_templates');
      const handler = templates![0].handler;

      const mockContext = {
        wpRequest: vi.fn().mockResolvedValue({ templates: [], total: 0 }),
        clampText: (t: string) => t,
        config: {},
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
      };

      await handler({ search: 'footer', include_content: true }, mockContext as any);

      const calledUrl = mockContext.wpRequest.mock.calls[0][0];
      expect(calledUrl).toContain('search=footer');
      expect(calledUrl).toContain('include_content=true');
    });
  });
});
