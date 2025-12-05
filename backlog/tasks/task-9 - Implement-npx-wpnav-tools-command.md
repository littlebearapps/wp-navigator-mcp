---
id: task-9
title: Implement `npx wpnav tools` command
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
**Task ID in phase**: wpnav-tools

List all available tools with descriptions.
Support --category filter (content, plugins, themes, etc).
Machine-readable JSON output.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- SECTION:ACCEPTANCE_CRITERIA:BEGIN -->
- [ ] `npx wpnav tools` lists all tools with descriptions
- [ ] `npx wpnav tools --category content` filters correctly
- [ ] Output includes tool count and categories
<!-- SECTION:ACCEPTANCE_CRITERIA:END -->
