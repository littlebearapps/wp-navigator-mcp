---
id: task-13
title: Implement multi-environment support
status: Ready
assignee: []
created_date: '2025-12-05 10:00'
updated_date: '2025-12-05 10:00'
labels:
  - phase-b
  - config
  - feature
dependencies:
  - task-12
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Phase**: phase-b-config-file
**Source**: wp-navigator-roadmap/main/docs/roadmap/phases/phase-b-config-file.yaml
**Task ID in phase**: environments

Add environments section to config schema.
Implement --env flag for CLI commands.
Per-environment writes, features, and limits.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- SECTION:ACCEPTANCE_CRITERIA:BEGIN -->
- [ ] environments.local, staging, production supported
- [ ] `--env production` overrides default_environment
- [ ] writes setting inherited and overridable per env
- [ ] WPNAV_ENVIRONMENT env var also switches env
<!-- SECTION:ACCEPTANCE_CRITERIA:END -->
