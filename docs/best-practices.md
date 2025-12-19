# Best Practices for WP Navigator MCP

**Version**: 2.7.0+
**Purpose**: Recommendations for human users to maximize effectiveness

---

## Quick Reference

| Practice | Priority | Impact |
|----------|----------|--------|
| **Use focus modes** | High | 85% token reduction |
| **Set up `wpnavigator.jsonc`** | High | Consistent AI behavior |
| **Use keychain credentials** | High | Security |
| **Generate context for web AI** | Medium | Web agent compatibility |
| **Use `--dry-run` for writes** | Medium | Safety |

---

## Token Optimization

### Focus Modes

Focus modes pre-filter tools to reduce context and token usage:

| Mode | Tools | Token Savings | When to Use |
|------|-------|---------------|-------------|
| `content-editing` | 14 | 82% | Writing and publishing |
| `read-only` | ~30 | 59% | Auditing and reporting |
| `full-admin` | All 75+ | 0% | Full site management |

**Configure in `wpnavigator.jsonc`:**

```jsonc
{
  "ai": {
    "focus_mode": "content-editing"
  }
}
```

### Dynamic Toolsets (v2.7.0+)

WP Navigator exposes only 5 meta-tools to AI, reducing initial context from ~19,500 tokens to ~500 tokens (97% reduction).

| Scenario | Tokens Used | Savings |
|----------|-------------|---------|
| Initial load | ~500 | 97% |
| Single tool use | ~1,300 | 93% |
| 3 tools (complex) | ~2,100 | 89% |
| 10 tools (power user) | ~5,500 | 72% |

---

## Security Best Practices

### Use Keychain Credentials

Store credentials securely in your system keychain instead of config files:

```bash
npx wpnav configure --keychain
```

This:
- Encrypts credentials with OS-level protection
- Prevents accidental commits of secrets
- Works on macOS (Keychain) and Windows (Credential Manager)

### Safe-by-Default Writes

WP Navigator disables write operations by default. Enable only when needed:

```bash
# One-time enable
WPNAV_ENABLE_WRITES=1 npx wpnav call wpnav_create_post ...

# In MCP config (persistent)
{
  "env": {
    "WPNAV_ENABLE_WRITES": "1"
  }
}
```

### Use Dry-Run Before Writes

Preview changes before applying:

```bash
# Preview post update
npx wpnav call wpnav_update_post --id 1 --title "New Title" --dry-run

# Preview sync operation
npx wpnav sync --dry-run
```

---

## Configuration Best Practices

### Set Up `wpnavigator.jsonc`

The manifest file defines your site's intent and AI behavior:

```jsonc
{
  "$schema": "https://wpnav.ai/schemas/wpnavigator.schema.json",
  "schema_version": 2,
  "brand": {
    "name": "My Site",
    "voice": "professional and helpful"
  },
  "ai": {
    "focus_mode": "content-editing",
    "role": "content-editor"
  },
  "safety": {
    "mode": "normal"
  }
}
```

### Use Environment Variables for Credentials

Keep credentials out of config files:

```json
{
  "WP_APP_USER": "$WP_APP_USER",
  "WP_APP_PASS": "$WP_APP_PASS"
}
```

Then set environment variables:
```bash
export WP_APP_USER="admin"
export WP_APP_PASS="xxxx xxxx xxxx xxxx"
```

### Validate Configuration

Check your setup before use:

```bash
npx wpnav validate
npx wpnav doctor
```

---

## Workflow Best Practices

### Use Snapshots Before Major Changes

Capture site state before making significant changes:

```bash
# Capture full site snapshot
npx wpnav snapshot site

# Capture specific page
npx wpnav snapshot page about
```

### Use Rollback for Recovery

If something goes wrong during sync:

```bash
# List available snapshots
npx wpnav rollback --list

# Restore from snapshot
npx wpnav rollback <sync-id>
```

### Generate Context for Web AI

For ChatGPT and other web-based AI without MCP support:

```bash
# Generate context file
npx wpnav context > wordpress-context.md

# Compact version for smaller context windows
npx wpnav context --compact > wordpress-context.md
```

---

## Local Development

### Allow HTTP for Localhost

For LocalWP, Docker, MAMP without HTTPS:

```bash
ALLOW_INSECURE_HTTP=1 npx wpnav status
```

Or in MCP config:
```json
{
  "env": {
    "ALLOW_INSECURE_HTTP": "1"
  }
}
```

### Use Repair Mode for Broken Config

Fix broken or outdated configuration:

```bash
npx wpnav init --repair
```

---

## Multi-Platform Support

WP Navigator works with multiple AI platforms:

```bash
# Generate MCP config for your platform
npx wpnav mcp-config --claude    # Claude Code
npx wpnav mcp-config --codex     # OpenAI Codex
npx wpnav mcp-config --gemini    # Google Gemini CLI
```

---

## Summary

1. **Use focus modes** for token efficiency
2. **Store credentials in keychain** for security
3. **Use `--dry-run`** before writes
4. **Set up `wpnavigator.jsonc`** for consistent AI behavior
5. **Take snapshots** before major changes
6. **Validate config** before use

---

## See Also

- [AI Agent Guide](ai-agent-guide.md) - For AI agent developers
- [CLI Reference](cli-reference.md) - Complete command documentation
- [Dynamic Toolsets](DYNAMIC-TOOLSETS.md) - Architecture details
- [Security](security.md) - Security model and practices

---

**Last Updated**: 2025-12-17
