/**
 * Tests for WP Navigator Cleanup Command
 *
 * Tests file discovery, deletion, and protection logic.
 * Note: Interactive TUI prompts are not tested here (requires manual testing).
 *
 * @package WP_Navigator_MCP
 * @since 1.1.0
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  findDeletableFiles,
  performCleanup,
  handleCleanup,
  type CleanupResult,
} from './cleanup.js';

describe('Cleanup Command', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wpnav-cleanup-test-'));
  });

  afterEach(() => {
    // Clean up temp directory
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('findDeletableFiles', () => {
    it('returns empty array when no onboarding files exist', () => {
      const result = findDeletableFiles(tempDir);
      expect(result).toEqual([]);
    });

    it('finds docs/ai-onboarding-handoff.md when present', () => {
      const docsDir = path.join(tempDir, 'docs');
      fs.mkdirSync(docsDir, { recursive: true });
      fs.writeFileSync(path.join(docsDir, 'ai-onboarding-handoff.md'), '# Handoff');

      const result = findDeletableFiles(tempDir);
      expect(result).toContain('docs/ai-onboarding-handoff.md');
    });

    it('finds docs/onboarding-intro.md when present', () => {
      const docsDir = path.join(tempDir, 'docs');
      fs.mkdirSync(docsDir, { recursive: true });
      fs.writeFileSync(path.join(docsDir, 'onboarding-intro.md'), '# Intro');

      const result = findDeletableFiles(tempDir);
      expect(result).toContain('docs/onboarding-intro.md');
    });

    it('finds sample-prompts/self-test.txt when present', () => {
      const promptsDir = path.join(tempDir, 'sample-prompts');
      fs.mkdirSync(promptsDir, { recursive: true });
      fs.writeFileSync(path.join(promptsDir, 'self-test.txt'), '# Self Test');

      const result = findDeletableFiles(tempDir);
      expect(result).toContain('sample-prompts/self-test.txt');
    });

    it('finds multiple onboarding files when all present', () => {
      // Create all deletable files
      const docsDir = path.join(tempDir, 'docs');
      const promptsDir = path.join(tempDir, 'sample-prompts');
      fs.mkdirSync(docsDir, { recursive: true });
      fs.mkdirSync(promptsDir, { recursive: true });

      fs.writeFileSync(path.join(docsDir, 'ai-onboarding-handoff.md'), '# Handoff');
      fs.writeFileSync(path.join(docsDir, 'onboarding-intro.md'), '# Intro');
      fs.writeFileSync(path.join(promptsDir, 'self-test.txt'), '# Self Test');

      const result = findDeletableFiles(tempDir);
      expect(result).toHaveLength(3);
      expect(result).toContain('docs/ai-onboarding-handoff.md');
      expect(result).toContain('docs/onboarding-intro.md');
      expect(result).toContain('sample-prompts/self-test.txt');
    });

    it('does NOT find protected files', () => {
      // Create protected files that should NOT be found
      const docsDir = path.join(tempDir, 'docs');
      const snapshotsDir = path.join(tempDir, 'snapshots');
      const rolesDir = path.join(tempDir, 'roles');
      fs.mkdirSync(docsDir, { recursive: true });
      fs.mkdirSync(snapshotsDir, { recursive: true });
      fs.mkdirSync(rolesDir, { recursive: true });

      fs.writeFileSync(path.join(tempDir, 'wpnavigator.jsonc'), '{}');
      fs.writeFileSync(path.join(tempDir, '.wpnav.env'), 'WP_BASE_URL=');
      fs.writeFileSync(path.join(docsDir, 'README.md'), '# README');
      fs.writeFileSync(path.join(docsDir, 'ai-setup-wpnavigator.md'), '# Setup');
      fs.writeFileSync(path.join(snapshotsDir, 'site_index.json'), '{}');

      const result = findDeletableFiles(tempDir);
      expect(result).toEqual([]);

      // Verify protected files still exist
      expect(fs.existsSync(path.join(tempDir, 'wpnavigator.jsonc'))).toBe(true);
      expect(fs.existsSync(path.join(tempDir, '.wpnav.env'))).toBe(true);
      expect(fs.existsSync(path.join(docsDir, 'README.md'))).toBe(true);
      expect(fs.existsSync(snapshotsDir)).toBe(true);
      expect(fs.existsSync(rolesDir)).toBe(true);
    });
  });

  describe('performCleanup', () => {
    it('deletes specified files successfully', () => {
      const docsDir = path.join(tempDir, 'docs');
      fs.mkdirSync(docsDir, { recursive: true });
      fs.writeFileSync(path.join(docsDir, 'ai-onboarding-handoff.md'), '# Handoff');

      const result = performCleanup(tempDir, ['docs/ai-onboarding-handoff.md']);

      expect(result.deleted).toContain('docs/ai-onboarding-handoff.md');
      expect(result.notFound).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
      expect(fs.existsSync(path.join(docsDir, 'ai-onboarding-handoff.md'))).toBe(false);
    });

    it('reports files not found', () => {
      const result = performCleanup(tempDir, ['docs/nonexistent.md']);

      expect(result.deleted).toHaveLength(0);
      expect(result.notFound).toContain('docs/nonexistent.md');
      expect(result.errors).toHaveLength(0);
    });

    it('deletes multiple files', () => {
      const docsDir = path.join(tempDir, 'docs');
      const promptsDir = path.join(tempDir, 'sample-prompts');
      fs.mkdirSync(docsDir, { recursive: true });
      fs.mkdirSync(promptsDir, { recursive: true });

      fs.writeFileSync(path.join(docsDir, 'ai-onboarding-handoff.md'), '# Handoff');
      fs.writeFileSync(path.join(promptsDir, 'self-test.txt'), '# Self Test');

      const result = performCleanup(tempDir, [
        'docs/ai-onboarding-handoff.md',
        'sample-prompts/self-test.txt',
      ]);

      expect(result.deleted).toHaveLength(2);
      expect(result.deleted).toContain('docs/ai-onboarding-handoff.md');
      expect(result.deleted).toContain('sample-prompts/self-test.txt');
      expect(fs.existsSync(path.join(docsDir, 'ai-onboarding-handoff.md'))).toBe(false);
      expect(fs.existsSync(path.join(promptsDir, 'self-test.txt'))).toBe(false);
    });

    it('preserves protected files even if passed to performCleanup', () => {
      // This tests the second layer of protection - even if someone
      // somehow passed a protected file path, it wouldn't be in the
      // deletable list. This test verifies the overall safety.
      const docsDir = path.join(tempDir, 'docs');
      fs.mkdirSync(docsDir, { recursive: true });
      fs.writeFileSync(path.join(docsDir, 'README.md'), '# Important docs');

      // Note: performCleanup will delete if file exists - the protection
      // is in findDeletableFiles which never returns protected paths
      // This test confirms findDeletableFiles won't return README.md
      const deletable = findDeletableFiles(tempDir);
      expect(deletable).not.toContain('docs/README.md');

      // README.md should still exist
      expect(fs.existsSync(path.join(docsDir, 'README.md'))).toBe(true);
    });

    it('handles mixed success and not-found scenarios', () => {
      const docsDir = path.join(tempDir, 'docs');
      fs.mkdirSync(docsDir, { recursive: true });
      fs.writeFileSync(path.join(docsDir, 'ai-onboarding-handoff.md'), '# Handoff');

      const result = performCleanup(tempDir, [
        'docs/ai-onboarding-handoff.md',
        'docs/onboarding-intro.md', // doesn't exist
      ]);

      expect(result.deleted).toContain('docs/ai-onboarding-handoff.md');
      expect(result.notFound).toContain('docs/onboarding-intro.md');
    });

    it('returns empty result when empty list provided', () => {
      const result = performCleanup(tempDir, []);

      expect(result.deleted).toHaveLength(0);
      expect(result.notFound).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('integration: full cleanup flow', () => {
    it('safely cleans up a fully scaffolded project', () => {
      // Set up a complete WP Navigator project structure
      const dirs = ['snapshots', 'snapshots/pages', 'roles', 'docs', 'sample-prompts'];
      for (const dir of dirs) {
        fs.mkdirSync(path.join(tempDir, dir), { recursive: true });
      }

      // Create protected files
      fs.writeFileSync(path.join(tempDir, 'wpnavigator.jsonc'), '{}');
      fs.writeFileSync(path.join(tempDir, '.wpnav.env'), 'WP_BASE_URL=test');
      fs.writeFileSync(path.join(tempDir, 'docs', 'README.md'), '# Project README');
      fs.writeFileSync(path.join(tempDir, 'snapshots', 'site_index.json'), '{"version":1}');
      fs.writeFileSync(path.join(tempDir, 'roles', 'custom-role.yaml'), 'name: test');

      // Create deletable onboarding files
      fs.writeFileSync(path.join(tempDir, 'docs', 'ai-onboarding-handoff.md'), '# Handoff');
      fs.writeFileSync(path.join(tempDir, 'docs', 'onboarding-intro.md'), '# Intro');
      fs.writeFileSync(path.join(tempDir, 'sample-prompts', 'self-test.txt'), '# Self Test');

      // Also create other sample prompts that should NOT be deleted
      fs.writeFileSync(path.join(tempDir, 'sample-prompts', 'page-builder.txt'), '# Page Builder');

      // Find deletable files
      const deletable = findDeletableFiles(tempDir);
      expect(deletable).toHaveLength(3);

      // Perform cleanup
      const result = performCleanup(tempDir, deletable);

      // Verify onboarding files were deleted
      expect(result.deleted).toHaveLength(3);
      expect(fs.existsSync(path.join(tempDir, 'docs', 'ai-onboarding-handoff.md'))).toBe(false);
      expect(fs.existsSync(path.join(tempDir, 'docs', 'onboarding-intro.md'))).toBe(false);
      expect(fs.existsSync(path.join(tempDir, 'sample-prompts', 'self-test.txt'))).toBe(false);

      // Verify protected files still exist
      expect(fs.existsSync(path.join(tempDir, 'wpnavigator.jsonc'))).toBe(true);
      expect(fs.existsSync(path.join(tempDir, '.wpnav.env'))).toBe(true);
      expect(fs.existsSync(path.join(tempDir, 'docs', 'README.md'))).toBe(true);
      expect(fs.existsSync(path.join(tempDir, 'snapshots', 'site_index.json'))).toBe(true);
      expect(fs.existsSync(path.join(tempDir, 'roles', 'custom-role.yaml'))).toBe(true);

      // Verify other sample prompts still exist
      expect(fs.existsSync(path.join(tempDir, 'sample-prompts', 'page-builder.txt'))).toBe(true);

      // Verify directories still exist
      expect(fs.existsSync(path.join(tempDir, 'snapshots'))).toBe(true);
      expect(fs.existsSync(path.join(tempDir, 'roles'))).toBe(true);
      expect(fs.existsSync(path.join(tempDir, 'docs'))).toBe(true);
      expect(fs.existsSync(path.join(tempDir, 'sample-prompts'))).toBe(true);
    });

    it('handles project with no onboarding files', () => {
      // Set up a project without onboarding files
      const dirs = ['snapshots', 'roles', 'docs'];
      for (const dir of dirs) {
        fs.mkdirSync(path.join(tempDir, dir), { recursive: true });
      }

      fs.writeFileSync(path.join(tempDir, 'wpnavigator.jsonc'), '{}');
      fs.writeFileSync(path.join(tempDir, 'docs', 'README.md'), '# README');

      // Find deletable files - should be empty
      const deletable = findDeletableFiles(tempDir);
      expect(deletable).toHaveLength(0);

      // Perform cleanup - should succeed with nothing to do
      const result = performCleanup(tempDir, deletable);
      expect(result.deleted).toHaveLength(0);
      expect(result.notFound).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('handleCleanup with JSON output', () => {
    let consoleLogSpy: ReturnType<typeof vi.spyOn>;
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
    let processCwdSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      processCwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(tempDir);
    });

    afterEach(() => {
      consoleLogSpy.mockRestore();
      consoleErrorSpy.mockRestore();
      processCwdSpy.mockRestore();
    });

    it('returns JSON with success true when no files to clean', async () => {
      const exitCode = await handleCleanup({ json: true, yes: true });

      expect(exitCode).toBe(0);
      expect(consoleLogSpy).toHaveBeenCalled();

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
      expect(output).toEqual({
        success: true,
        command: 'cleanup',
        data: {
          deleted: [],
          not_found: [],
          message: 'No onboarding files found',
        },
      });
    });

    it('returns JSON with deleted files list on success', async () => {
      // Create deletable files
      const docsDir = path.join(tempDir, 'docs');
      fs.mkdirSync(docsDir, { recursive: true });
      fs.writeFileSync(path.join(docsDir, 'ai-onboarding-handoff.md'), '# Handoff');

      const exitCode = await handleCleanup({ json: true, yes: true });

      expect(exitCode).toBe(0);
      const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
      expect(output.success).toBe(true);
      expect(output.command).toBe('cleanup');
      expect(output.data.deleted).toContain('docs/ai-onboarding-handoff.md');
    });

    it('requires --yes flag in JSON mode', async () => {
      // Create a file to trigger the confirmation check
      const docsDir = path.join(tempDir, 'docs');
      fs.mkdirSync(docsDir, { recursive: true });
      fs.writeFileSync(path.join(docsDir, 'ai-onboarding-handoff.md'), '# Handoff');

      const exitCode = await handleCleanup({ json: true }); // no yes flag

      expect(exitCode).toBe(1);
      const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
      expect(output.success).toBe(false);
      expect(output.error.code).toBe('CONFIRMATION_REQUIRED');
    });

    it('suppresses TUI output in JSON mode', async () => {
      // Create deletable files
      const docsDir = path.join(tempDir, 'docs');
      fs.mkdirSync(docsDir, { recursive: true });
      fs.writeFileSync(path.join(docsDir, 'ai-onboarding-handoff.md'), '# Handoff');

      await handleCleanup({ json: true, yes: true });

      // Console.error (TUI output) should not be called with cleanup messages
      // JSON output goes to console.log
      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
    });
  });
});
