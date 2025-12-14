# Frequently Asked Questions

Quick answers to common questions about WP Navigator MCP.

---

## General

### What is WP Navigator MCP?

WP Navigator MCP is an MCP (Model Context Protocol) server that enables AI assistants like Claude to manage WordPress sites. It provides 68+ tools for content management, plugins, themes, and Gutenberg block editing.

### What AI assistants are supported?

Any MCP-compatible client works, including:

- **Claude Code** - CLI for developers
- **Gemini CLI** - Google's AI assistant
- **Other MCP clients** - Any client implementing the MCP protocol

### Do I need to install anything on WordPress?

Yes, you need the **WP Navigator plugin** installed on your WordPress site:

- **[WP Navigator Free](https://wordpress.org/plugins/wp-navigator/)** - Basic features, free
- **[WP Navigator Pro](https://wpnav.ai/pro)** - Advanced features, premium

The MCP server connects to your WordPress site through the plugin's REST API.

---

## Setup

### How do I get an Application Password?

1. Go to WordPress Admin → Users → Your Profile
2. Scroll to "Application Passwords"
3. Enter a name like "WP Navigator MCP"
4. Click "Add New Application Password"
5. Copy the password immediately (shown only once)

**Requirements:**
- WordPress 5.6 or later
- HTTPS enabled (or localhost)

### Why can't I see Application Passwords?

Possible reasons:

- WordPress version is below 5.6
- Site is not using HTTPS
- A security plugin disabled Application Passwords
- Custom code disabled the feature

### What's the difference between `wp-config.json` and `wpnav.config.json`?

- **`wp-config.json`** - Legacy single-environment format
- **`wpnav.config.json`** - New format with multi-environment support

Both work. New projects should use `wpnav.config.json` for local/staging/production environments.

---

## Free vs Pro

### What's the difference between Free and Pro?

| Feature | Free | Pro |
|---------|------|-----|
| Posts & Pages | ✅ | ✅ |
| Media Management | ✅ | ✅ |
| Comments & Taxonomies | ✅ | ✅ |
| Plugins & Themes | ✅ | ✅ |
| Gutenberg Blocks | ✅ | ✅ |
| User Management | ✅ | ✅ |
| Policy Controls | Basic | Advanced |
| Audit Logging | - | ✅ |
| Priority Support | - | ✅ |

### Does the MCP server know which plugin edition I'm using?

Yes. When connecting, the MCP server calls `wpnav_introspect` which returns the plugin edition. Some Pro features are enforced server-side by the WordPress plugin.

---

## Security

### Is my data secure?

Yes. WP Navigator MCP:

- **Connects only to your WordPress site** - No third-party servers
- **No telemetry** - No data sent to us
- **Local credentials** - Your credentials stay in your config file
- **HTTPS required** - Encrypted connections for non-localhost

See [Security](security.md) for details.

### How do I enable write operations?

Set `WPNAV_ENABLE_WRITES=1` in your MCP client config:

```json
{
  "env": {
    "WPNAV_ENABLE_WRITES": "1"
  }
}
```

Writes are disabled by default for safety.

### Why do I get "WRITES_DISABLED" error?

You're trying to create, update, or delete something without enabling writes. See above.

### Can the AI assistant access anything outside my WordPress site?

No. WP Navigator MCP only connects to the WordPress URL you configure. It cannot:

- Access other websites
- Make requests to arbitrary URLs
- Read your local files (except the config file)

---

## Multiple Sites

### Can I use this with multiple WordPress sites?

Yes! Use the multi-environment config format:

```json
{
  "environments": {
    "site-a": { "WP_BASE_URL": "https://site-a.com", ... },
    "site-b": { "WP_BASE_URL": "https://site-b.com", ... }
  },
  "defaultEnvironment": "site-a"
}
```

Switch environments:

```bash
npx wpnav --env site-b status
```

### Can I manage staging and production from the same config?

Yes, that's the intended use case:

```json
{
  "environments": {
    "local": { ... },
    "staging": { ... },
    "production": { ... }
  },
  "defaultEnvironment": "local"
}
```

---

## CLI Mode

### What's CLI mode?

CLI mode lets you run WP Navigator commands directly from your terminal, without going through an MCP client. Useful for:

- Scripting and automation
- Testing tools quickly
- Web-based AI agents

### What's the difference between MCP mode and CLI mode?

| Aspect | MCP Mode | CLI Mode |
|--------|----------|----------|
| Interface | Claude/AI client | Terminal |
| Invocation | Natural language | `npx wpnav call ...` |
| Use case | Interactive AI sessions | Scripts, automation |
| Auth | Configured in MCP client | Config file or env vars |

Both use the same underlying tools.

---

## Updates

### How do I update to a new version?

**For npx users** (recommended):

npx automatically uses the latest version. To force update:

```bash
npm cache clean --force
npx @littlebearapps/wp-navigator-mcp@latest --version
```

**For global install:**

```bash
npm update -g @littlebearapps/wp-navigator-mcp
```

### How do I check which version I have?

```bash
npx @littlebearapps/wp-navigator-mcp --version
```

### Where's the changelog?

- [GitHub Releases](https://github.com/littlebearapps/wp-navigator-mcp/releases)
- [CHANGELOG.md](https://github.com/littlebearapps/wp-navigator-mcp/blob/main/CHANGELOG.md)

---

## Troubleshooting

### Where are the logs?

**CLI mode:**
```bash
npx wpnav doctor  # Runs diagnostics
```

### Why is it slow?

Common causes:

1. **WordPress performance** - Check your site's speed
2. **Large responses** - Use pagination (`--limit` flag)
3. **Network latency** - Check your connection to the WordPress server

### How do I report a bug?

Use the [bug report template](https://github.com/littlebearapps/wp-navigator-mcp/issues/new?template=bug_report.yml) on GitHub.

Include:
- MCP client and version
- Steps to reproduce
- Error messages/logs

---

## Still Have Questions?

- **Discussions**: [GitHub Discussions](https://github.com/littlebearapps/wp-navigator-mcp/discussions) - Ask the community
- **Documentation**: [wpnav.ai/docs](https://wpnav.ai/docs) - Full documentation
- **Issues**: [GitHub Issues](https://github.com/littlebearapps/wp-navigator-mcp/issues) - Bug reports

---

## See Also

- [CLI Reference](cli-reference.md) - Command documentation
- [Security](security.md) - Security practices
- [Troubleshooting](troubleshooting.md) - Problem solving
- [Contributing](contributing.md) - How to contribute
