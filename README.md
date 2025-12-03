# WP Navigator MCP Server

MCP (Model Context Protocol) server for AI-assisted WordPress management via Claude Code, Claude Desktop, and other MCP-compatible clients.

[![npm version](https://img.shields.io/npm/v/@littlebearapps/wp-navigator-mcp.svg)](https://www.npmjs.com/package/@littlebearapps/wp-navigator-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

---

## What is this?

WP Navigator MCP provides **48+ tools** for managing WordPress sites through AI assistants like Claude. It connects to any WordPress site running the [WP Navigator](https://wpnav.ai) plugin (Free or Pro).

**Key capabilities:**
- Create, update, and manage posts and pages (including Gutenberg blocks)
- Upload and manage media library items
- Manage plugins and themes
- Handle comments and taxonomies
- Full content rollback support

---

## Quick Start

### 1. Install on Your WordPress Site

Install and activate [WP Navigator](https://wpnav.ai) on your WordPress site (Free version works).

### 2. Create Application Password

In WordPress admin: **Users → Your Profile → Application Passwords**

Generate a new password and save it securely.

### 3. Create Configuration File

Create `wp-config.json` in your working directory:

```json
{
  "WP_BASE_URL": "https://your-site.com",
  "WP_REST_API": "https://your-site.com/wp-json",
  "WPNAV_BASE": "https://your-site.com/wp-json/wpnav/v1",
  "WPNAV_INTROSPECT": "https://your-site.com/wp-json/wpnav/v1/introspect",
  "WP_APP_USER": "your-username",
  "WP_APP_PASS": "xxxx xxxx xxxx xxxx xxxx xxxx"
}
```

**Tip**: Copy from `wp-config.json.example` and fill in your values.

### 4. Configure Your MCP Client

#### Claude Code

Add to your project's `.mcp.json`:

```json
{
  "mcpServers": {
    "wpnav": {
      "command": "npx",
      "args": ["-y", "@littlebearapps/wp-navigator-mcp", "./wp-config.json"]
    }
  }
}
```

#### Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "wpnav": {
      "command": "npx",
      "args": ["-y", "@littlebearapps/wp-navigator-mcp", "/path/to/wp-config.json"]
    }
  }
}
```

Restart Claude Desktop after editing.

### 5. Verify Connection

In Claude, try:
> "Use wpnav_introspect to check the WordPress connection"

---

## Installation Options

### npx (Recommended)

No installation needed - runs directly:

```bash
npx @littlebearapps/wp-navigator-mcp ./wp-config.json
```

### Global Install

```bash
npm install -g @littlebearapps/wp-navigator-mcp
wp-navigator ./wp-config.json
```

### Local Development

```bash
git clone https://github.com/littlebearapps/wp-navigator-mcp.git
cd wp-navigator-mcp
npm install
npm run build
npm start
```

---

## Compatibility

| WP Navigator MCP | WP Navigator Free | WP Navigator Pro | Node.js |
|------------------|-------------------|------------------|---------|
| v1.0.x           | v1.0+             | v1.0+            | 18+     |

**Supported Platforms:**
- macOS (Apple Silicon and Intel)
- Linux (x64)
- Windows (via WSL recommended)

**MCP Clients:**
- Claude Desktop
- Claude Code CLI
- Gemini CLI
- Any MCP-compatible client

---

## Environment Variables

Optional environment variables for advanced configuration:

| Variable | Default | Description |
|----------|---------|-------------|
| `WPNAV_ENABLE_WRITES` | `0` | Enable write operations (required for create/update/delete) |
| `ALLOW_INSECURE_HTTP` | `0` | Allow HTTP for localhost development |
| `WPNAV_TOOL_TIMEOUT_MS` | `600000` | Per-tool timeout (10 minutes) |
| `WPNAV_MAX_RESPONSE_KB` | `64` | Maximum response size before truncation |

**Example with writes enabled:**

```json
{
  "mcpServers": {
    "wpnav": {
      "command": "npx",
      "args": ["-y", "@littlebearapps/wp-navigator-mcp", "./wp-config.json"],
      "env": {
        "WPNAV_ENABLE_WRITES": "1"
      }
    }
  }
}
```

---

## Available Tools

### Discovery
- `wpnav_introspect` - Plugin info, policy, capabilities, environment hints
- `wpnav_help` - Connection status, safety toggles, next steps

### Content Management

**Posts (7 tools):**
- `wpnav_list_posts` - List posts with filtering
- `wpnav_get_post` - Get post by ID
- `wpnav_create_post` - Create new post
- `wpnav_create_post_with_blocks` - Create post with Gutenberg blocks
- `wpnav_update_post` - Update existing post
- `wpnav_rollback` - Restore to previous revision
- `wpnav_delete_post` - Delete post

**Pages (5 tools):**
- `wpnav_list_pages` - List pages with filtering
- `wpnav_get_page` - Get page by ID
- `wpnav_create_page` - Create new page
- `wpnav_update_page` - Update existing page
- `wpnav_delete_page` - Delete page

**Media (4 tools):**
- `wpnav_list_media` - List media items
- `wpnav_get_media` - Get media details
- `wpnav_upload_media_from_url` - Sideload media from URL
- `wpnav_delete_media` - Delete media item

**Comments (5 tools):**
- `wpnav_list_comments` - List comments
- `wpnav_get_comment` - Get comment details
- `wpnav_create_comment` - Create new comment
- `wpnav_update_comment` - Update comment
- `wpnav_delete_comment` - Delete comment

### Site Management

**Plugins (5 tools):**
- `wpnav_list_plugins` - List installed plugins
- `wpnav_get_plugin` - Get plugin details
- `wpnav_activate_plugin` - Activate plugin
- `wpnav_deactivate_plugin` - Deactivate plugin
- `wpnav_delete_plugin` - Delete plugin

**Themes (6 tools):**
- `wpnav_list_themes` - List installed themes
- `wpnav_get_theme` - Get theme details
- `wpnav_install_theme` - Install theme from WordPress.org
- `wpnav_activate_theme` - Activate theme
- `wpnav_update_theme` - Update theme
- `wpnav_delete_theme` - Delete theme

**Users (2 tools):**
- `wpnav_list_users` - List WordPress users
- `wpnav_get_user` - Get user details

**Taxonomy (4 tools):**
- `wpnav_list_categories` - List categories
- `wpnav_list_tags` - List tags
- `wpnav_create_category` - Create category
- `wpnav_create_tag` - Create tag

### Gutenberg Block Editor (6 tools)

- `wpnav_gutenberg_introspect` - Get block editor status
- `wpnav_gutenberg_list_blocks` - List blocks in a post
- `wpnav_gutenberg_insert_block` - Insert a new block
- `wpnav_gutenberg_replace_block` - Replace an existing block
- `wpnav_gutenberg_move_block` - Move a block
- `wpnav_gutenberg_delete_block` - Delete a block

---

## Security Features

### Safe by Default
- **Writes disabled** - Set `WPNAV_ENABLE_WRITES=1` to enable modifications
- **HTTPS required** - TLS enforced for non-localhost connections
- **Single-origin** - Only configured WordPress URL is accessible (SSRF prevention)
- **Timeout protection** - All operations have configurable timeouts
- **Concurrency guard** - Single in-flight write operation at a time

### Policy Enforcement
The WP Navigator plugin enforces granular permissions:
- Category-level access control (posts, pages, media, plugins, etc.)
- Read/write permission per category
- Admin UI to configure allowed operations

All MCP operations respect your WordPress guardrails policy.

---

## Troubleshooting

### "Connection refused" or "ECONNREFUSED"
- Verify WordPress site is accessible
- Check the URL in `wp-config.json` is correct
- Ensure HTTPS is used (or set `ALLOW_INSECURE_HTTP=1` for localhost)

### "Authentication failed" (401)
- Verify Application Password is correct
- Ensure username matches the WordPress user
- Check the user has Administrator role

### "Writes disabled"
- Set `WPNAV_ENABLE_WRITES=1` in your MCP config's `env` section

### "Plugin not found"
- Ensure WP Navigator (Free or Pro) is installed and activated
- Check `/wp-json/wpnav/v1/introspect` returns valid JSON

### "MCP server not appearing"
- Restart Claude Desktop after config changes
- Verify `npx @littlebearapps/wp-navigator-mcp --help` works
- Check Claude Desktop logs: `~/Library/Logs/Claude/`

---

## Development

### Building from Source

```bash
git clone https://github.com/littlebearapps/wp-navigator-mcp.git
cd wp-navigator-mcp
npm install
npm run build
```

### Running Tests

```bash
npm test
```

### Development Mode

```bash
npm run dev  # Watch mode - rebuilds on file changes
```

---

## Related Projects

| Project | Description |
|---------|-------------|
| [WP Navigator](https://wpnav.ai) | WordPress plugin (Free version on WordPress.org) |
| [WP Navigator Pro](https://wpnav.ai/pro) | Premium WordPress plugin with advanced features |

---

## Support

- **Issues**: [GitHub Issues](https://github.com/littlebearapps/wp-navigator-mcp/issues)
- **Documentation**: [wpnav.ai/docs](https://wpnav.ai/docs)
- **Website**: [wpnav.ai](https://wpnav.ai)

---

## License

MIT - see [LICENSE](LICENSE) for details.

---

## Changelog

### v1.0.0 (2025-12-03)

Initial standalone release:
- 48+ WordPress management tools
- Claude Desktop and Claude Code support
- Safe-by-default writes (opt-in)
- HTTPS enforcement
- Policy-based access control
- Gutenberg block editor support
- Content rollback feature
