# Troubleshooting

Solutions to common issues with WP Navigator MCP.

---

## Quick Diagnostics

Run the doctor command for automated diagnostics:

```bash
npx wpnav doctor
```

This checks Node.js, configuration, network, and authentication.

---

## CLI Command Issues

### "Command starts MCP server instead of CLI"

**Symptoms:**
- Running `npx wpnav connect` starts MCP server mode
- Command hangs waiting for MCP input
- No CLI output, just waiting

**Solutions:**

1. **Update to v2.8.0+:**
   ```bash
   npx @littlebearapps/wp-navigator-mcp@latest --version
   ```

2. **Clear npm cache:**
   ```bash
   npm cache clean --force
   ```

3. **Use explicit package name:**
   ```bash
   npx @littlebearapps/wp-navigator-mcp connect
   ```

### "Command not recognized"

**Symptoms:**
- Error: `Unknown command`
- Command not listed in help

**Solutions:**

1. **Check spelling:**
   ```bash
   npx wpnav --help
   ```

2. **Update to latest version:**
   ```bash
   npx @littlebearapps/wp-navigator-mcp@latest --help
   ```

3. **Common commands:**
   - `init`, `connect`, `status`, `doctor`
   - `call`, `tools`, `validate`, `configure`
   - `snapshot`, `diff`, `sync`, `rollback`

---

## Connection Issues

### "Connection refused" or "ECONNREFUSED"

**Symptoms:**
- Error: `ECONNREFUSED`
- Error: `connect ETIMEDOUT`

**Solutions:**

1. **Verify WordPress site is running:**
   ```bash
   curl -I https://your-site.com
   ```

2. **Check URL in configuration:**
   ```bash
   npx wpnav validate
   ```

3. **Test REST API directly:**
   ```bash
   curl https://your-site.com/wp-json/
   ```

4. **Check firewall/proxy:**
   - Ensure outbound HTTPS (port 443) is allowed
   - Check corporate proxy settings

### "SSL/TLS error" or Certificate Issues

**Symptoms:**
- Error: `UNABLE_TO_VERIFY_LEAF_SIGNATURE`
- Error: `CERT_HAS_EXPIRED`

**Solutions:**

1. **Verify SSL certificate:**
   ```bash
   openssl s_client -connect your-site.com:443
   ```

2. **For self-signed certificates (development only):**
   ```bash
   NODE_TLS_REJECT_UNAUTHORIZED=0 npx wpnav status
   ```
   ⚠️ Never use in production!

3. **For localhost development:**
   ```bash
   ALLOW_INSECURE_HTTP=1 npx wpnav status
   ```

### "DNS resolution failed"

**Symptoms:**
- Error: `ENOTFOUND`
- Error: `getaddrinfo ENOTFOUND`

**Solutions:**

1. **Check hostname:**
   ```bash
   nslookup your-site.com
   ```

2. **Try IP address directly** (if known)

3. **Check `/etc/hosts`** for local overrides

---

## Authentication Errors

### 401 Unauthorized

**Symptoms:**
- Error: `Authentication failed`
- Error: `401 Unauthorized`
- Status: `Invalid credentials`

**Solutions:**

1. **Verify Application Password format:**
   - Should be 24 characters with spaces: `xxxx xxxx xxxx xxxx xxxx xxxx`
   - No extra quotes or escaping

2. **Regenerate Application Password:**
   - WordPress Admin → Users → Your Profile → Application Passwords
   - Delete old password, create new one
   - Copy immediately (only shown once)

3. **Check username:**
   - Must match WordPress username exactly (case-sensitive)
   - Not email address (unless that's your username)

4. **Verify user exists:**
   ```bash
   npx wpnav call wpnav_list_users --limit 5
   ```

### 403 Forbidden

**Symptoms:**
- Error: `403 Forbidden`
- Error: `Permission denied`

**Solutions:**

1. **Check user role:**
   - User needs Administrator role for most operations
   - Or specific capabilities for limited access

2. **Check WP Navigator plugin settings:**
   - WordPress Admin → WP Navigator → Guardrails
   - Ensure required operations are enabled

3. **Check WordPress security plugins:**
   - Some plugins block REST API access
   - Whitelist the Application Password or user

### "Application Passwords disabled"

**Symptoms:**
- No "Application Passwords" section in WordPress profile
- Error mentioning Application Passwords

**Solutions:**

1. **Requires WordPress 5.6+**

2. **Requires HTTPS** (or localhost)

3. **Check if disabled by plugin:**
   - Some security plugins disable Application Passwords
   - Check plugin settings

4. **Check if disabled by code:**
   ```php
   // In wp-config.php or theme - remove if present:
   add_filter('wp_is_application_passwords_available', '__return_false');
   ```

---

## Plugin Issues

### "Plugin not found" (404 on /wpnav/v1/)

**Symptoms:**
- Error: `404 Not Found` on introspect
- Error: `Route not found`

**Solutions:**

1. **Verify plugin is installed:**
   - WordPress Admin → Plugins
   - Look for "WP Navigator" or "WP Navigator Pro"

2. **Verify plugin is activated:**
   - Must be activated, not just installed

3. **Flush permalinks:**
   - WordPress Admin → Settings → Permalinks
   - Click "Save Changes" (no changes needed)

4. **Test endpoint directly:**
   ```bash
   curl -u "user:app-password" https://your-site.com/wp-json/wpnav/v1/introspect
   ```

### "Plugin version mismatch"

**Symptoms:**
- Warning about version compatibility
- Some tools not working

**Solutions:**

1. **Update WP Navigator plugin** to latest version

2. **Check compatibility table** in README.md

3. **Update MCP server:**
   ```bash
   npx @littlebearapps/wp-navigator-mcp@latest --version
   ```

---

## Configuration Issues

### "Config file not found"

**Symptoms:**
- Error: `Configuration file not found`
- Error: `No wpnav.config.json found`

**Solutions:**

1. **Check walk-up discovery (v2.8.0+):**

   WP Navigator searches for config in parent directories automatically:
   ```
   /project/subdir/     ← you are here
   /project/            ← wpnav.config.json found here ✓
   ```

2. **Check current directory:**
   ```bash
   ls -la wpnav.config.json
   ls -la wp-config.json
   ```

3. **Use explicit path:**
   ```bash
   npx wpnav --config /full/path/to/wpnav.config.json status
   ```

4. **Create config file:**
   ```bash
   npx wpnav init
   ```

5. **Supported config file names:**
   - `wpnav.config.json` (recommended)
   - `wpnav.config.jsonc` (with comments)
   - `wp-config.json` (legacy)

### "Invalid JSON in config file"

**Symptoms:**
- Error: `SyntaxError: Unexpected token`
- Error: `JSON parse error`

**Solutions:**

1. **Validate JSON:**
   ```bash
   cat wpnav.config.json | jq .
   ```

2. **Common issues:**
   - Trailing commas (not allowed in JSON)
   - Single quotes (use double quotes)
   - Unescaped characters in passwords

3. **Use JSONC format** (allows comments):
   - Rename to `wpnav.config.jsonc`
   - Or use `wpnavigator.jsonc`

4. **See example configuration:** [wpnavigator.jsonc example](./examples/wpnavigator.jsonc)

### "Missing required field"

**Symptoms:**
- Error: `Missing required field: WP_BASE_URL`
- Validation errors

**Solutions:**

1. **Check all required fields:**
   ```json
   {
     "WP_BASE_URL": "https://...",
     "WP_REST_API": "https://.../wp-json",
     "WPNAV_BASE": "https://.../wp-json/wpnav/v1",
     "WPNAV_INTROSPECT": "https://.../wp-json/wpnav/v1/introspect",
     "WP_APP_USER": "...",
     "WP_APP_PASS": "..."
   }
   ```

2. **Validate config:**
   ```bash
   npx wpnav validate
   ```

---

## MCP Client Issues

### Claude Code: "Tools not loading"

**Symptoms:**
- `/mcp` doesn't show wpnav
- Tools timeout

**Solutions:**

1. **Check `.mcp.json` in project:**
   ```bash
   cat .mcp.json | jq .
   ```

2. **Verify npx works:**
   ```bash
   npx @littlebearapps/wp-navigator-mcp --version
   ```

3. **Clear npm cache:**
   ```bash
   npm cache clean --force
   ```

---

## Write Operation Issues

### "WRITES_DISABLED"

**Symptoms:**
- Error: `Write operations are disabled`
- Cannot create/update/delete

**Solutions:**

1. **Set environment variable:**
   ```json
   {
     "env": {
       "WPNAV_ENABLE_WRITES": "1"
     }
   }
   ```

2. **For CLI:**
   ```bash
   WPNAV_ENABLE_WRITES=1 npx wpnav call wpnav_create_post --title "Test"
   ```

### "Operation blocked by policy"

**Symptoms:**
- Error: `POLICY_DENY`
- Error: `Operation not allowed`

**Solutions:**

1. **Check WP Navigator settings:**
   - WordPress Admin → WP Navigator → Guardrails
   - Enable required operation category

2. **Check user capabilities:**
   - User may lack required WordPress capabilities

---

## Performance Issues

### "Timeout" errors

**Symptoms:**
- Error: `Operation timed out`
- Very slow responses

**Solutions:**

1. **Increase timeout:**
   ```bash
   WPNAV_TOOL_TIMEOUT_MS=900000 npx wpnav call wpnav_list_posts
   ```

2. **Check WordPress performance:**
   - Slow database queries
   - Plugin conflicts
   - Server resources

3. **Use pagination:**
   ```bash
   npx wpnav call wpnav_list_posts --limit 10 --page 1
   ```

### "Response truncated"

**Symptoms:**
- Warning about truncated response
- Missing data in results

**Solutions:**

1. **Increase response limit:**
   ```bash
   WPNAV_MAX_RESPONSE_KB=256 npx wpnav call wpnav_list_posts
   ```

2. **Use pagination** for large result sets

3. **Request specific fields** instead of full objects

---

## Local Development (v2.4.0+)

### HTTP Connection Refused

**Symptoms:**
- Error: `Insecure HTTP connection rejected`
- Works with HTTPS but not HTTP localhost

**Solutions:**

1. **Enable insecure HTTP for localhost:**
   ```bash
   ALLOW_INSECURE_HTTP=1 npx wpnav status
   ```

2. **In MCP config:**
   ```json
   {
     "env": {
       "ALLOW_INSECURE_HTTP": "1"
     }
   }
   ```

### Environment Variable Credentials Not Loading

**Symptoms:**
- Config uses `$WP_APP_USER` but still prompts for credentials
- Error about missing credentials despite env vars set

**Solutions:**

1. **Check env vars are exported:**
   ```bash
   echo $WP_APP_USER $WP_APP_PASS
   ```

2. **Verify config syntax** (must use `$` prefix):
   ```json
   {
     "WP_APP_USER": "$WP_APP_USER",
     "WP_APP_PASS": "$WP_APP_PASS"
   }
   ```

3. **Shell session must have vars exported:**
   ```bash
   export WP_APP_USER="admin"
   export WP_APP_PASS="xxxx xxxx xxxx xxxx"
   ```

### Broken Configuration After Update

**Symptoms:**
- Config worked before, now fails validation
- Missing or outdated files

**Solutions:**

1. **Run repair mode:**
   ```bash
   npx wpnav init --repair
   ```

2. **This will:**
   - Detect existing configuration
   - Validate each file
   - Offer to regenerate broken files
   - Preserve valid credentials

---

## Getting Help

If these solutions don't help:

1. **Run diagnostics:**
   ```bash
   npx wpnav doctor --json > diagnostics.json
   ```

2. **Check existing issues:** [GitHub Issues](https://github.com/littlebearapps/wp-navigator-mcp/issues)

3. **Ask in Discussions:** [GitHub Discussions](https://github.com/littlebearapps/wp-navigator-mcp/discussions)

4. **Open new issue:** Include diagnostics output and steps to reproduce

---

## See Also

- [Getting Started](getting-started.md) - Quick setup guide
- [MCP Setup](mcp-setup.md) - Configure Claude Code, Codex, Gemini
- [CLI Reference](cli-reference.md) - Command documentation
- [Security](security.md) - Security configuration
- [FAQ](faq.md) - Frequently asked questions

---

**Last Updated**: 2025-12-18
