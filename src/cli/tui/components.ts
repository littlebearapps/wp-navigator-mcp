/**
 * TUI Components
 *
 * Terminal UI components for WP Navigator CLI.
 * Provides consistent styling across all CLI commands.
 *
 * @package WP_Navigator_Pro
 * @since 1.1.0
 */

import type {
  StepHeaderOptions,
  ProgressBarOptions,
  SpinnerOptions,
  SpinnerInstance,
  MessageType,
  BoxOptions,
} from './types.js';

// Unicode symbols
export const symbols = {
  success: '\u2714', // checkmark
  error: '\u2716', // cross
  warning: '\u26A0', // warning sign
  info: '\u2139', // info
  bullet: '\u2022', // bullet
  arrow: '\u2192', // right arrow
  dash: '\u2500', // horizontal line
};

// Spinner frames (braille dots animation)
const defaultSpinnerFrames = [
  '\u280B',
  '\u2819',
  '\u2839',
  '\u2838',
  '\u283C',
  '\u2834',
  '\u2826',
  '\u2827',
  '\u2807',
  '\u280F',
];

// ANSI color codes (when terminal supports it)
export const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

/**
 * Check if terminal supports colors
 */
export function supportsColor(): boolean {
  if (process.env.NO_COLOR) return false;
  if (process.env.FORCE_COLOR) return true;
  return process.stdout.isTTY ?? false;
}

/**
 * Apply color to text if terminal supports it
 */
export function colorize(text: string, color: keyof typeof colors): string {
  if (!supportsColor()) return text;
  return `${colors[color]}${text}${colors.reset}`;
}

/**
 * Render step header
 *
 * @example
 * stepHeader({ current: 1, total: 3, title: 'Connecting to WordPress' })
 * // Output: "Step 1 of 3 — Connecting to WordPress"
 */
export function stepHeader(options: StepHeaderOptions): string {
  const { current, total, title } = options;
  const stepText = `Step ${current} of ${total}`;
  const separator = '\u2014'; // em dash

  if (supportsColor()) {
    return `${colors.bold}${stepText}${colors.reset} ${colors.dim}${separator}${colors.reset} ${title}`;
  }
  return `${stepText} ${separator} ${title}`;
}

/**
 * Render progress bar
 *
 * @example
 * progressBar({ percent: 60, width: 20 })
 * // Output: "▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░ 60%"
 */
export function progressBar(options: ProgressBarOptions): string {
  const { percent, width = 20, showPercent = true } = options;
  const clampedPercent = Math.max(0, Math.min(100, percent));
  const filled = Math.round((clampedPercent / 100) * width);
  const empty = width - filled;

  const filledChar = '\u2593'; // dark shade
  const emptyChar = '\u2591'; // light shade

  let bar = filledChar.repeat(filled) + emptyChar.repeat(empty);

  if (supportsColor()) {
    bar = `${colors.green}${filledChar.repeat(filled)}${colors.gray}${emptyChar.repeat(empty)}${colors.reset}`;
  }

  if (showPercent) {
    return `${bar} ${clampedPercent}%`;
  }
  return bar;
}

/**
 * Create an animated spinner
 *
 * @example
 * const spinner = createSpinner({ text: 'Loading...' });
 * // ... do work ...
 * spinner.succeed('Done!');
 */
export function createSpinner(options: SpinnerOptions): SpinnerInstance {
  const { text, frames = defaultSpinnerFrames, interval = 80 } = options;

  let currentFrame = 0;
  let currentText = text;
  let timer: ReturnType<typeof setInterval> | null = null;
  let isRunning = false;

  // Only animate if TTY
  const isTTY = process.stderr.isTTY ?? false;

  function render() {
    if (!isTTY) return;

    const frame = frames[currentFrame % frames.length];
    process.stderr.write(`\r${colorize(frame, 'cyan')} ${currentText}`);
    currentFrame++;
  }

  function clearLine() {
    if (!isTTY) return;
    process.stderr.write('\r\x1b[K'); // Clear line
  }

  function start() {
    if (isRunning) return;
    isRunning = true;

    if (isTTY) {
      render();
      timer = setInterval(render, interval);
    } else {
      // Non-TTY: just print the text
      console.error(`... ${currentText}`);
    }
  }

  function stop() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    isRunning = false;
    clearLine();
  }

  // Start immediately
  start();

  return {
    succeed(finalText?: string) {
      stop();
      const msg = finalText ?? currentText;
      console.error(`${colorize(symbols.success, 'green')} ${msg}`);
    },

    fail(finalText?: string) {
      stop();
      const msg = finalText ?? currentText;
      console.error(`${colorize(symbols.error, 'red')} ${msg}`);
    },

    warn(finalText?: string) {
      stop();
      const msg = finalText ?? currentText;
      console.error(`${colorize(symbols.warning, 'yellow')} ${msg}`);
    },

    update(newText: string) {
      currentText = newText;
      if (!isTTY && isRunning) {
        console.error(`... ${newText}`);
      }
    },

    stop() {
      stop();
    },
  };
}

/**
 * Print success message
 *
 * @example
 * success('Page updated successfully');
 * // Output: "✔ Page updated successfully"
 */
export function success(message: string): void {
  console.error(`${colorize(symbols.success, 'green')} ${message}`);
}

/**
 * Print error message
 *
 * @example
 * error('Failed to connect', 'Check your network connection');
 * // Output: "✖ Failed to connect"
 * //         "  Check your network connection"
 */
export function error(message: string, hint?: string): void {
  console.error(`${colorize(symbols.error, 'red')} ${colorize(message, 'red')}`);
  if (hint) {
    console.error(`  ${colorize(hint, 'dim')}`);
  }
}

/**
 * Print warning message
 */
export function warning(message: string): void {
  console.error(`${colorize(symbols.warning, 'yellow')} ${message}`);
}

/**
 * Print info message
 */
export function info(message: string): void {
  console.error(`${colorize(symbols.info, 'blue')} ${message}`);
}

/**
 * Print a styled message with appropriate prefix
 */
export function message(text: string, type: MessageType): void {
  switch (type) {
    case 'success':
      success(text);
      break;
    case 'error':
      error(text);
      break;
    case 'warning':
      warning(text);
      break;
    case 'info':
      info(text);
      break;
  }
}

/**
 * Print a blank line for spacing
 */
export function newline(): void {
  console.error('');
}

/**
 * Print a horizontal divider
 */
export function divider(width = 40): void {
  const line = symbols.dash.repeat(width);
  console.error(colorize(line, 'dim'));
}

/**
 * Print text in a box
 */
export function box(content: string, options: BoxOptions = {}): void {
  const { title, padding = 1 } = options;
  const lines = content.split('\n');
  const maxWidth = Math.max(...lines.map((l) => l.length), title?.length ?? 0);
  const width = maxWidth + padding * 2;

  // Box characters
  const topLeft = '\u250C';
  const topRight = '\u2510';
  const bottomLeft = '\u2514';
  const bottomRight = '\u2518';
  const horizontal = '\u2500';
  const vertical = '\u2502';

  // Top border
  let topBorder = topLeft + horizontal.repeat(width) + topRight;
  if (title) {
    const titlePadded = ` ${title} `;
    const insertPos = 2;
    topBorder =
      topLeft +
      horizontal.repeat(insertPos) +
      titlePadded +
      horizontal.repeat(width - insertPos - titlePadded.length) +
      topRight;
  }

  console.error(colorize(topBorder, 'dim'));

  // Content lines
  const pad = ' '.repeat(padding);
  for (const line of lines) {
    const paddedLine = pad + line.padEnd(maxWidth) + pad;
    console.error(`${colorize(vertical, 'dim')}${paddedLine}${colorize(vertical, 'dim')}`);
  }

  // Bottom border
  console.error(colorize(bottomLeft + horizontal.repeat(width) + bottomRight, 'dim'));
}

/**
 * Print a list with bullets
 */
export function list(items: string[], indent = 2): void {
  const indentStr = ' '.repeat(indent);
  for (const item of items) {
    console.error(`${indentStr}${colorize(symbols.bullet, 'dim')} ${item}`);
  }
}

/**
 * Print a key-value pair
 */
export function keyValue(key: string, value: string, keyWidth = 15): void {
  const paddedKey = key.padEnd(keyWidth);
  // Safe: callers are responsible for masking sensitive values (see maskPassword usage in credentials.ts)
  // lgtm[js/clear-text-logging]
  console.error(`  ${colorize(paddedKey, 'dim')} ${value}`);
}

/**
 * Display write mode indicator with appropriate styling
 *
 * Safe mode (writes disabled): Green checkmark
 * Write mode (writes enabled): Yellow warning icon
 *
 * @example
 * modeIndicator(false);
 * // Output: "✔ SAFE MODE (writes disabled)"
 *
 * modeIndicator(true);
 * // Output: "⚠ WRITE MODE (changes allowed)"
 */
export function modeIndicator(writesEnabled: boolean): void {
  if (writesEnabled) {
    // Write mode - yellow warning
    console.error(
      `${colorize(symbols.warning, 'yellow')} ${colorize('WRITE MODE', 'yellow')} ${colorize('(changes allowed)', 'dim')}`
    );
  } else {
    // Safe mode - green checkmark
    console.error(
      `${colorize(symbols.success, 'green')} ${colorize('SAFE MODE', 'green')} ${colorize('(writes disabled)', 'dim')}`
    );
  }
}
