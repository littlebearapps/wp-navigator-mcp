# CLI Reference

Complete command-line reference for WP Navigator MCP.

---

## Installation

### npx (Recommended)

Run without installation:

```bash
npx @littlebearapps/wp-navigator-mcp --help
```

### Global Install

```bash
npm install -g @littlebearapps/wp-navigator-mcp
wpnav --help
```

### Local Development

```bash
git clone https://github.com/littlebearapps/wp-navigator-mcp.git
cd wp-navigator-mcp
npm install
npm run build
npm start -- --help
```

---

## Configuration

### Configuration File Format

Create `wpnav.config.json` in your project directory:

```json
{
  "environments": {
    "local": {
      "WP_BASE_URL": "http://localhost:8080",
      "WP_REST_API": "http://localhost:8080/wp-json",
      "WPNAV_BASE": "http://localhost:8080/wp-json/wpnav/v1",
      "WPNAV_INTROSPECT": "http://localhost:8080/wp-json/wpnav/v1/introspect",
      "WP_APP_USER": "admin",
      "WP_APP_PASS": "xxxx xxxx xxxx xxxx"
    },
    "staging": {
      "WP_BASE_URL": "https://staging.example.com",
      "WP_REST_API": "https://staging.example.com/wp-json",
      "WPNAV_BASE": "https://staging.example.com/wp-json/wpnav/v1",
      "WPNAV_INTROSPECT": "https://staging.example.com/wp-json/wpnav/v1/introspect",
      "WP_APP_USER": "your-username",
      "WP_APP_PASS": "xxxx xxxx xxxx xxxx"
    },
    "production": {
      "WP_BASE_URL": "https://example.com",
      "WP_REST_API": "https://example.com/wp-json",
      "WPNAV_BASE": "https://example.com/wp-json/wpnav/v1",
      "WPNAV_INTROSPECT": "https://example.com/wp-json/wpnav/v1/introspect",
      "WP_APP_USER": "your-username",
      "WP_APP_PASS": "xxxx xxxx xxxx xxxx"
    }
  },
  "defaultEnvironment": "local"
}
```

### Legacy Single-Environment Format

Also supported for backwards compatibility:

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

### Walk-Up Discovery

The CLI searches for configuration in this order:

1. Explicit `--config <path>` flag
2. `wpnav.config.json` in current directory
3. `wpnav.config.json` in parent directories (walks up to filesystem root)
4. `wp-config.json` (legacy format)

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `WPNAV_ENABLE_WRITES` | `0` | Enable write operations (create/update/delete) |
| `ALLOW_INSECURE_HTTP` | `0` | Allow HTTP for localhost development |
| `WPNAV_TOOL_TIMEOUT_MS` | `600000` | Per-tool timeout (10 minutes) |
| `WPNAV_MAX_RESPONSE_KB` | `64` | Maximum response size before truncation |
| `WPNAV_DEBUG_HTTP_TIMING` | `0` | Enable HTTP timing debug output |
| `WP_APP_USER` | - | WordPress username (for env-based credential loading) |
| `WP_APP_PASS` | - | WordPress application password (for env-based credential loading) |

### Environment Variable Credentials (v2.4.0+)

Credentials can reference environment variables in configuration files using the `$VAR` syntax:

```json
{
  "environments": {
    "local": {
      "WP_BASE_URL": "http://localhost:8080",
      "WP_REST_API": "http://localhost:8080/wp-json",
      "WPNAV_BASE": "http://localhost:8080/wp-json/wpnav/v1",
      "WPNAV_INTROSPECT": "http://localhost:8080/wp-json/wpnav/v1/introspect",
      "WP_APP_USER": "$WP_APP_USER",
      "WP_APP_PASS": "$WP_APP_PASS"
    }
  }
}
```

This allows credentials to be stored in environment variables rather than config files, which is useful for:
- CI/CD pipelines
- Docker containers
- Shared team configurations
- Keeping secrets out of version control

---

## Commands

### `wpnav connect` (v2.7.0+)

Connect to a WordPress site using a Magic Link from the WP Navigator plugin.

```bash
# Connect using Magic Link URL
npx wpnav connect wpnav://connect?site=example.com&token=abc123...

# Interactive mode (prompts for URL)
npx wpnav connect

# With options
npx wpnav connect <url> --json           # JSON output instead of TUI
npx wpnav connect <url> --local          # Allow HTTP for localhost
npx wpnav connect <url> --skip-init      # Don't auto-scaffold project
npx wpnav connect <url> --yes            # Skip confirmation prompts
```

**Options:**

| Flag | Description |
|------|-------------|
| `--json` | Output as JSON instead of TUI |
| `--local` | Allow HTTP for localhost development |
| `--skip-init` | Don't automatically run init after connection |
| `--yes` | Skip confirmation prompts |

**Magic Link flow:**

1. Open WordPress admin → WP Navigator → Settings
2. Click "Connect AI Assistant" to generate Magic Link
3. Copy the link and run `npx wpnav connect <link>`
4. Credentials are stored in `.wpnav.env` (auto-gitignored)

---

### `wpnav init`

Initialize a new WP Navigator project with configuration files.

```bash
# Interactive wizard (default)
npx wpnav init

# Skip entry screen, go directly to wizard
npx wpnav init --mode guided

# Quick setup - create files without prompts
npx wpnav init --mode scaffold

# Create files + AI handoff document
npx wpnav init --mode ai-handoff

# Repair existing configuration (v2.4.0+)
npx wpnav init --repair
```

**Options:**

| Flag | Description |
|------|-------------|
| `--mode <type>` | Setup mode: `guided`, `scaffold`, or `ai-handoff` |
| `--repair` | Validate and fix existing configuration files (v2.4.0+) |
| `--express` | Use detected defaults without prompts |
| `--skip-smoke-test` | Skip the connection test |
| `--json` | Output results as JSON |

**Modes:**

| Mode | Description |
|------|-------------|
| `guided` | Interactive wizard that walks you through setup |
| `scaffold` | Creates template files without prompts |
| `ai-handoff` | Creates files + AI-ready handoff document for agents |

**Repair Mode (v2.4.0+):**

The `--repair` flag provides idempotent configuration management:
- Detects existing configuration files
- Validates each file for syntax and schema compliance
- Offers to regenerate missing or broken files
- Preserves valid credentials and settings

```bash
# Check and fix configuration
npx wpnav init --repair

# Automatically offered when init detects existing config
npx wpnav init  # Will prompt: "Repair existing config?"
```

**Generated files:**

- `wpnav.config.json` - Configuration file
- `wpnavigator.jsonc` - Site manifest (optional)
- `sample-prompts/` - AI prompts (self-test, add-page, content-audit, etc.)
- `.wpnav/` - Local state directory

---

### `wpnav call <tool>`

Directly invoke an MCP tool.

```bash
# List posts
npx wpnav call wpnav_list_posts --limit 5

# Get site overview
npx wpnav call wpnav_get_site_overview

# Preview a change without executing (dry-run)
npx wpnav call wpnav_update_post --id 1 --title "New Title" --dry-run

# Create a post (requires WPNAV_ENABLE_WRITES=1)
WPNAV_ENABLE_WRITES=1 npx wpnav call wpnav_create_post --title "My Post" --content "Hello world"
```

**Options:**

| Flag | Description |
|------|-------------|
| `--dry-run` | Preview the operation without executing |
| `--json` | Output raw JSON response |
| `--config <path>` | Path to configuration file |
| `--env <name>` | Environment to use (local/staging/production) |

---

### `wpnav tools`

List available MCP tools.

```bash
# List all tools
npx wpnav tools

# Filter by category
npx wpnav tools --category content
npx wpnav tools --category plugins
npx wpnav tools --category gutenberg

# Output as JSON
npx wpnav tools --json

# Output as markdown (for documentation)
npx wpnav tools --format markdown
npx wpnav tools --format markdown --examples --toc

# Search tools semantically (v2.7.0)
npx wpnav tools --search "create blog post"
npx wpnav tools --search "upload image" --limit 5
npx wpnav tools --search "manage plugins" --category plugins

# Describe tool schemas (v2.7.0)
npx wpnav tools describe wpnav_list_posts
npx wpnav tools describe wpnav_create_page wpnav_update_page
npx wpnav tools describe wpnav_gutenberg_insert_block --json
```

**Options:**

| Flag | Description |
|------|-------------|
| `--category <name>` | Filter tools by category |
| `--search <query>` | Semantic search for tools (v2.7.0) |
| `--limit <n>` | Max results for search (default: 10) |
| `--json` | Output as JSON (default) |
| `--format <type>` | Output format: `json` or `markdown` |
| `--examples` | Include example usage (markdown only) |
| `--toc` | Include table of contents (markdown only) |

**Subcommands:**

| Subcommand | Description |
|------------|-------------|
| `describe <tool...>` | Get full JSON Schema for one or more tools (max 10) |
| `categories` | List all available tool categories |

**Categories:**

- `core` - Discovery, introspection, post types, search
- `content` - Posts, pages, media, comments
- `taxonomy` - Categories and tags
- `users` - User management
- `plugins` - Plugin management
- `themes` - Theme management
- `gutenberg` - Block editor operations
- `batch` - Batch get, update, delete operations
- `cookbook` - AI plugin guidance (Gutenberg, Elementor)
- `roles` - AI role personas (content-editor, developer, etc.)
- `options` - WordPress options read/write (v2.8.0)
- `settings` - Site settings and statistics (v2.8.0)
- `health` - WordPress Site Health integration (v2.8.0)
- `discovery` - REST routes, shortcodes, block patterns, templates (v2.8.0)
- `maintenance` - Flush rewrites, maintenance mode (v2.8.0)

---

## MCP Tool Discovery (v2.7.0+)

When running as an MCP server (for Claude Code, Codex CLI, Gemini CLI), WP Navigator uses a **Dynamic Toolsets** architecture that exposes only 5 meta-tools instead of 86+ individual tools. This reduces initial token usage from ~19,500 to ~500 tokens (97.7% reduction).

### Meta-Tools

| Tool | Purpose |
|------|---------|
| `wpnav_introspect` | Site discovery, capabilities, plugin version |
| `wpnav_search_tools` | Find tools by natural language query or category |
| `wpnav_describe_tools` | Get full JSON Schema for specific tools |
| `wpnav_execute` | Execute any tool by name with arguments |
| `wpnav_context` | Full context dump for non-MCP agents |

### Workflow: Search → Describe → Execute

**1. Search for relevant tools:**
```json
{
  "name": "wpnav_search_tools",
  "arguments": { "query": "list blog posts" }
}
```
Returns: `["wpnav_list_posts", "wpnav_get_post", "wpnav_search"]`

**2. Get tool schema (optional):**
```json
{
  "name": "wpnav_describe_tools",
  "arguments": { "tools": ["wpnav_list_posts"] }
}
```
Returns: Full JSON Schema with parameters, types, defaults

**3. Execute the tool:**
```json
{
  "name": "wpnav_execute",
  "arguments": {
    "tool": "wpnav_list_posts",
    "args": { "limit": 10, "status": "publish" }
  }
}
```

### Search Options

```json
// Natural language search
{ "query": "upload images" }

// Category filter
{ "category": "content" }

// Both
{ "query": "create", "category": "gutenberg" }
```

### CLI Equivalents

The CLI provides direct tool access without the meta-tool layer:

```bash
# CLI: Direct invocation (no meta-tools needed)
npx wpnav call wpnav_list_posts --limit 10

# MCP: Uses wpnav_execute internally
wpnav_execute(tool="wpnav_list_posts", args={"limit": 10})
```

**See also:** [Dynamic Toolsets Architecture](DYNAMIC-TOOLSETS.md)

---

### `wpnav status`

Check connection and configuration status.

```bash
npx wpnav status

# With specific config
npx wpnav status --config ./my-config.json

# Output as JSON
npx wpnav status --json
```

**Output includes:**

- Configuration file location and validity
- WordPress connection status
- Plugin version and edition (Free/Pro)
- Write mode status
- Environment information

---

### `wpnav validate`

Validate configuration and manifest files.

```bash
# Validate config file only
npx wpnav validate

# Validate manifest file
npx wpnav validate --manifest

# Validate snapshots
npx wpnav validate --snapshots

# Validate manifest only (skip config)
npx wpnav validate --manifest-only

# Test actual connection
npx wpnav validate --check-connection

# Strict mode (warnings are errors)
npx wpnav validate --strict

# Output as JSON
npx wpnav validate --json
```

**Validation checks:**

- JSON/JSONC syntax
- Required fields present
- URL format validity
- Credential format
- Schema compliance

---

### `wpnav configure`

Interactive credential setup.

```bash
# Interactive mode
npx wpnav configure

# Non-interactive (silent) mode
npx wpnav configure --silent \
  --site https://example.com \
  --user admin \
  --password "xxxx xxxx xxxx xxxx"
```

**Options:**

| Flag | Description |
|------|-------------|
| `--silent` | Non-interactive mode |
| `--site <url>` | WordPress site URL |
| `--user <username>` | WordPress username |
| `--password <pass>` | Application password |

---

### `wpnav credentials` (v2.7.0+)

Manage credentials stored in OS keychain (macOS Keychain, Windows Credential Manager, Linux Secret Service).

```bash
# Store credential in keychain
npx wpnav credentials store --site example.com

# Show stored credential
npx wpnav credentials show --site example.com

# Show credential with password revealed
npx wpnav credentials show --site example.com --reveal

# Remove credential from keychain
npx wpnav credentials clear --site example.com

# List all stored credentials
npx wpnav credentials list

# Check keychain status
npx wpnav credentials status

# Output as JSON
npx wpnav credentials list --json
```

**Subcommands:**

| Subcommand | Description |
|------------|-------------|
| `store --site <domain>` | Store credential in keychain (prompts for password) |
| `show --site <domain>` | Display stored credential (masked by default) |
| `clear --site <domain>` | Remove credential from keychain |
| `list` | List all stored credentials |
| `status` | Show keychain provider status |

**Options:**

| Flag | Description |
|------|-------------|
| `--site <domain>` | Site domain (required for store/show/clear) |
| `--reveal` | Show password in clear text (default: masked) |
| `--yes` | Skip confirmation prompts |
| `--json` | Output as JSON |

**Keychain reference in config:**

After storing credentials, use the keychain reference in `wpnav.config.json`:

```json
{
  "environments": {
    "production": {
      "site": "https://example.com",
      "user": "admin",
      "password": "keychain://wp-navigator/example.com"
    }
  }
}
```

**Platform support:**

| Platform | Provider | Status |
|----------|----------|--------|
| macOS | Keychain | Full support |
| Windows | Credential Manager | Full support |
| Linux | Secret Service (libsecret) | Requires libsecret-tools |

---

### `wpnav doctor`

Run system diagnostics and health checks.

```bash
npx wpnav doctor

# Output as JSON
npx wpnav doctor --json
```

**Checks performed:**

- Node.js version compatibility
- npm/npx availability
- Configuration file presence
- Network connectivity
- WordPress REST API access
- Plugin installation and activation
- Authentication validity
- Write permissions (if enabled)

---

### `wpnav snapshot`

Create snapshots of WordPress content.

```bash
# Full site index snapshot
npx wpnav snapshot site

# Single page snapshot by slug
npx wpnav snapshot page home
npx wpnav snapshot page about-us

# All pages snapshot
npx wpnav snapshot pages

# Plugin settings snapshot
npx wpnav snapshot plugins              # All plugins with extractors
npx wpnav snapshot plugins woocommerce  # Specific plugin
npx wpnav snapshot plugins --merge      # Update wpnavigator.jsonc manifest

# Output as JSON
npx wpnav snapshot site --json
```

**Snapshot types:**

| Type | Description |
|------|-------------|
| `site` | Full site index (pages, posts, plugins, themes, theme customizer) |
| `page <slug>` | Single page with full content and blocks |
| `pages` | All pages with content |
| `plugins [slug]` | Plugin settings extraction (WooCommerce, Yoast, RankMath, generic) |

**Plugin extractors:** Dedicated extractors for WooCommerce, Yoast SEO, and RankMath. Other plugins use a generic prefix-based extractor. Sensitive data (API keys, passwords, tokens) is automatically excluded.

Snapshots are stored in `.wpnav/snapshots/` for rollback.

---

### `wpnav diff`

Compare manifest against live WordPress site.

```bash
# Show differences
npx wpnav diff

# Output as JSON
npx wpnav diff --json
```

**Shows:**

- Pages/posts in manifest but not on site
- Pages/posts on site but not in manifest
- Content differences for matching pages
- Plugin/theme status differences

---

### `wpnav sync`

Apply manifest changes to WordPress.

```bash
# Preview changes (dry-run)
npx wpnav sync --dry-run

# Apply changes (prompts for confirmation)
npx wpnav sync

# Apply changes without confirmation
npx wpnav sync --yes
```

**Options:**

| Flag | Description |
|------|-------------|
| `--dry-run` | Preview changes without applying |
| `--yes` | Skip confirmation prompt |

**Note:** Creates automatic backup snapshot before applying changes.

---

### `wpnav rollback`

Restore from pre-sync snapshots.

```bash
# List available snapshots
npx wpnav rollback --list

# Restore from specific snapshot
npx wpnav rollback <sync-id>

# Preview rollback without applying
npx wpnav rollback <sync-id> --dry-run
```

---

### `wpnav cleanup`

Remove onboarding helper files after setup.

```bash
# Remove onboarding files
npx wpnav cleanup

# Skip confirmation prompt
npx wpnav cleanup --yes
```

**Removes:**

- Sample prompts folder
- AI handoff document
- Onboarding state files

---

### `wpnav export-env`

Export configuration as environment variables.

```bash
# Export as shell script (default)
npx wpnav export-env

# Export as Docker ENV statements
npx wpnav export-env --format docker

# Export as GitHub Actions format
npx wpnav export-env --format github

# Output as JSON
npx wpnav export-env --json

# Use specific config file
npx wpnav export-env --config ./my-config.json --env production
```

**Options:**

| Flag | Description |
|------|-------------|
| `--format <type>` | Output format: `shell`, `docker`, or `github` |
| `--json` | Output as JSON with metadata |
| `--config <path>` | Path to configuration file |
| `--env <name>` | Environment to export (local/staging/production) |

**Formats:**

| Format | Output | Use Case |
|--------|--------|----------|
| `shell` | `export VAR="value"` | Source in bash/zsh |
| `docker` | `ENV VAR=value` | Dockerfile |
| `github` | `VAR: "value"` | GitHub Actions workflow |

---

### `wpnav mcp-config`

Generate MCP configuration snippets for AI platforms.

```bash
# Interactive platform selection
npx wpnav mcp-config

# Generate for specific platform
npx wpnav mcp-config --claude
npx wpnav mcp-config --codex
npx wpnav mcp-config --gemini

# Generate for all platforms
npx wpnav mcp-config --all

# Output as JSON
npx wpnav mcp-config --json
```

**Options:**

| Flag | Description |
|------|-------------|
| `--claude` | Generate Claude Code configuration (.mcp.json) |
| `--codex` | Generate OpenAI Codex configuration (config.toml) |
| `--gemini` | Generate Google Gemini CLI configuration (settings.json) |
| `--all` | Generate configurations for all platforms |
| `--json` | Output as JSON with metadata |

**Platform Config Files:**

| Platform | File | Format |
|----------|------|--------|
| Claude Code | `.mcp.json` | JSON |
| OpenAI Codex | `config.toml` | TOML |
| Google Gemini CLI | `settings.json` | JSON |

---

### `wpnav context` (v2.7.0+)

Generate context dump for non-MCP AI agents (ChatGPT, web-based assistants).

```bash
# Generate full context dump
npx wpnav context

# Include site snapshot
npx wpnav context --include-snapshot

# Specify output file
npx wpnav context --output context.md

# Compact format (less verbose)
npx wpnav context --compact

# Output as JSON
npx wpnav context --json
```

**Options:**

| Flag | Description |
|------|-------------|
| `--include-snapshot` | Include current site snapshot in context |
| `--output <file>` | Write context to file instead of stdout |
| `--compact` | Generate compact format (reduced token usage) |
| `--json` | Output as JSON instead of markdown |
| `--env <name>` | Environment to use (local/staging/production) |

**Context includes:**

- Available tools with parameters and descriptions
- Site configuration (URL, environment)
- Active role and focus mode (if configured)
- Tool access restrictions
- Sample usage patterns

---

### `wpnav suggest` (v2.8.0+)

Get context-aware AI guidance based on current state.

```bash
# Get contextual suggestions
npx wpnav suggest

# Limit number of suggestions
npx wpnav suggest --limit 3

# Output as JSON
npx wpnav suggest --json
```

**Options:**

| Flag | Description |
|------|-------------|
| `--limit <n>` | Maximum number of suggestions (default: 5) |
| `--json` | Output as JSON |
| `--config <path>` | Path to configuration file |
| `--env <name>` | Environment to use (local/staging/production) |

**Context analyzed:**

- Current project state (config, manifest, snapshots)
- Recent tool usage patterns
- WordPress site health status
- Common next actions based on current state

**Example output:**

```
📌 Suggestions based on your current context:

1. Run wpnav doctor to check system health
   → No recent health check found

2. Take a site snapshot before making changes
   → wpnav snapshot site

3. Update your manifest after recent WordPress changes
   → wpnav diff to see what changed
```

---

### `wpnav role` (v2.7.0+)

Manage AI role personas for focused tool access.

```bash
# List available roles
npx wpnav role list

# Show details for a specific role
npx wpnav role show content-editor
npx wpnav role show developer

# Validate role configuration
npx wpnav role validate

# Set active role (persists in .wpnav/state.json)
npx wpnav role set content-editor

# Clear active role
npx wpnav role clear

# Output as JSON
npx wpnav role list --json
```

**Subcommands:**

| Subcommand | Description |
|------------|-------------|
| `list` | List all available roles |
| `show <name>` | Display role details (tools, permissions) |
| `validate` | Check role configuration in manifest |
| `set <name>` | Set the active role |
| `clear` | Clear the active role |

**Built-in roles:**

| Role | Description | Tools |
|------|-------------|-------|
| `content-editor` | Content creation and editing | Posts, pages, media, categories, tags |
| `developer` | Development and debugging | All tools including testing |
| `site-admin` | Full site administration | All tools |
| `read-only` | Read-only access | List and get operations only |

---

### `wpnav set` (v2.8.0+)

Update configuration values in `wpnav.config.json`.

```bash
# Set a config value
npx wpnav set safety.enable_writes true

# Set default environment
npx wpnav set default_environment production

# List current configuration values
npx wpnav set --list

# Output as JSON
npx wpnav set --list --json
```

**Options:**

| Flag | Description |
|------|-------------|
| `--list` | Show current configuration values |
| `--json` | Output as JSON |

**Settable Keys:**

| Key | Type | Description |
|-----|------|-------------|
| `default_environment` | string | Default environment to use |
| `default_role` | string | Default AI role for context |
| `safety.enable_writes` | boolean | Enable write operations |
| `safety.allow_insecure_http` | boolean | Allow HTTP for localhost |
| `safety.tool_timeout_ms` | number | Per-tool timeout in milliseconds |
| `safety.max_response_kb` | number | Maximum response size in KB |
| `safety.sign_headers` | boolean | Enable HMAC request signing |
| `safety.hmac_secret` | string | HMAC secret for signing |
| `safety.ca_bundle` | string | Custom CA bundle path |
| `features.workflows` | boolean | Enable AI workflows |
| `features.bulk_validator` | boolean | Enable bulk content validator |
| `features.seo_audit` | boolean | Enable SEO audit tool |
| `features.content_reviewer` | boolean | Enable content reviewer |
| `features.migration_planner` | boolean | Enable migration planner |
| `features.performance_analyzer` | boolean | Enable performance analyzer |

**Value formats:**

| Type | Accepted Values |
|------|-----------------|
| boolean | `true`, `false`, `yes`, `no`, `1`, `0`, `on`, `off` |
| number | Positive integers (e.g., `600000`, `64`) |
| string | Any text value |

---

### `wpnav use` (v2.8.0+)

Switch the active environment in `wpnav.config.json`.

```bash
# Switch to production environment
npx wpnav use production

# Switch to staging
npx wpnav use staging

# List available environments
npx wpnav use --list

# Output as JSON
npx wpnav use --list --json
```

**Options:**

| Flag | Description |
|------|-------------|
| `--list` | List all available environments with details |
| `--json` | Output as JSON |

**Example output:**

```
Available Environments

Active: production

→ production
    Site: https://example.com
    User: admin

  staging
    Site: https://staging.example.com
    User: admin

  local
    Site: http://localhost:8080
    User: admin

Total: 3
Config: /path/to/wpnav.config.json
```

**Note:** After switching environments, new CLI sessions will use the selected environment by default. You can still override with `--env <name>` for individual commands.

---

## Common Workflows

### First-Time Setup

```bash
# 1. Initialize project
npx wpnav init

# 2. Follow interactive wizard to configure credentials

# 3. Verify connection
npx wpnav status

# 4. Test by listing posts
npx wpnav call wpnav_list_posts --limit 3
```

### Content Management

```bash
# List recent posts
npx wpnav call wpnav_list_posts --limit 10 --status publish

# Get specific post
npx wpnav call wpnav_get_post --id 123

# Create new post (requires WPNAV_ENABLE_WRITES=1)
WPNAV_ENABLE_WRITES=1 npx wpnav call wpnav_create_post \
  --title "My New Post" \
  --content "Post content here" \
  --status draft
```

### Site Audit

```bash
# Take full site snapshot
npx wpnav snapshot site

# Check for differences with manifest
npx wpnav diff

# Run diagnostics
npx wpnav doctor
```

### Safe Deployment

```bash
# 1. Preview changes
npx wpnav sync --dry-run

# 2. Apply changes (creates automatic backup)
npx wpnav sync

# 3. If something goes wrong, rollback
npx wpnav rollback --list
npx wpnav rollback <sync-id>
```

### Site Understanding (v2.8.0)

```bash
# Check site health
npx wpnav call wpnav_site_health

# Get site statistics
npx wpnav call wpnav_site_statistics

# Explore available REST routes
npx wpnav call wpnav_list_rest_routes --namespace wpnav/v1

# Discover block patterns
npx wpnav call wpnav_list_block_patterns

# Find registered shortcodes
npx wpnav call wpnav_list_shortcodes
```

### Plugin Settings (v2.8.0)

```bash
# Read plugin option
npx wpnav call wpnav_get_option --option woocommerce_currency

# Modify plugin option (requires writes enabled + allowed prefix)
WPNAV_ENABLE_WRITES=1 npx wpnav call wpnav_set_option \
  --option yoast_wpseo_titles \
  --value '{"title-home-wpseo": "My Site"}'

# Note: Only plugin-detected prefixes allowed (woocommerce_*, yoast_*, etc.)
```

### Maintenance (v2.8.0)

```bash
# Enable maintenance mode
WPNAV_ENABLE_WRITES=1 npx wpnav call wpnav_maintenance_mode --enable true

# Flush rewrite rules (useful after permalink changes)
WPNAV_ENABLE_WRITES=1 npx wpnav call wpnav_flush_rewrite

# Disable maintenance mode
WPNAV_ENABLE_WRITES=1 npx wpnav call wpnav_maintenance_mode --enable false
```

---

## Exit Codes (v2.8.0 Standardized)

WP Navigator uses category-based exit codes for shell scripting and CI/CD integration.

| Code | Category | Description |
|------|----------|-------------|
| `0` | Success | Operation completed successfully |
| `1` | System | General system errors (unknown, timeout) |
| `2` | Config | Configuration errors (missing file, invalid format, missing fields) |
| `3` | Connection | Network errors (unreachable, DNS failure, SSL issues) |
| `4` | WordPress | WordPress-specific errors (REST disabled, plugin missing/inactive) |
| `5` | Validation | Input validation failures (invalid parameters, format errors) |
| `6` | Auth | Authentication failures (invalid credentials, expired tokens, insufficient permissions) |
| `7` | Not Found | Resource not found (page, post, plugin, theme not found) |
| `8` | Conflict | Resource conflicts (already exists, concurrent modification) |
| `9` | Safety | Safety-related rejections (writes disabled, policy denied, blocked option) |

**Example usage in scripts:**

```bash
#!/bin/bash
npx wpnav call wpnav_list_posts --limit 5
exit_code=$?

case $exit_code in
  0) echo "Success" ;;
  6) echo "Authentication failed - check credentials" ;;
  9) echo "Writes disabled - set WPNAV_ENABLE_WRITES=1" ;;
  *) echo "Error occurred (code: $exit_code)" ;;
esac
```

**JSON error format (v2.8.0):**

When using `--json` output, errors include structured metadata:

```json
{
  "success": false,
  "error": {
    "code": "AUTH_FAILED",
    "category": "auth",
    "message": "Invalid application password",
    "suggestions": [
      "Regenerate application password in WordPress admin",
      "Verify username is correct"
    ],
    "commands": [
      "wpnav configure",
      "wpnav doctor"
    ]
  }
}
```

---

## See Also

- [Getting Started](getting-started.md) - Quick setup guide
- [MCP Setup](mcp-setup.md) - Configure Claude Code, Codex, Gemini
- [Security](security.md) - Security practices
- [Troubleshooting](troubleshooting.md) - Common issues
- [FAQ](faq.md) - Frequently asked questions
- [README](../README.md) - Project overview

---

**Last Updated**: 2025-12-18
