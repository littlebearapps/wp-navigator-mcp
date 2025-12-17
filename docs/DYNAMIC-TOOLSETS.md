# Dynamic Toolsets Architecture

**Version**: v2.7.0
**Status**: Production

---

## Overview

Dynamic Toolsets is an architecture that dramatically reduces initial token consumption when connecting AI agents to WordPress via MCP. Instead of exposing 75+ individual tools (each with full JSON Schema), the MCP server exposes only **5 meta-tools** that enable on-demand tool discovery and execution.

### Token Reduction

| Approach | Initial Tokens | Reduction |
|----------|----------------|-----------|
| Traditional (all 75 tools) | ~19,500 | - |
| Dynamic Toolsets (5 meta-tools) | ~500 | **97.7%** |

This matters because:
- MCP clients (Claude Code, Codex CLI, Gemini CLI) include all tool schemas in their context
- Large tool counts consume context budget before any work begins
- Many sessions only use 3-5 tools, making full exposure wasteful

---

## Meta-Tools

The MCP server exposes exactly 5 tools:

| Tool | Purpose | When to Use |
|------|---------|-------------|
| `wpnav_introspect` | Site discovery | First call - understand site capabilities |
| `wpnav_search_tools` | Find tools | When you need a capability |
| `wpnav_describe_tools` | Get schemas | Before calling unfamiliar tools |
| `wpnav_execute` | Run any tool | Execute discovered tools |
| `wpnav_context` | Context dump | For non-MCP agents (ChatGPT, etc.) |

---

## Workflow: Search → Describe → Execute

### 1. Search for Tools

Use natural language or category filters to find relevant tools:

```json
// Natural language
{
  "name": "wpnav_search_tools",
  "arguments": { "query": "upload images to media library" }
}

// Category filter
{
  "name": "wpnav_search_tools",
  "arguments": { "category": "media" }
}

// Combined
{
  "name": "wpnav_search_tools",
  "arguments": { "query": "create", "category": "content" }
}
```

**Response:**
```json
{
  "tools": [
    {
      "name": "wpnav_upload_media_from_url",
      "description": "Upload media from URL to WordPress media library",
      "category": "media"
    },
    {
      "name": "wpnav_list_media",
      "description": "List media items with pagination and filters",
      "category": "media"
    }
  ],
  "total": 2,
  "query": "upload images to media library"
}
```

### 2. Describe Tools (Optional)

Get full JSON Schema for tools you plan to use:

```json
{
  "name": "wpnav_describe_tools",
  "arguments": { "tools": ["wpnav_upload_media_from_url"] }
}
```

**Response:**
```json
{
  "tools": [
    {
      "name": "wpnav_upload_media_from_url",
      "description": "Upload media from URL to WordPress media library",
      "inputSchema": {
        "type": "object",
        "properties": {
          "url": {
            "type": "string",
            "description": "URL of the image to upload"
          },
          "title": {
            "type": "string",
            "description": "Title for the media item"
          },
          "alt_text": {
            "type": "string",
            "description": "Alt text for accessibility"
          }
        },
        "required": ["url"]
      }
    }
  ]
}
```

### 3. Execute

Run the tool with arguments:

```json
{
  "name": "wpnav_execute",
  "arguments": {
    "tool": "wpnav_upload_media_from_url",
    "args": {
      "url": "https://example.com/image.jpg",
      "title": "Hero Image",
      "alt_text": "Beautiful landscape"
    }
  }
}
```

**Response:**
```json
{
  "success": true,
  "tool": "wpnav_upload_media_from_url",
  "result": {
    "id": 42,
    "title": "Hero Image",
    "url": "https://your-site.com/wp-content/uploads/2024/01/image.jpg",
    "alt_text": "Beautiful landscape"
  }
}
```

---

## Categories

Tools are organized into categories for filtering:

| Category | Description | Example Tools |
|----------|-------------|---------------|
| `core` | Discovery, introspection | `wpnav_introspect`, `wpnav_get_site_overview` |
| `content` | Posts and pages | `wpnav_list_posts`, `wpnav_create_page` |
| `media` | Media library | `wpnav_upload_media_from_url`, `wpnav_list_media` |
| `taxonomy` | Categories and tags | `wpnav_list_categories`, `wpnav_create_tag` |
| `users` | User management | `wpnav_list_users`, `wpnav_get_user` |
| `plugins` | Plugin management | `wpnav_list_plugins`, `wpnav_activate_plugin` |
| `themes` | Theme management | `wpnav_list_themes`, `wpnav_activate_theme` |
| `gutenberg` | Block editor | `wpnav_gutenberg_insert_block`, `wpnav_gutenberg_list_blocks` |
| `comments` | Comments | `wpnav_list_comments`, `wpnav_create_comment` |
| `batch` | Bulk operations | `wpnav_batch_get`, `wpnav_batch_update` |
| `cookbook` | AI guidance | `wpnav_list_cookbooks`, `wpnav_get_cookbook` |
| `roles` | Role personas | `wpnav_list_roles`, `wpnav_load_role` |
| `testing` | Test utilities | `wpnav_test_metrics`, `wpnav_seed_test_data` |

---

## Semantic Search

The `wpnav_search_tools` tool uses embeddings-based semantic search to find relevant tools from natural language queries.

### How It Works

1. All 75+ tool descriptions are pre-embedded at build time
2. Your query is embedded at runtime
3. Cosine similarity finds the closest matches
4. Results are ranked by relevance score

### Search Tips

| Query Style | Example | Result Quality |
|-------------|---------|----------------|
| Action + Object | "create new blog post" | Excellent |
| Object only | "posts" | Good |
| Category browse | `{"category": "content"}` | Complete |
| Verb only | "delete" | Moderate |

### Embeddings Location

```
src/embeddings/
├── tool-embeddings.json    # Pre-computed embeddings (gitignored)
├── index.ts                # Embedding loader and search
└── generate.ts             # Build script for embeddings
```

Run `npm run generate:embeddings` to regenerate after adding tools.

---

## Error Handling

### Tool Not Found

```json
{
  "name": "wpnav_execute",
  "arguments": { "tool": "wpnav_nonexistent", "args": {} }
}
```

**Response:**
```json
{
  "error": "TOOL_NOT_FOUND",
  "message": "Tool 'wpnav_nonexistent' does not exist",
  "suggestion": "Use wpnav_search_tools to discover available tools"
}
```

### Validation Errors

```json
{
  "name": "wpnav_execute",
  "arguments": {
    "tool": "wpnav_get_post",
    "args": {}  // Missing required 'id'
  }
}
```

**Response:**
```json
{
  "error": "VALIDATION_ERROR",
  "message": "Missing required parameter: id",
  "tool": "wpnav_get_post",
  "schema": { "required": ["id"] }
}
```

### Write Protection

```json
{
  "name": "wpnav_execute",
  "arguments": {
    "tool": "wpnav_create_post",
    "args": { "title": "Test" }
  }
}
```

**Response (if WPNAV_ENABLE_WRITES=0):**
```json
{
  "error": "WRITES_DISABLED",
  "message": "Write operations are disabled. Set WPNAV_ENABLE_WRITES=1 in MCP server configuration.",
  "hint": "This is an MCP server setting, not a WordPress setting."
}
```

---

## Focus Modes

Focus modes pre-filter available tools to reduce scope (configured in `wpnavigator.jsonc`):

| Mode | Tools Available | Use Case |
|------|-----------------|----------|
| `full-admin` | All 75+ tools | Full site management |
| `content-editing` | Content, media, taxonomy | Writing and publishing |
| `read-only` | List/get operations only | Auditing and reporting |

```jsonc
// wpnavigator.jsonc
{
  "ai": {
    "focus_mode": "content-editing"
  }
}
```

When focus mode is active, `wpnav_search_tools` and `wpnav_execute` respect the restrictions.

---

## Role Integration

Roles (AI personas) define which tools are accessible:

```json
{
  "name": "wpnav_search_tools",
  "arguments": { "query": "delete posts" }
}
```

With `content-editor` role active, destructive tools are filtered from results.

**See also:** [Roles documentation](../roles/README.md)

---

## CLI Mode

In CLI mode (`npx wpnav call`), tools are invoked directly without the meta-tool layer:

```bash
# Direct invocation (CLI)
npx wpnav call wpnav_list_posts --limit 10

# Equivalent MCP workflow
wpnav_search_tools(query="list posts")
wpnav_execute(tool="wpnav_list_posts", args={"limit": 10})
```

The CLI is for:
- Testing and debugging
- Scripts and automation
- Web-based AI agents without MCP support

---

## Implementation Details

### META_TOOLS Set

In `src/mcp-server.ts`, the exposed tools are controlled by:

```typescript
const META_TOOLS = new Set([
  'wpnav_introspect',
  'wpnav_search_tools',
  'wpnav_describe_tools',
  'wpnav_execute',
  'wpnav_context',
]);
```

### Tool Registry

All 75+ tools are registered in the tool registry (`src/tool-registry/`):

```typescript
toolRegistry.register({
  definition: {
    name: 'wpnav_list_posts',
    description: 'List posts with pagination',
    inputSchema: { /* ... */ }
  },
  handler: async (args, context) => { /* ... */ },
  category: ToolCategory.CONTENT,
});
```

### Search Tools Implementation

`src/tools/core/search-tools.ts`:
- Loads pre-computed embeddings
- Computes query embedding at runtime
- Returns top-k matches by cosine similarity

### Execute Implementation

`src/tools/core/execute.ts`:
- Validates tool exists in registry
- Validates arguments against schema
- Checks focus mode and role restrictions
- Delegates to tool handler

---

## Comparison with Traditional MCP

| Aspect | Traditional | Dynamic Toolsets |
|--------|-------------|------------------|
| Initial tokens | ~19,500 | ~500 |
| Tool discovery | Read all schemas | Search by intent |
| Schema access | Always loaded | On-demand |
| Execution | Direct | Via wpnav_execute |
| Token efficiency | Low | High |
| Context budget | Consumed early | Preserved |

---

## Troubleshooting

### "Tool not found" but tool exists

1. Check focus mode restrictions
2. Check active role permissions
3. Verify tool is enabled in policy (plugin settings)

### Search returns unexpected results

1. Try more specific query
2. Use category filter
3. Check embeddings are generated (`npm run generate:embeddings`)

### Execute validation fails

1. Use `wpnav_describe_tools` to get exact schema
2. Check required vs optional parameters
3. Verify parameter types match schema

---

## See Also

- [CLI Reference](cli-reference.md) - Command-line usage
- [Tool Registry](TOOL-REGISTRY.md) - Tool registration system
- [MCP-TOOL-AUTHORITY.yaml](MCP-TOOL-AUTHORITY.yaml) - Canonical tool definitions
- [Roles](../roles/README.md) - AI role personas

---

**Last Updated**: 2025-12-17
