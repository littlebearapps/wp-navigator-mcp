/**
 * Page TUI Infrastructure
 *
 * Provides page-based terminal rendering with screen clearing,
 * header/footer management, and graceful fallbacks.
 *
 * @package WP_Navigator_Pro
 * @since 2.5.0
 *
 * @example
 * import { createPage } from './page.js';
 *
 * const page = createPage({ header: 'Setup Wizard' });
 * page.clear();
 * page.renderHeader('Step 1 of 5');
 * page.render('Welcome to the setup wizard...');
 * page.renderFooter('[Enter] Continue  [Q] Quit');
 */

import {
  CLEAR_SCREEN,
  CURSOR_HOME,
  CURSOR_HIDE,
  CURSOR_SHOW,
  moveCursor,
  clearLineAt,
} from './ansi.js';
import {
  getTerminalSize,
  getCapabilities,
  supportsPageTUI,
  getContentArea,
  truncateToWidth,
  type TerminalSize,
  type ContentArea,
} from './terminal.js';
import { colorize, colors, supportsColor } from './components.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Options for creating a page instance
 */
export interface PageOptions {
  /** Default header text */
  header?: string;
  /** Default footer text */
  footer?: string;
  /** Lines reserved for header area (default: 3) */
  reserveHeaderLines?: number;
  /** Lines reserved for footer area (default: 2) */
  reserveFooterLines?: number;
  /** Output stream (default: process.stderr for interactive output) */
  output?: NodeJS.WriteStream;
}

/**
 * Page TUI instance interface
 */
export interface PageTUI {
  /** Clear the entire screen and move cursor to home */
  clear(): void;
  /** Render content in the main content area */
  render(content: string): void;
  /** Render header at top of screen */
  renderHeader(header: string): void;
  /** Render footer at bottom of screen */
  renderFooter(footer: string): void;
  /** Render a complete page (header + content + footer) */
  renderPage(options: { header?: string; content: string; footer?: string }): void;
  /** Get available content area dimensions */
  getContentArea(): ContentArea;
  /** Get current terminal size */
  getSize(): TerminalSize;
  /** Check if page-based rendering is supported */
  isSupported(): boolean;
  /** Hide cursor (for cleaner rendering) */
  hideCursor(): void;
  /** Show cursor */
  showCursor(): void;
  /** Refresh terminal size (call after resize) */
  refresh(): void;
}

/**
 * Internal page state
 */
interface PageState {
  size: TerminalSize;
  headerLines: number;
  footerLines: number;
  defaultHeader: string;
  defaultFooter: string;
  cursorHidden: boolean;
  output: NodeJS.WriteStream;
}

// =============================================================================
// Page Factory
// =============================================================================

/**
 * Create a new page TUI instance
 *
 * The page instance provides methods for rendering content
 * within a fixed layout with header and footer areas.
 *
 * In TTY environments, this uses screen clearing and cursor positioning.
 * In non-TTY environments, it falls back to sequential output.
 *
 * @param options - Page configuration options
 * @returns PageTUI instance
 */
export function createPage(options: PageOptions = {}): PageTUI {
  const {
    header = '',
    footer = '',
    reserveHeaderLines = 3,
    reserveFooterLines = 2,
    output = process.stderr,
  } = options;

  // Initialize state
  const state: PageState = {
    size: getTerminalSize(),
    headerLines: reserveHeaderLines,
    footerLines: reserveFooterLines,
    defaultHeader: header,
    defaultFooter: footer,
    cursorHidden: false,
    output,
  };

  /**
   * Write to output stream
   */
  function write(text: string): void {
    state.output.write(text);
  }

  /**
   * Write line to output stream
   */
  function writeLine(text: string): void {
    state.output.write(text + '\n');
  }

  /**
   * Check if page-based rendering is available
   */
  function isSupported(): boolean {
    return supportsPageTUI() && state.output.isTTY === true;
  }

  /**
   * Clear screen (TTY) or output newlines (non-TTY)
   */
  function clear(): void {
    if (isSupported()) {
      write(CLEAR_SCREEN + CURSOR_HOME);
    } else {
      // Non-TTY fallback: output separator line
      writeLine('\n' + '─'.repeat(Math.min(state.size.width, 60)) + '\n');
    }
  }

  /**
   * Render header at top of screen
   */
  function renderHeader(headerText: string): void {
    const text = headerText || state.defaultHeader;
    if (!text) return;

    const truncated = truncateToWidth(text, state.size.width - 2);

    if (isSupported()) {
      // Position at top and render header
      write(moveCursor(1, 1));
      write(colorize(truncated, 'bold'));
      write('\n');
      // Draw separator line
      write(colorize('─'.repeat(state.size.width), 'dim'));
      write('\n');
    } else {
      // Non-TTY fallback: just output header
      writeLine(text);
      writeLine('─'.repeat(Math.min(state.size.width, 60)));
    }
  }

  /**
   * Render footer at bottom of screen
   */
  function renderFooter(footerText: string): void {
    const text = footerText || state.defaultFooter;
    if (!text) return;

    const truncated = truncateToWidth(text, state.size.width - 2);

    if (isSupported()) {
      // Position at footer area
      const footerRow = state.size.height - state.footerLines + 1;
      write(moveCursor(footerRow, 1));
      // Draw separator line
      write(colorize('─'.repeat(state.size.width), 'dim'));
      write('\n');
      write(colorize(truncated, 'dim'));
    } else {
      // Non-TTY fallback: output footer
      writeLine('─'.repeat(Math.min(state.size.width, 60)));
      writeLine(text);
    }
  }

  /**
   * Render main content
   */
  function render(content: string): void {
    if (isSupported()) {
      // Position at content area start
      const contentArea = getContentArea(state.headerLines, state.footerLines);
      write(moveCursor(contentArea.startRow, 1));

      // Split content into lines and render within bounds
      const lines = content.split('\n');
      const maxLines = contentArea.height;

      for (let i = 0; i < Math.min(lines.length, maxLines); i++) {
        const line = truncateToWidth(lines[i], state.size.width);
        writeLine(line);
      }

      // If content was truncated, show indicator
      if (lines.length > maxLines) {
        const moreText = `... (${lines.length - maxLines} more lines)`;
        write(colorize(moreText, 'dim'));
      }
    } else {
      // Non-TTY fallback: output content directly
      writeLine(content);
    }
  }

  /**
   * Render a complete page with header, content, and footer
   */
  function renderPage(opts: { header?: string; content: string; footer?: string }): void {
    clear();
    renderHeader(opts.header ?? state.defaultHeader);
    render(opts.content);
    renderFooter(opts.footer ?? state.defaultFooter);
  }

  /**
   * Get content area dimensions
   */
  function getContentAreaDimensions(): ContentArea {
    return getContentArea(state.headerLines, state.footerLines);
  }

  /**
   * Get current terminal size
   */
  function getSize(): TerminalSize {
    return { ...state.size };
  }

  /**
   * Hide cursor for cleaner rendering
   */
  function hideCursor(): void {
    if (isSupported() && !state.cursorHidden) {
      write(CURSOR_HIDE);
      state.cursorHidden = true;
    }
  }

  /**
   * Show cursor
   */
  function showCursor(): void {
    if (state.cursorHidden) {
      write(CURSOR_SHOW);
      state.cursorHidden = false;
    }
  }

  /**
   * Refresh terminal size (call after resize events)
   */
  function refresh(): void {
    state.size = getTerminalSize();
  }

  // Return page instance
  return {
    clear,
    render,
    renderHeader,
    renderFooter,
    renderPage,
    getContentArea: getContentAreaDimensions,
    getSize,
    isSupported,
    hideCursor,
    showCursor,
    refresh,
  };
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Create a simple box around content
 *
 * @param content - Content to wrap in box
 * @param options - Box options
 * @returns Boxed content string
 */
export function createBox(
  content: string,
  options: { title?: string; width?: number; padding?: number } = {}
): string {
  const { title, padding = 1 } = options;
  const termSize = getTerminalSize();
  const width = Math.min(options.width ?? termSize.width - 4, termSize.width - 4);
  const innerWidth = width - 2 - padding * 2;

  const lines = content.split('\n');
  const paddedLines = lines.map((line) => {
    const truncated = line.slice(0, innerWidth);
    const padded = truncated.padEnd(innerWidth);
    return '│' + ' '.repeat(padding) + padded + ' '.repeat(padding) + '│';
  });

  // Build box
  const topLine = title
    ? '┌─ ' + title + ' ' + '─'.repeat(Math.max(0, width - title.length - 5)) + '┐'
    : '┌' + '─'.repeat(width - 2) + '┐';
  const bottomLine = '└' + '─'.repeat(width - 2) + '┘';

  return [topLine, ...paddedLines, bottomLine].join('\n');
}

/**
 * Center text within a given width
 *
 * @param text - Text to center
 * @param width - Width to center within (default: terminal width)
 * @returns Centered text string
 */
export function centerText(text: string, width?: number): string {
  const termWidth = width ?? getTerminalSize().width;
  const padding = Math.max(0, Math.floor((termWidth - text.length) / 2));
  return ' '.repeat(padding) + text;
}

/**
 * Right-align text within a given width
 *
 * @param text - Text to right-align
 * @param width - Width to align within (default: terminal width)
 * @returns Right-aligned text string
 */
export function rightAlign(text: string, width?: number): string {
  const termWidth = width ?? getTerminalSize().width;
  const padding = Math.max(0, termWidth - text.length);
  return ' '.repeat(padding) + text;
}
