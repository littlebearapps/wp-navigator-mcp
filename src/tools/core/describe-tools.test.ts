/**
 * Describe Tools Meta-Tool Tests
 *
 * Tests for wpnav_describe_tools - on-demand schema loading functionality.
 *
 * @package WP_Navigator_MCP
 * @since 2.7.0
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { describeToolsHandler, describeToolsDefinition } from './describe-tools.js';
import { toolRegistry, ToolCategory } from '../../tool-registry/index.js';

// Mock context (not used by describe tools but required by handler signature)
const mockContext = {
  wpRequest: async () => ({}),
  config: {} as any,
  logger: { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} },
  clampText: (text: string) => text,
};

/**
 * Helper to parse response text safely
 */
function parseResponse(result: { content: Array<{ type: string; text?: string }> }): any {
  const text = result.content[0]?.text;
  if (!text) throw new Error('No text in response');
  return JSON.parse(text);
}

// Register test tools for the tests
function registerTestTools() {
  // Clear and re-register for isolated tests
  toolRegistry.register({
    definition: {
      name: 'wpnav_test_tool_a',
      description: 'Test tool A for unit tests',
      inputSchema: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Title field' },
          count: { type: 'number', description: 'Count field' },
        },
        required: ['title'],
      },
    },
    handler: async () => ({ content: [{ type: 'text', text: '{}' }] }),
    category: ToolCategory.CONTENT,
  });

  toolRegistry.register({
    definition: {
      name: 'wpnav_test_tool_b',
      description: 'Test tool B for unit tests',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'number', description: 'ID field' },
        },
        required: ['id'],
      },
    },
    handler: async () => ({ content: [{ type: 'text', text: '{}' }] }),
    category: ToolCategory.PLUGINS,
  });

  toolRegistry.register({
    definition: {
      name: 'wpnav_test_tool_c',
      description: 'Test tool C for unit tests',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    handler: async () => ({ content: [{ type: 'text', text: '{}' }] }),
    category: ToolCategory.CORE,
  });
}

describe('describeToolsDefinition', () => {
  it('has correct name', () => {
    expect(describeToolsDefinition.name).toBe('wpnav_describe_tools');
  });

  it('has description mentioning schemas', () => {
    expect(describeToolsDefinition.description).toContain('schema');
  });

  it('has inputSchema with tools array property', () => {
    const props = describeToolsDefinition.inputSchema.properties;
    expect(props).toHaveProperty('tools');
    expect(props.tools.type).toBe('array');
    expect(props.tools.items.type).toBe('string');
  });

  it('has maxItems limit of 10', () => {
    expect(describeToolsDefinition.inputSchema.properties.tools.maxItems).toBe(10);
  });

  it('requires tools parameter', () => {
    expect(describeToolsDefinition.inputSchema.required).toContain('tools');
  });
});

describe('describeToolsHandler', () => {
  beforeEach(() => {
    registerTestTools();
  });

  describe('input validation', () => {
    it('returns error when tools is not an array', async () => {
      const result = await describeToolsHandler({ tools: 'not-array' as any }, mockContext);
      const response = parseResponse(result);

      expect(response.error).toBe('INVALID_INPUT');
      expect(response.message).toContain('array');
    });

    it('returns error when tools array is empty', async () => {
      const result = await describeToolsHandler({ tools: [] }, mockContext);
      const response = parseResponse(result);

      expect(response.error).toBe('INVALID_INPUT');
      expect(response.message).toContain('empty');
      expect(response.hint).toContain('wpnav_search_tools');
    });
  });

  describe('tool retrieval', () => {
    it('returns full schema for valid tool', async () => {
      const result = await describeToolsHandler({ tools: ['wpnav_test_tool_a'] }, mockContext);
      const response = parseResponse(result);

      expect(response.tools).toHaveLength(1);
      expect(response.tools[0].name).toBe('wpnav_test_tool_a');
      expect(response.tools[0].description).toBe('Test tool A for unit tests');
      expect(response.tools[0].inputSchema).toBeDefined();
      expect(response.tools[0].inputSchema.properties).toHaveProperty('title');
      expect(response.tools[0].inputSchema.properties).toHaveProperty('count');
      expect(response.tools[0].inputSchema.required).toContain('title');
    });

    it('returns multiple tools when requested', async () => {
      const result = await describeToolsHandler(
        { tools: ['wpnav_test_tool_a', 'wpnav_test_tool_b'] },
        mockContext
      );
      const response = parseResponse(result);

      expect(response.tools).toHaveLength(2);
      expect(response.tools.map((t: any) => t.name)).toContain('wpnav_test_tool_a');
      expect(response.tools.map((t: any) => t.name)).toContain('wpnav_test_tool_b');
    });

    it('includes category in response', async () => {
      const result = await describeToolsHandler({ tools: ['wpnav_test_tool_a'] }, mockContext);
      const response = parseResponse(result);

      expect(response.tools[0].category).toBe('content');
    });

    it('returns correct category for each tool', async () => {
      const result = await describeToolsHandler(
        { tools: ['wpnav_test_tool_a', 'wpnav_test_tool_b', 'wpnav_test_tool_c'] },
        mockContext
      );
      const response = parseResponse(result);

      const toolA = response.tools.find((t: any) => t.name === 'wpnav_test_tool_a');
      const toolB = response.tools.find((t: any) => t.name === 'wpnav_test_tool_b');
      const toolC = response.tools.find((t: any) => t.name === 'wpnav_test_tool_c');

      expect(toolA.category).toBe('content');
      expect(toolB.category).toBe('plugins');
      expect(toolC.category).toBe('core');
    });
  });

  describe('not found handling', () => {
    it('returns not_found array for invalid tool names', async () => {
      const result = await describeToolsHandler({ tools: ['wpnav_nonexistent_tool'] }, mockContext);
      const response = parseResponse(result);

      expect(response.tools).toHaveLength(0);
      expect(response.not_found).toContain('wpnav_nonexistent_tool');
    });

    it('returns both found and not_found tools', async () => {
      const result = await describeToolsHandler(
        { tools: ['wpnav_test_tool_a', 'wpnav_nonexistent', 'wpnav_test_tool_b'] },
        mockContext
      );
      const response = parseResponse(result);

      expect(response.tools).toHaveLength(2);
      expect(response.not_found).toHaveLength(1);
      expect(response.not_found).toContain('wpnav_nonexistent');
    });

    it('preserves order of not_found tools', async () => {
      const result = await describeToolsHandler(
        { tools: ['wpnav_fake1', 'wpnav_fake2', 'wpnav_fake3'] },
        mockContext
      );
      const response = parseResponse(result);

      expect(response.not_found).toEqual(['wpnav_fake1', 'wpnav_fake2', 'wpnav_fake3']);
    });
  });

  describe('max items limit', () => {
    it('truncates to 10 tools when more are requested', async () => {
      const tools = Array.from({ length: 15 }, (_, i) => `wpnav_tool_${i}`);
      const result = await describeToolsHandler({ tools }, mockContext);
      const response = parseResponse(result);

      // All 10 should be in not_found since they don't exist
      expect(response.not_found.length).toBeLessThanOrEqual(10);
      expect(response.warning).toContain('15 tools');
    });

    it('adds warning when truncated', async () => {
      const tools = Array.from({ length: 12 }, (_, i) => `wpnav_tool_${i}`);
      const result = await describeToolsHandler({ tools }, mockContext);
      const response = parseResponse(result);

      expect(response.warning).toBeDefined();
      expect(response.warning).toContain('Only first 10');
    });

    it('does not add warning when under limit', async () => {
      const result = await describeToolsHandler(
        { tools: ['wpnav_test_tool_a', 'wpnav_test_tool_b'] },
        mockContext
      );
      const response = parseResponse(result);

      expect(response.warning).toBeUndefined();
    });
  });

  describe('response format', () => {
    it('returns valid JSON response', async () => {
      const result = await describeToolsHandler({ tools: ['wpnav_test_tool_a'] }, mockContext);

      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
      expect(() => parseResponse(result)).not.toThrow();
    });

    it('response has tools and not_found arrays', async () => {
      const result = await describeToolsHandler({ tools: ['wpnav_test_tool_a'] }, mockContext);
      const response = parseResponse(result);

      expect(response).toHaveProperty('tools');
      expect(response).toHaveProperty('not_found');
      expect(Array.isArray(response.tools)).toBe(true);
      expect(Array.isArray(response.not_found)).toBe(true);
    });

    it('tool objects have required fields', async () => {
      const result = await describeToolsHandler({ tools: ['wpnav_test_tool_a'] }, mockContext);
      const response = parseResponse(result);

      const tool = response.tools[0];
      expect(tool).toHaveProperty('name');
      expect(tool).toHaveProperty('description');
      expect(tool).toHaveProperty('inputSchema');
      expect(tool).toHaveProperty('category');
    });
  });

  describe('schema accuracy', () => {
    it('returns exact inputSchema from registry', async () => {
      const result = await describeToolsHandler({ tools: ['wpnav_test_tool_a'] }, mockContext);
      const response = parseResponse(result);

      const registeredTool = toolRegistry.getTool('wpnav_test_tool_a');
      expect(response.tools[0].inputSchema).toEqual(registeredTool?.definition.inputSchema);
    });

    it('preserves required fields in schema', async () => {
      const result = await describeToolsHandler({ tools: ['wpnav_test_tool_b'] }, mockContext);
      const response = parseResponse(result);

      expect(response.tools[0].inputSchema.required).toEqual(['id']);
    });

    it('preserves property descriptions in schema', async () => {
      const result = await describeToolsHandler({ tools: ['wpnav_test_tool_a'] }, mockContext);
      const response = parseResponse(result);

      expect(response.tools[0].inputSchema.properties.title.description).toBe('Title field');
    });
  });
});

describe('integration with tool registry', () => {
  beforeEach(() => {
    registerTestTools();
  });

  it('uses toolRegistry.getTool to fetch tools', async () => {
    const spy = vi.spyOn(toolRegistry, 'getTool');

    await describeToolsHandler({ tools: ['wpnav_test_tool_a'] }, mockContext);

    expect(spy).toHaveBeenCalledWith('wpnav_test_tool_a');
    spy.mockRestore();
  });

  it('works with real registered tools (introspect)', async () => {
    // wpnav_introspect should be registered in production
    const tool = toolRegistry.getTool('wpnav_introspect');
    if (tool) {
      const result = await describeToolsHandler({ tools: ['wpnav_introspect'] }, mockContext);
      const response = parseResponse(result);

      expect(response.tools).toHaveLength(1);
      expect(response.tools[0].name).toBe('wpnav_introspect');
      expect(response.tools[0].category).toBe('core');
    }
  });
});
