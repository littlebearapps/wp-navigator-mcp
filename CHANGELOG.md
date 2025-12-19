# Changelog

All notable changes to @littlebearapps/wp-navigator-mcp will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.8.1](https://github.com/littlebearapps/wp-navigator-mcp-master/compare/v2.8.0...v2.8.1) (2025-12-19)


### Bug Fixes

* update hardcoded version strings to 2.8.0 ([#44](https://github.com/littlebearapps/wp-navigator-mcp-master/issues/44)) ([2d4ffc2](https://github.com/littlebearapps/wp-navigator-mcp-master/commit/2d4ffc2322ec1f9f6be6fdf6995a016ffa4d80ad))

## [2.8.0](https://github.com/littlebearapps/wp-navigator-mcp-master/compare/v2.7.0...v2.8.0) (2025-12-19)


### Features

* v2.8.0 Essential Access & Understanding ([#42](https://github.com/littlebearapps/wp-navigator-mcp-master/issues/42)) ([4474d65](https://github.com/littlebearapps/wp-navigator-mcp-master/commit/4474d65e553ab484f42da31602305a64dc2ad68d))


### Bug Fixes

* **ci:** use PAT for release-please to trigger CI on PRs ([#41](https://github.com/littlebearapps/wp-navigator-mcp-master/issues/41)) ([a5f841f](https://github.com/littlebearapps/wp-navigator-mcp-master/commit/a5f841f05f6c599176a4571e303ec6b4ee654812))

## [2.7.0](https://github.com/littlebearapps/wp-navigator-mcp-master/compare/v2.6.1...v2.7.0) (2025-12-17)


### Features

* v2.7.0 Vibecoder Transformation Release ([#39](https://github.com/littlebearapps/wp-navigator-mcp-master/issues/39)) ([125659e](https://github.com/littlebearapps/wp-navigator-mcp-master/commit/125659edcc6edd1ccbdc817399a007958a887f00))

## [Unreleased]

### Added

- **v2.8.0 Essential Access & Understanding tools** (task-99): 7 new tools for programmatic access and site understanding
  - **Options tools**: `wpnav_get_option`, `wpnav_set_option` (plugin-detected prefixes only for safety)
  - **Health tools**: `wpnav_site_health` (WordPress Site Health integration)
  - **Discovery tools**: `wpnav_list_rest_routes`, `wpnav_list_shortcodes`, `wpnav_list_block_patterns`, `wpnav_list_block_templates`
- **Standardized error format** (task-99.8): Machine-parseable errors with codes, categories, and actionable suggestions
- **Exit codes** (task-99.10): Category-based exit codes (0-9) for shell scripting and CI/CD
- **Suggest command** (task-99.9): `wpnav suggest` for context-aware AI guidance
- Integration tests for v2.8.0 tools

### Changed

- Error responses now include structured `code`, `category`, `suggestions`, and `commands` fields
- Total tool count increased from 75 to 82
- CLI reference updated with new tool categories and exit codes

### Security

- `wpnav_set_option` restricted to plugin-detected option prefixes only (e.g., `woocommerce_*`, `yoast_*`)
- Core WordPress options (`siteurl`, `home`, `admin_email`, etc.) are blocked from modification
- Options allowlist derived from introspect `detected_plugins` for dynamic security

## [2.6.0](https://github.com/littlebearapps/wp-navigator-mcp-master/compare/v2.5.0...v2.6.0) (2025-12-15)


### Features

* v2.6.0 MCP Excellence Release ([#29](https://github.com/littlebearapps/wp-navigator-mcp-master/issues/29)) ([bb7bc6f](https://github.com/littlebearapps/wp-navigator-mcp-master/commit/bb7bc6f7020e29916946510f63a4aaecf36a6ae2))

## [2.5.0](https://github.com/littlebearapps/wp-navigator-mcp-master/compare/v2.4.0...v2.5.0) (2025-12-14)


### Features

* implement v2.5.0 TUI Polish release ([#27](https://github.com/littlebearapps/wp-navigator-mcp-master/issues/27)) ([b0f87c6](https://github.com/littlebearapps/wp-navigator-mcp-master/commit/b0f87c63c34015342eb078ca847c1126894364ca))

## [2.4.0](https://github.com/littlebearapps/wp-navigator-mcp-master/compare/v2.3.0...v2.4.0) (2025-12-14)


### Features

* implement v2.4.0 Local Development Support release ([#25](https://github.com/littlebearapps/wp-navigator-mcp-master/issues/25)) ([be67e35](https://github.com/littlebearapps/wp-navigator-mcp-master/commit/be67e35683db2e39f6a34689c5f8d82feca567d7))

## [2.3.0](https://github.com/littlebearapps/wp-navigator-mcp-master/compare/v2.2.0...v2.3.0) (2025-12-14)


### Features

* implement v2.3.0 Multi-Platform Support release ([#22](https://github.com/littlebearapps/wp-navigator-mcp-master/issues/22)) ([d924c8e](https://github.com/littlebearapps/wp-navigator-mcp-master/commit/d924c8e783b3d1422683073b38a3cd3206ff5922))


### Bug Fixes

* resolve YAML syntax errors and add workflow validation ([3750dc1](https://github.com/littlebearapps/wp-navigator-mcp-master/commit/3750dc1c55700d657da623bd8960ada21396dcd2))

## [2.2.0](https://github.com/littlebearapps/wp-navigator-mcp-master/compare/v2.1.2...v2.2.0) (2025-12-14)


### Features

* add GitHub Discussions and automated release announcements ([a06c732](https://github.com/littlebearapps/wp-navigator-mcp-master/commit/a06c732e7ac0140637d7796fcd57a93974bea8ce))
* complete v2.1.0 Developer Excellence release ([#21](https://github.com/littlebearapps/wp-navigator-mcp-master/issues/21)) ([868061a](https://github.com/littlebearapps/wp-navigator-mcp-master/commit/868061a7bcd87f6f192721c44f39fdaf8c84bb3c))

## [2.1.2](https://github.com/littlebearapps/wp-navigator-mcp-master/compare/v2.1.1...v2.1.2) (2025-12-13)


### Bug Fixes

* exclude release-please.yml from public sync ([cb76106](https://github.com/littlebearapps/wp-navigator-mcp-master/commit/cb7610681a0426d8aa770ea19351b22caa9651ad))

## [2.1.1](https://github.com/littlebearapps/wp-navigator-mcp-master/compare/v2.1.0...v2.1.1) (2025-12-13)


### Bug Fixes

* restructure release workflow for npm provenance support ([daf08c7](https://github.com/littlebearapps/wp-navigator-mcp-master/commit/daf08c717a225582eb9f9fb6a6c98779bb911083))
* use yaml library for YAML parsing instead of custom parser ([763b093](https://github.com/littlebearapps/wp-navigator-mcp-master/commit/763b0937a7cd57ab29eb1bf4ac6a9e14a9696bd4))

## [2.1.0](https://github.com/littlebearapps/wp-navigator-mcp-master/compare/v2.0.2...v2.1.0) (2025-12-13)


### Features

* add dual-repo structure for public/private separation ([#14](https://github.com/littlebearapps/wp-navigator-mcp-master/issues/14)) ([a287c04](https://github.com/littlebearapps/wp-navigator-mcp-master/commit/a287c0422297a6949a0837a4484ad5db5fbfc830))
* add Phase C init wizard, plugin detection, and roles system ([5e78206](https://github.com/littlebearapps/wp-navigator-mcp-master/commit/5e782061503357c99db94e2690c2d1b663254192))

## [2.0.2](https://github.com/littlebearapps/wp-navigator-mcp/compare/v2.0.1...v2.0.2) (2025-12-11)


### Bug Fixes

* **ci:** add publish job to release-please workflow ([6b58397](https://github.com/littlebearapps/wp-navigator-mcp/commit/6b583974f96a8cadbb79e68c900bd1aa063d9172))

## [2.0.1](https://github.com/littlebearapps/wp-navigator-mcp/compare/v2.0.0...v2.0.1) (2025-12-11)


### Bug Fixes

* **ci:** trigger publish workflow on release event ([9b59e7a](https://github.com/littlebearapps/wp-navigator-mcp/commit/9b59e7a306bfdb3cf4308e49070ce3954fa46a6a))

## [2.0.0](https://github.com/littlebearapps/wp-navigator-mcp/compare/v1.0.1...v2.0.0) (2025-12-10)


### ⚠ BREAKING CHANGES

* **deps:** None - internal dev dependency only

### Features

* add release automation, tool authority, and plugin compatibility check ([3266e95](https://github.com/littlebearapps/wp-navigator-mcp/commit/3266e959e5fa223e67e2b6d4374e3d1b6a9917f7))
* add snapshot schemas for Phase B2 (task-29, task-30) ([7a0531c](https://github.com/littlebearapps/wp-navigator-mcp/commit/7a0531c70ef9119c5218a06e56875f196f3acce5))
* complete Phase A CLI mode implementation ([fd56b84](https://github.com/littlebearapps/wp-navigator-mcp/commit/fd56b844da1e5d7c8b03b24263d49373e5438c7e))
* complete Phase B1 config and manifest implementation ([c808bee](https://github.com/littlebearapps/wp-navigator-mcp/commit/c808beef6118be8cbdc5eef972aeaf50c03a68bd))
* complete Phase B2 snapshots and sync workflow ([cd13181](https://github.com/littlebearapps/wp-navigator-mcp/commit/cd1318183ef88a0e053670ca13df7b8725cfdf61))


### Bug Fixes

* clarify WRITES_DISABLED error is MCP server config, not WordPress setting ([0af37cb](https://github.com/littlebearapps/wp-navigator-mcp/commit/0af37cbd44bfff4629c584a61ef4ca73b155bfb1))
* **deps:** update @modelcontextprotocol/sdk and glob to fix high severity vulnerabilities ([f3a4c7f](https://github.com/littlebearapps/wp-navigator-mcp/commit/f3a4c7f6b0712e36b6c94c88bb1fd16500452182))
* **deps:** upgrade vitest and @vitest/coverage-v8 to 4.x ([03351fa](https://github.com/littlebearapps/wp-navigator-mcp/commit/03351fa9d22873be844c34df3735f649d33d9647))

## [1.0.1] - 2025-12-03

### Fixed
- Added `wp-navigator-mcp` bin alias for npx compatibility
- Re-enabled npm provenance after repo made public
- Corrected config file format in README examples

### Changed
- Renamed package binaries from `wpnav-mcp` to `wp-navigator` for consistency

## [1.0.0] - 2025-12-02

### Added
- Initial release as standalone npm package
- 48+ WordPress management tools via MCP protocol
- **Core tools**: `wpnav_introspect`, `wpnav_help`, `wpnav_test_metrics`
- **Content tools**: posts, pages, media, comments (list, get, create, update, delete)
- **Taxonomy tools**: categories, tags, taxonomies
- **Theme tools**: list, get, activate, install, update, delete, revert
- **Plugin tools**: list, get, activate, deactivate, install, update, delete
- **User tools**: list, get, create, update
- **Gutenberg tools**: introspect, list_blocks, insert, replace, delete, move, patterns
- **Testing tools**: `wpnav_seed_test_data`, `wpnav_test_metrics`
- Safe-by-default writes (opt-in via `WPNAV_ENABLE_WRITES=1`)
- HTTPS enforcement for non-localhost connections
- Single-origin SSRF protection
- Configurable timeouts and response size limits
- JSON file configuration support
- Claude Desktop and Claude Code integration guides
