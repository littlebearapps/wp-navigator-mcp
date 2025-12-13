/**
 * Tests for Backup Reminder Module
 *
 * @package WP_Navigator_MCP
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  loadBackupState,
  saveBackupState,
  detectBackupPlugins,
  shouldShowReminder,
  resetBackupState,
  type BackupReminderState,
} from './backup-reminder.js';
import type { SiteIndexSnapshot } from './snapshots/types.js';

// Test directory for state files
const TEST_DIR = '/tmp/wpnav-test-backup-reminder';

describe('BackupReminder', () => {
  beforeEach(() => {
    // Clean up test directory
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true });
    }
    fs.mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    // Clean up test directory
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true });
    }
  });

  describe('loadBackupState', () => {
    it('should return default state when no file exists', () => {
      const state = loadBackupState(TEST_DIR);
      expect(state.first_sync_acknowledged).toBe(false);
      expect(state.last_daily_reminder).toBeUndefined();
    });

    it('should load state from file', () => {
      const stateDir = path.join(TEST_DIR, '.wpnav');
      fs.mkdirSync(stateDir, { recursive: true });
      fs.writeFileSync(
        path.join(stateDir, 'state.json'),
        JSON.stringify({
          first_sync_acknowledged: true,
          last_daily_reminder: '2024-01-01T00:00:00.000Z',
        })
      );

      const state = loadBackupState(TEST_DIR);
      expect(state.first_sync_acknowledged).toBe(true);
      expect(state.last_daily_reminder).toBe('2024-01-01T00:00:00.000Z');
    });

    it('should return default state on invalid JSON', () => {
      const stateDir = path.join(TEST_DIR, '.wpnav');
      fs.mkdirSync(stateDir, { recursive: true });
      fs.writeFileSync(path.join(stateDir, 'state.json'), 'invalid json');

      const state = loadBackupState(TEST_DIR);
      expect(state.first_sync_acknowledged).toBe(false);
    });
  });

  describe('saveBackupState', () => {
    it('should save state to file', () => {
      const state: BackupReminderState = {
        first_sync_acknowledged: true,
        last_daily_reminder: '2024-01-01T00:00:00.000Z',
      };

      saveBackupState(TEST_DIR, state);

      const statePath = path.join(TEST_DIR, '.wpnav', 'state.json');
      expect(fs.existsSync(statePath)).toBe(true);

      const loaded = JSON.parse(fs.readFileSync(statePath, 'utf-8'));
      expect(loaded.first_sync_acknowledged).toBe(true);
      expect(loaded.last_daily_reminder).toBe('2024-01-01T00:00:00.000Z');
    });

    it('should create .wpnav directory if not exists', () => {
      const state: BackupReminderState = { first_sync_acknowledged: false };
      saveBackupState(TEST_DIR, state);

      expect(fs.existsSync(path.join(TEST_DIR, '.wpnav'))).toBe(true);
    });
  });

  describe('detectBackupPlugins', () => {
    it('should return empty array for undefined snapshot', () => {
      const plugins = detectBackupPlugins(undefined);
      expect(plugins).toEqual([]);
    });

    it('should return empty array for snapshot without plugins', () => {
      const snapshot = {
        plugins: { active: [], inactive: [] },
      } as unknown as SiteIndexSnapshot;
      const plugins = detectBackupPlugins(snapshot);
      expect(plugins).toEqual([]);
    });

    it('should detect UpdraftPlus', () => {
      const snapshot = {
        plugins: {
          active: [{ slug: 'updraftplus', name: 'UpdraftPlus', version: '1.0' }],
          inactive: [],
        },
      } as unknown as SiteIndexSnapshot;
      const plugins = detectBackupPlugins(snapshot);
      expect(plugins).toContain('UpdraftPlus');
    });

    it('should detect All-in-One WP Migration', () => {
      const snapshot = {
        plugins: {
          active: [{ slug: 'all-in-one-wp-migration', name: 'AIOWPM', version: '1.0' }],
          inactive: [],
        },
      } as unknown as SiteIndexSnapshot;
      const plugins = detectBackupPlugins(snapshot);
      expect(plugins).toContain('All-in-One WP Migration');
    });

    it('should detect multiple backup plugins', () => {
      const snapshot = {
        plugins: {
          active: [
            { slug: 'updraftplus', name: 'UpdraftPlus', version: '1.0' },
            { slug: 'duplicator', name: 'Duplicator', version: '1.0' },
          ],
          inactive: [],
        },
      } as unknown as SiteIndexSnapshot;
      const plugins = detectBackupPlugins(snapshot);
      expect(plugins).toHaveLength(2);
      expect(plugins).toContain('UpdraftPlus');
      expect(plugins).toContain('Duplicator');
    });

    it('should be case-insensitive for plugin slugs', () => {
      const snapshot = {
        plugins: {
          active: [{ slug: 'UPDRAFTPLUS', name: 'UpdraftPlus', version: '1.0' }],
          inactive: [],
        },
      } as unknown as SiteIndexSnapshot;
      const plugins = detectBackupPlugins(snapshot);
      expect(plugins).toContain('UpdraftPlus');
    });
  });

  describe('shouldShowReminder', () => {
    describe('frequency: never', () => {
      it('should not show reminder', () => {
        const result = shouldShowReminder('never', { first_sync_acknowledged: false });
        expect(result.show).toBe(false);
        expect(result.skipReason).toBe('never');
      });
    });

    describe('frequency: first_sync_only', () => {
      it('should show reminder if not acknowledged', () => {
        const result = shouldShowReminder('first_sync_only', { first_sync_acknowledged: false });
        expect(result.show).toBe(true);
      });

      it('should not show reminder if already acknowledged', () => {
        const result = shouldShowReminder('first_sync_only', { first_sync_acknowledged: true });
        expect(result.show).toBe(false);
        expect(result.skipReason).toBe('already_acknowledged');
      });
    });

    describe('frequency: daily', () => {
      it('should show reminder if no previous reminder', () => {
        const result = shouldShowReminder('daily', { first_sync_acknowledged: false });
        expect(result.show).toBe(true);
      });

      it('should show reminder if more than 24h since last', () => {
        const yesterday = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
        const result = shouldShowReminder('daily', {
          first_sync_acknowledged: true,
          last_daily_reminder: yesterday,
        });
        expect(result.show).toBe(true);
      });

      it('should not show reminder if less than 24h since last', () => {
        const recent = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString();
        const result = shouldShowReminder('daily', {
          first_sync_acknowledged: true,
          last_daily_reminder: recent,
        });
        expect(result.show).toBe(false);
        expect(result.skipReason).toBe('daily_shown_recently');
      });
    });

    describe('frequency: always', () => {
      it('should always show reminder', () => {
        const result = shouldShowReminder('always', { first_sync_acknowledged: true });
        expect(result.show).toBe(true);
      });

      it('should show even if acknowledged', () => {
        const result = shouldShowReminder('always', {
          first_sync_acknowledged: true,
          last_daily_reminder: new Date().toISOString(),
        });
        expect(result.show).toBe(true);
      });
    });
  });

  describe('resetBackupState', () => {
    it('should delete state file', () => {
      const state: BackupReminderState = { first_sync_acknowledged: true };
      saveBackupState(TEST_DIR, state);

      const statePath = path.join(TEST_DIR, '.wpnav', 'state.json');
      expect(fs.existsSync(statePath)).toBe(true);

      resetBackupState(TEST_DIR);
      expect(fs.existsSync(statePath)).toBe(false);
    });

    it('should not throw if file does not exist', () => {
      expect(() => resetBackupState(TEST_DIR)).not.toThrow();
    });
  });
});
