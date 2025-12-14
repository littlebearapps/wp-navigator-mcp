/**
 * JIT Safety Acknowledgment Module
 *
 * Provides first-sync safety prompts that appear when users run
 * `wpnav sync` for the first time. Stores acknowledgment to avoid
 * prompting on subsequent syncs.
 *
 * @package WP_Navigator_Pro
 * @since 2.4.0
 */

import * as fs from 'fs';
import * as path from 'path';
import { confirmPrompt } from '../tui/prompts.js';
import { warning, info, newline, box, colorize, list } from '../tui/components.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Safety acknowledgment state persisted between sessions
 */
export interface SafetyState {
  /** Whether first sync safety has been acknowledged */
  first_sync_acknowledged: boolean;
  /** When the acknowledgment was made (ISO timestamp) */
  acknowledged_at?: string;
}

/**
 * Result of safety acknowledgment check
 */
export interface SafetyCheckResult {
  /** Whether the safety prompt was shown */
  shown: boolean;
  /** Whether user confirmed to continue */
  confirmed: boolean;
  /** Whether user wants to create a rollback point */
  createRollback: boolean;
  /** Reason prompt was skipped (if shown=false) */
  skipReason?: 'already_acknowledged' | 'yes_flag' | 'non_interactive' | 'dry_run';
}

/**
 * Options for the safety check
 */
export interface SafetyCheckOptions {
  /** Project directory */
  projectDir: string;
  /** Whether to skip confirmation (--yes flag) */
  skipConfirm: boolean;
  /** Whether this is a Pro edition install */
  isPro: boolean;
  /** Site name for display */
  siteName?: string;
  /** Whether this is a dry-run (skip prompts) */
  dryRun?: boolean;
  /** Whether running in interactive mode */
  isInteractive?: boolean;
}

// =============================================================================
// Constants
// =============================================================================

/** Path to state file within project */
const STATE_FILE_NAME = 'state.json';
const STATE_DIR_NAME = '.wpnav';

// =============================================================================
// State Management
// =============================================================================

/**
 * Get path to state file
 */
function getStatePath(projectDir: string): string {
  return path.join(projectDir, STATE_DIR_NAME, STATE_FILE_NAME);
}

/**
 * Load safety acknowledgment state from file
 */
export function loadSafetyState(projectDir: string): SafetyState {
  const statePath = getStatePath(projectDir);
  try {
    if (fs.existsSync(statePath)) {
      const content = fs.readFileSync(statePath, 'utf-8');
      const state = JSON.parse(content);
      // Handle both top-level and nested safety state
      const safety = state.safety || state;
      return {
        first_sync_acknowledged: safety.first_sync_acknowledged ?? false,
        acknowledged_at: safety.acknowledged_at,
      };
    }
  } catch {
    // Ignore errors, return default state
  }
  return { first_sync_acknowledged: false };
}

/**
 * Save safety acknowledgment state to file
 *
 * Merges with existing state to preserve other state fields
 * (like backup reminder state).
 */
export function saveSafetyState(projectDir: string, safetyState: SafetyState): void {
  const statePath = getStatePath(projectDir);
  const stateDir = path.dirname(statePath);

  try {
    // Read existing state
    let existingState: Record<string, unknown> = {};
    if (fs.existsSync(statePath)) {
      const content = fs.readFileSync(statePath, 'utf-8');
      existingState = JSON.parse(content);
    }

    // Merge safety state
    const newState = {
      ...existingState,
      safety: {
        first_sync_acknowledged: safetyState.first_sync_acknowledged,
        acknowledged_at: safetyState.acknowledged_at,
      },
    };

    // Ensure directory exists
    if (!fs.existsSync(stateDir)) {
      fs.mkdirSync(stateDir, { recursive: true });
    }

    fs.writeFileSync(statePath, JSON.stringify(newState, null, 2), 'utf-8');
  } catch {
    // Ignore errors - state is non-critical
  }
}

/**
 * Reset safety state (for testing)
 */
export function resetSafetyState(projectDir: string): void {
  const statePath = getStatePath(projectDir);
  try {
    if (fs.existsSync(statePath)) {
      const content = fs.readFileSync(statePath, 'utf-8');
      const state = JSON.parse(content);
      // Remove safety section
      delete state.safety;
      fs.writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf-8');
    }
  } catch {
    // Ignore errors
  }
}

// =============================================================================
// Safety Prompt UI
// =============================================================================

/**
 * Display the safety prompt and get user confirmation
 */
export async function showSafetyPrompt(options: {
  isPro: boolean;
  siteName?: string;
  isInteractive?: boolean;
}): Promise<{ confirmed: boolean; createRollback: boolean }> {
  const { isPro, siteName, isInteractive = true } = options;

  newline();
  box('First Sync Safety Check', { title: 'Important' });
  newline();

  const siteDisplay = siteName || 'your WordPress site';
  warning(`You're about to sync changes to ${colorize(siteDisplay, 'bold')}`);
  newline();

  info('Before proceeding, please confirm:');
  list([
    'You have a recent backup of your WordPress site',
    'You understand that this will modify content on the site',
    'You have reviewed the changes with `wpnav diff` first',
  ]);
  newline();

  if (!isInteractive) {
    // Non-interactive mode, proceed without prompts
    return { confirmed: true, createRollback: false };
  }

  // Ask about backup
  const hasBackup = await confirmPrompt({
    message: 'Have you made a recent backup?',
    defaultValue: false,
  });

  if (!hasBackup) {
    newline();
    warning('We strongly recommend making a backup before syncing.');
    info(
      'You can use your hosting provider, a plugin like UpdraftPlus, or export via Tools > Export.'
    );
    newline();

    const continueAnyway = await confirmPrompt({
      message: 'Continue anyway?',
      defaultValue: false,
    });

    if (!continueAnyway) {
      return { confirmed: false, createRollback: false };
    }
  }

  // Offer rollback point for Pro users
  let createRollback = false;
  if (isPro) {
    newline();
    info('Pro Feature: WP Navigator can create a rollback point before syncing.');
    info('This allows you to restore your site if something goes wrong.');
    newline();

    createRollback = await confirmPrompt({
      message: 'Create a rollback point before syncing?',
      defaultValue: true,
    });
  }

  return { confirmed: true, createRollback };
}

// =============================================================================
// Main Entry Point
// =============================================================================

/**
 * Check and display safety acknowledgment if needed
 *
 * This should be called BEFORE sync operations.
 *
 * @param options - Safety check options
 * @returns Result indicating if sync should proceed and if rollback point should be created
 */
export async function checkSafetyAcknowledgment(
  options: SafetyCheckOptions
): Promise<SafetyCheckResult> {
  const {
    projectDir,
    skipConfirm,
    isPro,
    siteName,
    dryRun = false,
    isInteractive = true,
  } = options;

  // Skip for dry-run mode
  if (dryRun) {
    return {
      shown: false,
      confirmed: true,
      createRollback: false,
      skipReason: 'dry_run',
    };
  }

  // Skip if --yes flag is set
  if (skipConfirm) {
    return {
      shown: false,
      confirmed: true,
      createRollback: false,
      skipReason: 'yes_flag',
    };
  }

  // Load state
  const state = loadSafetyState(projectDir);

  // Skip if already acknowledged
  if (state.first_sync_acknowledged) {
    return {
      shown: false,
      confirmed: true,
      createRollback: false,
      skipReason: 'already_acknowledged',
    };
  }

  // Skip in non-interactive mode (but log warning)
  if (!isInteractive) {
    return {
      shown: false,
      confirmed: true,
      createRollback: false,
      skipReason: 'non_interactive',
    };
  }

  // Show safety prompt
  const { confirmed, createRollback } = await showSafetyPrompt({
    isPro,
    siteName,
    isInteractive,
  });

  // Save acknowledgment if confirmed
  if (confirmed) {
    const newState: SafetyState = {
      first_sync_acknowledged: true,
      acknowledged_at: new Date().toISOString(),
    };
    saveSafetyState(projectDir, newState);
  }

  return {
    shown: true,
    confirmed,
    createRollback,
  };
}
