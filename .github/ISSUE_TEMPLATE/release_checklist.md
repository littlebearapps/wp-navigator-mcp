---
name: Release Checklist
about: Track release preparation (maintainers only)
title: 'Release v[VERSION]'
labels: 'release'
assignees: ''
---

## Release v[VERSION]

**Target Date**: [DATE]
**Release Type**: [ ] Patch | [ ] Minor | [ ] Major

---

### Pre-Release Checklist

- [ ] All planned features for this release are merged
- [ ] All tests passing on main branch
- [ ] CHANGELOG.md updated with all changes
- [ ] README.md updated if needed
- [ ] Documentation updated (cli-reference.md, etc.)
- [ ] No open blocking issues

### Release Execution

- [ ] Merge Release Please PR (bumps version, updates changelog)
- [ ] Verify GitHub Release created with release notes
- [ ] Verify npm publish succeeded
- [ ] Verify Discussion announcement created (if automated)

### Post-Release Verification

- [ ] **npm**: https://www.npmjs.com/package/@littlebearapps/wp-navigator-mcp shows new version
- [ ] **GitHub Release**: Release page shows correct version and notes
- [ ] **Install test**: `npx @littlebearapps/wp-navigator-mcp@[VERSION] --help` works
- [ ] **Badges**: README badges show updated version

### Post-Release Tasks

- [ ] Announce on social media (if major release)
- [ ] Update wpnav.ai/docs if needed
- [ ] Close this issue

---

### Release Notes Summary

<!-- Brief summary of what's in this release -->

**Added:**
-

**Changed:**
-

**Fixed:**
-

---

**Related PRs:**
- #
