/**
 * Keyboard Input Tests
 *
 * @package WP_Navigator_Pro
 * @since 2.5.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  parseKey,
  createKeyboardInput,
  isQuitKey,
  isBackKey,
  isHelpKey,
  isRetryKey,
  isContinueKey,
  type KeyEvent,
} from './keyboard.js';

describe('Keyboard input', () => {
  describe('parseKey', () => {
    describe('single printable characters', () => {
      it('should parse lowercase letters', () => {
        const event = parseKey(Buffer.from('a'));
        expect(event.key).toBe('a');
        expect(event.ctrl).toBe(false);
        expect(event.isNavKey).toBe(false);
      });

      it('should normalize uppercase to lowercase', () => {
        const event = parseKey(Buffer.from('A'));
        expect(event.key).toBe('a');
      });

      it('should parse navigation key b', () => {
        const event = parseKey(Buffer.from('b'));
        expect(event.key).toBe('b');
        expect(event.isNavKey).toBe(true);
      });

      it('should parse navigation key h', () => {
        const event = parseKey(Buffer.from('h'));
        expect(event.key).toBe('h');
        expect(event.isNavKey).toBe(true);
      });

      it('should parse navigation key q', () => {
        const event = parseKey(Buffer.from('q'));
        expect(event.key).toBe('q');
        expect(event.isNavKey).toBe(true);
      });

      it('should parse navigation key r', () => {
        const event = parseKey(Buffer.from('r'));
        expect(event.key).toBe('r');
        expect(event.isNavKey).toBe(true);
      });

      it('should parse navigation key y', () => {
        const event = parseKey(Buffer.from('y'));
        expect(event.key).toBe('y');
        expect(event.isNavKey).toBe(true);
      });

      it('should parse navigation key n', () => {
        const event = parseKey(Buffer.from('n'));
        expect(event.key).toBe('n');
        expect(event.isNavKey).toBe(true);
      });

      it('should mark non-navigation keys correctly', () => {
        const event = parseKey(Buffer.from('x'));
        expect(event.isNavKey).toBe(false);
      });

      it('should parse numbers', () => {
        const event = parseKey(Buffer.from('5'));
        expect(event.key).toBe('5');
      });

      it('should parse special characters', () => {
        const event = parseKey(Buffer.from('?'));
        expect(event.key).toBe('?');
      });
    });

    describe('control characters', () => {
      it('should parse Enter key (CR)', () => {
        const event = parseKey(Buffer.from([13])); // Carriage Return
        expect(event.key).toBe('enter');
        expect(event.isNavKey).toBe(true);
      });

      it('should parse Enter key (LF)', () => {
        const event = parseKey(Buffer.from([10])); // Line Feed
        expect(event.key).toBe('enter');
        expect(event.isNavKey).toBe(true);
      });

      it('should parse Tab key', () => {
        const event = parseKey(Buffer.from([9]));
        expect(event.key).toBe('tab');
      });

      it('should parse Backspace (DEL)', () => {
        const event = parseKey(Buffer.from([127]));
        expect(event.key).toBe('backspace');
      });

      it('should parse Backspace (Ctrl+H)', () => {
        const event = parseKey(Buffer.from([8]));
        expect(event.key).toBe('backspace');
      });

      it('should parse Ctrl+C', () => {
        const event = parseKey(Buffer.from([3]));
        expect(event.key).toBe('ctrl+c');
        expect(event.ctrl).toBe(true);
      });

      it('should parse Ctrl+D', () => {
        const event = parseKey(Buffer.from([4]));
        expect(event.key).toBe('ctrl+d');
        expect(event.ctrl).toBe(true);
      });

      it('should parse Escape key', () => {
        const event = parseKey(Buffer.from([27]));
        expect(event.key).toBe('escape');
        expect(event.isNavKey).toBe(true);
      });
    });

    describe('ANSI escape sequences', () => {
      it('should parse Up arrow key', () => {
        const event = parseKey(Buffer.from('\x1b[A'));
        expect(event.key).toBe('up');
      });

      it('should parse Down arrow key', () => {
        const event = parseKey(Buffer.from('\x1b[B'));
        expect(event.key).toBe('down');
      });

      it('should parse Right arrow key', () => {
        const event = parseKey(Buffer.from('\x1b[C'));
        expect(event.key).toBe('right');
      });

      it('should parse Left arrow key', () => {
        const event = parseKey(Buffer.from('\x1b[D'));
        expect(event.key).toBe('left');
      });

      it('should parse alternative Up arrow (Application mode)', () => {
        const event = parseKey(Buffer.from('\x1bOA'));
        expect(event.key).toBe('up');
      });

      it('should parse Home key', () => {
        const event = parseKey(Buffer.from('\x1b[H'));
        expect(event.key).toBe('home');
      });

      it('should parse End key', () => {
        const event = parseKey(Buffer.from('\x1b[F'));
        expect(event.key).toBe('end');
      });

      it('should parse Page Up key', () => {
        const event = parseKey(Buffer.from('\x1b[5~'));
        expect(event.key).toBe('pageup');
      });

      it('should parse Page Down key', () => {
        const event = parseKey(Buffer.from('\x1b[6~'));
        expect(event.key).toBe('pagedown');
      });

      it('should parse Delete key', () => {
        const event = parseKey(Buffer.from('\x1b[3~'));
        expect(event.key).toBe('delete');
      });

      it('should parse F1 key', () => {
        const event = parseKey(Buffer.from('\x1bOP'));
        expect(event.key).toBe('f1');
      });

      it('should handle unknown escape sequence as escape', () => {
        const event = parseKey(Buffer.from('\x1b[99~'));
        expect(event.key).toBe('escape');
      });
    });

    describe('raw buffer preservation', () => {
      it('should preserve raw buffer for single character', () => {
        const buffer = Buffer.from('a');
        const event = parseKey(buffer);
        expect(event.raw).toEqual(buffer);
      });

      it('should preserve raw buffer for escape sequence', () => {
        const buffer = Buffer.from('\x1b[A');
        const event = parseKey(buffer);
        expect(event.raw).toEqual(buffer);
      });
    });

    describe('multi-byte UTF-8 characters', () => {
      it('should handle emoji', () => {
        const event = parseKey(Buffer.from('\u{1F600}')); // Grinning face
        expect(event.key.length).toBeGreaterThan(0);
        expect(event.isNavKey).toBe(false);
      });

      it('should handle unicode characters', () => {
        const event = parseKey(Buffer.from('\u00E9')); // e with acute
        expect(event.key).toBe('\u00E9');
        expect(event.isNavKey).toBe(false);
      });
    });
  });

  describe('key type helpers', () => {
    describe('isQuitKey', () => {
      it('should return true for q key', () => {
        const event: KeyEvent = { key: 'q', raw: Buffer.from('q'), ctrl: false, isNavKey: true };
        expect(isQuitKey(event)).toBe(true);
      });

      it('should return true for Ctrl+C', () => {
        const event: KeyEvent = {
          key: 'ctrl+c',
          raw: Buffer.from([3]),
          ctrl: true,
          isNavKey: false,
        };
        expect(isQuitKey(event)).toBe(true);
      });

      it('should return false for other keys', () => {
        const event: KeyEvent = { key: 'x', raw: Buffer.from('x'), ctrl: false, isNavKey: false };
        expect(isQuitKey(event)).toBe(false);
      });
    });

    describe('isBackKey', () => {
      it('should return true for b key', () => {
        const event: KeyEvent = { key: 'b', raw: Buffer.from('b'), ctrl: false, isNavKey: true };
        expect(isBackKey(event)).toBe(true);
      });

      it('should return true for escape key', () => {
        const event: KeyEvent = {
          key: 'escape',
          raw: Buffer.from([27]),
          ctrl: false,
          isNavKey: true,
        };
        expect(isBackKey(event)).toBe(true);
      });

      it('should return false for other keys', () => {
        const event: KeyEvent = { key: 'x', raw: Buffer.from('x'), ctrl: false, isNavKey: false };
        expect(isBackKey(event)).toBe(false);
      });
    });

    describe('isHelpKey', () => {
      it('should return true for h key', () => {
        const event: KeyEvent = { key: 'h', raw: Buffer.from('h'), ctrl: false, isNavKey: true };
        expect(isHelpKey(event)).toBe(true);
      });

      it('should return true for ? key', () => {
        const event: KeyEvent = { key: '?', raw: Buffer.from('?'), ctrl: false, isNavKey: false };
        expect(isHelpKey(event)).toBe(true);
      });

      it('should return false for other keys', () => {
        const event: KeyEvent = { key: 'x', raw: Buffer.from('x'), ctrl: false, isNavKey: false };
        expect(isHelpKey(event)).toBe(false);
      });
    });

    describe('isRetryKey', () => {
      it('should return true for r key', () => {
        const event: KeyEvent = { key: 'r', raw: Buffer.from('r'), ctrl: false, isNavKey: true };
        expect(isRetryKey(event)).toBe(true);
      });

      it('should return false for other keys', () => {
        const event: KeyEvent = { key: 'x', raw: Buffer.from('x'), ctrl: false, isNavKey: false };
        expect(isRetryKey(event)).toBe(false);
      });
    });

    describe('isContinueKey', () => {
      it('should return true for enter key', () => {
        const event: KeyEvent = {
          key: 'enter',
          raw: Buffer.from([13]),
          ctrl: false,
          isNavKey: true,
        };
        expect(isContinueKey(event)).toBe(true);
      });

      it('should return true for y key', () => {
        const event: KeyEvent = { key: 'y', raw: Buffer.from('y'), ctrl: false, isNavKey: true };
        expect(isContinueKey(event)).toBe(true);
      });

      it('should return false for other keys', () => {
        const event: KeyEvent = { key: 'x', raw: Buffer.from('x'), ctrl: false, isNavKey: false };
        expect(isContinueKey(event)).toBe(false);
      });
    });
  });

  describe('createKeyboardInput', () => {
    describe('isSupported', () => {
      it('should return false when stdin is not a TTY', () => {
        const mockInput = {
          isTTY: false,
          setRawMode: vi.fn(),
        } as unknown as NodeJS.ReadStream;

        const keyboard = createKeyboardInput({ input: mockInput, autoCleanup: false });
        expect(keyboard.isSupported()).toBe(false);
      });

      it('should return false when setRawMode is not available', () => {
        const mockInput = {
          isTTY: true,
          // No setRawMode
        } as unknown as NodeJS.ReadStream;

        const keyboard = createKeyboardInput({ input: mockInput, autoCleanup: false });
        expect(keyboard.isSupported()).toBe(false);
      });

      it('should return true when TTY with setRawMode', () => {
        const mockInput = {
          isTTY: true,
          setRawMode: vi.fn(),
        } as unknown as NodeJS.ReadStream;

        const keyboard = createKeyboardInput({ input: mockInput, autoCleanup: false });
        expect(keyboard.isSupported()).toBe(true);
      });
    });

    describe('setup and cleanup', () => {
      it('should return false when not supported', () => {
        const mockInput = {
          isTTY: false,
          setRawMode: vi.fn(),
        } as unknown as NodeJS.ReadStream;

        const keyboard = createKeyboardInput({ input: mockInput, autoCleanup: false });
        expect(keyboard.setup()).toBe(false);
        expect(keyboard.isActive()).toBe(false);
      });

      it('should enable raw mode when supported', () => {
        const setRawMode = vi.fn();
        const resume = vi.fn();
        const mockInput = {
          isTTY: true,
          isRaw: false,
          setRawMode,
          resume,
        } as unknown as NodeJS.ReadStream;

        const keyboard = createKeyboardInput({ input: mockInput, autoCleanup: false });
        const result = keyboard.setup();

        expect(result).toBe(true);
        expect(setRawMode).toHaveBeenCalledWith(true);
        expect(resume).toHaveBeenCalled();
        expect(keyboard.isActive()).toBe(true);
      });

      it('should restore raw mode on cleanup', () => {
        const setRawMode = vi.fn();
        const resume = vi.fn();
        const pause = vi.fn();
        const removeListener = vi.fn();
        const mockInput = {
          isTTY: true,
          isRaw: false,
          setRawMode,
          resume,
          pause,
          removeListener,
        } as unknown as NodeJS.ReadStream;

        const keyboard = createKeyboardInput({ input: mockInput, autoCleanup: false });
        keyboard.setup();
        keyboard.cleanup();

        expect(setRawMode).toHaveBeenCalledWith(false);
        expect(pause).toHaveBeenCalled();
        expect(keyboard.isActive()).toBe(false);
      });

      it('should be idempotent - multiple setup calls are safe', () => {
        const setRawMode = vi.fn();
        const resume = vi.fn();
        const mockInput = {
          isTTY: true,
          isRaw: false,
          setRawMode,
          resume,
        } as unknown as NodeJS.ReadStream;

        const keyboard = createKeyboardInput({ input: mockInput, autoCleanup: false });
        keyboard.setup();
        keyboard.setup(); // Second call

        expect(setRawMode).toHaveBeenCalledTimes(1); // Only once
      });

      it('should be idempotent - multiple cleanup calls are safe', () => {
        const setRawMode = vi.fn();
        const resume = vi.fn();
        const pause = vi.fn();
        const removeListener = vi.fn();
        const mockInput = {
          isTTY: true,
          isRaw: false,
          setRawMode,
          resume,
          pause,
          removeListener,
        } as unknown as NodeJS.ReadStream;

        const keyboard = createKeyboardInput({ input: mockInput, autoCleanup: false });
        keyboard.setup();
        keyboard.cleanup();
        keyboard.cleanup(); // Second call

        expect(pause).toHaveBeenCalledTimes(1); // Only once
      });
    });

    describe('waitForKey', () => {
      it('should reject if not set up', async () => {
        const mockInput = {
          isTTY: false,
        } as unknown as NodeJS.ReadStream;

        const keyboard = createKeyboardInput({ input: mockInput, autoCleanup: false });

        await expect(keyboard.waitForKey()).rejects.toThrow('Keyboard not set up');
      });

      it('should resolve with key event when data received', async () => {
        const dataHandlers: ((data: Buffer) => void)[] = [];
        const mockInput = {
          isTTY: true,
          isRaw: false,
          setRawMode: vi.fn(),
          resume: vi.fn(),
          on: vi.fn((event: string, handler: (data: Buffer) => void) => {
            if (event === 'data') {
              dataHandlers.push(handler);
            }
          }),
          removeListener: vi.fn(),
        } as unknown as NodeJS.ReadStream;

        const keyboard = createKeyboardInput({ input: mockInput, autoCleanup: false });
        keyboard.setup();

        // Start waiting for key
        const keyPromise = keyboard.waitForKey();

        // Simulate key press
        expect(dataHandlers.length).toBe(1);
        dataHandlers[0](Buffer.from('a'));

        const event = await keyPromise;
        expect(event.key).toBe('a');
      });
    });
  });
});
