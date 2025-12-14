/**
 * TUI Components Tests
 *
 * @package WP_Navigator_Pro
 * @since 1.1.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { stepHeader, progressBar, symbols, supportsColor, colorize } from './components.js';

describe('TUI Components', () => {
  // Mock environment for consistent testing
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    // Disable colors for predictable output
    process.env.NO_COLOR = '1';
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('symbols', () => {
    it('should have all required symbols', () => {
      expect(symbols.success).toBe('\u2714');
      expect(symbols.error).toBe('\u2716');
      expect(symbols.warning).toBe('\u26A0');
      expect(symbols.info).toBe('\u2139');
      expect(symbols.bullet).toBe('\u2022');
      expect(symbols.arrow).toBe('\u2192');
    });
  });

  describe('supportsColor', () => {
    it('should return false when NO_COLOR is set', () => {
      process.env.NO_COLOR = '1';
      expect(supportsColor()).toBe(false);
    });

    it('should return true when FORCE_COLOR is set', () => {
      delete process.env.NO_COLOR;
      process.env.FORCE_COLOR = '1';
      expect(supportsColor()).toBe(true);
    });
  });

  describe('colorize', () => {
    it('should return plain text when colors disabled', () => {
      process.env.NO_COLOR = '1';
      expect(colorize('test', 'green')).toBe('test');
    });

    it('should apply ANSI codes when colors enabled', () => {
      delete process.env.NO_COLOR;
      process.env.FORCE_COLOR = '1';
      const result = colorize('test', 'green');
      expect(result).toContain('\x1b[32m');
      expect(result).toContain('test');
      expect(result).toContain('\x1b[0m');
    });
  });

  describe('stepHeader', () => {
    it('should format step header correctly', () => {
      const result = stepHeader({ current: 1, total: 3, title: 'Test Step' });
      expect(result).toContain('Step 1 of 3');
      expect(result).toContain('Test Step');
      expect(result).toContain('\u2014'); // em dash
    });

    it('should handle different step numbers', () => {
      const result = stepHeader({ current: 5, total: 10, title: 'Another Step' });
      expect(result).toContain('Step 5 of 10');
      expect(result).toContain('Another Step');
    });
  });

  describe('progressBar', () => {
    it('should render 0% progress', () => {
      const result = progressBar({ percent: 0, width: 10 });
      expect(result).toContain('0%');
      // Should have 10 empty chars
      expect(result.match(/\u2591/g)?.length).toBe(10);
    });

    it('should render 100% progress', () => {
      const result = progressBar({ percent: 100, width: 10 });
      expect(result).toContain('100%');
      // Should have 10 filled chars
      expect(result.match(/\u2593/g)?.length).toBe(10);
    });

    it('should render 50% progress', () => {
      const result = progressBar({ percent: 50, width: 10 });
      expect(result).toContain('50%');
      // Should have 5 filled and 5 empty
      expect(result.match(/\u2593/g)?.length).toBe(5);
      expect(result.match(/\u2591/g)?.length).toBe(5);
    });

    it('should clamp values above 100', () => {
      const result = progressBar({ percent: 150, width: 10 });
      expect(result).toContain('100%');
    });

    it('should clamp values below 0', () => {
      const result = progressBar({ percent: -10, width: 10 });
      expect(result).toContain('0%');
    });

    it('should hide percentage when showPercent is false', () => {
      const result = progressBar({ percent: 50, width: 10, showPercent: false });
      expect(result).not.toContain('%');
    });

    it('should use default width of 20', () => {
      const result = progressBar({ percent: 100 });
      // Should have 20 filled chars
      expect(result.match(/\u2593/g)?.length).toBe(20);
    });
  });
});
