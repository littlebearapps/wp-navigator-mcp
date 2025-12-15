/**
 * Guides Resource Generator
 *
 * Generates wpnav://guides/* content with how-to guides.
 *
 * @package WP_Navigator_MCP
 * @since 2.6.0
 */

import type { ResourceContent, ResourceGeneratorContext } from '../types.js';

/**
 * Available guide names
 */
export const AVAILABLE_GUIDES = ['gutenberg', 'workflows'] as const;
export type GuideName = (typeof AVAILABLE_GUIDES)[number];

/**
 * Gutenberg guide content
 */
const GUTENBERG_GUIDE = `# Gutenberg Block Editor Guide

## Overview

The Gutenberg block editor is WordPress's default content editor. WP Navigator provides tools for programmatic block manipulation.

## Available Tools

- \`wpnav_gutenberg_get_blocks\` - Get blocks from a page/post
- \`wpnav_gutenberg_update_blocks\` - Update all blocks on a page/post
- \`wpnav_gutenberg_insert_block\` - Insert a new block at a position
- \`wpnav_gutenberg_remove_block\` - Remove a block by client ID
- \`wpnav_gutenberg_insert_pattern\` - Insert a reusable block pattern

## Common Block Types

| Block Name | Description | Use Case |
|------------|-------------|----------|
| \`core/paragraph\` | Text content | Body text, descriptions |
| \`core/heading\` | H1-H6 headings | Section titles |
| \`core/image\` | Images | Photos, graphics |
| \`core/columns\` | Multi-column layouts | Side-by-side content |
| \`core/group\` | Container for blocks | Grouping, styling |
| \`core/buttons\` | Button containers | CTAs, navigation |
| \`core/list\` | Ordered/unordered lists | Features, steps |
| \`core/quote\` | Quotations | Testimonials, citations |
| \`core/cover\` | Image with overlay | Hero sections |
| \`core/media-text\` | Media + text side by side | Features with images |

## Workflow Example

### 1. Get Current Blocks

\`\`\`json
{
  "tool": "wpnav_gutenberg_get_blocks",
  "arguments": { "page_id": 123 }
}
\`\`\`

### 2. Analyze Structure

Review the block structure and plan your changes.

### 3. Insert New Content

\`\`\`json
{
  "tool": "wpnav_gutenberg_insert_block",
  "arguments": {
    "page_id": 123,
    "block_name": "core/paragraph",
    "attributes": { "content": "New paragraph text" },
    "position": 2
  }
}
\`\`\`

### 4. Verify Changes

Call \`wpnav_gutenberg_get_blocks\` again to verify.

## Block Patterns

Use \`wpnav_gutenberg_insert_pattern\` to insert pre-designed layouts:

\`\`\`json
{
  "tool": "wpnav_gutenberg_insert_pattern",
  "arguments": {
    "page_id": 123,
    "pattern_slug": "core/text-two-columns"
  }
}
\`\`\`

## Best Practices

1. **Always get current blocks first** - Understand existing structure
2. **Use block patterns** - Faster than building from scratch
3. **Preserve client IDs** - Don't regenerate IDs when updating
4. **Test on staging** - Verify changes before production
5. **Use the cookbook** - Load \`wpnav://cookbooks/gutenberg\` for detailed guidance

## Related Resources

- \`wpnav://cookbooks/gutenberg\` - Detailed Gutenberg cookbook
- \`wpnav://tools/overview\` - Full tool reference
`;

/**
 * Workflows guide content
 */
const WORKFLOWS_GUIDE = `# Common Workflows Guide

## Content Management Workflow

### 1. Audit Existing Content

\`\`\`
wpnav_list_pages          # List all pages
wpnav_list_posts          # List all posts
wpnav_snapshot_page       # Capture page structure
\`\`\`

### 2. Create New Content

\`\`\`
wpnav_create_page         # Create a new page
wpnav_create_post_with_blocks  # Create post with Gutenberg blocks
\`\`\`

### 3. Update Content

\`\`\`
wpnav_update_page         # Update page metadata
wpnav_gutenberg_update_blocks  # Update page blocks
\`\`\`

## Plugin Management Workflow

### 1. Assess Current State

\`\`\`
wpnav_list_plugins        # List all plugins with status
wpnav_match_cookbooks     # Find AI guidance for active plugins
\`\`\`

### 2. Load Plugin Guidance

\`\`\`
wpnav://cookbooks/{plugin-slug}  # Load cookbook resource
wpnav_load_cookbook              # Load via tool
\`\`\`

### 3. Manage Plugins

\`\`\`
wpnav_activate_plugin     # Activate a plugin
wpnav_deactivate_plugin   # Deactivate a plugin
\`\`\`

## Media Management Workflow

### 1. Browse Media

\`\`\`
wpnav_list_media          # List media items with filters
\`\`\`

### 2. Add Media

\`\`\`
wpnav_upload_media_from_url  # Upload from external URL
\`\`\`

### 3. Use in Content

Reference media by ID in block attributes.

## User Management Workflow

### 1. Review Users

\`\`\`
wpnav_list_users          # List users with roles
\`\`\`

### 2. Manage Users

\`\`\`
wpnav_update_user         # Update user details
\`\`\`

## Theme Management Workflow

### 1. Check Current Theme

\`\`\`
wpnav_list_themes         # List installed themes
wpnav://site/context      # See active theme info
\`\`\`

### 2. Manage Themes

\`\`\`
wpnav_activate_theme      # Switch active theme
wpnav_revert_theme        # Rollback to previous theme
\`\`\`

## Role-Based Workflows

### Content Editor Workflow

1. Load the role: \`wpnav://roles/content-editor\`
2. Focus on: pages, posts, media, comments
3. Avoid: plugin/theme management, user admin

### SEO Specialist Workflow

1. Load the role: \`wpnav://roles/seo-specialist\`
2. Focus on: content optimization, meta data
3. Avoid: structural changes, plugin config

### Site Admin Workflow

1. Load the role: \`wpnav://roles/site-admin\`
2. Full access to all tools
3. Focus on: plugins, themes, users, settings

## Safety Best Practices

1. **Start read-only** - Use list/get tools first
2. **Use dry-run** - CLI supports \`--dry-run\` for previews
3. **Snapshot before changes** - Use \`wpnav snapshot\` command
4. **Test on staging** - Verify workflows before production
5. **Enable writes explicitly** - \`WPNAV_ENABLE_WRITES=1\`

## Related Resources

- \`wpnav://tools/overview\` - Complete tool reference
- \`wpnav://roles/list\` - Available AI roles
- \`wpnav://cookbooks/list\` - Plugin cookbooks
`;

/**
 * Guide content map
 */
const GUIDES: Record<GuideName, string> = {
  gutenberg: GUTENBERG_GUIDE,
  workflows: WORKFLOWS_GUIDE,
};

/**
 * Generate guide content
 */
export async function generateGuide(
  uri: string,
  _context: ResourceGeneratorContext
): Promise<ResourceContent | null> {
  const guideName = uri.replace('wpnav://guides/', '') as GuideName;

  const content = GUIDES[guideName];
  if (!content) {
    return null;
  }

  return {
    uri,
    mimeType: 'text/markdown',
    text: content,
  };
}

/**
 * Get guide metadata for resource listing
 */
export function getGuideResourceMeta(
  guideName: string
): { name: string; description: string } | null {
  switch (guideName) {
    case 'gutenberg':
      return {
        name: 'Guide: Gutenberg',
        description: 'How to build pages with Gutenberg blocks',
      };
    case 'workflows':
      return {
        name: 'Guide: Workflows',
        description: 'Common workflow patterns for content, plugins, and users',
      };
    default:
      return null;
  }
}
