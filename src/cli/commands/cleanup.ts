/**
 * WP Navigator Cleanup Command
 *
 * Removes onboarding helper files after setup is complete.
 * Only deletes specific onboarding files - never user content.
 *
 * @package WP_Navigator_Pro
 * @since 1.1.0
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  confirmPrompt,
} from '../tui/prompts.js';
import {
  success,
  error as errorMessage,
  warning,
  info,
  newline,
  list,
  colorize,
  symbols,
} from '../tui/components.js';

// =============================================================================
// Types
// =============================================================================

export interface CleanupOptions {
  yes?: boolean; // Skip confirmation
}

export interface CleanupResult {
  deleted: string[];
  notFound: string[];
  errors: Array<{ file: string; error: string }>;
}

// =============================================================================
// Constants
// =============================================================================

// Files that CAN be deleted by cleanup
const DELETABLE_FILES = [
  'docs/ai-onboarding-handoff.md',
  'docs/onboarding-intro.md',
  'sample-prompts/self-test.txt',
];

// Files/directories that must NEVER be deleted
const PROTECTED_PATHS = [
  'snapshots',
  'wpnavigator.jsonc',
  'roles',
  '.wpnav.env',
  'docs/README.md',
  'docs/ai-setup-wpnavigator.md',
];

// =============================================================================
// Core Functions
// =============================================================================

/**
 * Find onboarding files that exist and can be deleted
 */
export function findDeletableFiles(cwd: string): string[] {
  const found: string[] = [];
  for (const relativePath of DELETABLE_FILES) {
    const fullPath = path.join(cwd, relativePath);
    if (fs.existsSync(fullPath)) {
      found.push(relativePath);
    }
  }
  return found;
}

/**
 * Delete a single file safely
 */
function deleteFile(cwd: string, relativePath: string): { success: boolean; error?: string } {
  const fullPath = path.join(cwd, relativePath);
  try {
    fs.unlinkSync(fullPath);
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Perform the cleanup operation
 */
export function performCleanup(cwd: string, filesToDelete: string[]): CleanupResult {
  const result: CleanupResult = {
    deleted: [],
    notFound: [],
    errors: [],
  };

  for (const relativePath of filesToDelete) {
    const fullPath = path.join(cwd, relativePath);

    if (!fs.existsSync(fullPath)) {
      result.notFound.push(relativePath);
      continue;
    }

    const deleteResult = deleteFile(cwd, relativePath);
    if (deleteResult.success) {
      result.deleted.push(relativePath);
    } else {
      result.errors.push({ file: relativePath, error: deleteResult.error || 'Unknown error' });
    }
  }

  return result;
}

// =============================================================================
// Display Functions
// =============================================================================

/**
 * Display files that will be deleted
 */
function displayFilesToDelete(files: string[]): void {
  info('The following onboarding files will be deleted:');
  newline();
  for (const file of files) {
    console.error(`  ${colorize(symbols.error, 'red')} ${file}`);
  }
}

/**
 * Display protected files (for reassurance)
 */
function displayProtectedFiles(): void {
  newline();
  info('These files are protected and will NOT be deleted:');
  newline();
  for (const file of PROTECTED_PATHS) {
    console.error(`  ${colorize(symbols.success, 'green')} ${file}`);
  }
}

/**
 * Display cleanup results
 */
function displayResults(result: CleanupResult): void {
  if (result.deleted.length > 0) {
    newline();
    success(`Deleted ${result.deleted.length} file${result.deleted.length > 1 ? 's' : ''}:`);
    for (const file of result.deleted) {
      console.error(`  ${colorize(symbols.success, 'green')} ${file}`);
    }
  }

  if (result.errors.length > 0) {
    newline();
    errorMessage(`Failed to delete ${result.errors.length} file${result.errors.length > 1 ? 's' : ''}:`);
    for (const { file, error } of result.errors) {
      console.error(`  ${colorize(symbols.error, 'red')} ${file}: ${error}`);
    }
  }
}

// =============================================================================
// Main Handler
// =============================================================================

/**
 * Handle the cleanup command
 */
export async function handleCleanup(options: CleanupOptions = {}): Promise<void> {
  const cwd = process.cwd();
  const skipConfirm = options.yes === true;

  // Find files that can be deleted
  const filesToDelete = findDeletableFiles(cwd);

  // Check if there's anything to clean up
  if (filesToDelete.length === 0) {
    info('Nothing to clean up. No onboarding files found.');
    newline();
    info('Onboarding files that would be removed if present:');
    list(DELETABLE_FILES);
    return;
  }

  // Display what will be deleted
  newline();
  displayFilesToDelete(filesToDelete);

  // Display protected files for reassurance
  displayProtectedFiles();
  newline();

  // Confirm deletion unless --yes flag is used
  if (!skipConfirm) {
    const confirmed = await confirmPrompt({
      message: 'Proceed with deletion?',
      defaultValue: false,
    });

    if (!confirmed) {
      info('Cleanup cancelled. No files were deleted.');
      return;
    }
  }

  // Perform cleanup
  const result = performCleanup(cwd, filesToDelete);

  // Display results
  displayResults(result);

  // Final status message
  newline();
  if (result.errors.length === 0 && result.deleted.length > 0) {
    success('Cleanup complete!');
  } else if (result.errors.length > 0) {
    warning('Cleanup completed with errors.');
  }
}

export default handleCleanup;
