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
```

**Options:**

| Flag | Description |
|------|-------------|
| `--category <name>` | Filter tools by category |
| `--json` | Output as JSON (default) |
| `--format <type>` | Output format: `json` or `markdown` |
| `--examples` | Include example usage (markdown only) |
| `--toc` | Include table of contents (markdown only) |

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

---

## Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Success |
| `1` | General error |
| `2` | Configuration error |
| `3` | Connection error |
| `4` | Authentication error |
| `5` | Validation error |

---

## See Also

- [README](../README.md) - Quick start guide
- [Security](security.md) - Security practices
- [Troubleshooting](troubleshooting.md) - Common issues
- [FAQ](faq.md) - Frequently asked questions
