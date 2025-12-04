# CLAUDE.md - WP Navigator MCP Server

**Version**: 1.0.1
**Package**: `@littlebearapps/wp-navigator-mcp`
**Status**: Published on npm

---

## Overview

MCP (Model Context Protocol) server enabling AI assistants to manage WordPress sites. Provides 48+ tools for content management, plugins, themes, users, and Gutenberg block editing.

**Key Relationships**:
- Works with **WP Navigator Free** (WordPress.org) and **WP Navigator Pro** (commercial)
- Pro features enforced server-side (WordPress plugin), not client-side (MCP)
- Independent versioning from WordPress plugins

---

## Task Management (Backlog.md)

**Status**: Initialised

**Session Start**: Check for "In Progress" tasks first:
```
mcp__backlog__task_list with status: "In Progress"
```

**Workflow**:
1. Check for in-progress tasks before starting new work
2. Create tasks for multi-step work with `mcp__backlog__task_create`
3. Mark tasks "In Progress" when starting, "Done" when complete
4. Use labels: `mcp`, `feature`, `bug`, `enhancement`, `chore`, `docs`

**Key Principles**:
- Use MCP tools (`mcp__backlog__*`), not CLI commands
- Don't edit markdown files directly
- Log issues during testing as Triage tasks with appropriate labels

---

## Quick Commands

```bash
# Build
npm run build

# Run tests
npm test

# Watch mode (development)
npm run dev

# Start server (requires wp-config.json)
npm start

# Test coverage
npm run test:coverage
```

---

## Architecture

```
src/
├── index.ts              # MCP server entry point
├── tools.ts              # Legacy tool definitions (being migrated)
├── config.ts             # Config loading (JSON file or env vars)
├── http.ts               # WordPress REST client (auth, retry, errors)
├── safety.ts             # Plan/Diff/Apply workflow
├── validation.ts         # Input validation helpers
├── output.ts             # Response formatting
├── logger.ts             # Logging utilities
├── startup-validator.ts  # Startup checks
├── tool-registry/        # Registry-based tool system
│   ├── registry.ts       # Central tool registry
│   ├── types.ts          # TypeScript interfaces
│   ├── utils.ts          # Shared validation utilities
│   └── index.ts          # Module exports
└── tools/                # Tool implementations by category
    ├── core/             # introspect, help
    ├── content/          # posts, pages, media, comments
    ├── taxonomy/         # categories, tags
    ├── users/            # user management
    ├── plugins/          # plugin management
    ├── themes/           # theme management
    ├── gutenberg/        # block editor operations
    └── testing/          # test utilities
```

---

## Key Files

| File | Purpose |
|------|---------|
| `src/index.ts` | MCP server initialization, request handlers |
| `src/tools.ts` | Legacy tool definitions (48+ tools) |
| `src/tool-registry/registry.ts` | New registry pattern for tool management |
| `src/http.ts` | WordPress REST client with retry, error handling |
| `src/config.ts` | Config validation, env var handling |
| `docs/TOOL-REGISTRY.md` | Tool registry system documentation |

---

## Tool Categories

| Category | Tool Count | Examples |
|----------|------------|----------|
| Core | 3 | `wpnav_introspect`, `wpnav_help` |
| Content | 20 | `wpnav_list_posts`, `wpnav_create_page` |
| Taxonomy | 8 | `wpnav_list_categories`, `wpnav_create_tag` |
| Users | 6 | `wpnav_list_users`, `wpnav_update_user` |
| Plugins | 7 | `wpnav_list_plugins`, `wpnav_activate_plugin` |
| Themes | 6 | `wpnav_list_themes`, `wpnav_activate_theme` |
| Gutenberg | 6 | `wpnav_gutenberg_insert_block` |

---

## Configuration

### Required Environment Variables

```bash
WP_BASE_URL=https://your-site.com
WP_REST_API=https://your-site.com/wp-json
WPNAV_BASE=https://your-site.com/wp-json/wpnav/v1
WPNAV_INTROSPECT=https://your-site.com/wp-json/wpnav/v1/introspect
WP_APP_USER=username
WP_APP_PASS=xxxx xxxx xxxx xxxx
```

### Optional Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `WPNAV_ENABLE_WRITES` | `0` | Enable write operations |
| `ALLOW_INSECURE_HTTP` | `0` | Allow HTTP for localhost |
| `WPNAV_TOOL_TIMEOUT_MS` | `600000` | Per-tool timeout (10 min) |
| `WPNAV_MAX_RESPONSE_KB` | `64` | Max response size |
| `WPNAV_SIGN_HEADERS` | `0` | Enable HMAC signing (v1.2.0+) |

### Configuration via JSON File

Create `wp-config.json`:
```json
{
  "WP_BASE_URL": "https://your-site.com",
  "WP_REST_API": "https://your-site.com/wp-json",
  "WPNAV_BASE": "https://your-site.com/wp-json/wpnav/v1",
  "WPNAV_INTROSPECT": "https://your-site.com/wp-json/wpnav/v1/introspect",
  "WP_APP_USER": "your-username",
  "WP_APP_PASS": "xxxx xxxx xxxx xxxx"
}
```

Run: `npm start ./wp-config.json`

---

## Development Workflow

### Adding a New Tool

1. Create tool in appropriate category (`src/tools/[category]/index.ts`)
2. Register with `toolRegistry.register()`:
   ```typescript
   toolRegistry.register({
     definition: { name: 'wpnav_my_tool', description: '...', inputSchema: {...} },
     handler: async (args, context) => { ... },
     category: ToolCategory.CONTENT,
   });
   ```
3. Add tests in `tests/` or alongside implementation
4. Run `npm test` to verify

### Tool Registry Pattern

- Use `validateRequired()`, `validatePagination()`, `validateId()` from `utils.ts`
- Return `{ content: [{ type: 'text', text: JSON.stringify(result) }] }`
- Access WordPress via `context.wpRequest(endpoint, options)`
- Feature flags gate experimental tools

---

## Testing

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage
```

Test files: `tests/`, `src/**/*.test.ts`

---

## Security Features

- **Safe by default**: Writes disabled unless `WPNAV_ENABLE_WRITES=1`
- **HTTPS enforced**: Non-localhost requires TLS
- **Single-origin**: Only configured WordPress URL accessible (SSRF prevention)
- **Concurrency guard**: One write operation at a time
- **Timeout protection**: Configurable per-tool timeouts
- **Plan/Diff/Apply**: Content changes use safe workflow

---

## Publishing

**Quick Reference**: @docs/quickrefs/publishing.md

```bash
# Automated (recommended): bump version, push, CI publishes
npm version patch|minor|major
git push --follow-tags

# Verify
npm view @littlebearapps/wp-navigator-mcp version
```

Package: `@littlebearapps/wp-navigator-mcp`
Registry: https://www.npmjs.com/package/@littlebearapps/wp-navigator-mcp

---

## MCP Client Configuration

### Claude Code
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

### Claude Desktop
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

---

## Related Projects

**WP Navigator Ecosystem**: @docs/quickrefs/wpnav-ecosystem.md

| Project | Path | Description |
|---------|------|-------------|
| **wp-navigator-pro** | `lba/plugins/wp-navigator-pro/main/` | WordPress plugin (Pro, private) |
| **wp-navigator** | `littlebearapps/wp-navigator` (public) | WordPress plugin (Free, extracted from Pro) |
| **wp-navigator-api** | `lba/plugins/wp-navigator-api/main/` | Cloud API backend |
| **wpnav.ai** | `lba/marketing/wpnav.ai/main/` | Marketing site |

### Plugin Coordination

**Authority File**: `docs/MCP-TOOL-AUTHORITY.yaml` - Canonical tool-endpoint mappings (auto-generated)

**When Plugin Updates Endpoints**:
1. Check if endpoint changes affect MCP tools
2. Update affected tools in `src/tools/`
3. Run `npm run generate:authority` to update authority file
4. Bump version appropriately (minor for new tools, patch for fixes)

**Version Independence**: MCP and plugin use independent version numbers with separate release cadences. Compatibility tracked via `min_plugin_version` in authority file.

**Related Files in wp-navigator-pro**:
- Plugin REST endpoints: `plugin/includes/class-rest-*.php`
- Coordination docs: `docs/quickrefs/mcp-server-coordination.md`

---

## Current Status

**v1.0.1** - Published on npm (2025-12-03)

- 63 WordPress management tools (13 categories)
- Release-Please automation
- Tool authority file auto-generation
- Plugin compatibility check on startup

---

## Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| "WRITES_DISABLED" | Set `WPNAV_ENABLE_WRITES=1` |
| "Authentication failed" (401) | Regenerate Application Password |
| "Plugin not found" (404) | Ensure WP Navigator plugin activated |
| "Insecure HTTP" | Use HTTPS or set `ALLOW_INSECURE_HTTP=1` for localhost |

### Debug Logging

```bash
# Enable HTTP timing
WPNAV_DEBUG_HTTP_TIMING=1 npm start

# Check startup
npm start ./wp-config.json 2>&1 | head -20
```

---

## Documentation

- **README.md** - User-facing documentation
- **docs/MCP-TOOL-AUTHORITY.yaml** - Canonical tool-endpoint mappings (auto-generated)
- **docs/TOOL-REGISTRY.md** - Tool registry system
- **docs/quickrefs/** - Publishing guide, ecosystem overview

---

**Last Updated**: 2025-12-04
