/**
 * Terminal Detection Utilities
 *
 * Provides terminal capability detection and size measurement
 * for adaptive TUI rendering.
 *
 * @package WP_Navigator_Pro
 * @since 2.5.0
 *
 * @example
 * import { getTerminalSize, getCapabilities, isSmallTerminal } from './terminal.js';
 *
 * const size = getTerminalSize();
 * console.log(`Terminal: ${size.width}x${size.height}`);
 *
 * const caps = getCapabilities();
 * if (caps.supportsAnsi) {
 *   // Use ANSI escape codes
 * }
 */

import { supportsColor } from './components.js';
import { supportsHyperlinks } from './links.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Terminal dimensions
 */
export interface TerminalSize {
  /** Number of columns (characters per line) */
  width: number;
  /** Number of rows (lines visible) */
  height: number;
}

/**
 * Terminal capability flags
 */
export interface TerminalCapabilities {
  /** Whether output is going to a TTY (interactive terminal) */
  isTTY: boolean;
  /** Whether terminal likely supports ANSI escape codes */
  supportsAnsi: boolean;
  /** Whether terminal supports ANSI colors */
  supportsColor: boolean;
  /** Whether terminal supports OSC 8 hyperlinks */
  supportsHyperlinks: boolean;
  /** Whether terminal is a "dumb" terminal with no capabilities */
  isDumb: boolean;
}

/**
 * Content area dimensions (terminal minus reserved header/footer)
 */
export interface ContentArea {
  /** Available width for content */
  width: number;
  /** Available height for content */
  height: number;
  /** Starting row for content (1-based) */
  startRow: number;
}

// =============================================================================
// Constants
// =============================================================================

/** Default terminal width for non-TTY environments */
export const DEFAULT_WIDTH = 80;

/** Default terminal height for non-TTY environments */
export const DEFAULT_HEIGHT = 24;

/** Minimum terminal width for page-based display */
export const MIN_PAGE_WIDTH = 40;

/** Minimum terminal height for page-based display */
export const MIN_PAGE_HEIGHT = 10;

// =============================================================================
// Terminal Size Detection
// =============================================================================

/**
 * Get current terminal dimensions
 *
 * Uses process.stdout dimensions when available,
 * falls back to standard 80x24 for non-TTY environments.
 *
 * @returns Terminal width and height
 */
export function getTerminalSize(): TerminalSize {
  const isTTY = process.stdout.isTTY ?? false;

  if (!isTTY) {
    return { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT };
  }

  return {
    width: process.stdout.columns ?? DEFAULT_WIDTH,
    height: process.stdout.rows ?? DEFAULT_HEIGHT,
  };
}

/**
 * Get terminal size with resize listener support
 *
 * @param onResize - Callback when terminal is resized
 * @returns Current size and cleanup function
 */
export function watchTerminalSize(onResize: (size: TerminalSize) => void): {
  size: TerminalSize;
  cleanup: () => void;
} {
  const size = getTerminalSize();

  const handler = (): void => {
    onResize(getTerminalSize());
  };

  process.stdout.on('resize', handler);

  return {
    size,
    cleanup: (): void => {
      process.stdout.off('resize', handler);
    },
  };
}

// =============================================================================
// Capability Detection
// =============================================================================

/**
 * Check if terminal is a "dumb" terminal
 *
 * Dumb terminals don't support ANSI escape codes.
 * Common in CI environments, pipes, or legacy systems.
 *
 * @returns True if terminal is dumb
 */
export function isDumbTerminal(): boolean {
  const term = process.env.TERM?.toLowerCase() ?? '';
  return term === 'dumb' || term === '';
}

/**
 * Check if terminal supports ANSI escape codes
 *
 * Checks for:
 * - TTY output
 * - Non-dumb terminal
 * - Not explicitly disabled via CI environment
 *
 * @returns True if ANSI is likely supported
 */
export function supportsAnsi(): boolean {
  // Not a TTY - no ANSI support
  if (!process.stdout.isTTY) return false;

  // Dumb terminal - no ANSI support
  if (isDumbTerminal()) return false;

  // CI environments often don't support full ANSI
  // But many modern CI systems do, so we check TERM
  const term = process.env.TERM ?? '';
  if (term.includes('xterm') || term.includes('screen') || term.includes('tmux')) {
    return true;
  }

  // Windows Terminal, VS Code, iTerm2 all support ANSI
  const termProgram = process.env.TERM_PROGRAM ?? '';
  if (termProgram === 'iTerm.app' || termProgram === 'Apple_Terminal' || termProgram === 'vscode') {
    return true;
  }

  // Windows Terminal
  if (process.env.WT_SESSION) return true;

  // Default to checking TTY + color support as proxy
  return supportsColor();
}

/**
 * Get all terminal capabilities
 *
 * @returns Object with all capability flags
 */
export function getCapabilities(): TerminalCapabilities {
  const isTTY = process.stdout.isTTY ?? false;
  const isDumb = isDumbTerminal();

  return {
    isTTY,
    isDumb,
    supportsAnsi: supportsAnsi(),
    supportsColor: supportsColor(),
    supportsHyperlinks: supportsHyperlinks(),
  };
}

// =============================================================================
// Size Checks
// =============================================================================

/**
 * Check if terminal is too small for page-based display
 *
 * Page-based rendering needs minimum space for:
 * - Header (1-3 lines)
 * - Content area (at least 5 lines)
 * - Footer (1-2 lines)
 *
 * @param minWidth - Minimum acceptable width (default: 40)
 * @param minHeight - Minimum acceptable height (default: 10)
 * @returns True if terminal is smaller than minimums
 */
export function isSmallTerminal(minWidth = MIN_PAGE_WIDTH, minHeight = MIN_PAGE_HEIGHT): boolean {
  const { width, height } = getTerminalSize();
  return width < minWidth || height < minHeight;
}

/**
 * Check if page-based TUI is supported
 *
 * Requires:
 * - TTY output
 * - ANSI support
 * - Minimum terminal size
 *
 * @returns True if page-based TUI can be used
 */
export function supportsPageTUI(): boolean {
  const caps = getCapabilities();

  if (!caps.isTTY) return false;
  if (!caps.supportsAnsi) return false;
  if (caps.isDumb) return false;
  if (isSmallTerminal()) return false;

  return true;
}

// =============================================================================
// Content Area Calculation
// =============================================================================

/**
 * Calculate available content area
 *
 * Subtracts reserved space for header and footer from total terminal size.
 *
 * @param headerLines - Lines reserved for header (default: 3)
 * @param footerLines - Lines reserved for footer (default: 2)
 * @returns Available content area dimensions
 */
export function getContentArea(headerLines = 3, footerLines = 2): ContentArea {
  const { width, height } = getTerminalSize();

  const contentHeight = Math.max(1, height - headerLines - footerLines);
  const startRow = headerLines + 1; // 1-based row after header

  return {
    width,
    height: contentHeight,
    startRow,
  };
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Truncate text to fit terminal width
 *
 * @param text - Text to truncate
 * @param maxWidth - Maximum width (default: terminal width - 2 for padding)
 * @param ellipsis - Ellipsis character (default: '...')
 * @returns Truncated text
 */
export function truncateToWidth(text: string, maxWidth?: number, ellipsis = '...'): string {
  const width = maxWidth ?? getTerminalSize().width - 2;

  if (text.length <= width) return text;

  return text.slice(0, width - ellipsis.length) + ellipsis;
}

/**
 * Wrap text to fit terminal width
 *
 * Simple word-wrap implementation for multi-line content.
 *
 * @param text - Text to wrap
 * @param maxWidth - Maximum width per line (default: terminal width - 4)
 * @returns Array of wrapped lines
 */
export function wrapText(text: string, maxWidth?: number): string[] {
  const width = maxWidth ?? getTerminalSize().width - 4;
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if (currentLine.length + word.length + 1 <= width) {
      currentLine += (currentLine ? ' ' : '') + word;
    } else {
      if (currentLine) lines.push(currentLine);
      // Handle words longer than max width
      if (word.length > width) {
        let remaining = word;
        while (remaining.length > width) {
          lines.push(remaining.slice(0, width));
          remaining = remaining.slice(width);
        }
        currentLine = remaining;
      } else {
        currentLine = word;
      }
    }
  }

  if (currentLine) lines.push(currentLine);
  return lines;
}
