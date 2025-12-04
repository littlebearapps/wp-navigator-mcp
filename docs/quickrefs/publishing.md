# npm Publishing Quick Reference

**Purpose**: Guide for WP Navigator MCP npm publishing workflow

---

## Package Details

- **Package**: `@littlebearapps/wp-navigator-mcp`
- **Registry**: https://www.npmjs.com/package/@littlebearapps/wp-navigator-mcp
- **Repository**: https://github.com/littlebearapps/wp-navigator-mcp (public)

---

## Required Secrets

Configure in GitHub repo Settings → Secrets → Actions:

| Secret | Purpose | Keychain Name |
|--------|---------|---------------|
| `NPM_TOKEN` | npm publish token | `npm-token` |

---

## Automated Publishing (Recommended)

Uses Release-Please for automated changelog and versioning:

1. **Merge to main** with conventional commits (`feat:`, `fix:`, etc.)
2. **Release-Please** creates a release PR with changelog updates
3. **Merge release PR** → creates tag → triggers npm publish

**Manual tag release** (alternative):
```bash
npm version patch|minor|major
git push --follow-tags
```

**Verify**:
```bash
npm view @littlebearapps/wp-navigator-mcp version
```

---

## Manual Publishing (Emergency Only)

```bash
# 1. Build
npm run build

# 2. Publish
npm publish --access public

# 3. Verify
npm view @littlebearapps/wp-navigator-mcp version
```

---

## Version Strategy

| Change Type | Version Bump | Example |
|-------------|--------------|---------|
| Bug fixes | patch | 1.0.1 → 1.0.2 |
| New tools | minor | 1.0.2 → 1.1.0 |
| Breaking changes | major | 1.1.0 → 2.0.0 |

---

## npx Usage

```bash
# Run with explicit version (recommended)
npx @littlebearapps/wp-navigator-mcp@1.0.1 ./wp-config.json

# Run latest
npx -y @littlebearapps/wp-navigator-mcp ./wp-config.json

# Clear cache if stale
npm cache clean --force
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "npm ERR! 401" | Regenerate NPM_TOKEN, update GitHub secret |
| "npm ERR! 403" | Check package scope permissions |
| "could not determine executable" | Use `wp-navigator-mcp` binary name |
| Stale npx cache | `npm cache clean --force` |

---

## Related Files

| File | Purpose |
|------|---------|
| `.github/workflows/release-please.yml` | Release-Please automation |
| `.github/workflows/publish.yml` | npm publish on tags |
| `release-please-config.json` | Release-Please config |
| `.release-please-manifest.json` | Version manifest |

---

**Last Updated**: 2025-12-04
