/**
 * Init module - Template generators and smoke test utilities
 *
 * Provides utilities for the wpnav init wizard:
 * - Template rendering (CLAUDE.md, .mcp.json)
 * - Smoke test for connection verification
 * - Gitignore management
 * - Repair mode for idempotent init (v2.4.5)
 * - Wizard orchestration with navigation (v2.5.0)
 * - Step history for back navigation (v2.5.0)
 * - Init logging (v2.5.0)
 */

export * from './generators.js';
export * from './smoke-test.js';
export * from './gitignore.js';
export * from './repair.js';

// v2.5.0+ - Wizard navigation infrastructure
export * from './step-history.js';
export * from './logger.js';
export * from './wizard.js';
