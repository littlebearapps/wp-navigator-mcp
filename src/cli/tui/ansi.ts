/**
 * ANSI Escape Code Constants
 *
 * Standard ANSI escape sequences for terminal control.
 * Used for screen clearing, cursor positioning, and terminal manipulation.
 *
 * @package WP_Navigator_Pro
 * @since 2.5.0
 *
 * @see https://en.wikipedia.org/wiki/ANSI_escape_code
 *
 * @example
 * import { CLEAR_SCREEN, CURSOR_HOME, moveCursor } from './ansi.js';
 * process.stdout.write(CLEAR_SCREEN + CURSOR_HOME);
 * process.stdout.write(moveCursor(5, 10) + 'Hello!');
 */

// =============================================================================
// Screen Control
// =============================================================================

/** Clear entire screen (ED - Erase Display, mode 2) */
export const CLEAR_SCREEN = '\x1b[2J';

/** Clear from cursor to end of screen (ED - Erase Display, mode 0) */
export const CLEAR_BELOW = '\x1b[J';

/** Clear from cursor to beginning of screen (ED - Erase Display, mode 1) */
export const CLEAR_ABOVE = '\x1b[1J';

/** Clear entire line (EL - Erase Line, mode 2) */
export const CLEAR_LINE = '\x1b[2K';

/** Clear from cursor to end of line (EL - Erase Line, mode 0) */
export const CLEAR_LINE_RIGHT = '\x1b[K';

/** Clear from cursor to beginning of line (EL - Erase Line, mode 1) */
export const CLEAR_LINE_LEFT = '\x1b[1K';

// =============================================================================
// Cursor Positioning
// =============================================================================

/** Move cursor to home position (top-left corner, row 1, column 1) */
export const CURSOR_HOME = '\x1b[H';

/** Hide cursor (DECTCEM - DEC Text Cursor Enable Mode) */
export const CURSOR_HIDE = '\x1b[?25l';

/** Show cursor (DECTCEM - DEC Text Cursor Enable Mode) */
export const CURSOR_SHOW = '\x1b[?25h';

/** Save cursor position (DECSC) */
export const CURSOR_SAVE = '\x1b7';

/** Restore cursor position (DECRC) */
export const CURSOR_RESTORE = '\x1b8';

// =============================================================================
// Cursor Movement Functions
// =============================================================================

/**
 * Move cursor to absolute position (CUP - Cursor Position)
 * @param row - Row number (1-based)
 * @param col - Column number (1-based)
 * @returns ANSI escape sequence
 */
export function moveCursor(row: number, col: number): string {
  return `\x1b[${row};${col}H`;
}

/**
 * Move cursor up by n rows (CUU - Cursor Up)
 * @param n - Number of rows to move up
 * @returns ANSI escape sequence
 */
export function moveUp(n: number): string {
  return n > 0 ? `\x1b[${n}A` : '';
}

/**
 * Move cursor down by n rows (CUD - Cursor Down)
 * @param n - Number of rows to move down
 * @returns ANSI escape sequence
 */
export function moveDown(n: number): string {
  return n > 0 ? `\x1b[${n}B` : '';
}

/**
 * Move cursor forward (right) by n columns (CUF - Cursor Forward)
 * @param n - Number of columns to move right
 * @returns ANSI escape sequence
 */
export function moveRight(n: number): string {
  return n > 0 ? `\x1b[${n}C` : '';
}

/**
 * Move cursor backward (left) by n columns (CUB - Cursor Back)
 * @param n - Number of columns to move left
 * @returns ANSI escape sequence
 */
export function moveLeft(n: number): string {
  return n > 0 ? `\x1b[${n}D` : '';
}

/**
 * Move cursor to beginning of line n lines down (CNL - Cursor Next Line)
 * @param n - Number of lines to move down
 * @returns ANSI escape sequence
 */
export function moveToLineBelow(n: number): string {
  return n > 0 ? `\x1b[${n}E` : '';
}

/**
 * Move cursor to beginning of line n lines up (CPL - Cursor Previous Line)
 * @param n - Number of lines to move up
 * @returns ANSI escape sequence
 */
export function moveToLineAbove(n: number): string {
  return n > 0 ? `\x1b[${n}F` : '';
}

/**
 * Move cursor to column n (CHA - Cursor Horizontal Absolute)
 * @param col - Column number (1-based)
 * @returns ANSI escape sequence
 */
export function moveToColumn(col: number): string {
  return `\x1b[${col}G`;
}

// =============================================================================
// Scrolling
// =============================================================================

/**
 * Scroll screen up by n lines (SU - Scroll Up)
 * @param n - Number of lines to scroll
 * @returns ANSI escape sequence
 */
export function scrollUp(n: number): string {
  return n > 0 ? `\x1b[${n}S` : '';
}

/**
 * Scroll screen down by n lines (SD - Scroll Down)
 * @param n - Number of lines to scroll
 * @returns ANSI escape sequence
 */
export function scrollDown(n: number): string {
  return n > 0 ? `\x1b[${n}T` : '';
}

// =============================================================================
// Alternate Screen Buffer
// =============================================================================

/** Enter alternate screen buffer (private mode 1049) */
export const ALT_BUFFER_ENTER = '\x1b[?1049h';

/** Exit alternate screen buffer (private mode 1049) */
export const ALT_BUFFER_EXIT = '\x1b[?1049l';

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Clear screen and move cursor to home position
 * Common pattern for full screen refresh
 * @returns Combined ANSI escape sequence
 */
export function clearAndHome(): string {
  return CLEAR_SCREEN + CURSOR_HOME;
}

/**
 * Move to position and clear to end of line
 * Useful for updating a single line
 * @param row - Row number (1-based)
 * @param col - Column number (1-based, defaults to 1)
 * @returns Combined ANSI escape sequence
 */
export function clearLineAt(row: number, col = 1): string {
  return moveCursor(row, col) + CLEAR_LINE_RIGHT;
}
