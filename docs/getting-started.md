# Getting Started

Get WP Navigator MCP running in under 5 minutes.

---

## Prerequisites

Before you begin, ensure you have:

1. **Node.js 18+** (or use the [standalone binary](./BINARY-INSTALLATION.md))
   ```bash
   node --version  # Should be v18.0.0 or higher
   ```

2. **WordPress 5.6+** with REST API enabled

3. **WP Navigator plugin** installed and activated
   - [Free version](https://wordpress.org/plugins/wp-navigator/) from WordPress.org
   - Or [Pro version](https://wpnav.ai/pro) for advanced features

---

## Quick Start (Recommended)

The fastest way to get started is using **Magic Link** authentication:

### Step 1: Generate a Magic Link

1. Go to WordPress Admin → **WP Navigator → Settings**
2. Click **"Connect AI Assistant"**
3. Copy the generated Magic Link

### Step 2: Connect

```bash
npx @littlebearapps/wp-navigator-mcp connect "<your-magic-link>"
```

This single command:
- Validates the connection
- Stores credentials securely
- Creates project configuration
- Scaffolds sample prompts

### Step 3: Verify

```bash
npx wpnav status
```

You should see:
```
✓ Connection verified!
  Site: Your Site Name
  WordPress: 6.4.2
  WP Navigator: Pro v2.7.0
  Tools available: 86
```

**That's it!** You're ready to use WP Navigator with Claude Code or any MCP client.

---

## Manual Setup (Alternative)

If Magic Link isn't available, you can configure manually:

### Step 1: Create Application Password

In WordPress Admin: **Users → Your Profile → Application Passwords**

1. Enter a name: `wp-navigator`
2. Click **"Add New Application Password"**
3. Copy the password immediately (it won't be shown again)

### Step 2: Initialize Project

```bash
npx wpnav init
```

Follow the interactive wizard to enter:
- WordPress site URL
- Username
- Application password

### Step 3: Verify Connection

```bash
npx wpnav status
```

---

## Configuration Files

After setup, you'll have these files:

| File | Purpose |
|------|---------|
| `wpnav.config.json` | Site URLs and environment settings |
| `.wpnav.env` | Credentials (auto-gitignored) |
| `wpnavigator.jsonc` | Content manifest with AI, tools, and safety settings |

For a complete example with all configuration options, see the [example wpnavigator.jsonc](./examples/wpnavigator.jsonc).

### Environment Variables

You can also use environment variables:

```bash
export WP_BASE_URL="https://your-site.com"
export WP_APP_USER="your-username"
export WP_APP_PASS="xxxx xxxx xxxx xxxx"
```

---

## Test Your First Command

Try listing posts from your WordPress site:

```bash
npx wpnav call wpnav_list_posts --limit 5
```

Or get a site overview:

```bash
npx wpnav call wpnav_get_site_overview
```

---

## Troubleshooting

### "Command not recognized"

Ensure you're using the full package name with npx:

```bash
npx @littlebearapps/wp-navigator-mcp <command>
# Or after init, just:
npx wpnav <command>
```

### "Connection failed"

Run diagnostics:

```bash
npx wpnav doctor
```

Common fixes:
- Verify site URL is correct and accessible
- Check Application Password is valid
- Ensure WP Navigator plugin is activated

### "Config not found"

WP Navigator searches for `wpnav.config.json` in the current directory and parent directories. Either:
- Run commands from your project directory
- Use `--config` flag: `npx wpnav --config /path/to/wpnav.config.json status`

For more issues, see [Troubleshooting](./troubleshooting.md).

---

## Next Steps

- **[MCP Setup Guide](./mcp-setup.md)** — Configure Claude Code, Codex, or Gemini CLI
- **[CLI Reference](./cli-reference.md)** — Full command documentation
- **[Security Guide](./security.md)** — Safe-by-default practices
- **[FAQ](./faq.md)** — Common questions answered

---

## Need Help?

- **GitHub Issues**: [Report bugs or request features](https://github.com/littlebearapps/wp-navigator-mcp/issues)
- **Discussions**: [Ask questions and share tips](https://github.com/littlebearapps/wp-navigator-mcp/discussions)

---

**Last Updated**: 2025-12-18
