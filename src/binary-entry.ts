#!/usr/bin/env bun

/**
 * WP Navigator Binary Entry Point
 *
 * Unified entry point for Bun-compiled standalone binary.
 * Uses static imports (required for Bun compile) instead of dynamic imports.
 *
 * This file is used by `bun build --compile` to create standalone executables.
 * For normal npm usage, src/index.ts is used instead (with dynamic imports).
 *
 * @package WP_Navigator_MCP
 * @since 2.7.0
 */

// Static imports required for Bun compile bundling
import { main as cliMain } from './cli.js';
import { startMcpServer } from './mcp-server.js';

// =============================================================================
// CLI Command Detection
// =============================================================================
// Same detection logic as index.ts, but with static imports for Bun bundling.

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
  // v2.7.0 commands
  'connect',
  'credentials',
  'role',
  'context',
  // v2.8.0 commands
  'set',
  'use',
  'suggest',
];
const CLI_FLAGS = ['--version', '--help', '-h', '-v'];

const firstArg = process.argv[2];

// Delegate to CLI if first arg is a known CLI command or flag
// Otherwise, start MCP server (including no-arg case for MCP clients)
if (CLI_COMMANDS.includes(firstArg) || CLI_FLAGS.includes(firstArg)) {
  // CLI mode
  cliMain().catch((err) => {
    console.error('CLI error:', err);
    process.exit(1);
  });
} else {
  // MCP Server mode - handles:
  // - No args (MCP clients using env vars)
  // - Config file path argument
  startMcpServer().catch((err) => {
    console.error('MCP Server error:', err);
    process.exit(1);
  });
}
