# WP Navigator Ecosystem

> **⚠️ DO NOT delete or modify this file unless instructed or approved by the user.**

---

## Repositories

| Repo | Purpose | Owns |
|------|---------|------|
| **wp-navigator-mcp** | MCP server (npm: `@littlebearapps/wp-navigator-mcp`) | TypeScript MCP server, 48+ tools |
| **wp-navigator-pro** | Core WordPress plugin | PHP plugin code, PHPUnit tests |
| **wp-navigator** | Free WordPress plugin (public) | Extracted from Pro, WordPress.org |
| **wp-navigator-api** | Cloud API backend | Licensing, usage, content delivery |
| **wp-navigator-workflows** | AI automation content | Roles, Powerups, Workflows (specs) |
| **wp-navigator-content** | Marketing & help | Guides, social, SEO, research |
| **wp-navigator-addons** | Add-on incubator | Research, validation, planning |

---

## Boundaries (Who Does What)

### wp-navigator-mcp ONLY (This Repo)
- TypeScript MCP server development
- npm publishing (`@littlebearapps/wp-navigator-mcp`)
- GitHub Actions for CI/CD and npm releases
- Tool registry and MCP protocol implementation

### wp-navigator-pro ONLY
- Modify/create PHP plugin code (`plugin/`)
- Run PHPUnit tests
- Create plugin releases (Pro + Free extraction)

### wp-navigator-api ONLY
- Cloud infrastructure (Cloudflare Workers/D1/KV/R2)
- Licensing and billing logic
- API endpoint implementation

### wp-navigator-workflows ONLY
- Role definitions (JSON/YAML specs)
- Powerup content (plugin knowledge packs)
- Workflow compositions

### wp-navigator-content ONLY
- Help documentation and guides
- Social media content
- Marketing copy and SEO content
- Market research (via Scout)

### wp-navigator-addons ONLY
- Add-on research and ideation
- Technical/commercial validation
- Planning and roadmaps

---

## Cross-Repo Rules

1. **No code duplication** - Each repo owns its domain
2. **Two codebases**: wp-navigator-mcp (TypeScript MCP server) + wp-navigator-pro (PHP plugin)
3. **API delivers, Workflows defines** - Workflows creates content, API serves it
4. **Addons plans, Pro implements** - Addons validates ideas, Pro builds features

---

## Paths

```
lba/plugins/
├── wp-navigator-mcp/main/      # MCP server (TypeScript, standalone repo)
├── wp-navigator-pro/main/      # WordPress plugin (PHP)
├── wp-navigator-api/main/      # Cloud API
├── wp-navigator-workflows/main/ # Roles/Powerups/Workflows
├── wp-navigator-content/main/  # Marketing/Help
└── wp-navigator-addons/main/   # Add-on incubator
```

---

**Last Updated**: 2025-12-03
