---
id: task-14
title: Implement `npx wpnav validate` command
status: Ready
assignee: []
created_date: '2025-12-05 10:00'
updated_date: '2025-12-05 10:00'
labels:
  - phase-b
  - config
  - cli
  - feature
dependencies:
  - task-12
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Phase**: phase-b-config-file
**Source**: wp-navigator-roadmap/main/docs/roadmap/phases/phase-b-config-file.yaml
**Task ID in phase**: wpnav-validate

Validate config file schema.
Check environment variable resolution.
Test connectivity to configured site(s).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- SECTION:ACCEPTANCE_CRITERIA:BEGIN -->
- [ ] Validates JSON syntax and schema
- [ ] Reports unresolved $ENV_VAR references
- [ ] Tests site reachability (optional --check-connection)
- [ ] Exit code 0 on success, 1 on failure
<!-- SECTION:ACCEPTANCE_CRITERIA:END -->
