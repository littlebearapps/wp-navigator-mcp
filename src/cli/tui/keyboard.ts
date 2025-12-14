/**
 * Keyboard Input Module
 *
 * Provides raw mode keyboard capture for single-key navigation.
 * Handles ANSI escape sequences for special keys and ensures
 * proper terminal cleanup on exit.
 *
 * @package WP_Navigator_Pro
 * @since 2.5.0
 *
 * @example
 * import { createKeyboardInput } from './keyboard.js';
 *
 * const keyboard = createKeyboardInput();
 * if (keyboard.setup()) {
 *   const key = await keyboard.waitForKey();
 *   console.log('Pressed:', key.key);
 *   keyboard.cleanup();
 * }
 */

// =============================================================================
// Types
// =============================================================================

/**
 * Represents a single key press event
 */
export interface KeyEvent {
  /** Normalized key name (e.g., 'b', 'enter', 'escape', 'up', 'down') */
  key: string;
  /** Raw bytes received from stdin */
  raw: Buffer;
  /** Whether Ctrl modifier was held */
  ctrl: boolean;
  /** Whether the key is a navigation key (b, h, q, r, enter) */
  isNavKey: boolean;
}

/**
 * Keyboard input controller interface
 */
export interface KeyboardInput {
  /** Enable raw mode input. Returns false if not supported (non-TTY). */
  setup(): boolean;
  /** Restore normal terminal mode. MUST be called before exit. */
  cleanup(): void;
  /** Wait for a single key press. Resolves when a key is pressed. */
  waitForKey(): Promise<KeyEvent>;
  /** Check if keyboard input is currently active (raw mode enabled) */
  isActive(): boolean;
  /** Check if raw mode is supported in current environment */
  isSupported(): boolean;
}

/**
 * Options for keyboard input creation
 */
export interface KeyboardInputOptions {
  /** Input stream (default: process.stdin) */
  input?: NodeJS.ReadStream;
  /** Whether to auto-register cleanup handlers (default: true) */
  autoCleanup?: boolean;
}

// =============================================================================
// Key Parsing Constants
// =============================================================================

/**
 * ANSI escape sequence mappings for special keys
 * Most terminals send these sequences for arrow keys, etc.
 */
const ESCAPE_SEQUENCES: Record<string, string> = {
  // Arrow keys (most terminals)
  '\x1b[A': 'up',
  '\x1b[B': 'down',
  '\x1b[C': 'right',
  '\x1b[D': 'left',

  // Arrow keys (alternative sequences)
  '\x1bOA': 'up',
  '\x1bOB': 'down',
  '\x1bOC': 'right',
  '\x1bOD': 'left',

  // Function keys
  '\x1bOP': 'f1',
  '\x1bOQ': 'f2',
  '\x1bOR': 'f3',
  '\x1bOS': 'f4',

  // Navigation keys
  '\x1b[H': 'home',
  '\x1b[F': 'end',
  '\x1b[5~': 'pageup',
  '\x1b[6~': 'pagedown',
  '\x1b[2~': 'insert',
  '\x1b[3~': 'delete',

  // Escape key alone (when followed by nothing)
  '\x1b': 'escape',
};

/**
 * Single-byte control character mappings
 */
const CONTROL_CHARS: Record<number, string> = {
  0: 'ctrl+@', // Ctrl+@
  1: 'ctrl+a',
  2: 'ctrl+b',
  3: 'ctrl+c', // SIGINT
  4: 'ctrl+d', // EOF
  5: 'ctrl+e',
  6: 'ctrl+f',
  7: 'ctrl+g',
  8: 'backspace', // Ctrl+H or Backspace
  9: 'tab', // Ctrl+I or Tab
  10: 'enter', // Ctrl+J or Line Feed
  11: 'ctrl+k',
  12: 'ctrl+l',
  13: 'enter', // Ctrl+M or Carriage Return
  14: 'ctrl+n',
  15: 'ctrl+o',
  16: 'ctrl+p',
  17: 'ctrl+q',
  18: 'ctrl+r',
  19: 'ctrl+s',
  20: 'ctrl+t',
  21: 'ctrl+u',
  22: 'ctrl+v',
  23: 'ctrl+w',
  24: 'ctrl+x',
  25: 'ctrl+y',
  26: 'ctrl+z', // SIGTSTP
  27: 'escape', // ESC
  127: 'backspace', // DEL
};

/**
 * Navigation keys that the wizard responds to
 */
const NAVIGATION_KEYS = new Set(['b', 'h', 'q', 'r', 'enter', 'escape', 'y', 'n']);

// =============================================================================
// Key Parsing
// =============================================================================

/**
 * Parse raw bytes into a KeyEvent
 *
 * @param data - Raw bytes from stdin
 * @returns Parsed key event
 */
export function parseKey(data: Buffer): KeyEvent {
  const raw = data;
  const str = data.toString('utf8');

  // Check for escape sequences first (multi-byte)
  if (str.length > 1 && str.startsWith('\x1b')) {
    const mappedKey = ESCAPE_SEQUENCES[str];
    if (mappedKey) {
      return {
        key: mappedKey,
        raw,
        ctrl: false,
        isNavKey: NAVIGATION_KEYS.has(mappedKey),
      };
    }

    // Unknown escape sequence - return the escape itself
    return {
      key: 'escape',
      raw,
      ctrl: false,
      isNavKey: true,
    };
  }

  // Single byte input
  if (data.length === 1) {
    const byte = data[0];

    // Control characters (0-31 and 127)
    if (byte < 32 || byte === 127) {
      const mapped = CONTROL_CHARS[byte];
      const isCtrl = mapped?.startsWith('ctrl+') ?? false;
      const key = mapped ?? `ctrl+${String.fromCharCode(byte + 64).toLowerCase()}`;

      return {
        key,
        raw,
        ctrl: isCtrl,
        isNavKey: NAVIGATION_KEYS.has(key),
      };
    }

    // Regular printable character
    const char = str.toLowerCase();
    return {
      key: char,
      raw,
      ctrl: false,
      isNavKey: NAVIGATION_KEYS.has(char),
    };
  }

  // Multi-byte UTF-8 character (emoji, unicode, etc.)
  return {
    key: str,
    raw,
    ctrl: false,
    isNavKey: false,
  };
}

// =============================================================================
// Keyboard Input Factory
// =============================================================================

/**
 * Create a new keyboard input controller
 *
 * @param options - Keyboard input configuration
 * @returns KeyboardInput instance
 */
export function createKeyboardInput(options: KeyboardInputOptions = {}): KeyboardInput {
  const { input = process.stdin, autoCleanup = true } = options;

  // State
  let isRawMode = false;
  let wasRawMode = false;
  let cleanupRegistered = false;
  let dataHandler: ((data: Buffer) => void) | null = null;

  /**
   * Check if raw mode is supported
   */
  function isSupported(): boolean {
    return typeof input.setRawMode === 'function' && input.isTTY === true;
  }

  /**
   * Enable raw mode for single-key capture
   */
  function setup(): boolean {
    if (!isSupported()) {
      return false;
    }

    if (isRawMode) {
      return true; // Already set up
    }

    try {
      // Save previous raw mode state
      wasRawMode = input.isRaw ?? false;

      // Enable raw mode
      input.setRawMode!(true);
      input.resume();
      isRawMode = true;

      // Register cleanup handlers if not already done
      if (autoCleanup && !cleanupRegistered) {
        registerCleanupHandlers();
        cleanupRegistered = true;
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Restore normal terminal mode
   */
  function cleanup(): void {
    if (!isRawMode) {
      return;
    }

    try {
      // Remove data handler if present
      if (dataHandler) {
        input.removeListener('data', dataHandler);
        dataHandler = null;
      }

      // Restore raw mode state
      if (isSupported()) {
        input.setRawMode!(wasRawMode);
        if (!wasRawMode) {
          input.pause();
        }
      }

      isRawMode = false;
    } catch {
      // Ignore cleanup errors (terminal might be gone)
    }
  }

  /**
   * Register process exit handlers for cleanup
   */
  function registerCleanupHandlers(): void {
    // Normal exit
    process.on('exit', cleanup);

    // Ctrl+C
    process.on('SIGINT', () => {
      cleanup();
      process.exit(130); // Standard exit code for SIGINT
    });

    // Kill signal
    process.on('SIGTERM', () => {
      cleanup();
      process.exit(143); // Standard exit code for SIGTERM
    });

    // Uncaught exception - cleanup before crashing
    process.on('uncaughtException', (err) => {
      cleanup();
      console.error('Uncaught exception:', err);
      process.exit(1);
    });
  }

  /**
   * Wait for a single key press
   */
  function waitForKey(): Promise<KeyEvent> {
    return new Promise((resolve, reject) => {
      if (!isRawMode) {
        reject(new Error('Keyboard not set up. Call setup() first.'));
        return;
      }

      // One-time data handler
      const handler = (data: Buffer): void => {
        input.removeListener('data', handler);
        dataHandler = null;
        resolve(parseKey(data));
      };

      dataHandler = handler;
      input.on('data', handler);
    });
  }

  /**
   * Check if raw mode is currently active
   */
  function isActive(): boolean {
    return isRawMode;
  }

  return {
    setup,
    cleanup,
    waitForKey,
    isActive,
    isSupported,
  };
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Wait for a specific key or set of keys
 *
 * @param keyboard - Keyboard input instance
 * @param validKeys - Set of valid key names to accept
 * @returns The pressed key event
 */
export async function waitForKeys(
  keyboard: KeyboardInput,
  validKeys: Set<string>
): Promise<KeyEvent> {
  while (true) {
    const event = await keyboard.waitForKey();
    if (validKeys.has(event.key)) {
      return event;
    }
    // Ignore invalid keys, wait for next
  }
}

/**
 * Wait for Enter key
 *
 * @param keyboard - Keyboard input instance
 * @returns The enter key event
 */
export async function waitForEnter(keyboard: KeyboardInput): Promise<KeyEvent> {
  return waitForKeys(keyboard, new Set(['enter']));
}

/**
 * Wait for Y/N confirmation
 *
 * @param keyboard - Keyboard input instance
 * @returns true if Y was pressed, false if N
 */
export async function waitForYesNo(keyboard: KeyboardInput): Promise<boolean> {
  const event = await waitForKeys(keyboard, new Set(['y', 'n', 'enter', 'escape']));
  return event.key === 'y';
}

/**
 * Check if a key event is a quit signal (Ctrl+C or Q)
 *
 * @param event - Key event to check
 * @returns true if this is a quit signal
 */
export function isQuitKey(event: KeyEvent): boolean {
  return event.key === 'q' || event.key === 'ctrl+c';
}

/**
 * Check if a key event is a back navigation key
 *
 * @param event - Key event to check
 * @returns true if this is a back key
 */
export function isBackKey(event: KeyEvent): boolean {
  return event.key === 'b' || event.key === 'escape';
}

/**
 * Check if a key event is a help key
 *
 * @param event - Key event to check
 * @returns true if this is a help key
 */
export function isHelpKey(event: KeyEvent): boolean {
  return event.key === 'h' || event.key === '?';
}

/**
 * Check if a key event is a retry key
 *
 * @param event - Key event to check
 * @returns true if this is a retry key
 */
export function isRetryKey(event: KeyEvent): boolean {
  return event.key === 'r';
}

/**
 * Check if a key event is a continue/confirm key
 *
 * @param event - Key event to check
 * @returns true if this is a continue key
 */
export function isContinueKey(event: KeyEvent): boolean {
  return event.key === 'enter' || event.key === 'y';
}
