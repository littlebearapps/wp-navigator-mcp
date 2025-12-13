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
export {
  inputPrompt,
  selectPrompt,
  confirmPrompt,
  pressEnterToContinue,
} from './prompts.js';

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
