/**
 * Init module - Template generators and smoke test utilities
 *
 * Provides utilities for the wpnav init wizard:
 * - Template rendering (CLAUDE.md, .mcp.json)
 * - Smoke test for connection verification
 * - Gitignore management
 * - Repair mode for idempotent init (v2.4.5)
 */

export * from './generators.js';
export * from './smoke-test.js';
export * from './gitignore.js';
export * from './repair.js';
