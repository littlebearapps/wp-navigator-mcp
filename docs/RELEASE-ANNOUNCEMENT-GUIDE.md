# Release Announcement Guide

Best practices and templates for WP Navigator MCP release announcements.

---

## Principles (from Keep a Changelog)

1. **Changelogs are for humans**, not machines
2. There should be an entry for **every single version**
3. The same **types of changes should be grouped**
4. Versions and sections should be **linkable**
5. The **latest version comes first**
6. The **release date** is displayed
7. Mention **Semantic Versioning** compliance

---

## Change Categories

Use these standard categories (from Keep a Changelog):

| Category | Description | Emoji |
|----------|-------------|-------|
| **Added** | New features | :sparkles: |
| **Changed** | Changes in existing functionality | :recycle: |
| **Deprecated** | Soon-to-be removed features | :warning: |
| **Removed** | Now removed features | :fire: |
| **Fixed** | Bug fixes | :bug: |
| **Security** | Vulnerability fixes | :lock: |

---

## Release Type Templates

### Major Release (x.0.0) - Breaking Changes

Major releases deserve the most attention. They may require user action.

```markdown
# :rocket: WP Navigator MCP v3.0.0

**This is a major release with breaking changes.** Please review the migration guide before upgrading.

## :warning: Breaking Changes

- **Config format changed**: `wp-config.json` now uses camelCase keys ([#123](link))
- **Removed deprecated tools**: `wpnav_legacy_*` tools removed ([#124](link))

## :sparkles: Highlights

### New Config System
The configuration system has been completely redesigned for better multi-site support.
- Walk-up directory discovery
- Environment-specific overrides
- JSON5 support with comments

[Learn more in the Config Guide](link-to-docs)

### Role-Based Tool Access
AI assistants can now operate with focused tool sets.
- `content-editor` - Content management only
- `developer` - Full access for development
- `auditor` - Read-only site analysis

[See Roles Documentation](link-to-docs)

## :recycle: Changes

- Tool timeout increased from 5min to 10min ([#125](link))
- Response size limit now configurable ([#126](link))

## :bug: Bug Fixes

- Fixed authentication retry loop ([#127](link))
- Resolved media upload timeout issues ([#128](link))

## :arrow_up: Migration Guide

### Step 1: Update Configuration
```bash
# Backup existing config
cp wp-config.json wp-config.json.backup

# Run migration helper
npx wpnav migrate-config
```

### Step 2: Update MCP Client Config
```json
{
  "mcpServers": {
    "wpnav": {
      "command": "npx",
      "args": ["-y", "@littlebearapps/wp-navigator-mcp@3.0.0"]
    }
  }
}
```

## :busts_in_silhouette: Contributors

Thanks to our contributors for this release!
- @contributor1 - Config system redesign
- @contributor2 - Role implementation

## :link: Links

- [Full Changelog](https://github.com/littlebearapps/wp-navigator-mcp/releases/tag/v3.0.0)
- [npm Package](https://www.npmjs.com/package/@littlebearapps/wp-navigator-mcp)
- [Migration Guide](https://wpnav.ai/docs/migration/v3)
- [Documentation](https://wpnav.ai/docs)

---

:speech_balloon: **Questions?** Reply to this discussion or [open an issue](https://github.com/littlebearapps/wp-navigator-mcp/issues/new).
```

---

### Minor Release (x.y.0) - New Features

Minor releases add functionality in a backward-compatible manner.

```markdown
# :sparkles: WP Navigator MCP v2.3.0

New features and improvements - fully backward compatible!

## :rocket: What's New

### Theme Customizer Snapshots
Capture your entire theme configuration including widgets, custom CSS, and site identity.

```bash
npx wpnav snapshot site  # Includes theme customizer
```

[Documentation](link-to-docs) | Related: [#89](link), [#92](link)

### Plugin Settings Extraction
Export settings from popular plugins with dedicated extractors.

**Supported plugins:**
- WooCommerce
- Yoast SEO
- RankMath

```bash
npx wpnav snapshot plugins --merge
```

[Documentation](link-to-docs) | Related: [#95](link)

## :recycle: Improvements

- **CLI**: Added `--json` flag to all commands for scripting ([#97](link))
- **Performance**: Reduced API calls by 40% with smart caching ([#98](link))
- **DX**: Better error messages with suggested fixes ([#99](link))

## :bug: Bug Fixes

- Fixed category assignment on post creation ([#100](link))
- Resolved timeout on large media uploads ([#101](link))
- Fixed manifest validation edge case ([#102](link))

## :package: Installation

```bash
# Latest version
npx @littlebearapps/wp-navigator-mcp@2.3.0 --help

# Or update globally
npm update -g @littlebearapps/wp-navigator-mcp
```

## :link: Links

- [Full Changelog](https://github.com/littlebearapps/wp-navigator-mcp/releases/tag/v2.3.0)
- [npm Package](https://www.npmjs.com/package/@littlebearapps/wp-navigator-mcp)
- [Documentation](https://wpnav.ai/docs)

---

:heart: Thanks for using WP Navigator! Star us on [GitHub](https://github.com/littlebearapps/wp-navigator-mcp) if you find it useful.
```

---

### Patch Release (x.y.z) - Bug Fixes

Patch releases are for backward-compatible bug fixes. Keep them concise.

```markdown
# :bug: WP Navigator MCP v2.2.1

Bug fixes and stability improvements.

## :wrench: Fixes

- **Authentication**: Fixed token refresh loop on expired sessions ([#110](link))
- **CLI**: Resolved `wpnav status` crash on missing config ([#111](link))
- **Gutenberg**: Fixed block parsing for nested columns ([#112](link))

## :shield: Security

- Updated dependencies to patch CVE-2024-XXXXX ([#113](link))

## :package: Update

```bash
npx @littlebearapps/wp-navigator-mcp@2.2.1 --help
```

[Full Changelog](https://github.com/littlebearapps/wp-navigator-mcp/releases/tag/v2.2.1) | [npm](https://www.npmjs.com/package/@littlebearapps/wp-navigator-mcp)
```

---

## Best Practices Checklist

### Content
- [ ] Clear, benefit-focused descriptions (not just "what" but "why it matters")
- [ ] Links to related GitHub issues/PRs
- [ ] Links to documentation for new features
- [ ] Installation/upgrade instructions
- [ ] Migration guide for breaking changes

### Formatting
- [ ] Consistent emoji usage for visual scanning
- [ ] Code blocks for commands and config
- [ ] Proper heading hierarchy
- [ ] Links are clickable and tested

### Tone
- [ ] Written for humans, not machines
- [ ] Positive and friendly
- [ ] Acknowledges contributors
- [ ] Invites feedback/questions

---

## Automated Announcement Workflow

The release announcement is created automatically by `.github/workflows/release-please.yml`:

1. **Release-Please** creates a release with auto-generated notes
2. **sync-public** job pushes to public repo
3. **announce-release** job creates a GitHub Discussion

### Customizing Announcements

For major releases, consider:
1. Writing a custom announcement before merging the release PR
2. Adding a blog post on wpnav.ai
3. Posting on social media

---

## Issue Linking Convention

When writing PR descriptions, include issue references for automatic linking:

```
Fixes #123
Closes #124
Related to #125
```

These will appear in auto-generated release notes.

---

## References

- [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
- [Semantic Versioning](https://semver.org/)
- [The Good Docs Project - Release Notes](https://thegooddocsproject.dev/template/release-notes)
- [GitHub Auto-generated Release Notes](https://docs.github.com/en/repositories/releasing-projects-on-github/automatically-generated-release-notes)

---

**Last Updated**: 2025-12-14
