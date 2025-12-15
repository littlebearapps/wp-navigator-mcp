#!/usr/bin/env node

/**
 * WP Navigator Entry Point
 *
 * Unified entry point that dispatches to either:
 * - CLI mode: For explicit CLI commands (init, tools, status) or flags (--version, --help)
 * - MCP Server mode: Default mode for MCP clients (no args or config file path)
 *
 * @package WP_Navigator_Pro
 * @since 2.6.1
 */

// =============================================================================
// CLI Command Detection
// =============================================================================
// Only route to CLI for explicit CLI commands/flags.
// Default behavior (no args) starts MCP server for MCP client compatibility.

const CLI_COMMANDS = [
  'init',
  'call',
  'tools',
  'status',
  'help',
  'validate',
  'configure',
  'doctor',
  'cleanup',
  'snapshot',
  'diff',
  'sync',
  'rollback',
  'roles',
  'export-env',
  'mcp-config',
  'claude-setup',
  'codex-setup',
  'gemini-setup',
];
const CLI_FLAGS = ['--version', '--help', '-h', '-v'];

const firstArg = process.argv[2];

// Delegate to CLI if first arg is a known CLI command or flag
// Otherwise, start MCP server (including no-arg case for MCP clients)
if (CLI_COMMANDS.includes(firstArg) || CLI_FLAGS.includes(firstArg)) {
  // CLI mode - dynamic import to avoid loading MCP server dependencies
  import('./cli.js')
    .then(({ main }) => main())
    .catch((err) => {
      console.error('CLI error:', err);
      process.exit(1);
    });
} else {
  // MCP Server mode - handles:
  // - No args (MCP clients using env vars)
  // - Config file path argument
  import('./mcp-server.js').catch((err) => {
    console.error('MCP Server error:', err);
    process.exit(1);
  });
}
