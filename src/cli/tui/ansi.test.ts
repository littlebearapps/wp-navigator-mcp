/**
 * ANSI Escape Code Tests
 *
 * @package WP_Navigator_Pro
 * @since 2.5.0
 */

import { describe, it, expect } from 'vitest';
import {
  // Screen control
  CLEAR_SCREEN,
  CLEAR_BELOW,
  CLEAR_ABOVE,
  CLEAR_LINE,
  CLEAR_LINE_RIGHT,
  CLEAR_LINE_LEFT,

  // Cursor control
  CURSOR_HOME,
  CURSOR_HIDE,
  CURSOR_SHOW,
  CURSOR_SAVE,
  CURSOR_RESTORE,

  // Cursor movement functions
  moveCursor,
  moveUp,
  moveDown,
  moveRight,
  moveLeft,
  moveToLineBelow,
  moveToLineAbove,
  moveToColumn,

  // Scrolling
  scrollUp,
  scrollDown,

  // Alternate buffer
  ALT_BUFFER_ENTER,
  ALT_BUFFER_EXIT,

  // Utilities
  clearAndHome,
  clearLineAt,
} from './ansi.js';

describe('ANSI escape codes', () => {
  describe('screen control constants', () => {
    it('should define CLEAR_SCREEN as ESC[2J', () => {
      expect(CLEAR_SCREEN).toBe('\x1b[2J');
    });

    it('should define CLEAR_BELOW as ESC[J', () => {
      expect(CLEAR_BELOW).toBe('\x1b[J');
    });

    it('should define CLEAR_ABOVE as ESC[1J', () => {
      expect(CLEAR_ABOVE).toBe('\x1b[1J');
    });

    it('should define CLEAR_LINE as ESC[2K', () => {
      expect(CLEAR_LINE).toBe('\x1b[2K');
    });

    it('should define CLEAR_LINE_RIGHT as ESC[K', () => {
      expect(CLEAR_LINE_RIGHT).toBe('\x1b[K');
    });

    it('should define CLEAR_LINE_LEFT as ESC[1K', () => {
      expect(CLEAR_LINE_LEFT).toBe('\x1b[1K');
    });
  });

  describe('cursor control constants', () => {
    it('should define CURSOR_HOME as ESC[H', () => {
      expect(CURSOR_HOME).toBe('\x1b[H');
    });

    it('should define CURSOR_HIDE as ESC[?25l', () => {
      expect(CURSOR_HIDE).toBe('\x1b[?25l');
    });

    it('should define CURSOR_SHOW as ESC[?25h', () => {
      expect(CURSOR_SHOW).toBe('\x1b[?25h');
    });

    it('should define CURSOR_SAVE as ESC7', () => {
      expect(CURSOR_SAVE).toBe('\x1b7');
    });

    it('should define CURSOR_RESTORE as ESC8', () => {
      expect(CURSOR_RESTORE).toBe('\x1b8');
    });
  });

  describe('cursor movement functions', () => {
    it('moveCursor should generate correct sequence for row,col', () => {
      expect(moveCursor(1, 1)).toBe('\x1b[1;1H');
      expect(moveCursor(5, 10)).toBe('\x1b[5;10H');
      expect(moveCursor(100, 200)).toBe('\x1b[100;200H');
    });

    it('moveUp should generate correct sequence', () => {
      expect(moveUp(1)).toBe('\x1b[1A');
      expect(moveUp(5)).toBe('\x1b[5A');
    });

    it('moveUp should return empty string for n <= 0', () => {
      expect(moveUp(0)).toBe('');
      expect(moveUp(-1)).toBe('');
    });

    it('moveDown should generate correct sequence', () => {
      expect(moveDown(1)).toBe('\x1b[1B');
      expect(moveDown(5)).toBe('\x1b[5B');
    });

    it('moveDown should return empty string for n <= 0', () => {
      expect(moveDown(0)).toBe('');
      expect(moveDown(-1)).toBe('');
    });

    it('moveRight should generate correct sequence', () => {
      expect(moveRight(1)).toBe('\x1b[1C');
      expect(moveRight(10)).toBe('\x1b[10C');
    });

    it('moveRight should return empty string for n <= 0', () => {
      expect(moveRight(0)).toBe('');
    });

    it('moveLeft should generate correct sequence', () => {
      expect(moveLeft(1)).toBe('\x1b[1D');
      expect(moveLeft(10)).toBe('\x1b[10D');
    });

    it('moveLeft should return empty string for n <= 0', () => {
      expect(moveLeft(0)).toBe('');
    });

    it('moveToLineBelow should generate correct sequence', () => {
      expect(moveToLineBelow(1)).toBe('\x1b[1E');
      expect(moveToLineBelow(3)).toBe('\x1b[3E');
    });

    it('moveToLineAbove should generate correct sequence', () => {
      expect(moveToLineAbove(1)).toBe('\x1b[1F');
      expect(moveToLineAbove(3)).toBe('\x1b[3F');
    });

    it('moveToColumn should generate correct sequence', () => {
      expect(moveToColumn(1)).toBe('\x1b[1G');
      expect(moveToColumn(50)).toBe('\x1b[50G');
    });
  });

  describe('scrolling functions', () => {
    it('scrollUp should generate correct sequence', () => {
      expect(scrollUp(1)).toBe('\x1b[1S');
      expect(scrollUp(5)).toBe('\x1b[5S');
    });

    it('scrollUp should return empty string for n <= 0', () => {
      expect(scrollUp(0)).toBe('');
    });

    it('scrollDown should generate correct sequence', () => {
      expect(scrollDown(1)).toBe('\x1b[1T');
      expect(scrollDown(5)).toBe('\x1b[5T');
    });

    it('scrollDown should return empty string for n <= 0', () => {
      expect(scrollDown(0)).toBe('');
    });
  });

  describe('alternate screen buffer constants', () => {
    it('should define ALT_BUFFER_ENTER', () => {
      expect(ALT_BUFFER_ENTER).toBe('\x1b[?1049h');
    });

    it('should define ALT_BUFFER_EXIT', () => {
      expect(ALT_BUFFER_EXIT).toBe('\x1b[?1049l');
    });
  });

  describe('utility functions', () => {
    it('clearAndHome should combine CLEAR_SCREEN and CURSOR_HOME', () => {
      expect(clearAndHome()).toBe('\x1b[2J\x1b[H');
    });

    it('clearLineAt should position cursor and clear line', () => {
      expect(clearLineAt(1)).toBe('\x1b[1;1H\x1b[K');
      expect(clearLineAt(5)).toBe('\x1b[5;1H\x1b[K');
      expect(clearLineAt(5, 10)).toBe('\x1b[5;10H\x1b[K');
    });
  });
});
