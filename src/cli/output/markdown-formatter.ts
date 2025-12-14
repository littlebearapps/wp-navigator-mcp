/**
 * Markdown Formatter for CLI Output
 *
 * Generates markdown documentation for WP Navigator MCP tools.
 *
 * @package WP_Navigator_MCP
 * @since 2.3.0
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';

// =============================================================================
// Types
// =============================================================================

export interface ParameterInfo {
  name: string;
  type: string;
  required: boolean;
  description: string;
  enum?: string[];
  default?: unknown;
}

export interface ToolDocumentation {
  name: string;
  description: string;
  category: string;
  parameters: ParameterInfo[];
}

export interface FormatOptions {
  includeExamples?: boolean;
  includeTableOfContents?: boolean;
}

// =============================================================================
// Parameter Extraction
// =============================================================================

/**
 * Extract parameter information from a tool's inputSchema
 */
export function extractParameters(tool: Tool): ParameterInfo[] {
  const schema = tool.inputSchema as {
    type?: string;
    properties?: Record<
      string,
      {
        type?: string;
        description?: string;
        enum?: string[];
        default?: unknown;
      }
    >;
    required?: string[];
  };

  if (!schema || schema.type !== 'object' || !schema.properties) {
    return [];
  }

  const required = schema.required || [];
  const params: ParameterInfo[] = [];

  for (const [name, prop] of Object.entries(schema.properties)) {
    params.push({
      name,
      type: prop.type || 'unknown',
      required: required.includes(name),
      description: prop.description || '',
      enum: prop.enum,
      default: prop.default,
    });
  }

  // Sort: required params first, then alphabetically
  return params.sort((a, b) => {
    if (a.required !== b.required) {
      return a.required ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });
}

// =============================================================================
// Markdown Generation
// =============================================================================

/**
 * Escape pipe characters for markdown tables
 */
function escapeTableCell(text: string): string {
  return text.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

/**
 * Format a parameter type with enum values if present
 */
function formatType(param: ParameterInfo): string {
  let type = param.type;
  if (param.enum && param.enum.length > 0) {
    type = param.enum.map((v) => `"${v}"`).join(' \\| ');
  }
  return type;
}

/**
 * Format description with default value if present
 */
function formatDescription(param: ParameterInfo): string {
  let desc = param.description;
  if (param.default !== undefined) {
    const defaultStr =
      typeof param.default === 'string' ? `"${param.default}"` : String(param.default);
    desc += ` (default: ${defaultStr})`;
  }
  return escapeTableCell(desc);
}

/**
 * Generate a parameter table for a tool
 */
export function formatParameterTable(params: ParameterInfo[]): string {
  if (params.length === 0) {
    return '*No parameters*\n';
  }

  const lines: string[] = [
    '| Name | Type | Required | Description |',
    '|------|------|----------|-------------|',
  ];

  for (const param of params) {
    lines.push(
      `| ${param.name} | ${formatType(param)} | ${param.required ? 'Yes' : 'No'} | ${formatDescription(param)} |`
    );
  }

  return lines.join('\n') + '\n';
}

/**
 * Generate an example JSON for a tool
 */
export function generateExample(params: ParameterInfo[]): string {
  if (params.length === 0) {
    return '```json\n{}\n```\n';
  }

  const example: Record<string, unknown> = {};

  for (const param of params) {
    if (param.required) {
      // Always include required params
      example[param.name] = getExampleValue(param);
    } else if (params.filter((p) => p.required).length === 0) {
      // If no required params, show first 2 optional ones
      if (Object.keys(example).length < 2) {
        example[param.name] = getExampleValue(param);
      }
    }
  }

  return '```json\n' + JSON.stringify(example, null, 2) + '\n```\n';
}

/**
 * Get an example value for a parameter
 */
function getExampleValue(param: ParameterInfo): unknown {
  // Use default if available
  if (param.default !== undefined) {
    return param.default;
  }

  // Use first enum value if available
  if (param.enum && param.enum.length > 0) {
    return param.enum[0];
  }

  // Generate based on type
  switch (param.type) {
    case 'string':
      return `example_${param.name}`;
    case 'number':
    case 'integer':
      return 10;
    case 'boolean':
      return true;
    case 'array':
      return [];
    case 'object':
      return {};
    default:
      return null;
  }
}

/**
 * Format a category name for display
 */
function formatCategoryName(category: string): string {
  return category.charAt(0).toUpperCase() + category.slice(1) + ' Tools';
}

/**
 * Format a single tool as markdown
 */
export function formatToolMarkdown(tool: ToolDocumentation, options: FormatOptions = {}): string {
  const lines: string[] = [];

  // Tool heading
  lines.push(`### ${tool.name}\n`);

  // Description
  lines.push(`${tool.description}\n`);

  // Parameters section
  lines.push('**Parameters:**\n');
  lines.push(formatParameterTable(tool.parameters));

  // Example section (if requested and has parameters)
  if (options.includeExamples && tool.parameters.length > 0) {
    lines.push('**Example:**\n');
    lines.push(generateExample(tool.parameters));
  }

  return lines.join('\n');
}

/**
 * Format all tools as markdown documentation
 */
export function formatToolsAsMarkdown(
  toolsByCategory: Record<string, ToolDocumentation[]>,
  options: FormatOptions = {}
): string {
  const lines: string[] = [];

  // Title
  lines.push('# WP Navigator MCP Tools\n');

  // Table of contents (if requested)
  if (options.includeTableOfContents) {
    lines.push('## Table of Contents\n');
    for (const category of Object.keys(toolsByCategory).sort()) {
      const anchor = category.toLowerCase().replace(/\s+/g, '-');
      lines.push(`- [${formatCategoryName(category)}](#${anchor}-tools)`);
    }
    lines.push('');
  }

  // Tools by category
  const sortedCategories = Object.keys(toolsByCategory).sort();
  for (const category of sortedCategories) {
    const tools = toolsByCategory[category];

    // Category heading
    lines.push(`## ${formatCategoryName(category)}\n`);

    // Sort tools alphabetically within category
    const sortedTools = [...tools].sort((a, b) => a.name.localeCompare(b.name));

    for (const tool of sortedTools) {
      lines.push(formatToolMarkdown(tool, options));
      lines.push('---\n');
    }
  }

  return lines.join('\n');
}

// =============================================================================
// Conversion Helper
// =============================================================================

/**
 * Convert a Tool from the registry to ToolDocumentation
 */
export function toolToDocumentation(tool: Tool, category: string): ToolDocumentation {
  return {
    name: tool.name,
    description: tool.description || '',
    category,
    parameters: extractParameters(tool),
  };
}
