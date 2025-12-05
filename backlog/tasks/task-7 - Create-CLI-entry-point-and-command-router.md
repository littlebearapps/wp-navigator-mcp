---
id: task-7
title: Create CLI entry point and command router
status: Ready
assignee: []
created_date: '2025-12-05 09:55'
updated_date: '2025-12-05 09:55'
labels:
  - phase-a
  - cli
  - feature
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Phase**: phase-a-cli-mode
**Source**: wp-navigator-roadmap/main/docs/roadmap/phases/phase-a-cli-mode.yaml
**Task ID in phase**: cli-entry

Add `bin/wpnav` CLI entry point to package.json.
Implement command router (call, tools, status, help).
Set up shared config loading for CLI mode.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- SECTION:ACCEPTANCE_CRITERIA:BEGIN -->
- [ ] `bin/wpnav` executable added to package.json
- [ ] Command router handles: call, tools, status, help
- [ ] Unknown commands show help message
<!-- SECTION:ACCEPTANCE_CRITERIA:END -->
