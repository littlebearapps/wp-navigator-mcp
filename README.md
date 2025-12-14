# WP Navigator MCP

[![npm version](https://img.shields.io/npm/v/@littlebearapps/wp-navigator-mcp.svg)](https://www.npmjs.com/package/@littlebearapps/wp-navigator-mcp)
[![npm downloads](https://img.shields.io/npm/dm/@littlebearapps/wp-navigator-mcp.svg)](https://www.npmjs.com/package/@littlebearapps/wp-navigator-mcp)
[![CI](https://github.com/littlebearapps/wp-navigator-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/littlebearapps/wp-navigator-mcp/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/littlebearapps/wp-navigator-mcp/branch/main/graph/badge.svg)](https://codecov.io/gh/littlebearapps/wp-navigator-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

**AI-powered WordPress management via Claude Code and MCP-compatible clients.**

Manage posts, pages, media, plugins, themes, and Gutenberg blocks through natural language — all with safe-by-default writes and full rollback support.

<!-- TODO: Add demo GIF when available
![Demo showing WP Navigator in action](https://raw.githubusercontent.com/littlebearapps/wp-navigator-mcp/main/docs/images/demo.gif)
-->

---

> **Coming Soon — January 2025**
>
> The **WP Navigator WordPress plugin** is not yet available. This MCP server requires the plugin to be installed on your WordPress site.
>
> **[Register your interest at wpnav.ai →](https://wpnav.ai)**

---

## Who Is This For?

| **WordPress Developer** | **Content Manager** |
|:---|:---|
| *"I want AI to help build and maintain sites"* | *"I want to manage content with natural language"* |
| You build WordPress sites and want AI assistance for development tasks. | You manage content and want faster, more intuitive workflows. |
| **Key features:** Gutenberg block editing, plugin management, theme switching, bulk operations | **Key features:** Post/page creation, media uploads, safe publishing, content rollback |

---

## What WP Navigator MCP Does

### Content Management

- Create and edit posts/pages with Gutenberg blocks
- Upload media from URLs (sideload images automatically)
- Manage comments, categories, and tags
- Full revision history with rollback support

### Site Management

- Install, activate, and manage plugins
- Switch and customize themes
- View and manage WordPress users

### Safety & Rollback

- **Safe by default** — Writes disabled until explicitly enabled
- **Full revision history** — Rollback any content change
- **Policy-based access** — WordPress plugin enforces granular permissions
- **HTTPS enforced** — Secure connections for non-localhost

---

## Quick Start

### 1. Install WP Navigator Plugin

<details>
<summary><strong>Free Version (WordPress.org)</strong></summary>

Search for "WP Navigator" in WordPress Plugins → Add New, or:

1. Download from [WordPress.org](https://wordpress.org/plugins/wp-navigator/)
2. Upload to `/wp-content/plugins/`
3. Activate the plugin

</details>

<details>
<summary><strong>Pro Version</strong></summary>

1. Purchase at [wpnav.ai/pro](https://wpnav.ai/pro)
2. Download the plugin ZIP
3. Upload via WordPress Admin → Plugins → Add New → Upload
4. Activate and enter your license key

</details>

### 2. Create Application Password

In WordPress Admin: **Users → Your Profile → Application Passwords**

1. Enter a name (e.g., "WP Navigator MCP")
2. Click "Add New Application Password"
3. Copy the password immediately (it won't be shown again)

### 3. Create Configuration File

Create `wpnav.config.json` in your project directory:

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

### 4. Configure Your MCP Client

<details>
<summary><strong>Claude Code</strong></summary>

Add to your project's `.mcp.json`:

```json
{
  "mcpServers": {
    "wpnav": {
      "command": "npx",
      "args": ["-y", "@littlebearapps/wp-navigator-mcp", "./wpnav.config.json"],
      "env": {
        "WPNAV_ENABLE_WRITES": "1"
      }
    }
  }
}
```

</details>


> **Note**: `WPNAV_ENABLE_WRITES=1` enables create/update/delete operations. Without it, only read operations work (safe by default).

### 5. Verify Connection

In Claude, try:
> "Use wpnav_introspect to check the WordPress connection"

---

## CLI Mode

WP Navigator MCP also works as a standalone CLI for scripts and web-based AI agents.

### Initialize a Project

```bash
npx wpnav init                   # Interactive wizard (guided mode)
npx wpnav init --mode scaffold   # Quick setup without prompts
npx wpnav init --mode ai-handoff # Create AI-ready handoff document
```

Creates project structure with `wpnavigator.jsonc` manifest and `sample-prompts/` folder containing ready-to-use AI prompts (self-test, add-page, content-audit, etc.).

### Direct Tool Invocation

```bash
# List posts
npx wpnav call wpnav_list_posts --limit 5

# Get site overview
npx wpnav call wpnav_get_site_overview

# Preview a change without executing
npx wpnav call wpnav_update_post --id 1 --title "New Title" --dry-run
```

### Other Commands

```bash
npx wpnav status      # Check WordPress connection and plugin edition
npx wpnav tools       # List available tools
npx wpnav tools --format markdown  # Generate documentation
npx wpnav configure   # Set up credentials interactively
npx wpnav validate    # Validate config and manifest
npx wpnav doctor      # Run system diagnostics
npx wpnav cleanup     # Remove onboarding helper files
```

### Multi-Platform Support (v2.3.0)

```bash
# Generate MCP configuration for your platform
npx wpnav mcp-config --claude    # Claude Code (.mcp.json)
npx wpnav mcp-config --codex     # OpenAI Codex (config.toml)
npx wpnav mcp-config --gemini    # Google Gemini CLI (settings.json)

# Export config as environment variables
npx wpnav export-env             # Shell format
npx wpnav export-env --format docker  # Dockerfile
npx wpnav export-env --format github  # GitHub Actions
```

### Snapshot & Sync Workflow

```bash
npx wpnav snapshot site       # Capture full site index
npx wpnav snapshot page about # Capture single page
npx wpnav diff                # Compare manifest vs WordPress
npx wpnav sync --dry-run      # Preview changes
npx wpnav sync                # Apply manifest to WordPress
npx wpnav rollback <id>       # Restore from pre-sync snapshot
```

See [CLI Reference](docs/cli-reference.md) for complete documentation.

---

## Project Structure

When you initialize a WP Navigator project with `npx wpnav init`, the following structure is created:

```
my-wp-project/
├── wpnavigator.jsonc       # Site manifest (your intent)
├── wpnav.config.json       # Connection configuration
├── .gitignore              # Ignores credentials and snapshots
├── snapshots/              # Site state snapshots
│   ├── site_index.json     # Full site structure
│   └── pages/              # Individual page snapshots
├── roles/                  # Custom AI role definitions
├── cookbooks/              # Custom plugin cookbooks (override bundled)
├── docs/                   # Project documentation
└── sample-prompts/         # Ready-to-use AI prompts
    ├── self-test.txt
    ├── add-page.txt
    └── content-audit.txt
```

### Directory Purposes

| Directory | Purpose | Git Status |
|-----------|---------|------------|
| `snapshots/` | Read-only state from WordPress | Ignore (regeneratable) |
| `roles/` | Custom AI behavior definitions | Commit |
| `cookbooks/` | Plugin-specific AI guidance | Commit |
| `docs/` | Project documentation | Commit |
| `sample-prompts/` | Reusable AI prompts | Commit |

### Recommended .gitignore

```gitignore
# Credentials (NEVER commit)
wpnav.config.json

# Snapshots (regenerate with wpnav snapshot)
snapshots/
```

---

## Available Tools

**68+ tools** organized by category:

| Category | Tools | Examples |
|----------|-------|----------|
| **Core** | 5 | `wpnav_introspect`, `wpnav_get_site_overview` |
| **Posts** | 7 | `wpnav_list_posts`, `wpnav_create_post_with_blocks` |
| **Pages** | 6 | `wpnav_list_pages`, `wpnav_snapshot_page` |
| **Media** | 4 | `wpnav_upload_media_from_url` |
| **Plugins** | 7 | `wpnav_list_plugins`, `wpnav_activate_plugin` |
| **Themes** | 7 | `wpnav_list_themes`, `wpnav_activate_theme` |
| **Gutenberg** | 7 | `wpnav_gutenberg_insert_block` |
| **Users** | 5 | `wpnav_list_users`, `wpnav_get_user` |
| **Comments** | 5 | `wpnav_list_comments`, `wpnav_create_comment` |
| **Taxonomy** | 12 | `wpnav_list_categories`, `wpnav_create_tag` |
| **Cookbook** | 3 | `wpnav_list_cookbooks`, `wpnav_get_cookbook` |

List all tools:
```bash
npx wpnav tools
npx wpnav tools --category gutenberg
```

---

## Architecture

```
┌─────────────────────┐     MCP Protocol     ┌────────────────────┐
│    Claude Code /    │ ◄──────────────────► │  WP Navigator MCP  │
│    MCP Clients      │                       │   (npm package)    │
└─────────────────────┘                       └─────────┬──────────┘
                                                        │ REST API
                                                        ▼
                                              ┌────────────────────┐
                                              │     WordPress      │
                                              │   + WP Navigator   │
                                              │      Plugin        │
                                              └────────────────────┘
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `WPNAV_ENABLE_WRITES` | `0` | Enable write operations (create/update/delete) |
| `ALLOW_INSECURE_HTTP` | `0` | Allow HTTP for localhost development |
| `WPNAV_TOOL_TIMEOUT_MS` | `600000` | Per-tool timeout (10 minutes) |
| `WPNAV_MAX_RESPONSE_KB` | `64` | Maximum response size before truncation |

---

## Compatibility

| WP Navigator MCP | WP Navigator Free | WP Navigator Pro | Node.js |
|------------------|-------------------|------------------|---------|
| v1.0.x           | v1.0+             | v1.0+            | 18+     |

**MCP Clients:** Claude Code, Gemini CLI, any MCP-compatible client

**Platforms:** macOS (Apple Silicon & Intel), Linux (x64), Windows (via WSL)

---

## Documentation

- **[CLI Reference](docs/cli-reference.md)** — Complete command documentation
- **[Security](docs/security.md)** — Security model and best practices
- **[Troubleshooting](docs/troubleshooting.md)** — Common issues and solutions
- **[FAQ](docs/faq.md)** — Frequently asked questions
- **[Contributing](docs/contributing.md)** — How to contribute

---

## Support & Community

- **Bug Reports**: [Open an Issue](https://github.com/littlebearapps/wp-navigator-mcp/issues/new?template=bug_report.yml)
- **Feature Requests**: [Start a Discussion](https://github.com/littlebearapps/wp-navigator-mcp/discussions/new?category=ideas)
- **Questions**: [Ask in Discussions](https://github.com/littlebearapps/wp-navigator-mcp/discussions/new?category=q-a)
- **Documentation**: [wpnav.ai/docs](https://wpnav.ai/docs)

---

## Related Projects

| Project | Description |
|---------|-------------|
| [WP Navigator Free](https://wordpress.org/plugins/wp-navigator/) | WordPress plugin (Free) |
| [WP Navigator Pro](https://wpnav.ai/pro) | WordPress plugin (Premium) |

---

## License

MIT — see [LICENSE](LICENSE) for details.

---

**Made with care by [Little Bear Apps](https://littlebearapps.com)**

[Issues](https://github.com/littlebearapps/wp-navigator-mcp/issues) · [Discussions](https://github.com/littlebearapps/wp-navigator-mcp/discussions) · [Changelog](CHANGELOG.md)
