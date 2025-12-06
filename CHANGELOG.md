# Changelog

All notable changes to @littlebearapps/wp-navigator-mcp will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0](https://github.com/littlebearapps/wp-navigator-mcp/compare/v1.0.1...v1.1.0) (2025-12-06)


### Features

* add release automation, tool authority, and plugin compatibility check ([3266e95](https://github.com/littlebearapps/wp-navigator-mcp/commit/3266e959e5fa223e67e2b6d4374e3d1b6a9917f7))


### Bug Fixes

* clarify WRITES_DISABLED error is MCP server config, not WordPress setting ([0af37cb](https://github.com/littlebearapps/wp-navigator-mcp/commit/0af37cbd44bfff4629c584a61ef4ca73b155bfb1))

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
