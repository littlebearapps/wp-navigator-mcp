/**
 * TUI Module Exports
 *
 * Central export point for all TUI components, prompts, and types.
 *
 * @package WP_Navigator_Pro
 * @since 1.1.0
 *
 * @example
 * import { stepHeader, progressBar, createSpinner, success, error } from './tui/index.js';
 * import { inputPrompt, selectPrompt, confirmPrompt } from './tui/index.js';
 */

// Types
export type {
  StepHeaderOptions,
  ProgressBarOptions,
  SpinnerOptions,
  SpinnerInstance,
  InputPromptOptions,
  SelectPromptOptions,
  ConfirmPromptOptions,
  MessageType,
  BoxOptions,
} from './types.js';

// Components
export {
  // Symbols
  symbols,
  colors,

  // Color utilities
  supportsColor,
  colorize,

  // Output components
  stepHeader,
  progressBar,
  createSpinner,

  // Message helpers
  success,
  error,
  warning,
  info,
  message,

  // Layout helpers
  newline,
  divider,
  box,
  list,
  keyValue,
} from './components.js';

// Prompts
export { inputPrompt, selectPrompt, confirmPrompt, pressEnterToContinue } from './prompts.js';

// Links
export {
  // URL constants
  WPNAV_URLS,
  type WpnavUrlKey,
  type LinkOptions,

  // Link detection
  supportsHyperlinks,

  // Link formatters
  link,
  wpnavLink,

  // Contextual link helpers
  demoLink,
  helpLink,
  docsLink,
  troubleshootLink,
  cliDocsLink,

  // Resource link blocks
  resourceLinks,
  printResourceLinks,

  // Error help
  getErrorHelpLink,
  errorWithHelp,
} from './links.js';

// ANSI escape codes (v2.5.0+)
export {
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

  // Cursor movement
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

  // Alternate screen buffer
  ALT_BUFFER_ENTER,
  ALT_BUFFER_EXIT,

  // Utilities
  clearAndHome,
  clearLineAt,
} from './ansi.js';

// Terminal detection (v2.5.0+)
export type { TerminalSize, TerminalCapabilities, ContentArea } from './terminal.js';
export {
  // Constants
  DEFAULT_WIDTH,
  DEFAULT_HEIGHT,
  MIN_PAGE_WIDTH,
  MIN_PAGE_HEIGHT,

  // Size detection
  getTerminalSize,
  watchTerminalSize,

  // Capability detection
  isDumbTerminal,
  supportsAnsi,
  getCapabilities,

  // Size checks
  isSmallTerminal,
  supportsPageTUI,

  // Content area
  getContentArea,

  // Text utilities
  truncateToWidth,
  wrapText,
} from './terminal.js';

// Page TUI (v2.5.0+)
export type { PageOptions, PageTUI } from './page.js';
export { createPage, createBox, centerText, rightAlign } from './page.js';

// Wizard Page (v2.5.0+)
export type { WizardPageOptions, WizardPage } from './wizard-page.js';
export {
  createWizardPage,
  formatStepTitle,
  formatStepComplete,
  formatStepError,
  createStepProgressBar,
} from './wizard-page.js';

// Keyboard Input (v2.5.0+)
export type { KeyEvent, KeyboardInput, KeyboardInputOptions } from './keyboard.js';
export {
  createKeyboardInput,
  parseKey,
  waitForKeys,
  waitForEnter,
  waitForYesNo,
  isQuitKey,
  isBackKey,
  isHelpKey,
  isRetryKey,
  isContinueKey,
} from './keyboard.js';
