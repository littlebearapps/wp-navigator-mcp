/**
 * Markdown Formatter Tests
 *
 * @package WP_Navigator_MCP
 * @since 2.3.0
 */

import { describe, it, expect } from 'vitest';
import {
  extractParameters,
  formatParameterTable,
  generateExample,
  formatToolMarkdown,
  formatToolsAsMarkdown,
  toolToDocumentation,
  type ToolDocumentation,
} from './markdown-formatter.js';
import { Tool } from '@modelcontextprotocol/sdk/types.js';

describe('markdown-formatter', () => {
  describe('extractParameters', () => {
    it('extracts parameters from inputSchema', () => {
      const tool: Tool = {
        name: 'wpnav_test_tool',
        description: 'Test tool',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'number', description: 'The post ID' },
            title: { type: 'string', description: 'The post title' },
            status: {
              type: 'string',
              description: 'Post status',
              enum: ['draft', 'publish', 'private'],
            },
          },
          required: ['id'],
        },
      };

      const params = extractParameters(tool);

      expect(params).toHaveLength(3);
      // Required params first
      expect(params[0].name).toBe('id');
      expect(params[0].required).toBe(true);
      expect(params[0].type).toBe('number');

      // Then alphabetically
      expect(params[1].name).toBe('status');
      expect(params[1].required).toBe(false);
      expect(params[1].enum).toEqual(['draft', 'publish', 'private']);

      expect(params[2].name).toBe('title');
      expect(params[2].required).toBe(false);
    });

    it('returns empty array for tool with no properties', () => {
      const tool: Tool = {
        name: 'wpnav_no_params',
        description: 'No params tool',
        inputSchema: {
          type: 'object',
          properties: {},
          required: [],
        },
      };

      const params = extractParameters(tool);
      expect(params).toHaveLength(0);
    });

    it('handles missing required array', () => {
      const tool: Tool = {
        name: 'wpnav_test',
        description: 'Test',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Name' },
          },
        },
      };

      const params = extractParameters(tool);
      expect(params).toHaveLength(1);
      expect(params[0].required).toBe(false);
    });
  });

  describe('formatParameterTable', () => {
    it('formats parameters as markdown table', () => {
      const params = [
        { name: 'id', type: 'number', required: true, description: 'Post ID' },
        { name: 'title', type: 'string', required: false, description: 'Post title' },
      ];

      const table = formatParameterTable(params);

      expect(table).toContain('| Name | Type | Required | Description |');
      expect(table).toContain('| id | number | Yes | Post ID |');
      expect(table).toContain('| title | string | No | Post title |');
    });

    it('returns "No parameters" for empty params', () => {
      const table = formatParameterTable([]);
      expect(table).toContain('*No parameters*');
    });

    it('formats enum types correctly', () => {
      const params = [
        {
          name: 'status',
          type: 'string',
          required: false,
          description: 'Status',
          enum: ['draft', 'publish'],
        },
      ];

      const table = formatParameterTable(params);
      expect(table).toContain('"draft" \\| "publish"');
    });

    it('includes default values in description', () => {
      const params = [
        {
          name: 'limit',
          type: 'number',
          required: false,
          description: 'Max items',
          default: 10,
        },
      ];

      const table = formatParameterTable(params);
      expect(table).toContain('(default: 10)');
    });

    it('escapes pipe characters in descriptions', () => {
      const params = [
        {
          name: 'test',
          type: 'string',
          required: false,
          description: 'Use | or other chars',
        },
      ];

      const table = formatParameterTable(params);
      expect(table).toContain('Use \\| or other chars');
    });
  });

  describe('generateExample', () => {
    it('generates JSON example for required params', () => {
      const params = [
        { name: 'id', type: 'number', required: true, description: 'Post ID' },
        { name: 'title', type: 'string', required: false, description: 'Title' },
      ];

      const example = generateExample(params);

      expect(example).toContain('```json');
      expect(example).toContain('"id"');
      expect(example).not.toContain('"title"'); // Optional, not included
    });

    it('uses default values in examples', () => {
      const params = [
        { name: 'limit', type: 'number', required: true, description: 'Limit', default: 10 },
      ];

      const example = generateExample(params);
      expect(example).toContain('"limit": 10');
    });

    it('uses first enum value in examples', () => {
      const params = [
        {
          name: 'status',
          type: 'string',
          required: true,
          description: 'Status',
          enum: ['publish', 'draft'],
        },
      ];

      const example = generateExample(params);
      expect(example).toContain('"status": "publish"');
    });

    it('returns empty object for no params', () => {
      const example = generateExample([]);
      expect(example).toContain('{}');
    });

    it('includes some optional params when no required params', () => {
      const params = [
        { name: 'limit', type: 'number', required: false, description: 'Limit' },
        { name: 'page', type: 'number', required: false, description: 'Page' },
        { name: 'status', type: 'string', required: false, description: 'Status' },
      ];

      const example = generateExample(params);
      // Should include first 2 optional params
      expect(example).toContain('"limit"');
      expect(example).toContain('"page"');
      expect(example).not.toContain('"status"');
    });
  });

  describe('formatToolMarkdown', () => {
    it('formats a tool as markdown', () => {
      const tool: ToolDocumentation = {
        name: 'wpnav_list_posts',
        description: 'List WordPress posts',
        category: 'content',
        parameters: [{ name: 'limit', type: 'number', required: false, description: 'Max posts' }],
      };

      const markdown = formatToolMarkdown(tool);

      expect(markdown).toContain('### wpnav_list_posts');
      expect(markdown).toContain('List WordPress posts');
      expect(markdown).toContain('**Parameters:**');
      expect(markdown).toContain('| limit |');
    });

    it('includes examples when requested', () => {
      const tool: ToolDocumentation = {
        name: 'wpnav_test',
        description: 'Test',
        category: 'core',
        parameters: [{ name: 'id', type: 'number', required: true, description: 'ID' }],
      };

      const markdown = formatToolMarkdown(tool, { includeExamples: true });

      expect(markdown).toContain('**Example:**');
      expect(markdown).toContain('```json');
    });

    it('excludes examples by default', () => {
      const tool: ToolDocumentation = {
        name: 'wpnav_test',
        description: 'Test',
        category: 'core',
        parameters: [{ name: 'id', type: 'number', required: true, description: 'ID' }],
      };

      const markdown = formatToolMarkdown(tool);

      expect(markdown).not.toContain('**Example:**');
    });
  });

  describe('formatToolsAsMarkdown', () => {
    it('formats tools grouped by category', () => {
      const toolsByCategory: Record<string, ToolDocumentation[]> = {
        content: [
          {
            name: 'wpnav_list_posts',
            description: 'List posts',
            category: 'content',
            parameters: [],
          },
        ],
        core: [
          {
            name: 'wpnav_introspect',
            description: 'Get capabilities',
            category: 'core',
            parameters: [],
          },
        ],
      };

      const markdown = formatToolsAsMarkdown(toolsByCategory);

      expect(markdown).toContain('# WP Navigator MCP Tools');
      expect(markdown).toContain('## Content Tools');
      expect(markdown).toContain('## Core Tools');
      expect(markdown).toContain('### wpnav_list_posts');
      expect(markdown).toContain('### wpnav_introspect');
    });

    it('sorts categories alphabetically', () => {
      const toolsByCategory: Record<string, ToolDocumentation[]> = {
        users: [
          { name: 'wpnav_list_users', description: 'Users', category: 'users', parameters: [] },
        ],
        content: [
          { name: 'wpnav_list_posts', description: 'Posts', category: 'content', parameters: [] },
        ],
      };

      const markdown = formatToolsAsMarkdown(toolsByCategory);

      const contentIndex = markdown.indexOf('## Content Tools');
      const usersIndex = markdown.indexOf('## Users Tools');

      expect(contentIndex).toBeLessThan(usersIndex);
    });

    it('includes table of contents when requested', () => {
      const toolsByCategory: Record<string, ToolDocumentation[]> = {
        content: [
          { name: 'wpnav_list_posts', description: 'Posts', category: 'content', parameters: [] },
        ],
      };

      const markdown = formatToolsAsMarkdown(toolsByCategory, { includeTableOfContents: true });

      expect(markdown).toContain('## Table of Contents');
      expect(markdown).toContain('[Content Tools]');
    });
  });

  describe('toolToDocumentation', () => {
    it('converts Tool to ToolDocumentation', () => {
      const tool: Tool = {
        name: 'wpnav_test',
        description: 'Test tool',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'number', description: 'ID' },
          },
          required: ['id'],
        },
      };

      const doc = toolToDocumentation(tool, 'core');

      expect(doc.name).toBe('wpnav_test');
      expect(doc.description).toBe('Test tool');
      expect(doc.category).toBe('core');
      expect(doc.parameters).toHaveLength(1);
      expect(doc.parameters[0].name).toBe('id');
    });
  });
});
