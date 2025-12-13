# WP Navigator MCP - GitHub Migration Steps

**Internal Documentation** - Manual steps required to complete the dual-repo migration.

---

## Pre-Migration Checklist

Before starting, ensure:
- [ ] All local changes are committed
- [ ] No pending PRs in the current repo
- [ ] You have admin access to the GitHub organization

---

## Step 1: Rename Current Repository

1. Go to https://github.com/littlebearapps/wp-navigator-mcp/settings
2. Scroll to "Repository name"
3. Change name to: `wp-navigator-mcp-master`
4. Click "Rename"

**Important**: GitHub will automatically redirect the old URL to the new one.

---

## Step 2: Set Repository to Private

1. On the renamed repo settings page, scroll to "Danger Zone"
2. Click "Change visibility"
3. Select "Make private"
4. Confirm by typing the repo name

---

## Step 3: Create New Public Repository

1. Go to https://github.com/organizations/littlebearapps/repositories/new
2. Repository name: `wp-navigator-mcp`
3. Description: `MCP server for WordPress site management via AI assistants`
4. Visibility: **Public**
5. **DO NOT** initialize with README, .gitignore, or license
6. Click "Create repository"

---

## Step 4: Initial Sync to Public Repository

Run these commands locally:

```bash
# Navigate to master repo working directory
cd ~/claude-code-tools/lba/plugins/wp-navigator-mcp/main

# Create sync directory
mkdir -p /tmp/wpnav-public-sync
rsync -av --exclude-from=.public-exclude --exclude='.git' ./ /tmp/wpnav-public-sync/

# Initialize as git repo and push to public
cd /tmp/wpnav-public-sync
git init
git add -A
git commit -m "Initial public release"
git branch -M main
git remote add origin https://github.com/littlebearapps/wp-navigator-mcp.git
git push -u origin main

# Create tag matching current version
git tag v2.0.2 -m "Release v2.0.2"
git push origin v2.0.2
```

---

## Step 5: Update Local Git Remote

```bash
cd ~/claude-code-tools/lba/plugins/wp-navigator-mcp/main

# Update remote URL to master repo
git remote set-url origin https://github.com/littlebearapps/wp-navigator-mcp-master.git

# Verify
git remote -v
# Should show: origin https://github.com/littlebearapps/wp-navigator-mcp-master.git
```

---

## Step 6: Create Personal Access Token

1. Go to https://github.com/settings/tokens?type=beta (Fine-grained tokens)
2. Click "Generate new token"
3. Token name: `wp-navigator-mcp-sync`
4. Expiration: 90 days (or longer)
5. Resource owner: `littlebearapps`
6. Repository access: "Only select repositories" → `littlebearapps/wp-navigator-mcp`
7. Permissions:
   - **Contents**: Read and write
   - **Metadata**: Read-only
8. Generate token and copy it

---

## Step 7: Add Secrets to Master Repository

1. Go to https://github.com/littlebearapps/wp-navigator-mcp-master/settings/secrets/actions
2. Add secret:
   - Name: `PUBLIC_REPO_TOKEN`
   - Value: (paste the token from Step 6)
3. Verify `NPM_TOKEN` secret exists (should already be there)

---

## Step 8: Configure Public Repository

### 8.1 Add NPM_TOKEN (optional, for manual backup publish)

1. Go to https://github.com/littlebearapps/wp-navigator-mcp/settings/secrets/actions
2. Add secret:
   - Name: `NPM_TOKEN`
   - Value: (same npm token as master repo)

### 8.2 Configure Branch Protection

1. Go to https://github.com/littlebearapps/wp-navigator-mcp/settings/branches
2. Add rule for `main`:
   - Require status checks: `build-and-test`
   - No required reviews (sync is automated)

### 8.3 Update Repository Settings

1. Go to https://github.com/littlebearapps/wp-navigator-mcp/settings
2. Features:
   - [x] Issues (for public bug reports)
   - [x] Discussions (optional, for community)
   - [ ] Wiki (not needed)
   - [ ] Projects (not needed)
3. Pull Requests:
   - [x] Allow squash merging
   - [ ] Allow merge commits (disable)
   - [ ] Allow rebase merging (disable)

---

## Step 9: Create Initial Release in Public Repo

```bash
# Using GitHub CLI
gh release create v2.0.2 \
  --repo littlebearapps/wp-navigator-mcp \
  --title "v2.0.2" \
  --notes "Initial public release of WP Navigator MCP Server"
```

Or via GitHub UI:
1. Go to https://github.com/littlebearapps/wp-navigator-mcp/releases/new
2. Tag: `v2.0.2`
3. Title: `v2.0.2`
4. Description: `Initial public release of WP Navigator MCP Server`
5. Click "Publish release"

---

## Step 10: Verify Setup

### Test the Sync Workflow

1. Make a small change in master repo (e.g., update version in package.json)
2. Push to main
3. Wait for Release-Please to create PR
4. Merge the release PR
5. Verify:
   - [ ] npm package published
   - [ ] Public repo updated with same tag
   - [ ] GitHub release created in public repo

### Test npm Package

```bash
# Clear npm cache and test
npm cache clean --force
npx @littlebearapps/wp-navigator-mcp --version
```

---

## Post-Migration Tasks

### Update Documentation

- [ ] Update README.md links if any point to old repo
- [ ] Update CLAUDE.md with dual-repo info
- [ ] Update ecosystem docs to reference master repo for development

### Update External References

- [ ] npm package.json URLs (already pointing to public repo)
- [ ] Any external documentation or links
- [ ] Marketing site (wpnav.ai) if applicable

### Clean Up

- [ ] Remove any redirect notices after 30 days (GitHub handles redirects automatically)
- [ ] Archive old backlog tasks related to this migration

---

## Rollback Plan

If something goes wrong:

1. **Rename repos back**:
   - Rename `wp-navigator-mcp-master` → `wp-navigator-mcp`
   - Delete the new public repo (or rename it)

2. **Revert workflow changes**:
   ```bash
   git checkout HEAD~1 -- .github/workflows/release-please.yml
   git commit -m "Revert: dual-repo workflow"
   git push
   ```

3. **Update local remote**:
   ```bash
   git remote set-url origin https://github.com/littlebearapps/wp-navigator-mcp.git
   ```

---

## Timeline Estimate

| Step | Duration |
|------|----------|
| Steps 1-3 (GitHub UI) | 5 minutes |
| Step 4 (Initial sync) | 5 minutes |
| Steps 5-7 (Config) | 10 minutes |
| Steps 8-9 (Public repo setup) | 10 minutes |
| Step 10 (Verification) | 15 minutes |
| **Total** | ~45 minutes |

---

**Last Updated**: 2025-12-13
