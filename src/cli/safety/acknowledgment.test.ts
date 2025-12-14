/**
 * Tests for JIT Safety Acknowledgment Module
 *
 * @package WP_Navigator_MCP
 * @since 2.4.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  loadSafetyState,
  saveSafetyState,
  resetSafetyState,
  checkSafetyAcknowledgment,
  type SafetyState,
  type SafetyCheckOptions,
} from './acknowledgment.js';

// Mock fs module
vi.mock('fs');
vi.mock('../tui/prompts.js', () => ({
  confirmPrompt: vi.fn(),
}));
vi.mock('../tui/components.js', () => ({
  warning: vi.fn(),
  info: vi.fn(),
  newline: vi.fn(),
  box: vi.fn(),
  colorize: vi.fn((text: string) => text),
  list: vi.fn(),
}));

// Helper to get prompts mock
import { confirmPrompt } from '../tui/prompts.js';
const mockConfirmPrompt = vi.mocked(confirmPrompt);

describe('JIT Safety Acknowledgment', () => {
  const testDir = '/test/project';
  const stateDir = path.join(testDir, '.wpnav');
  const statePath = path.join(stateDir, 'state.json');

  beforeEach(() => {
    vi.clearAllMocks();
    // Default fs mocks
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(fs.readFileSync).mockReturnValue('{}');
    vi.mocked(fs.writeFileSync).mockImplementation(() => {});
    vi.mocked(fs.mkdirSync).mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('loadSafetyState', () => {
    it('returns default state when file does not exist', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const state = loadSafetyState(testDir);

      expect(state.first_sync_acknowledged).toBe(false);
      expect(state.acknowledged_at).toBeUndefined();
    });

    it('loads state from nested safety object', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({
          safety: {
            first_sync_acknowledged: true,
            acknowledged_at: '2025-12-14T10:00:00.000Z',
          },
        })
      );

      const state = loadSafetyState(testDir);

      expect(state.first_sync_acknowledged).toBe(true);
      expect(state.acknowledged_at).toBe('2025-12-14T10:00:00.000Z');
    });

    it('handles legacy top-level state format', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({
          first_sync_acknowledged: true,
          acknowledged_at: '2025-12-14T10:00:00.000Z',
        })
      );

      const state = loadSafetyState(testDir);

      expect(state.first_sync_acknowledged).toBe(true);
    });

    it('returns default state on parse error', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue('invalid json');

      const state = loadSafetyState(testDir);

      expect(state.first_sync_acknowledged).toBe(false);
    });
  });

  describe('saveSafetyState', () => {
    it('creates state directory if it does not exist', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const state: SafetyState = {
        first_sync_acknowledged: true,
        acknowledged_at: '2025-12-14T10:00:00.000Z',
      };

      saveSafetyState(testDir, state);

      expect(fs.mkdirSync).toHaveBeenCalledWith(stateDir, { recursive: true });
    });

    it('merges with existing state', () => {
      vi.mocked(fs.existsSync).mockImplementation((p) => p === statePath);
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({
          last_daily_reminder: '2025-12-13T10:00:00.000Z',
        })
      );

      const state: SafetyState = {
        first_sync_acknowledged: true,
        acknowledged_at: '2025-12-14T10:00:00.000Z',
      };

      saveSafetyState(testDir, state);

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        statePath,
        expect.stringContaining('last_daily_reminder'),
        'utf-8'
      );
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        statePath,
        expect.stringContaining('first_sync_acknowledged'),
        'utf-8'
      );
    });

    it('writes state to correct path', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const state: SafetyState = {
        first_sync_acknowledged: true,
      };

      saveSafetyState(testDir, state);

      expect(fs.writeFileSync).toHaveBeenCalledWith(statePath, expect.any(String), 'utf-8');
    });
  });

  describe('resetSafetyState', () => {
    it('removes safety section from state file', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({
          safety: { first_sync_acknowledged: true },
          other_data: 'preserved',
        })
      );

      resetSafetyState(testDir);

      const writeCall = vi.mocked(fs.writeFileSync).mock.calls[0];
      const written = JSON.parse(writeCall[1] as string);
      expect(written.safety).toBeUndefined();
      expect(written.other_data).toBe('preserved');
    });

    it('does nothing if state file does not exist', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      resetSafetyState(testDir);

      expect(fs.writeFileSync).not.toHaveBeenCalled();
    });
  });

  describe('checkSafetyAcknowledgment', () => {
    const baseOptions: SafetyCheckOptions = {
      projectDir: testDir,
      skipConfirm: false,
      isPro: false,
      siteName: 'example.com',
      dryRun: false,
      isInteractive: true,
    };

    it('skips prompt for dry-run mode', async () => {
      const result = await checkSafetyAcknowledgment({
        ...baseOptions,
        dryRun: true,
      });

      expect(result.shown).toBe(false);
      expect(result.confirmed).toBe(true);
      expect(result.skipReason).toBe('dry_run');
      expect(mockConfirmPrompt).not.toHaveBeenCalled();
    });

    it('skips prompt when --yes flag is set', async () => {
      const result = await checkSafetyAcknowledgment({
        ...baseOptions,
        skipConfirm: true,
      });

      expect(result.shown).toBe(false);
      expect(result.confirmed).toBe(true);
      expect(result.skipReason).toBe('yes_flag');
      expect(mockConfirmPrompt).not.toHaveBeenCalled();
    });

    it('skips prompt when already acknowledged', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({
          safety: { first_sync_acknowledged: true },
        })
      );

      const result = await checkSafetyAcknowledgment(baseOptions);

      expect(result.shown).toBe(false);
      expect(result.confirmed).toBe(true);
      expect(result.skipReason).toBe('already_acknowledged');
      expect(mockConfirmPrompt).not.toHaveBeenCalled();
    });

    it('skips prompt in non-interactive mode', async () => {
      const result = await checkSafetyAcknowledgment({
        ...baseOptions,
        isInteractive: false,
      });

      expect(result.shown).toBe(false);
      expect(result.confirmed).toBe(true);
      expect(result.skipReason).toBe('non_interactive');
      expect(mockConfirmPrompt).not.toHaveBeenCalled();
    });

    it('shows prompt and saves acknowledgment when confirmed', async () => {
      mockConfirmPrompt.mockResolvedValue(true); // User confirms backup

      const result = await checkSafetyAcknowledgment(baseOptions);

      expect(result.shown).toBe(true);
      expect(result.confirmed).toBe(true);
      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('returns cancelled when user declines backup and continue', async () => {
      mockConfirmPrompt
        .mockResolvedValueOnce(false) // No backup
        .mockResolvedValueOnce(false); // Don't continue anyway

      const result = await checkSafetyAcknowledgment(baseOptions);

      expect(result.shown).toBe(true);
      expect(result.confirmed).toBe(false);
      expect(result.createRollback).toBe(false);
    });

    it('continues when user has no backup but chooses to proceed', async () => {
      mockConfirmPrompt
        .mockResolvedValueOnce(false) // No backup
        .mockResolvedValueOnce(true); // Continue anyway

      const result = await checkSafetyAcknowledgment(baseOptions);

      expect(result.shown).toBe(true);
      expect(result.confirmed).toBe(true);
    });

    it('offers rollback point for Pro users', async () => {
      mockConfirmPrompt
        .mockResolvedValueOnce(true) // Has backup
        .mockResolvedValueOnce(true); // Create rollback

      const result = await checkSafetyAcknowledgment({
        ...baseOptions,
        isPro: true,
      });

      expect(result.shown).toBe(true);
      expect(result.confirmed).toBe(true);
      expect(result.createRollback).toBe(true);
    });

    it('does not offer rollback for Free users', async () => {
      mockConfirmPrompt.mockResolvedValueOnce(true); // Has backup

      const result = await checkSafetyAcknowledgment({
        ...baseOptions,
        isPro: false,
      });

      expect(result.shown).toBe(true);
      expect(result.confirmed).toBe(true);
      expect(result.createRollback).toBe(false);
      // Only one prompt for backup, no rollback prompt
      expect(mockConfirmPrompt).toHaveBeenCalledTimes(1);
    });

    it('Pro user can decline rollback point', async () => {
      mockConfirmPrompt
        .mockResolvedValueOnce(true) // Has backup
        .mockResolvedValueOnce(false); // Don't create rollback

      const result = await checkSafetyAcknowledgment({
        ...baseOptions,
        isPro: true,
      });

      expect(result.shown).toBe(true);
      expect(result.confirmed).toBe(true);
      expect(result.createRollback).toBe(false);
    });
  });

  describe('state file path', () => {
    it('uses .wpnav/state.json within project directory', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue('{}');

      loadSafetyState('/my/project');

      expect(fs.existsSync).toHaveBeenCalledWith('/my/project/.wpnav/state.json');
    });
  });
});
