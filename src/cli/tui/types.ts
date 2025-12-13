/**
 * TUI Component Types
 *
 * TypeScript interfaces for WP Navigator CLI TUI components.
 *
 * @package WP_Navigator_Pro
 * @since 1.1.0
 */

/**
 * Step header configuration
 */
export interface StepHeaderOptions {
  /** Current step number (1-indexed) */
  current: number;
  /** Total number of steps */
  total: number;
  /** Step title/description */
  title: string;
}

/**
 * Progress bar configuration
 */
export interface ProgressBarOptions {
  /** Current progress (0-100) */
  percent: number;
  /** Bar width in characters (default: 20) */
  width?: number;
  /** Show percentage label (default: true) */
  showPercent?: boolean;
}

/**
 * Spinner configuration
 */
export interface SpinnerOptions {
  /** Text to display next to spinner */
  text: string;
  /** Spinner animation frames (default: braille dots) */
  frames?: string[];
  /** Frame interval in ms (default: 80) */
  interval?: number;
}

/**
 * Active spinner instance
 */
export interface SpinnerInstance {
  /** Stop the spinner with success message */
  succeed: (text?: string) => void;
  /** Stop the spinner with error message */
  fail: (text?: string) => void;
  /** Stop the spinner with warning message */
  warn: (text?: string) => void;
  /** Update the spinner text */
  update: (text: string) => void;
  /** Stop the spinner without status */
  stop: () => void;
}

/**
 * Input prompt configuration
 */
export interface InputPromptOptions {
  /** Prompt message */
  message: string;
  /** Default value (shown in brackets, selected on Enter) */
  defaultValue?: string;
  /** Validation function (returns error message or null if valid) */
  validate?: (input: string) => string | null;
  /** Transform input before returning */
  transform?: (input: string) => string;
  /** Hide input (for passwords) */
  secret?: boolean;
}

/**
 * Select prompt configuration
 */
export interface SelectPromptOptions {
  /** Prompt message */
  message: string;
  /** Available choices */
  choices: Array<{
    /** Display label */
    label: string;
    /** Return value */
    value: string;
    /** Mark as recommended (default on Enter) */
    recommended?: boolean;
  }>;
}

/**
 * Confirm prompt configuration
 */
export interface ConfirmPromptOptions {
  /** Prompt message */
  message: string;
  /** Default value (true = yes, false = no) */
  defaultValue?: boolean;
}

/**
 * Message type for styled output
 */
export type MessageType = 'success' | 'error' | 'warning' | 'info';

/**
 * Box styling options
 */
export interface BoxOptions {
  /** Box title */
  title?: string;
  /** Border style */
  borderStyle?: 'single' | 'double' | 'rounded';
  /** Padding inside box */
  padding?: number;
}
