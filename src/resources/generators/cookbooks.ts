/**
 * Cookbooks Resource Generator
 *
 * Generates wpnav://cookbooks/* content using existing cookbook loaders.
 *
 * @package WP_Navigator_MCP
 * @since 2.6.0
 */

import { discoverCookbooks, getCookbook } from '../../cookbook/loader.js';
import type { LoadedSkillCookbook } from '../../cookbook/loader.js';
import type { ResourceContent, ResourceGeneratorContext } from '../types.js';

/**
 * List all cookbook URIs for dynamic resource listing
 */
export function listCookbookUris(): string[] {
  const { cookbooks } = discoverCookbooks();
  return Array.from(cookbooks.keys())
    .filter((slug) => slug !== 'list') // Exclude 'list' as it's a static resource
    .map((slug) => `wpnav://cookbooks/${slug}`);
}

/**
 * Get cookbook resource metadata for listing
 */
export function getCookbookResourceMeta(
  slug: string
): { name: string; description: string } | null {
  const cookbook = getCookbook(slug) as LoadedSkillCookbook | null;
  if (!cookbook) return null;

  return {
    name: `Cookbook: ${cookbook.plugin.name}`,
    description:
      cookbook.skillFrontmatter?.description || `AI guidance for ${cookbook.plugin.name} plugin`,
  };
}

/**
 * Generate cookbooks list content
 */
export async function generateCookbooksList(
  _context: ResourceGeneratorContext
): Promise<ResourceContent> {
  const { cookbooks, sources } = discoverCookbooks();

  const cookbookList = Array.from(cookbooks.entries()).map(([slug, cookbook]) => {
    const skillCookbook = cookbook as LoadedSkillCookbook;
    return {
      slug,
      name: cookbook.plugin.name,
      description: skillCookbook.skillFrontmatter?.description || null,
      version: cookbook.cookbook_version,
      source: cookbook.source,
      min_version: cookbook.plugin.min_version || null,
      max_version: cookbook.plugin.max_version || null,
      allowed_tools_count: skillCookbook.allowedTools?.length || 0,
    };
  });

  const content = `# Available Cookbooks

## Summary

- **Total Cookbooks**: ${cookbookList.length}
- **Bundled**: ${sources.bundled.length}
- **Project**: ${sources.project.length}

## What Are Cookbooks?

Cookbooks provide plugin-specific AI guidance including:
- **Plugin capabilities**: Settings, blocks, shortcodes, endpoints
- **Common tasks**: Step-by-step workflows for the plugin
- **Best practices**: Plugin-specific recommendations
- **Tool hints**: Which WP Navigator tools work best

## Available Cookbooks

${cookbookList
  .map(
    (c) => `
### ${c.name}

- **Slug**: \`${c.slug}\`
- **Version**: ${c.version}
- **Source**: ${c.source}
${c.description ? `- **Description**: ${c.description}` : ''}
${c.min_version ? `- **Min Plugin Version**: ${c.min_version}` : ''}
${c.max_version ? `- **Max Plugin Version**: ${c.max_version}` : ''}
${c.allowed_tools_count > 0 ? `- **Relevant Tools**: ${c.allowed_tools_count}` : ''}

**Load**: \`wpnav://cookbooks/${c.slug}\`
`
  )
  .join('\n')}

## Usage

### Via MCP Resource

Read a specific cookbook resource to get plugin guidance:
\`\`\`
wpnav://cookbooks/gutenberg
wpnav://cookbooks/elementor
\`\`\`

### Via Tool

Use the \`wpnav_load_cookbook\` tool:
\`\`\`json
{
  "tool": "wpnav_load_cookbook",
  "arguments": { "plugin_slug": "gutenberg" }
}
\`\`\`

### Match Active Plugins

Use \`wpnav_match_cookbooks\` to find cookbooks for your active plugins:
\`\`\`json
{
  "tool": "wpnav_match_cookbooks"
}
\`\`\`

## Creating Custom Cookbooks

Place cookbook files in:
- **Project**: \`./cookbooks/my-plugin.md\` (SKILL.md format)

Project cookbooks completely replace bundled cookbooks with the same slug.

### SKILL.md Format

\`\`\`markdown
---
name: my-plugin
version: "1.0.0"
min-plugin-version: "1.0"
description: AI guidance for My Plugin
allowed-tools:
  - wpnav_list_posts
  - wpnav_update_post
---

# My Plugin Cookbook

Your markdown guidance here...
\`\`\`
`;

  return {
    uri: 'wpnav://cookbooks/list',
    mimeType: 'text/markdown',
    text: content,
  };
}

/**
 * Generate specific cookbook content
 */
export async function generateCookbookContent(
  uri: string,
  _context: ResourceGeneratorContext
): Promise<ResourceContent | null> {
  const slug = uri.replace('wpnav://cookbooks/', '');

  // Handle list separately
  if (slug === 'list') {
    return generateCookbooksList(_context);
  }

  const cookbook = getCookbook(slug) as LoadedSkillCookbook | null;
  if (!cookbook) return null;

  // If SKILL.md body exists, return it with a header
  if (cookbook.skillBody) {
    const header = `# Cookbook: ${cookbook.plugin.name}

## Metadata

- **Plugin**: \`${cookbook.plugin.slug}\`
- **Version**: ${cookbook.cookbook_version}
- **Source**: ${cookbook.source}
${cookbook.plugin.min_version ? `- **Min Plugin Version**: ${cookbook.plugin.min_version}` : ''}
${cookbook.plugin.max_version ? `- **Max Plugin Version**: ${cookbook.plugin.max_version}` : ''}
${cookbook.allowedTools?.length ? `- **Allowed Tools**: ${cookbook.allowedTools.join(', ')}` : ''}

---

`;
    return {
      uri,
      mimeType: 'text/markdown',
      text: header + cookbook.skillBody,
    };
  }

  // Fallback for JSON/YAML cookbooks without skillBody
  const content = `# Cookbook: ${cookbook.plugin.name}

## Plugin Information

- **Slug**: \`${cookbook.plugin.slug}\`
- **Name**: ${cookbook.plugin.name}
- **Cookbook Version**: ${cookbook.cookbook_version}
- **Source**: ${cookbook.source}
${cookbook.plugin.min_version ? `- **Min Version**: ${cookbook.plugin.min_version}` : ''}
${cookbook.plugin.max_version ? `- **Max Version**: ${cookbook.plugin.max_version}` : ''}

## Capabilities

${formatCapabilities(cookbook.capabilities)}

## Common Tasks

${formatCommonTasks(cookbook.common_tasks)}

${cookbook.documentation_url ? `## Documentation\n\n[Official Documentation](${cookbook.documentation_url})` : ''}
`;

  return {
    uri,
    mimeType: 'text/markdown',
    text: content,
  };
}

/**
 * Format capabilities for display
 */
function formatCapabilities(capabilities: any): string {
  if (!capabilities || Object.keys(capabilities).length === 0) {
    return 'No structured capabilities defined.';
  }

  const sections: string[] = [];

  if (capabilities.blocks?.length) {
    sections.push(
      `### Blocks\n\n${capabilities.blocks.map((b: any) => `- \`${b.name || b}\``).join('\n')}`
    );
  }

  if (capabilities.shortcodes?.length) {
    sections.push(
      `### Shortcodes\n\n${capabilities.shortcodes.map((s: any) => `- \`${s.name || s}\``).join('\n')}`
    );
  }

  if (capabilities.settings_pages?.length) {
    sections.push(
      `### Settings Pages\n\n${capabilities.settings_pages.map((p: any) => `- ${p.title || p.menu_slug || p}`).join('\n')}`
    );
  }

  if (capabilities.rest_endpoints?.length) {
    sections.push(
      `### REST Endpoints\n\n${capabilities.rest_endpoints.map((e: any) => `- \`${e.path || e}\``).join('\n')}`
    );
  }

  return sections.length > 0 ? sections.join('\n\n') : 'No structured capabilities defined.';
}

/**
 * Format common tasks for display
 */
function formatCommonTasks(tasks: any[] | undefined): string {
  if (!tasks || tasks.length === 0) {
    return 'No common tasks defined.';
  }

  return tasks
    .map((task) => {
      const title = task.name || task.title || 'Task';
      const description = task.description || '';
      return `### ${title}\n\n${description}`;
    })
    .join('\n\n');
}
