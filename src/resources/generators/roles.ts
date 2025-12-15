/**
 * Roles Resource Generator
 *
 * Generates wpnav://roles/* content using existing role loaders.
 *
 * @package WP_Navigator_MCP
 * @since 2.6.0
 */

import { discoverRoles, getRole } from '../../roles/loader.js';
import type { ResourceContent, ResourceGeneratorContext } from '../types.js';

/**
 * List all role URIs for dynamic resource listing
 */
export function listRoleUris(): string[] {
  const { roles } = discoverRoles();
  return Array.from(roles.keys())
    .filter((slug) => slug !== 'list') // Exclude 'list' as it's a static resource
    .map((slug) => `wpnav://roles/${slug}`);
}

/**
 * Get role resource metadata for listing
 */
export function getRoleResourceMeta(slug: string): { name: string; description: string } | null {
  const role = getRole(slug);
  if (!role) return null;

  return {
    name: `Role: ${role.name}`,
    description: role.description || `AI role persona: ${role.name}`,
  };
}

/**
 * Generate roles list content
 */
export async function generateRolesList(
  _context: ResourceGeneratorContext
): Promise<ResourceContent> {
  const { roles, sources } = discoverRoles();

  const roleList = Array.from(roles.entries()).map(([slug, role]) => ({
    slug,
    name: role.name,
    description: role.description,
    source: role.source,
    focus_areas: role.focus_areas || [],
    tags: role.tags || [],
    has_tool_restrictions:
      (role.tools?.allowed && role.tools.allowed.length > 0) ||
      (role.tools?.denied && role.tools.denied.length > 0),
  }));

  const content = `# Available Roles

## Summary

- **Total Roles**: ${roleList.length}
- **Bundled**: ${sources.bundled.length}
- **Global**: ${sources.global.length}
- **Project**: ${sources.project.length}

## What Are Roles?

Roles are AI personas that provide:
- **Context**: System prompt guidance for the AI
- **Focus Areas**: Specific topics to prioritize
- **Avoidance**: Things to skip or de-prioritize
- **Tool Access**: Optional allowed/denied tool lists

## Available Roles

${roleList
  .map(
    (r) => `
### ${r.name}

- **Slug**: \`${r.slug}\`
- **Source**: ${r.source}
- **Description**: ${r.description}
${r.focus_areas.length > 0 ? `- **Focus Areas**: ${r.focus_areas.join(', ')}` : ''}
${r.tags.length > 0 ? `- **Tags**: ${r.tags.join(', ')}` : ''}
${r.has_tool_restrictions ? '- **Tool Restrictions**: Yes (see full role for details)' : ''}

**Load**: \`wpnav://roles/${r.slug}\`
`
  )
  .join('\n')}

## Usage

### Via MCP Resource

Read a specific role resource to get the full definition:
\`\`\`
wpnav://roles/content-editor
wpnav://roles/seo-specialist
\`\`\`

### Via Tool

Use the \`wpnav_load_role\` tool:
\`\`\`json
{
  "tool": "wpnav_load_role",
  "arguments": { "name": "content-editor" }
}
\`\`\`

## Creating Custom Roles

Place role files in:
- **Project**: \`./roles/my-role.yaml\`
- **Global**: \`~/.wpnav/roles/my-role.yaml\`

Project roles override bundled roles with the same name.
`;

  return {
    uri: 'wpnav://roles/list',
    mimeType: 'text/markdown',
    text: content,
  };
}

/**
 * Generate specific role content
 */
export async function generateRoleContent(
  uri: string,
  _context: ResourceGeneratorContext
): Promise<ResourceContent | null> {
  const slug = uri.replace('wpnav://roles/', '');

  // Handle list separately
  if (slug === 'list') {
    return generateRolesList(_context);
  }

  const role = getRole(slug);
  if (!role) return null;

  const content = `# Role: ${role.name}

## Description

${role.description}

## Context

\`\`\`
${role.context}
\`\`\`

## Focus Areas

${(role.focus_areas || []).map((area) => `- ${area}`).join('\n') || 'None specified'}

## Things to Avoid

${(role.avoid || []).map((item) => `- ${item}`).join('\n') || 'None specified'}

## Tool Access

### Allowed Tools

${
  role.tools?.allowed && role.tools.allowed.length > 0
    ? role.tools.allowed.map((t) => `- \`${t}\``).join('\n')
    : 'All tools allowed (no restrictions)'
}

### Denied Tools

${
  role.tools?.denied && role.tools.denied.length > 0
    ? role.tools.denied.map((t) => `- \`${t}\``).join('\n')
    : 'None denied'
}

## Metadata

- **Source**: ${role.source}
- **Source Path**: \`${role.sourcePath}\`
- **Schema Version**: ${role.schema_version || 1}
${role.author ? `- **Author**: ${role.author}` : ''}
${role.version ? `- **Version**: ${role.version}` : ''}
${role.priority !== undefined ? `- **Priority**: ${role.priority}` : ''}
${role.tags?.length ? `- **Tags**: ${role.tags.join(', ')}` : ''}

## Usage

Apply this role to focus AI assistance on ${role.name.toLowerCase()} tasks.

The context above will be provided to the AI to guide its behavior, and tool access may be restricted based on the allowed/denied lists.
`;

  return {
    uri,
    mimeType: 'text/markdown',
    text: content,
  };
}
