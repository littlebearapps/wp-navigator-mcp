---
id: task-12
title: Implement config file schema and loader
status: Ready
assignee: []
created_date: '2025-12-05 10:00'
updated_date: '2025-12-05 10:00'
labels:
  - phase-b
  - config
  - feature
dependencies:
  - task-7
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Phase**: phase-b-config-file
**Source**: wp-navigator-roadmap/main/docs/roadmap/phases/phase-b-config-file.yaml
**Task ID in phase**: config-schema

Define wpnav.config.json schema (config_version, site, user, password, safety, features).
Implement loader with directory walk-up discovery.
Support $ENV_VAR syntax for secrets.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- SECTION:ACCEPTANCE_CRITERIA:BEGIN -->
- [ ] Schema documented in TypeScript types
- [ ] Loader walks up directory tree (like .eslintrc)
- [ ] $WP_APP_PASS resolves from environment
- [ ] Falls back to env vars when no config file
<!-- SECTION:ACCEPTANCE_CRITERIA:END -->
