/**
 * Page TUI Tests
 *
 * @package WP_Navigator_Pro
 * @since 2.5.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Writable } from 'stream';
import { createPage, createBox, centerText, rightAlign, type PageTUI } from './page.js';
import { CLEAR_SCREEN, CURSOR_HOME, CURSOR_HIDE, CURSOR_SHOW } from './ansi.js';

/**
 * Create a mock output stream that captures writes
 */
function createMockOutput(): { stream: NodeJS.WriteStream; output: string[]; clear: () => void } {
  const output: string[] = [];

  const stream = new Writable({
    write(chunk, encoding, callback) {
      output.push(chunk.toString());
      callback();
    },
  }) as unknown as NodeJS.WriteStream;

  // Mock isTTY for testing TTY behavior
  Object.defineProperty(stream, 'isTTY', { value: true, writable: true });

  return {
    stream,
    output,
    clear: () => {
      output.length = 0;
    },
  };
}

describe('Page TUI', () => {
  const originalIsTTY = process.stdout.isTTY;
  const originalColumns = process.stdout.columns;
  const originalRows = process.stdout.rows;
  const originalTerm = process.env.TERM;

  beforeEach(() => {
    // Set up TTY environment
    Object.defineProperty(process.stdout, 'isTTY', { value: true, writable: true });
    Object.defineProperty(process.stdout, 'columns', { value: 80, writable: true });
    Object.defineProperty(process.stdout, 'rows', { value: 24, writable: true });
    process.env.TERM = 'xterm-256color';
  });

  afterEach(() => {
    Object.defineProperty(process.stdout, 'isTTY', { value: originalIsTTY, writable: true });
    Object.defineProperty(process.stdout, 'columns', { value: originalColumns, writable: true });
    Object.defineProperty(process.stdout, 'rows', { value: originalRows, writable: true });
    if (originalTerm === undefined) {
      delete process.env.TERM;
    } else {
      process.env.TERM = originalTerm;
    }
  });

  describe('createPage', () => {
    it('should create a page instance with default options', () => {
      const mock = createMockOutput();
      const page = createPage({ output: mock.stream });

      expect(page).toBeDefined();
      expect(typeof page.clear).toBe('function');
      expect(typeof page.render).toBe('function');
      expect(typeof page.renderHeader).toBe('function');
      expect(typeof page.renderFooter).toBe('function');
      expect(typeof page.renderPage).toBe('function');
      expect(typeof page.getContentArea).toBe('function');
      expect(typeof page.getSize).toBe('function');
      expect(typeof page.isSupported).toBe('function');
      expect(typeof page.hideCursor).toBe('function');
      expect(typeof page.showCursor).toBe('function');
      expect(typeof page.refresh).toBe('function');
    });

    it('should accept custom options', () => {
      const mock = createMockOutput();
      const page = createPage({
        header: 'Test Header',
        footer: 'Test Footer',
        reserveHeaderLines: 4,
        reserveFooterLines: 3,
        output: mock.stream,
      });

      expect(page).toBeDefined();
    });
  });

  describe('isSupported', () => {
    it('should return true in TTY environment with ANSI support', () => {
      const mock = createMockOutput();
      const page = createPage({ output: mock.stream });

      expect(page.isSupported()).toBe(true);
    });

    it('should return false when output is not TTY', () => {
      const mock = createMockOutput();
      Object.defineProperty(mock.stream, 'isTTY', { value: false, writable: true });

      const page = createPage({ output: mock.stream });

      expect(page.isSupported()).toBe(false);
    });
  });

  describe('getSize', () => {
    it('should return terminal dimensions', () => {
      const mock = createMockOutput();
      const page = createPage({ output: mock.stream });

      const size = page.getSize();
      expect(size.width).toBe(80);
      expect(size.height).toBe(24);
    });
  });

  describe('getContentArea', () => {
    it('should calculate content area with default header/footer', () => {
      const mock = createMockOutput();
      const page = createPage({ output: mock.stream });

      const area = page.getContentArea();
      expect(area.width).toBe(80);
      expect(area.height).toBe(24 - 3 - 2); // 19 lines
      expect(area.startRow).toBe(4);
    });

    it('should respect custom header/footer lines', () => {
      const mock = createMockOutput();
      const page = createPage({
        reserveHeaderLines: 5,
        reserveFooterLines: 4,
        output: mock.stream,
      });

      const area = page.getContentArea();
      expect(area.height).toBe(24 - 5 - 4); // 15 lines
      expect(area.startRow).toBe(6);
    });
  });

  describe('clear', () => {
    it('should output CLEAR_SCREEN and CURSOR_HOME in TTY mode', () => {
      const mock = createMockOutput();
      const page = createPage({ output: mock.stream });

      page.clear();

      const combined = mock.output.join('');
      expect(combined).toContain(CLEAR_SCREEN);
      expect(combined).toContain(CURSOR_HOME);
    });

    it('should output separator line in non-TTY mode', () => {
      const mock = createMockOutput();
      Object.defineProperty(mock.stream, 'isTTY', { value: false, writable: true });

      const page = createPage({ output: mock.stream });
      page.clear();

      const combined = mock.output.join('');
      expect(combined).toContain('─');
      expect(combined).not.toContain(CLEAR_SCREEN);
    });
  });

  describe('hideCursor / showCursor', () => {
    it('should output CURSOR_HIDE when hiding', () => {
      const mock = createMockOutput();
      const page = createPage({ output: mock.stream });

      page.hideCursor();

      const combined = mock.output.join('');
      expect(combined).toContain(CURSOR_HIDE);
    });

    it('should output CURSOR_SHOW when showing', () => {
      const mock = createMockOutput();
      const page = createPage({ output: mock.stream });

      page.hideCursor();
      mock.clear();
      page.showCursor();

      const combined = mock.output.join('');
      expect(combined).toContain(CURSOR_SHOW);
    });

    it('should not output CURSOR_HIDE in non-TTY mode', () => {
      const mock = createMockOutput();
      Object.defineProperty(mock.stream, 'isTTY', { value: false, writable: true });

      const page = createPage({ output: mock.stream });
      page.hideCursor();

      expect(mock.output.join('')).not.toContain(CURSOR_HIDE);
    });
  });
});

describe('createBox', () => {
  const originalColumns = process.stdout.columns;

  beforeEach(() => {
    Object.defineProperty(process.stdout, 'columns', { value: 80, writable: true });
  });

  afterEach(() => {
    Object.defineProperty(process.stdout, 'columns', { value: originalColumns, writable: true });
  });

  it('should create a box around content', () => {
    const box = createBox('Hello', { width: 20 });

    expect(box).toContain('┌');
    expect(box).toContain('┐');
    expect(box).toContain('└');
    expect(box).toContain('┘');
    expect(box).toContain('│');
    expect(box).toContain('Hello');
  });

  it('should include title when provided', () => {
    const box = createBox('Content', { title: 'Title', width: 30 });

    expect(box).toContain('Title');
    expect(box).toContain('Content');
  });

  it('should handle multi-line content', () => {
    const box = createBox('Line 1\nLine 2\nLine 3', { width: 20 });
    const lines = box.split('\n');

    expect(lines.length).toBe(5); // top + 3 content + bottom
  });
});

describe('centerText', () => {
  it('should center text within width', () => {
    const centered = centerText('Hello', 20);

    // centerText adds left padding only: floor((20 - 5) / 2) = 7 spaces + 5 chars = 12
    const expectedPadding = Math.floor((20 - 5) / 2);
    expect(centered.length).toBe(expectedPadding + 5);
    expect(centered.trim()).toBe('Hello');
    expect(centered.startsWith(' ')).toBe(true);
  });

  it('should handle text longer than width', () => {
    const centered = centerText('Hello World!', 5);

    // Should not add padding when text is longer
    expect(centered).toBe('Hello World!');
  });
});

describe('rightAlign', () => {
  it('should right-align text within width', () => {
    const aligned = rightAlign('Hello', 20);

    expect(aligned.length).toBe(20);
    expect(aligned.endsWith('Hello')).toBe(true);
    expect(aligned.startsWith(' ')).toBe(true);
  });

  it('should handle text longer than width', () => {
    const aligned = rightAlign('Hello World!', 5);

    // Should not add padding when text is longer
    expect(aligned).toBe('Hello World!');
  });
});
