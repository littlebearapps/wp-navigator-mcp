/**
 * Terminal Detection Tests
 *
 * @package WP_Navigator_Pro
 * @since 2.5.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  DEFAULT_WIDTH,
  DEFAULT_HEIGHT,
  MIN_PAGE_WIDTH,
  MIN_PAGE_HEIGHT,
  getTerminalSize,
  isDumbTerminal,
  supportsAnsi,
  getCapabilities,
  isSmallTerminal,
  supportsPageTUI,
  getContentArea,
  truncateToWidth,
  wrapText,
} from './terminal.js';

describe('Terminal detection', () => {
  describe('constants', () => {
    it('should define DEFAULT_WIDTH as 80', () => {
      expect(DEFAULT_WIDTH).toBe(80);
    });

    it('should define DEFAULT_HEIGHT as 24', () => {
      expect(DEFAULT_HEIGHT).toBe(24);
    });

    it('should define MIN_PAGE_WIDTH as 40', () => {
      expect(MIN_PAGE_WIDTH).toBe(40);
    });

    it('should define MIN_PAGE_HEIGHT as 10', () => {
      expect(MIN_PAGE_HEIGHT).toBe(10);
    });
  });

  describe('getTerminalSize', () => {
    const originalIsTTY = process.stdout.isTTY;
    const originalColumns = process.stdout.columns;
    const originalRows = process.stdout.rows;

    afterEach(() => {
      // Restore original values
      Object.defineProperty(process.stdout, 'isTTY', { value: originalIsTTY, writable: true });
      Object.defineProperty(process.stdout, 'columns', { value: originalColumns, writable: true });
      Object.defineProperty(process.stdout, 'rows', { value: originalRows, writable: true });
    });

    it('should return actual dimensions when TTY', () => {
      Object.defineProperty(process.stdout, 'isTTY', { value: true, writable: true });
      Object.defineProperty(process.stdout, 'columns', { value: 120, writable: true });
      Object.defineProperty(process.stdout, 'rows', { value: 40, writable: true });

      const size = getTerminalSize();
      expect(size.width).toBe(120);
      expect(size.height).toBe(40);
    });

    it('should return defaults when not TTY', () => {
      Object.defineProperty(process.stdout, 'isTTY', { value: false, writable: true });

      const size = getTerminalSize();
      expect(size.width).toBe(DEFAULT_WIDTH);
      expect(size.height).toBe(DEFAULT_HEIGHT);
    });

    it('should return defaults when isTTY is undefined', () => {
      Object.defineProperty(process.stdout, 'isTTY', { value: undefined, writable: true });

      const size = getTerminalSize();
      expect(size.width).toBe(DEFAULT_WIDTH);
      expect(size.height).toBe(DEFAULT_HEIGHT);
    });
  });

  describe('isDumbTerminal', () => {
    const originalTerm = process.env.TERM;

    afterEach(() => {
      if (originalTerm === undefined) {
        delete process.env.TERM;
      } else {
        process.env.TERM = originalTerm;
      }
    });

    it('should return true for TERM=dumb', () => {
      process.env.TERM = 'dumb';
      expect(isDumbTerminal()).toBe(true);
    });

    it('should return true for TERM=DUMB (case insensitive)', () => {
      process.env.TERM = 'DUMB';
      expect(isDumbTerminal()).toBe(true);
    });

    it('should return true for empty TERM', () => {
      process.env.TERM = '';
      expect(isDumbTerminal()).toBe(true);
    });

    it('should return true for undefined TERM', () => {
      delete process.env.TERM;
      expect(isDumbTerminal()).toBe(true);
    });

    it('should return false for xterm', () => {
      process.env.TERM = 'xterm';
      expect(isDumbTerminal()).toBe(false);
    });

    it('should return false for xterm-256color', () => {
      process.env.TERM = 'xterm-256color';
      expect(isDumbTerminal()).toBe(false);
    });
  });

  describe('getCapabilities', () => {
    it('should return all capability flags', () => {
      const caps = getCapabilities();

      expect(caps).toHaveProperty('isTTY');
      expect(caps).toHaveProperty('isDumb');
      expect(caps).toHaveProperty('supportsAnsi');
      expect(caps).toHaveProperty('supportsColor');
      expect(caps).toHaveProperty('supportsHyperlinks');

      expect(typeof caps.isTTY).toBe('boolean');
      expect(typeof caps.isDumb).toBe('boolean');
      expect(typeof caps.supportsAnsi).toBe('boolean');
      expect(typeof caps.supportsColor).toBe('boolean');
      expect(typeof caps.supportsHyperlinks).toBe('boolean');
    });
  });

  describe('isSmallTerminal', () => {
    const originalIsTTY = process.stdout.isTTY;
    const originalColumns = process.stdout.columns;
    const originalRows = process.stdout.rows;

    afterEach(() => {
      Object.defineProperty(process.stdout, 'isTTY', { value: originalIsTTY, writable: true });
      Object.defineProperty(process.stdout, 'columns', { value: originalColumns, writable: true });
      Object.defineProperty(process.stdout, 'rows', { value: originalRows, writable: true });
    });

    it('should return true when width is too small', () => {
      Object.defineProperty(process.stdout, 'isTTY', { value: true, writable: true });
      Object.defineProperty(process.stdout, 'columns', { value: 30, writable: true });
      Object.defineProperty(process.stdout, 'rows', { value: 24, writable: true });

      expect(isSmallTerminal()).toBe(true);
    });

    it('should return true when height is too small', () => {
      Object.defineProperty(process.stdout, 'isTTY', { value: true, writable: true });
      Object.defineProperty(process.stdout, 'columns', { value: 80, writable: true });
      Object.defineProperty(process.stdout, 'rows', { value: 8, writable: true });

      expect(isSmallTerminal()).toBe(true);
    });

    it('should return false when terminal is large enough', () => {
      Object.defineProperty(process.stdout, 'isTTY', { value: true, writable: true });
      Object.defineProperty(process.stdout, 'columns', { value: 80, writable: true });
      Object.defineProperty(process.stdout, 'rows', { value: 24, writable: true });

      expect(isSmallTerminal()).toBe(false);
    });

    it('should accept custom minimum dimensions', () => {
      Object.defineProperty(process.stdout, 'isTTY', { value: true, writable: true });
      Object.defineProperty(process.stdout, 'columns', { value: 50, writable: true });
      Object.defineProperty(process.stdout, 'rows', { value: 15, writable: true });

      expect(isSmallTerminal(60, 20)).toBe(true);
      expect(isSmallTerminal(40, 10)).toBe(false);
    });
  });

  describe('getContentArea', () => {
    const originalIsTTY = process.stdout.isTTY;
    const originalColumns = process.stdout.columns;
    const originalRows = process.stdout.rows;

    afterEach(() => {
      Object.defineProperty(process.stdout, 'isTTY', { value: originalIsTTY, writable: true });
      Object.defineProperty(process.stdout, 'columns', { value: originalColumns, writable: true });
      Object.defineProperty(process.stdout, 'rows', { value: originalRows, writable: true });
    });

    it('should calculate content area with default header/footer', () => {
      Object.defineProperty(process.stdout, 'isTTY', { value: true, writable: true });
      Object.defineProperty(process.stdout, 'columns', { value: 80, writable: true });
      Object.defineProperty(process.stdout, 'rows', { value: 24, writable: true });

      const area = getContentArea();

      expect(area.width).toBe(80);
      expect(area.height).toBe(24 - 3 - 2); // height - header(3) - footer(2)
      expect(area.startRow).toBe(4); // header(3) + 1
    });

    it('should calculate content area with custom header/footer', () => {
      Object.defineProperty(process.stdout, 'isTTY', { value: true, writable: true });
      Object.defineProperty(process.stdout, 'columns', { value: 100, writable: true });
      Object.defineProperty(process.stdout, 'rows', { value: 30, writable: true });

      const area = getContentArea(5, 3);

      expect(area.width).toBe(100);
      expect(area.height).toBe(30 - 5 - 3); // height - header(5) - footer(3)
      expect(area.startRow).toBe(6); // header(5) + 1
    });

    it('should ensure minimum height of 1', () => {
      Object.defineProperty(process.stdout, 'isTTY', { value: true, writable: true });
      Object.defineProperty(process.stdout, 'columns', { value: 80, writable: true });
      Object.defineProperty(process.stdout, 'rows', { value: 5, writable: true });

      const area = getContentArea(3, 2);

      expect(area.height).toBe(1);
    });
  });

  describe('truncateToWidth', () => {
    it('should not truncate short text', () => {
      expect(truncateToWidth('Hello', 10)).toBe('Hello');
    });

    it('should truncate long text with ellipsis', () => {
      expect(truncateToWidth('Hello World!', 8)).toBe('Hello...');
    });

    it('should use custom ellipsis', () => {
      expect(truncateToWidth('Hello World!', 10, '…')).toBe('Hello Wor…');
    });

    it('should handle exact length', () => {
      expect(truncateToWidth('Hello', 5)).toBe('Hello');
    });
  });

  describe('wrapText', () => {
    it('should not wrap short text', () => {
      const lines = wrapText('Hello', 20);
      expect(lines).toEqual(['Hello']);
    });

    it('should wrap text at word boundaries', () => {
      const lines = wrapText('Hello World Test', 10);
      expect(lines).toEqual(['Hello', 'World Test']);
    });

    it('should handle long words by breaking them', () => {
      const lines = wrapText('Supercalifragilisticexpialidocious', 10);
      expect(lines.length).toBeGreaterThan(1);
      expect(lines[0].length).toBeLessThanOrEqual(10);
    });

    it('should handle multiple lines', () => {
      const lines = wrapText('This is a longer text that should wrap across multiple lines', 15);
      expect(lines.length).toBeGreaterThan(1);
      lines.forEach((line) => {
        expect(line.length).toBeLessThanOrEqual(15);
      });
    });

    it('should handle empty string', () => {
      const lines = wrapText('', 10);
      expect(lines).toEqual([]);
    });
  });
});
