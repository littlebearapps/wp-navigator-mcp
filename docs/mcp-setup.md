# MCP Client Setup

Configure WP Navigator MCP with your preferred AI assistant.

---

## Supported Clients

| Client | Setup Command | Config File |
|--------|---------------|-------------|
| Claude Code | `npx wpnav claude-setup` | `.mcp.json` |
| OpenAI Codex | `npx wpnav codex-setup` | `config.toml` |
| Google Gemini CLI | `npx wpnav gemini-setup` | `settings.json` |

---

## Claude Code

### Quick Setup

```bash
npx wpnav claude-setup
```

This generates the MCP configuration snippet for your Claude Code settings.

### Manual Configuration

Add to your `.mcp.json` (project-level) or Claude Code settings:

```json
{
  "mcpServers": {
    "wpnav": {
      "command": "npx",
      "args": ["-y", "@littlebearapps/wp-navigator-mcp", "./wpnav.config.json"]
    }
  }
}
```

### With Environment Variables

If using environment variables instead of config file:

```json
{
  "mcpServers": {
    "wpnav": {
      "command": "npx",
      "args": ["-y", "@littlebearapps/wp-navigator-mcp"],
      "env": {
        "WP_BASE_URL": "https://your-site.com",
        "WP_REST_API": "https://your-site.com/wp-json",
        "WPNAV_BASE": "https://your-site.com/wp-json/wpnav/v1",
        "WPNAV_INTROSPECT": "https://your-site.com/wp-json/wpnav/v1/introspect",
        "WP_APP_USER": "your-username",
        "WP_APP_PASS": "xxxx xxxx xxxx xxxx"
      }
    }
  }
}
```

### Verify Connection

In Claude Code, run:
```
/mcp
```

You should see `wpnav` listed with available tools.

---

## OpenAI Codex CLI

### Quick Setup

```bash
npx wpnav codex-setup
```

### Manual Configuration

Add to `~/.codex/config.toml`:

```toml
[mcp_servers.wpnav]
command = "npx"
args = ["-y", "@littlebearapps/wp-navigator-mcp", "./wpnav.config.json"]
```

### With Environment Variables

```toml
[mcp_servers.wpnav]
command = "npx"
args = ["-y", "@littlebearapps/wp-navigator-mcp"]

[mcp_servers.wpnav.env]
WP_BASE_URL = "https://your-site.com"
WP_REST_API = "https://your-site.com/wp-json"
WPNAV_BASE = "https://your-site.com/wp-json/wpnav/v1"
WPNAV_INTROSPECT = "https://your-site.com/wp-json/wpnav/v1/introspect"
WP_APP_USER = "your-username"
WP_APP_PASS = "xxxx xxxx xxxx xxxx"
```

---

## Google Gemini CLI

### Quick Setup

```bash
npx wpnav gemini-setup
```

### Manual Configuration

Add to your Gemini CLI settings:

```json
{
  "mcpServers": {
    "wpnav": {
      "command": "npx",
      "args": ["-y", "@littlebearapps/wp-navigator-mcp", "./wpnav.config.json"]
    }
  }
}
```

---

## All Platforms at Once

Generate configuration for all supported platforms:

```bash
npx wpnav mcp-config --all
```

Or select interactively:

```bash
npx wpnav mcp-config
```

---

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `WP_BASE_URL` | Yes | WordPress site URL |
| `WP_REST_API` | Yes | REST API base (usually `{site}/wp-json`) |
| `WPNAV_BASE` | Yes | WP Navigator API base |
| `WPNAV_INTROSPECT` | Yes | Introspect endpoint URL |
| `WP_APP_USER` | Yes | WordPress username |
| `WP_APP_PASS` | Yes | Application password |
| `WPNAV_ENABLE_WRITES` | No | Enable write operations (default: `0`) |
| `ALLOW_INSECURE_HTTP` | No | Allow HTTP for localhost (default: `0`) |
| `WPNAV_MAX_RESPONSE_KB` | No | Max response size (default: `64`) |

---

## Using Config File vs Environment Variables

### Config File (Recommended)

- Easier to manage multiple environments
- Supports environment variable references (`$VAR_NAME`)
- Walk-up discovery finds config in parent directories
- Credentials can be stored separately in `.wpnav.env`

### Environment Variables

- Simpler for single-site setups
- Required for some CI/CD environments
- No file management needed

### Hybrid Approach

Config file with credential references:

```json
{
  "WP_BASE_URL": "https://your-site.com",
  "WP_REST_API": "https://your-site.com/wp-json",
  "WPNAV_BASE": "https://your-site.com/wp-json/wpnav/v1",
  "WPNAV_INTROSPECT": "https://your-site.com/wp-json/wpnav/v1/introspect",
  "WP_APP_USER": "$WP_APP_USER",
  "WP_APP_PASS": "$WP_APP_PASS"
}
```

Then set credentials as environment variables or in `.wpnav.env`.

---

## Troubleshooting MCP Connections

### "MCP server not responding"

1. Check server starts correctly:
   ```bash
   npx wpnav status
   ```

2. Verify config file path in MCP settings is correct

3. Check for Node.js version issues:
   ```bash
   node --version  # Should be v18+
   ```

### "Tool not found"

1. Verify WP Navigator plugin is activated
2. Check introspect endpoint:
   ```bash
   npx wpnav call wpnav_introspect
   ```

### "Authentication failed"

1. Regenerate Application Password in WordPress
2. Update credentials in config or environment

### Still stuck?

Run full diagnostics:
```bash
npx wpnav doctor --json
```

See [Troubleshooting](./troubleshooting.md) for more solutions.

---

## Export for CI/CD

Generate environment exports for different platforms:

```bash
# Shell format (default)
npx wpnav export-env

# Docker format
npx wpnav export-env --format docker

# GitHub Actions format
npx wpnav export-env --format github
```

---

**Last Updated**: 2025-12-18
