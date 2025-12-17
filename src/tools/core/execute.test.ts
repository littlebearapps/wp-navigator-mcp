/**
 * Execute Tool Meta-Tool Tests
 *
 * Tests for wpnav_execute - dynamic tool execution functionality.
 *
 * @package WP_Navigator_MCP
 * @since 2.7.0
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { executeToolHandler, executeToolDefinition } from './execute.js';
import { toolRegistry, ToolCategory } from '../../tool-registry/index.js';

// Mock context
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
  // Register a simple read-only tool
  toolRegistry.register({
    definition: {
      name: 'wpnav_test_readonly',
      description: 'Test read-only tool',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'number', description: 'ID parameter' },
        },
        required: ['id'],
      },
    },
    handler: async (args) => ({
      content: [{ type: 'text', text: JSON.stringify({ success: true, id: args.id }) }],
    }),
    category: ToolCategory.CONTENT,
  });

  // Register a tool that returns specific data
  toolRegistry.register({
    definition: {
      name: 'wpnav_test_echo',
      description: 'Test tool that echoes input',
      inputSchema: {
        type: 'object',
        properties: {
          message: { type: 'string', description: 'Message to echo' },
        },
        required: ['message'],
      },
    },
    handler: async (args) => ({
      content: [{ type: 'text', text: JSON.stringify({ echo: args.message }) }],
    }),
    category: ToolCategory.CORE,
  });

  // Register a tool that throws an error
  toolRegistry.register({
    definition: {
      name: 'wpnav_test_error',
      description: 'Test tool that throws an error',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    handler: async () => {
      throw new Error('Simulated execution error');
    },
    category: ToolCategory.CORE,
  });

  // Register a tool that throws validation error
  toolRegistry.register({
    definition: {
      name: 'wpnav_test_validation_error',
      description: 'Test tool that throws validation error',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
        required: ['name'],
      },
    },
    handler: async () => {
      throw new Error('name is required');
    },
    category: ToolCategory.CONTENT,
  });

  // Register a tool that throws writes disabled error
  toolRegistry.register({
    definition: {
      name: 'wpnav_test_write_error',
      description: 'Test tool that throws writes disabled error',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    handler: async () => {
      throw new Error('WRITES_DISABLED: write operations are not enabled');
    },
    category: ToolCategory.CONTENT,
  });
}

describe('executeToolDefinition', () => {
  it('has correct name', () => {
    expect(executeToolDefinition.name).toBe('wpnav_execute');
  });

  it('has description mentioning execution', () => {
    expect(executeToolDefinition.description).toContain('Execute');
  });

  it('has inputSchema with tool and arguments properties', () => {
    const props = executeToolDefinition.inputSchema.properties;
    expect(props).toHaveProperty('tool');
    expect(props).toHaveProperty('arguments');
    expect(props.tool.type).toBe('string');
    expect(props.arguments.type).toBe('object');
  });

  it('requires tool and arguments parameters', () => {
    expect(executeToolDefinition.inputSchema.required).toContain('tool');
    expect(executeToolDefinition.inputSchema.required).toContain('arguments');
  });
});

describe('executeToolHandler', () => {
  beforeEach(() => {
    registerTestTools();
  });

  describe('input validation', () => {
    it('returns INVALID_INPUT when tool is not provided', async () => {
      const result = await executeToolHandler({ tool: '', arguments: {} }, mockContext);
      const response = parseResponse(result);

      expect(response.error).toBe('INVALID_INPUT');
      expect(response.message).toContain('tool');
    });

    it('returns INVALID_INPUT when tool is not a string', async () => {
      const result = await executeToolHandler({ tool: 123 as any, arguments: {} }, mockContext);
      const response = parseResponse(result);

      expect(response.error).toBe('INVALID_INPUT');
    });

    it('returns INVALID_INPUT when arguments is null', async () => {
      const result = await executeToolHandler(
        { tool: 'wpnav_test_readonly', arguments: null as any },
        mockContext
      );
      const response = parseResponse(result);

      expect(response.error).toBe('INVALID_INPUT');
      expect(response.message).toContain('object');
    });

    it('returns INVALID_INPUT when arguments is an array', async () => {
      const result = await executeToolHandler(
        { tool: 'wpnav_test_readonly', arguments: [] as any },
        mockContext
      );
      const response = parseResponse(result);

      expect(response.error).toBe('INVALID_INPUT');
    });
  });

  describe('tool not found', () => {
    it('returns TOOL_NOT_FOUND for non-existent tool', async () => {
      const result = await executeToolHandler(
        { tool: 'wpnav_nonexistent_tool', arguments: {} },
        mockContext
      );
      const response = parseResponse(result);

      expect(response.error).toBe('TOOL_NOT_FOUND');
      expect(response.message).toContain('wpnav_nonexistent_tool');
    });

    it('includes available_categories hint for TOOL_NOT_FOUND', async () => {
      const result = await executeToolHandler(
        { tool: 'wpnav_fake_tool', arguments: {} },
        mockContext
      );
      const response = parseResponse(result);

      expect(response.available_categories).toBeDefined();
      expect(Array.isArray(response.available_categories)).toBe(true);
    });

    it('includes hint to use wpnav_search_tools', async () => {
      const result = await executeToolHandler(
        { tool: 'wpnav_missing', arguments: {} },
        mockContext
      );
      const response = parseResponse(result);

      expect(response.hint).toContain('wpnav_search_tools');
    });
  });

  describe('successful execution', () => {
    it('executes valid tool with correct arguments', async () => {
      const result = await executeToolHandler(
        { tool: 'wpnav_test_readonly', arguments: { id: 42 } },
        mockContext
      );
      const response = parseResponse(result);

      expect(response.success).toBe(true);
      expect(response.id).toBe(42);
    });

    it('passes arguments correctly to tool handler', async () => {
      const result = await executeToolHandler(
        { tool: 'wpnav_test_echo', arguments: { message: 'Hello World' } },
        mockContext
      );
      const response = parseResponse(result);

      expect(response.echo).toBe('Hello World');
    });

    it('returns tool result unchanged', async () => {
      const result = await executeToolHandler(
        { tool: 'wpnav_test_echo', arguments: { message: 'test' } },
        mockContext
      );

      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
    });
  });

  describe('error handling', () => {
    it('returns EXECUTION_FAILED for general errors', async () => {
      const result = await executeToolHandler(
        { tool: 'wpnav_test_error', arguments: {} },
        mockContext
      );
      const response = parseResponse(result);

      expect(response.error).toBe('EXECUTION_FAILED');
      expect(response.message).toContain('Simulated execution error');
      expect(response.tool).toBe('wpnav_test_error');
    });

    it('returns VALIDATION_FAILED for validation errors', async () => {
      const result = await executeToolHandler(
        { tool: 'wpnav_test_validation_error', arguments: {} },
        mockContext
      );
      const response = parseResponse(result);

      expect(response.error).toBe('VALIDATION_FAILED');
      expect(response.message).toContain('required');
      expect(response.hint).toContain('wpnav_describe_tools');
    });

    it('returns WRITES_DISABLED for write operation errors', async () => {
      const result = await executeToolHandler(
        { tool: 'wpnav_test_write_error', arguments: {} },
        mockContext
      );
      const response = parseResponse(result);

      expect(response.error).toBe('WRITES_DISABLED');
      expect(response.message).toContain('WPNAV_ENABLE_WRITES');
    });
  });

  describe('tool disabled handling', () => {
    it('returns TOOL_DISABLED when tool is disabled', async () => {
      // Mock isEnabled to return false
      const spy = vi.spyOn(toolRegistry, 'isEnabled').mockReturnValue(false);

      const result = await executeToolHandler(
        { tool: 'wpnav_test_readonly', arguments: { id: 1 } },
        mockContext
      );
      const response = parseResponse(result);

      expect(response.error).toBe('TOOL_DISABLED');
      expect(response.message).toContain('wpnav_test_readonly');
      expect(response.hint).toContain('focus mode');

      spy.mockRestore();
    });

    it('returns TOOL_DISABLED with feature flag reason when tool has featureFlag', async () => {
      // Register a tool with a featureFlag
      toolRegistry.register({
        definition: {
          name: 'wpnav_test_feature_flag_tool',
          description: 'Test tool with feature flag',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        handler: async () => ({
          content: [{ type: 'text', text: JSON.stringify({ success: true }) }],
        }),
        category: ToolCategory.CORE,
        featureFlag: 'experimental_gutenberg_v2',
      });

      // Mock isEnabled to return false (simulating feature flag not enabled)
      const spy = vi.spyOn(toolRegistry, 'isEnabled').mockReturnValue(false);

      const result = await executeToolHandler(
        { tool: 'wpnav_test_feature_flag_tool', arguments: {} },
        mockContext
      );
      const response = parseResponse(result);

      expect(response.error).toBe('TOOL_DISABLED');
      expect(response.message).toContain('feature flag');
      expect(response.message).toContain('experimental_gutenberg_v2');

      spy.mockRestore();
    });
  });
});

describe('integration with tool registry', () => {
  beforeEach(() => {
    registerTestTools();
  });

  it('uses toolRegistry.getTool to check tool existence', async () => {
    const spy = vi.spyOn(toolRegistry, 'getTool');

    await executeToolHandler({ tool: 'wpnav_test_readonly', arguments: { id: 1 } }, mockContext);

    expect(spy).toHaveBeenCalledWith('wpnav_test_readonly');
    spy.mockRestore();
  });

  it('uses toolRegistry.isEnabled to check tool availability', async () => {
    const spy = vi.spyOn(toolRegistry, 'isEnabled');

    await executeToolHandler({ tool: 'wpnav_test_readonly', arguments: { id: 1 } }, mockContext);

    expect(spy).toHaveBeenCalledWith('wpnav_test_readonly');
    spy.mockRestore();
  });

  it('uses toolRegistry.execute to run the tool', async () => {
    const spy = vi.spyOn(toolRegistry, 'execute');

    await executeToolHandler(
      { tool: 'wpnav_test_echo', arguments: { message: 'test' } },
      mockContext
    );

    expect(spy).toHaveBeenCalledWith('wpnav_test_echo', { message: 'test' }, mockContext);
    spy.mockRestore();
  });

  it('works with real registered tool (introspect)', async () => {
    // wpnav_introspect should be registered
    const tool = toolRegistry.getTool('wpnav_introspect');
    if (tool) {
      // Just verify we can look it up, actual execution needs WordPress
      expect(tool.definition.name).toBe('wpnav_introspect');
    }
  });
});
