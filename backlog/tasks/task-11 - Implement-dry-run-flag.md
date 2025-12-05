---
id: task-11
title: Implement --dry-run flag
status: Ready
assignee: []
created_date: '2025-12-05 09:55'
updated_date: '2025-12-05 09:55'
labels:
  - phase-a
  - cli
  - feature
  - safety
dependencies:
  - task-8
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Phase**: phase-a-cli-mode
**Source**: wp-navigator-roadmap/main/docs/roadmap/phases/phase-a-cli-mode.yaml
**Task ID in phase**: dry-run

Add --dry-run flag to `npx wpnav call`.
Returns preview of operation without executing.
Shows method, endpoint, and payload diff.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- SECTION:ACCEPTANCE_CRITERIA:BEGIN -->
- [ ] `npx wpnav call wpnav_update_post --id 1 --title X --dry-run` previews
- [ ] Dry-run output includes would_execute object
- [ ] No actual changes made to WordPress
<!-- SECTION:ACCEPTANCE_CRITERIA:END -->
