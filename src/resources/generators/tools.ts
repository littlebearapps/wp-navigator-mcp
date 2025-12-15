/**
 * Tools Overview Resource Generator
 *
 * Generates wpnav://tools/overview content with categorized tool list.
 *
 * @package WP_Navigator_MCP
 * @since 2.6.0
 */

import { toolRegistry } from '../../tool-registry/index.js';
import { ToolCategory } from '../../tool-registry/types.js';
import type { ResourceContent, ResourceGeneratorContext } from '../types.js';

/**
 * Category display names and descriptions
 */
const CATEGORY_INFO: Record<ToolCategory, { name: string; description: string }> = {
  [ToolCategory.CORE]: {
    name: 'Core',
    description: 'Introspection, help, and site overview tools',
  },
  [ToolCategory.CONTENT]: {
    name: 'Content',
    description: 'Pages, posts, media, and comments management',
  },
  [ToolCategory.TAXONOMY]: {
    name: 'Taxonomy',
    description: 'Categories, tags, and custom taxonomies',
  },
  [ToolCategory.USERS]: {
    name: 'Users',
    description: 'User management and roles',
  },
  [ToolCategory.PLUGINS]: {
    name: 'Plugins',
    description: 'Plugin activation, deactivation, and management',
  },
  [ToolCategory.THEMES]: {
    name: 'Themes',
    description: 'Theme management and customization',
  },
  [ToolCategory.WORKFLOWS]: {
    name: 'Workflows',
    description: 'AI workflow automation tools',
  },
  [ToolCategory.COOKBOOK]: {
    name: 'Cookbook',
    description: 'Plugin-specific AI guidance and configuration',
  },
  [ToolCategory.ROLES]: {
    name: 'Roles',
    description: 'AI role personas and tool filtering',
  },
  [ToolCategory.BATCH]: {
    name: 'Batch',
    description: 'Multi-item operations for efficiency',
  },
};

/**
 * Generate tools overview content
 */
export async function generateToolsOverview(
  _context: ResourceGeneratorContext
): Promise<ResourceContent> {
  const allDefinitions = toolRegistry.getAllDefinitions();

  // Group tools by category
  const byCategory: Record<string, Array<{ name: string; description: string }>> = {};

  for (const category of Object.values(ToolCategory)) {
    const tools = toolRegistry.getByCategory(category);
    if (tools.length > 0) {
      byCategory[category] = tools.map((t) => ({
        name: t.definition.name,
        description: t.definition.description || 'No description',
      }));
    }
  }

  // Build markdown content
  const sections = Object.entries(byCategory)
    .map(([category, tools]) => {
      const info = CATEGORY_INFO[category as ToolCategory];
      return `### ${info?.name || category}

${info?.description || ''}

${tools.map((t) => `- **\`${t.name}\`**: ${t.description}`).join('\n')}
`;
    })
    .join('\n');

  const content = `# WP Navigator Tools Overview

## Summary

- **Total Tools**: ${allDefinitions.length}
- **Categories**: ${Object.keys(byCategory).length}

## Tool Naming Convention

- \`wpnav_list_*\` - List/browse resources with pagination
- \`wpnav_get_*\` - Get a specific resource by ID
- \`wpnav_create_*\` - Create new resources
- \`wpnav_update_*\` - Update existing resources
- \`wpnav_delete_*\` - Delete resources
- \`wpnav_*_plugin\` - Plugin management operations

## Quick Start

1. Call \`wpnav_introspect\` to understand API capabilities and permissions
2. Use \`wpnav_get_site_overview\` for a comprehensive site summary
3. Browse content with \`wpnav_list_*\` tools
4. Use \`wpnav_load_role\` to adopt a persona (e.g., content-editor)
5. Use \`wpnav_load_cookbook\` for plugin-specific guidance

## Categories

${sections}

## Write Operations

Write operations require \`WPNAV_ENABLE_WRITES=1\` to be set. Without this flag, all write operations will return an error with code \`WRITES_DISABLED\`.
`;

  return {
    uri: 'wpnav://tools/overview',
    mimeType: 'text/markdown',
    text: content,
  };
}
