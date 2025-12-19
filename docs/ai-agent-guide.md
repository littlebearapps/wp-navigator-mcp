# AI Agent Guide for WP Navigator MCP

**Version**: 2.7.0+
**Purpose**: Recommended workflow for AI agents using Dynamic Toolsets

---

## Overview

WP Navigator MCP uses a **Dynamic Toolsets** architecture that exposes only 5 meta-tools instead of 75+ individual tools. This reduces initial context from ~19,500 tokens to ~500 tokens (97% reduction).

### Meta-Tools

| Tool | Purpose | When to Use |
|------|---------|-------------|
| `wpnav_introspect` | Site discovery | First call - understand site capabilities |
| `wpnav_search_tools` | Find tools | When you need a capability |
| `wpnav_describe_tools` | Get schemas | Before calling unfamiliar tools |
| `wpnav_execute` | Run any tool | Execute discovered tools |
| `wpnav_context` | Context dump | For non-MCP agents (ChatGPT, etc.) |

---

## Recommended Workflow

### Step 1: Start with Introspect

Always begin by checking site capabilities and connection:

```json
{
  "name": "wpnav_introspect",
  "arguments": {}
}
```

This returns:
- Plugin edition (Free/Pro)
- Enabled capabilities
- Available roles and cookbooks
- Focus mode restrictions

### Step 2: Search for Tools

Use natural language or category filters to find relevant tools:

```json
// Natural language search
{
  "name": "wpnav_search_tools",
  "arguments": { "query": "create blog post with blocks" }
}

// Category filter
{
  "name": "wpnav_search_tools",
  "arguments": { "category": "content" }
}

// Combined
{
  "name": "wpnav_search_tools",
  "arguments": { "query": "upload", "category": "media" }
}
```

### Step 3: Describe Tools (When Needed)

Get full JSON Schema for tools you plan to use:

```json
{
  "name": "wpnav_describe_tools",
  "arguments": { "tools": ["wpnav_create_post_with_blocks"] }
}
```

**When to describe:**
- Using a tool for the first time
- Unsure about required parameters
- Complex tools with many options

**When to skip:**
- Simple tools with obvious parameters
- Tools you've used before in the session

### Step 4: Execute

Run the tool with validated arguments:

```json
{
  "name": "wpnav_execute",
  "arguments": {
    "tool": "wpnav_create_post_with_blocks",
    "args": {
      "title": "My Blog Post",
      "blocks": [
        { "blockName": "core/paragraph", "attrs": {}, "innerHTML": "<p>Hello world</p>" }
      ],
      "status": "draft"
    }
  }
}
```

---

## Token Optimization

### Savings by Scenario

| Scenario | Static (75 tools) | Dynamic (5 meta-tools) | Savings |
|----------|-------------------|------------------------|---------|
| Initial load | 19,500 tokens | 500 tokens | 97% |
| Single tool use | 19,500 tokens | 1,300 tokens | 93% |
| 3 tools (complex) | 19,500 tokens | 2,100 tokens | 89% |
| 10 tools (power user) | 19,500 tokens | 5,500 tokens | 72% |

### Best Practices

1. **Cache described tools** - Don't re-describe tools you've already loaded in the session
2. **Use category filters** - Narrow searches when you know the domain
3. **Batch descriptions** - Describe multiple tools in one call if you need several
4. **Respect focus mode** - Only search/execute allowed tools

---

## Tool Categories

| Category | Description | Example Tools |
|----------|-------------|---------------|
| `core` | Discovery, introspection | `wpnav_introspect`, `wpnav_get_site_overview` |
| `content` | Posts and pages | `wpnav_list_posts`, `wpnav_create_page` |
| `media` | Media library | `wpnav_upload_media_from_url`, `wpnav_list_media` |
| `taxonomy` | Categories and tags | `wpnav_list_categories`, `wpnav_create_tag` |
| `users` | User management | `wpnav_list_users`, `wpnav_get_user` |
| `plugins` | Plugin management | `wpnav_list_plugins`, `wpnav_activate_plugin` |
| `themes` | Theme management | `wpnav_list_themes`, `wpnav_activate_theme` |
| `gutenberg` | Block editor | `wpnav_gutenberg_insert_block` |
| `comments` | Comments | `wpnav_list_comments`, `wpnav_create_comment` |
| `batch` | Bulk operations | `wpnav_batch_get`, `wpnav_batch_update` |
| `cookbook` | AI guidance | `wpnav_list_cookbooks`, `wpnav_load_cookbook` |
| `roles` | Role personas | `wpnav_list_roles`, `wpnav_load_role` |

---

## Focus Mode Restrictions

When focus mode is active, tools are filtered:

| Mode | Available Tools | Restrictions |
|------|-----------------|--------------|
| `content-editing` | Content, media, taxonomy | No plugin/theme/user management |
| `read-only` | List/get operations only | No create/update/delete |
| `full-admin` | All 75+ tools | No restrictions |

**Check active focus mode:**
```json
{
  "name": "wpnav_introspect",
  "arguments": {}
}
// Response includes: "focus_mode": "content-editing"
```

---

## Role Integration

Roles define AI personas with specific tool access and behavior:

```json
// Load a role
{
  "name": "wpnav_execute",
  "arguments": {
    "tool": "wpnav_load_role",
    "args": { "slug": "content-editor" }
  }
}
```

Built-in roles:
- `content-editor` - Content creation and publishing
- `developer` - Full site management
- `seo-specialist` - SEO-focused operations
- `site-admin` - Administrative tasks

---

## Error Handling

### Tool Not Found

```json
{
  "error": "TOOL_NOT_FOUND",
  "message": "Tool 'wpnav_nonexistent' does not exist",
  "suggestion": "Use wpnav_search_tools to discover available tools"
}
```

**Action:** Use `wpnav_search_tools` to find the correct tool name.

### Validation Errors

```json
{
  "error": "VALIDATION_ERROR",
  "message": "Missing required parameter: id",
  "tool": "wpnav_get_post",
  "schema": { "required": ["id"] }
}
```

**Action:** Use `wpnav_describe_tools` to get the full schema.

### Write Protection

```json
{
  "error": "WRITES_DISABLED",
  "message": "Write operations are disabled. Set WPNAV_ENABLE_WRITES=1 in MCP server configuration.",
  "hint": "This is an MCP server setting, not a WordPress setting."
}
```

**Action:** Ask user to enable writes in MCP configuration.

### Focus Mode Blocked

```json
{
  "error": "TOOL_BLOCKED",
  "message": "Tool 'wpnav_activate_plugin' is not available in 'content-editing' focus mode",
  "focus_mode": "content-editing",
  "suggestion": "Switch to 'full-admin' mode or use an allowed tool"
}
```

**Action:** Respect focus mode restrictions or ask user to change mode.

---

## Cookbook Integration

Cookbooks provide plugin-specific AI guidance:

```json
// List available cookbooks
{
  "name": "wpnav_execute",
  "arguments": {
    "tool": "wpnav_list_cookbooks",
    "args": {}
  }
}

// Load cookbook for Gutenberg
{
  "name": "wpnav_execute",
  "arguments": {
    "tool": "wpnav_load_cookbook",
    "args": { "slug": "gutenberg" }
  }
}
```

Cookbooks include:
- Block definitions and examples
- Best practices for the plugin
- Common patterns and workflows

---

## Example Workflows

### Create a Blog Post

```
1. wpnav_introspect() → Check capabilities
2. wpnav_search_tools("create post with blocks") → Find tools
3. wpnav_describe_tools(["wpnav_create_post_with_blocks"]) → Get schema
4. wpnav_execute("wpnav_create_post_with_blocks", {...}) → Create post
```

### Upload and Insert Image

```
1. wpnav_search_tools("upload image") → Find upload tool
2. wpnav_execute("wpnav_upload_media_from_url", {url: "..."}) → Upload
3. wpnav_execute("wpnav_gutenberg_insert_block", {block: image_block}) → Insert
```

### Audit Site Content

```
1. wpnav_introspect() → Check focus mode
2. wpnav_execute("wpnav_get_site_overview", {}) → Get overview
3. wpnav_execute("wpnav_list_posts", {status: "all"}) → List posts
4. wpnav_execute("wpnav_list_pages", {}) → List pages
```

---

## Summary

1. **Start with `wpnav_introspect`** to understand site capabilities
2. **Use `wpnav_search_tools`** to find tools by intent
3. **Use `wpnav_describe_tools`** for unfamiliar tool schemas
4. **Use `wpnav_execute`** to run tools with validated arguments
5. **Respect focus mode** restrictions
6. **Cache described tools** to avoid redundant calls

---

## See Also

- [Best Practices](best-practices.md) - For human users
- [Dynamic Toolsets](DYNAMIC-TOOLSETS.md) - Architecture details
- [CLI Reference](cli-reference.md) - Command documentation

---

**Last Updated**: 2025-12-17
