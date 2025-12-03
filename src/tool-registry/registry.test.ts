/**
 * Tool Registry Tests
 *
 * @package WP_Navigator_Pro
 * @since 1.3.0
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ToolRegistry } from './registry.js';
import { ToolCategory, RegisteredTool } from './types.js';

describe('ToolRegistry', () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = new ToolRegistry();
  });

  describe('register', () => {
    it('should register a tool', () => {
      const tool: RegisteredTool = {
        definition: {
          name: 'test_tool',
          description: 'Test tool',
          inputSchema: {
            type: 'object',
            properties: {},
            required: [],
          },
        },
        handler: async () => ({ content: [{ type: 'text', text: 'test' }] }),
        category: ToolCategory.CORE,
      };

      registry.register(tool);

      expect(registry.getTool('test_tool')).toBe(tool);
    });

    it('should register tool aliases', () => {
      const tool: RegisteredTool = {
        definition: {
          name: 'test_tool',
          description: 'Test tool',
          inputSchema: {
            type: 'object',
            properties: {},
            required: [],
          },
        },
        handler: async () => ({ content: [{ type: 'text', text: 'test' }] }),
        category: ToolCategory.CORE,
        aliases: ['test.tool', 'test-tool'],
      };

      registry.register(tool);

      expect(registry.getTool('test_tool')).toBe(tool);
      expect(registry.getTool('test.tool')).toBe(tool);
      expect(registry.getTool('test-tool')).toBe(tool);
    });
  });

  describe('feature flags', () => {
    it('should respect feature flags', () => {
      const tool: RegisteredTool = {
        definition: {
          name: 'workflow_tool',
          description: 'Workflow tool',
          inputSchema: {
            type: 'object',
            properties: {},
            required: [],
          },
        },
        handler: async () => ({ content: [{ type: 'text', text: 'workflow' }] }),
        category: ToolCategory.WORKFLOWS,
        featureFlag: 'WORKFLOWS_ENABLED',
      };

      registry.register(tool);

      // Initially disabled
      expect(registry.isEnabled('workflow_tool')).toBe(false);

      // Enable feature flag
      registry.setFeatureFlag('WORKFLOWS_ENABLED', true);
      expect(registry.isEnabled('workflow_tool')).toBe(true);
    });

    it('should filter disabled tools from getAllDefinitions', () => {
      const enabledTool: RegisteredTool = {
        definition: {
          name: 'enabled_tool',
          description: 'Enabled tool',
          inputSchema: { type: 'object', properties: {}, required: [] },
        },
        handler: async () => ({ content: [{ type: 'text', text: 'enabled' }] }),
        category: ToolCategory.CORE,
      };

      const disabledTool: RegisteredTool = {
        definition: {
          name: 'disabled_tool',
          description: 'Disabled tool',
          inputSchema: { type: 'object', properties: {}, required: [] },
        },
        handler: async () => ({ content: [{ type: 'text', text: 'disabled' }] }),
        category: ToolCategory.WORKFLOWS,
        featureFlag: 'WORKFLOWS_ENABLED',
      };

      registry.register(enabledTool);
      registry.register(disabledTool);

      const definitions = registry.getAllDefinitions();

      expect(definitions).toHaveLength(1);
      expect(definitions[0].name).toBe('enabled_tool');
    });
  });

  describe('getByCategory', () => {
    it('should return tools by category', () => {
      const coreTools: RegisteredTool[] = [
        {
          definition: {
            name: 'core_tool_1',
            description: 'Core tool 1',
            inputSchema: { type: 'object', properties: {}, required: [] },
          },
          handler: async () => ({ content: [{ type: 'text', text: 'core1' }] }),
          category: ToolCategory.CORE,
        },
        {
          definition: {
            name: 'core_tool_2',
            description: 'Core tool 2',
            inputSchema: { type: 'object', properties: {}, required: [] },
          },
          handler: async () => ({ content: [{ type: 'text', text: 'core2' }] }),
          category: ToolCategory.CORE,
        },
      ];

      const contentTool: RegisteredTool = {
        definition: {
          name: 'content_tool',
          description: 'Content tool',
          inputSchema: { type: 'object', properties: {}, required: [] },
        },
        handler: async () => ({ content: [{ type: 'text', text: 'content' }] }),
        category: ToolCategory.CONTENT,
      };

      coreTools.forEach((t) => registry.register(t));
      registry.register(contentTool);

      const coreResult = registry.getByCategory(ToolCategory.CORE);
      const contentResult = registry.getByCategory(ToolCategory.CONTENT);

      expect(coreResult).toHaveLength(2);
      expect(contentResult).toHaveLength(1);
      expect(coreResult.map((t) => t.definition.name)).toEqual(['core_tool_1', 'core_tool_2']);
      expect(contentResult[0].definition.name).toBe('content_tool');
    });

    it('should not return duplicates for aliases', () => {
      const tool: RegisteredTool = {
        definition: {
          name: 'test_tool',
          description: 'Test tool',
          inputSchema: { type: 'object', properties: {}, required: [] },
        },
        handler: async () => ({ content: [{ type: 'text', text: 'test' }] }),
        category: ToolCategory.CORE,
        aliases: ['test.tool'],
      };

      registry.register(tool);

      const result = registry.getByCategory(ToolCategory.CORE);
      expect(result).toHaveLength(1);
    });
  });

  describe('execute', () => {
    it('should execute a tool', async () => {
      const tool: RegisteredTool = {
        definition: {
          name: 'test_tool',
          description: 'Test tool',
          inputSchema: { type: 'object', properties: {}, required: [] },
        },
        handler: async (args, context) => ({
          content: [{ type: 'text', text: `Hello ${args.name}` }],
        }),
        category: ToolCategory.CORE,
      };

      registry.register(tool);

      const context: any = {
        wpRequest: async () => ({}),
        config: {},
        logger: {},
        clampText: (t: string) => t,
      };

      const result = await registry.execute('test_tool', { name: 'World' }, context);

      expect(result.content[0]).toEqual({ type: 'text', text: 'Hello World' });
    });

    it('should throw error for non-existent tool', async () => {
      const context: any = {
        wpRequest: async () => ({}),
        config: {},
        logger: {},
        clampText: (t: string) => t,
      };

      await expect(registry.execute('non_existent', {}, context)).rejects.toThrow(
        'Tool not found: non_existent'
      );
    });

    it('should throw error for disabled tool', async () => {
      const tool: RegisteredTool = {
        definition: {
          name: 'disabled_tool',
          description: 'Disabled tool',
          inputSchema: { type: 'object', properties: {}, required: [] },
        },
        handler: async () => ({ content: [{ type: 'text', text: 'disabled' }] }),
        category: ToolCategory.WORKFLOWS,
        featureFlag: 'WORKFLOWS_ENABLED',
      };

      registry.register(tool);

      const context: any = {
        wpRequest: async () => ({}),
        config: {},
        logger: {},
        clampText: (t: string) => t,
      };

      await expect(registry.execute('disabled_tool', {}, context)).rejects.toThrow(
        'Tool is disabled: disabled_tool (requires feature flag: WORKFLOWS_ENABLED)'
      );
    });
  });

  describe('getStats', () => {
    it('should return registry statistics', () => {
      const tools: RegisteredTool[] = [
        {
          definition: {
            name: 'core_tool',
            description: 'Core tool',
            inputSchema: { type: 'object', properties: {}, required: [] },
          },
          handler: async () => ({ content: [{ type: 'text', text: 'core' }] }),
          category: ToolCategory.CORE,
        },
        {
          definition: {
            name: 'content_tool',
            description: 'Content tool',
            inputSchema: { type: 'object', properties: {}, required: [] },
          },
          handler: async () => ({ content: [{ type: 'text', text: 'content' }] }),
          category: ToolCategory.CONTENT,
        },
        {
          definition: {
            name: 'workflow_tool',
            description: 'Workflow tool',
            inputSchema: { type: 'object', properties: {}, required: [] },
          },
          handler: async () => ({ content: [{ type: 'text', text: 'workflow' }] }),
          category: ToolCategory.WORKFLOWS,
          featureFlag: 'WORKFLOWS_ENABLED',
        },
      ];

      tools.forEach((t) => registry.register(t));

      const stats = registry.getStats();

      expect(stats.totalTools).toBe(3);
      expect(stats.enabledTools).toBe(2);
      expect(stats.disabledTools).toBe(1);
      expect(stats.byCategory[ToolCategory.CORE]).toBe(1);
      expect(stats.byCategory[ToolCategory.CONTENT]).toBe(1);
      expect(stats.byCategory[ToolCategory.WORKFLOWS]).toBe(1);
    });
  });
});
