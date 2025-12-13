# Security

WP Navigator MCP is designed with security as a core principle. This document explains our security model and best practices.

---

## Safe by Default

WP Navigator MCP operates in **read-only mode** by default. Write operations (create, update, delete) are disabled until explicitly enabled.

### Enabling Writes

To enable write operations, set the environment variable:

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

This prevents accidental modifications when you only need to read content.

---

## Transport Security

### HTTPS Enforcement

- **Non-localhost connections require HTTPS** (TLS 1.2+)
- HTTP is blocked by default for remote sites
- For local development, set `ALLOW_INSECURE_HTTP=1`

```bash
# Only for localhost development
ALLOW_INSECURE_HTTP=1 npx wpnav status
```

### Single-Origin Policy

WP Navigator MCP only connects to the WordPress URL you configure. It will not:

- Follow redirects to different domains
- Make requests to arbitrary URLs
- Connect to URLs provided in tool arguments

This prevents Server-Side Request Forgery (SSRF) attacks.

---

## Authentication

### Application Passwords

WP Navigator uses [WordPress Application Passwords](https://make.wordpress.org/core/2020/11/05/application-passwords-integration-guide/) for authentication:

- **Scoped access** - Separate from your main WordPress password
- **Revocable** - Delete anytime in WordPress admin
- **Auditable** - WordPress logs Application Password usage

### Creating Application Passwords

1. Go to WordPress Admin → Users → Your Profile
2. Scroll to "Application Passwords"
3. Enter a name (e.g., "WP Navigator MCP")
4. Click "Add New Application Password"
5. Copy the generated password immediately (it won't be shown again)

### Best Practices

- **Use a dedicated user** - Create a WordPress user specifically for WP Navigator
- **Minimum permissions** - Only grant roles/capabilities needed
- **Rotate regularly** - Regenerate Application Passwords periodically
- **Revoke when done** - Delete unused Application Passwords

---

## WordPress Plugin Security

The WP Navigator plugin (Free or Pro) enforces additional security:

### Policy-Based Access Control

Configure which operations are allowed in WordPress admin:

- **Category-level control** - Enable/disable posts, pages, media, plugins, etc.
- **Read/write separation** - Allow reads but block writes per category
- **Per-user policies** - Different permissions for different users

### Audit Logging

The plugin logs all MCP operations:

- Tool invocations
- User and timestamp
- Success/failure status

Check logs in WordPress admin for security monitoring.

---

## Data Handling

### What Data Is Sent

WP Navigator MCP sends to your WordPress site:

- Tool invocation parameters (post IDs, titles, content, etc.)
- Authentication credentials (in HTTP headers)

### What Data Is NOT Sent

- No telemetry to third parties
- No analytics collection
- No data leaves your WordPress site except responses to your requests

### Local Storage

Configuration files may contain sensitive data. Protect them:

```bash
# Recommended permissions for config file
chmod 600 wpnav.config.json

# Add to .gitignore
echo "wpnav.config.json" >> .gitignore
echo "wp-config.json" >> .gitignore
```

---

## Operational Security

### Timeouts

All operations have configurable timeouts to prevent hanging:

```bash
# Default: 10 minutes (600000ms)
WPNAV_TOOL_TIMEOUT_MS=300000 npx wpnav call wpnav_list_posts
```

### Response Size Limits

Large responses are truncated to prevent memory issues:

```bash
# Default: 64KB
WPNAV_MAX_RESPONSE_KB=128 npx wpnav call wpnav_list_posts
```

### Concurrency Guard

Only one write operation runs at a time. This prevents:

- Race conditions
- Conflicting updates
- Accidental bulk modifications

---

## Reporting Security Issues

If you discover a security vulnerability:

1. **Do NOT open a public GitHub issue**
2. Use [GitHub Security Advisories](https://github.com/littlebearapps/wp-navigator-mcp/security/advisories/new)
3. Or email security@littlebearapps.com

We will:

- Acknowledge within 48 hours
- Investigate and provide updates
- Credit you in the fix (unless you prefer anonymity)

---

## Security Checklist

Before using WP Navigator MCP in production:

- [ ] HTTPS enabled on WordPress site
- [ ] Dedicated WordPress user for MCP access
- [ ] Minimum necessary permissions configured
- [ ] Application Password (not main password) used
- [ ] Configuration file excluded from version control
- [ ] `WPNAV_ENABLE_WRITES` only enabled when needed
- [ ] Regular review of WordPress audit logs

---

## See Also

- [CLI Reference](cli-reference.md) - Command documentation
- [Troubleshooting](troubleshooting.md) - Common issues
- [FAQ](faq.md) - Frequently asked questions
