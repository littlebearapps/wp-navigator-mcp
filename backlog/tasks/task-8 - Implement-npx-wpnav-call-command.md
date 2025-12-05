---
id: task-8
title: Implement `npx wpnav call` command
status: Ready
assignee: []
created_date: '2025-12-05 09:55'
updated_date: '2025-12-05 09:55'
labels:
  - phase-a
  - cli
  - feature
dependencies:
  - task-7
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Phase**: phase-a-cli-mode
**Source**: wp-navigator-roadmap/main/docs/roadmap/phases/phase-a-cli-mode.yaml
**Task ID in phase**: wpnav-call

Direct tool invocation: npx wpnav call <tool> [--param value]
Support --json flag for complex parameters.
JSON output with success/error format.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- SECTION:ACCEPTANCE_CRITERIA:BEGIN -->
- [ ] `npx wpnav call wpnav_list_posts --limit 5` returns posts
- [ ] `npx wpnav call wpnav_create_post --json '{...}'` works
- [ ] Errors return structured JSON with code and message
<!-- SECTION:ACCEPTANCE_CRITERIA:END -->
