# Changelog

All notable changes to @littlebearapps/wp-navigator-mcp will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
