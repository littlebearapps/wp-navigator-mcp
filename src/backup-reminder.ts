/**
 * Backup Reminder Module
 *
 * Implements backup reminder logic for the sync command based on
 * manifest safety settings.
 *
 * @package WP_Navigator_Pro
 * @since 1.2.0
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  getBackupReminders,
  getManifestSafety,
  type WPNavManifest,
  type BackupReminderFrequency,
} from './manifest.js';
import type { SiteIndexSnapshot } from './snapshots/types.js';
import { confirmPrompt } from './cli/tui/prompts.js';
import {
  warning,
  info,
  newline,
  list,
  colorize,
  box,
} from './cli/tui/components.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Backup reminder state persisted between sessions
 */
export interface BackupReminderState {
  /** Whether first sync has been acknowledged */
  first_sync_acknowledged: boolean;
  /** Last time a daily reminder was shown (ISO timestamp) */
  last_daily_reminder?: string;
}

/**
 * Result of backup reminder check
 */
export interface BackupReminderResult {
  /** Whether reminder was shown */
  shown: boolean;
  /** Whether user confirmed to continue */
  confirmed: boolean;
  /** Reason reminder was skipped (if shown=false) */
  skipReason?: 'disabled' | 'never' | 'already_acknowledged' | 'daily_shown_recently' | 'yes_flag';
  /** Detected backup plugins */
  detectedPlugins?: string[];
}

// =============================================================================
// Known Backup Plugins
// =============================================================================

/**
 * Known backup plugin slugs and their display names
 */
const BACKUP_PLUGINS: Record<string, string> = {
  'updraftplus': 'UpdraftPlus',
  'updraftplus-premium': 'UpdraftPlus Premium',
  'all-in-one-wp-migration': 'All-in-One WP Migration',
  'backupbuddy': 'BackupBuddy',
  'backwpup': 'BackWPup',
  'duplicator': 'Duplicator',
  'duplicator-pro': 'Duplicator Pro',
  'jetpack': 'Jetpack Backup',
  'vaultpress': 'VaultPress',
  'wp-time-capsule': 'WP Time Capsule',
  'blogvault-real-time-backup': 'BlogVault',
  'backup-backup': 'Backup Migration',
  'xcloner-backup-and-restore': 'XCloner',
  'total-upkeep': 'Total Upkeep',
};

// =============================================================================
// State Management
// =============================================================================

/**
 * Get path to state file
 */
function getStatePath(projectDir: string): string {
  return path.join(projectDir, '.wpnav', 'state.json');
}

/**
 * Load backup reminder state from file
 */
export function loadBackupState(projectDir: string): BackupReminderState {
  const statePath = getStatePath(projectDir);
  try {
    if (fs.existsSync(statePath)) {
      const content = fs.readFileSync(statePath, 'utf-8');
      const state = JSON.parse(content);
      return {
        first_sync_acknowledged: state.first_sync_acknowledged ?? false,
        last_daily_reminder: state.last_daily_reminder,
      };
    }
  } catch {
    // Ignore errors, return default state
  }
  return { first_sync_acknowledged: false };
}

/**
 * Save backup reminder state to file
 */
export function saveBackupState(projectDir: string, state: BackupReminderState): void {
  const statePath = getStatePath(projectDir);
  const stateDir = path.dirname(statePath);

  try {
    if (!fs.existsSync(stateDir)) {
      fs.mkdirSync(stateDir, { recursive: true });
    }
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf-8');
  } catch {
    // Ignore errors - state is non-critical
  }
}

// =============================================================================
// Plugin Detection
// =============================================================================

/**
 * Detect backup plugins from site index snapshot
 */
export function detectBackupPlugins(siteIndex?: SiteIndexSnapshot): string[] {
  if (!siteIndex?.plugins?.active) {
    return [];
  }

  const detected: string[] = [];
  for (const plugin of siteIndex.plugins.active) {
    const slug = plugin.slug.toLowerCase();
    if (BACKUP_PLUGINS[slug]) {
      detected.push(BACKUP_PLUGINS[slug]);
    }
  }

  return detected;
}

/**
 * Try to load site index snapshot for backup plugin detection
 */
export function loadSiteIndexForPluginDetection(projectDir: string): SiteIndexSnapshot | undefined {
  const siteIndexPath = path.join(projectDir, 'snapshots', 'site_index.json');
  try {
    if (fs.existsSync(siteIndexPath)) {
      const content = fs.readFileSync(siteIndexPath, 'utf-8');
      return JSON.parse(content) as SiteIndexSnapshot;
    }
  } catch {
    // Ignore errors
  }
  return undefined;
}

// =============================================================================
// Reminder Logic
// =============================================================================

/**
 * Check if daily reminder should be shown (more than 24h since last)
 */
function shouldShowDailyReminder(lastReminder?: string): boolean {
  if (!lastReminder) {
    return true;
  }

  const lastTime = new Date(lastReminder).getTime();
  const now = Date.now();
  const twentyFourHours = 24 * 60 * 60 * 1000;

  return now - lastTime > twentyFourHours;
}

/**
 * Determine if backup reminder should be shown based on frequency and state
 */
export function shouldShowReminder(
  frequency: BackupReminderFrequency,
  state: BackupReminderState
): { show: boolean; skipReason?: string } {
  switch (frequency) {
    case 'never':
      return { show: false, skipReason: 'never' };

    case 'first_sync_only':
      if (state.first_sync_acknowledged) {
        return { show: false, skipReason: 'already_acknowledged' };
      }
      return { show: true };

    case 'daily':
      if (!shouldShowDailyReminder(state.last_daily_reminder)) {
        return { show: false, skipReason: 'daily_shown_recently' };
      }
      return { show: true };

    case 'always':
      return { show: true };

    default:
      return { show: true };
  }
}

/**
 * Display the backup reminder and get user confirmation
 */
export async function showBackupReminder(
  detectedPlugins: string[],
  isInteractive: boolean = true
): Promise<boolean> {
  newline();
  box('Safety Check', { title: 'Backup Reminder' });
  newline();

  warning('We recommend making a backup before applying changes.');
  newline();

  if (detectedPlugins.length > 0) {
    console.error(colorize('Detected backup plugins (optional):', 'dim'));
    list(detectedPlugins);
    newline();
  }

  info("If you haven't backed up recently, consider doing that now.");
  newline();

  if (!isInteractive) {
    return true; // Non-interactive mode, assume yes
  }

  const confirmed = await confirmPrompt({
    message: 'Continue with sync?',
    defaultValue: false,
  });

  return confirmed;
}

// =============================================================================
// Main Entry Point
// =============================================================================

/**
 * Check and display backup reminder if needed
 *
 * @param manifest - Loaded manifest
 * @param projectDir - Project directory
 * @param skipConfirm - Whether to skip confirmation (--yes flag)
 * @returns Result indicating if sync should proceed
 */
export async function checkBackupReminder(
  manifest: WPNavManifest | undefined,
  projectDir: string,
  skipConfirm: boolean
): Promise<BackupReminderResult> {
  // Get backup reminder settings
  const reminders = getBackupReminders(manifest);

  // If reminders disabled, skip
  if (!reminders.enabled || !reminders.before_sync) {
    return {
      shown: false,
      confirmed: true,
      skipReason: 'disabled',
    };
  }

  // If --yes flag, skip reminder
  if (skipConfirm) {
    return {
      shown: false,
      confirmed: true,
      skipReason: 'yes_flag',
    };
  }

  // Load state
  const state = loadBackupState(projectDir);

  // Check if should show based on frequency
  const { show, skipReason } = shouldShowReminder(reminders.frequency, state);
  if (!show) {
    return {
      shown: false,
      confirmed: true,
      skipReason: skipReason as BackupReminderResult['skipReason'],
    };
  }

  // Try to detect backup plugins
  const siteIndex = loadSiteIndexForPluginDetection(projectDir);
  const detectedPlugins = detectBackupPlugins(siteIndex);

  // Show reminder
  const confirmed = await showBackupReminder(detectedPlugins, true);

  // Update state
  if (confirmed) {
    const newState: BackupReminderState = {
      ...state,
      first_sync_acknowledged: true,
      last_daily_reminder: new Date().toISOString(),
    };
    saveBackupState(projectDir, newState);
  }

  return {
    shown: true,
    confirmed,
    detectedPlugins: detectedPlugins.length > 0 ? detectedPlugins : undefined,
  };
}

/**
 * Reset backup reminder state (for testing)
 */
export function resetBackupState(projectDir: string): void {
  const statePath = getStatePath(projectDir);
  try {
    if (fs.existsSync(statePath)) {
      fs.unlinkSync(statePath);
    }
  } catch {
    // Ignore errors
  }
}
