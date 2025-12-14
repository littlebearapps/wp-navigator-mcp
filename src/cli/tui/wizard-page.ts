/**
 * Wizard Page Component
 *
 * Specialized page component for multi-step wizards.
 * Provides consistent header with step progress and footer with navigation hints.
 *
 * @package WP_Navigator_Pro
 * @since 2.5.0
 *
 * @example
 * import { createWizardPage } from './wizard-page.js';
 *
 * const wizardPage = createWizardPage({
 *   title: 'WP Navigator Setup',
 *   currentStep: 2,
 *   totalSteps: 5,
 * });
 *
 * wizardPage.render('Configure your WordPress connection...');
 */

import { createPage, type PageTUI, type PageOptions, rightAlign } from './page.js';
import { getTerminalSize, supportsPageTUI, type TerminalSize } from './terminal.js';
import { colorize, supportsColor, symbols } from './components.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Options for creating a wizard page
 */
export interface WizardPageOptions {
  /** Wizard title (shown in header) */
  title: string;
  /** Current step number (1-based) */
  currentStep: number;
  /** Total number of steps */
  totalSteps: number;
  /** Show back navigation hint (default: true for step > 1) */
  showBackHint?: boolean;
  /** Show help hint (default: true) */
  showHelpHint?: boolean;
  /** Show quit hint (default: true) */
  showQuitHint?: boolean;
  /** Custom footer text (overrides navigation hints) */
  customFooter?: string;
  /** Output stream (default: process.stderr) */
  output?: NodeJS.WriteStream;
}

/**
 * Wizard page instance interface
 */
export interface WizardPage {
  /** Clear screen and prepare for new step */
  clear(): void;
  /** Render content for current step */
  render(content: string): void;
  /** Render complete step (clears, shows header/content/footer) */
  renderStep(content: string): void;
  /** Update step progress (without clearing) */
  updateStep(currentStep: number, totalSteps?: number): void;
  /** Show navigation hints in footer */
  showNavigationHints(): void;
  /** Show help overlay with contextual help text */
  showHelp(helpText: string): void;
  /** Check if page-based rendering is supported */
  isSupported(): boolean;
  /** Get current terminal size */
  getSize(): TerminalSize;
  /** Get the underlying page instance */
  getPage(): PageTUI;
}

/**
 * Internal wizard state
 */
interface WizardState {
  title: string;
  currentStep: number;
  totalSteps: number;
  showBackHint: boolean;
  showHelpHint: boolean;
  showQuitHint: boolean;
  customFooter?: string;
}

// =============================================================================
// Wizard Page Factory
// =============================================================================

/**
 * Create a new wizard page instance
 *
 * @param options - Wizard page configuration
 * @returns WizardPage instance
 */
export function createWizardPage(options: WizardPageOptions): WizardPage {
  const {
    title,
    currentStep,
    totalSteps,
    showBackHint = currentStep > 1,
    showHelpHint = true,
    showQuitHint = true,
    customFooter,
    output = process.stderr,
  } = options;

  // Initialize state
  const state: WizardState = {
    title,
    currentStep,
    totalSteps,
    showBackHint,
    showHelpHint,
    showQuitHint,
    customFooter,
  };

  // Create underlying page
  const page = createPage({
    reserveHeaderLines: 3,
    reserveFooterLines: 2,
    output,
  });

  /**
   * Generate header with title and step progress
   */
  function generateHeader(): string {
    const { width } = getTerminalSize();
    const stepText = `Step ${state.currentStep}/${state.totalSteps}`;

    if (supportsPageTUI()) {
      // Full-width header with title left, progress right
      const padding = width - state.title.length - stepText.length - 2;
      if (padding > 0) {
        return `${state.title}${' '.repeat(padding)}${stepText}`;
      }
      // Narrow terminal: stack vertically
      return `${state.title}\n${stepText}`;
    }

    // Non-TTY: simple header
    return `${state.title} — ${stepText}`;
  }

  /**
   * Generate footer with navigation hints
   */
  function generateFooter(): string {
    if (state.customFooter) {
      return state.customFooter;
    }

    const hints: string[] = [];

    if (state.showBackHint && state.currentStep > 1) {
      hints.push('[B]ack');
    }
    if (state.showHelpHint) {
      hints.push('[H]elp');
    }
    if (state.showQuitHint) {
      hints.push('[Q]uit');
    }

    if (hints.length === 0) {
      return 'Press Enter to continue';
    }

    return hints.join('  ');
  }

  /**
   * Generate step progress indicator (visual)
   */
  function generateProgressIndicator(): string {
    const { currentStep, totalSteps } = state;
    const filled = currentStep;
    const empty = totalSteps - currentStep;

    // Use circles for progress: ● for completed/current, ○ for remaining
    const indicator = '●'.repeat(filled) + '○'.repeat(empty);

    if (supportsColor()) {
      return colorize(indicator, 'cyan');
    }
    return indicator;
  }

  /**
   * Clear screen
   */
  function clear(): void {
    page.clear();
  }

  /**
   * Render content
   */
  function render(content: string): void {
    page.render(content);
  }

  /**
   * Render complete step (clear + header + content + footer)
   */
  function renderStep(content: string): void {
    page.renderPage({
      header: generateHeader(),
      content,
      footer: generateFooter(),
    });
  }

  /**
   * Update step progress
   */
  function updateStep(newCurrentStep: number, newTotalSteps?: number): void {
    state.currentStep = newCurrentStep;
    if (newTotalSteps !== undefined) {
      state.totalSteps = newTotalSteps;
    }
    // Update back hint visibility based on step
    state.showBackHint = newCurrentStep > 1;
  }

  /**
   * Show navigation hints in footer
   */
  function showNavigationHints(): void {
    page.renderFooter(generateFooter());
  }

  /**
   * Show help overlay with contextual help text
   */
  function showHelp(helpText: string): void {
    const { width } = getTerminalSize();
    const boxWidth = Math.min(width - 4, 70);

    // Create help box content
    const lines = helpText.split('\n');
    const paddedLines = lines.map((line) => {
      const truncated = line.slice(0, boxWidth - 6);
      return truncated;
    });

    // Build box manually for better control
    const topLine = '┌─ Help ' + '─'.repeat(Math.max(0, boxWidth - 9)) + '┐';
    const bottomLine = '└' + '─'.repeat(boxWidth - 2) + '┘';

    const boxedLines = paddedLines.map((line) => {
      const padded = line.padEnd(boxWidth - 4);
      return '│ ' + padded + ' │';
    });

    const helpBox = [topLine, ...boxedLines, bottomLine].join('\n');

    // Output help
    if (supportsPageTUI()) {
      page.clear();
      page.renderHeader(generateHeader());
    }
    output.write('\n');
    output.write(helpBox);
    output.write('\n\n');
    if (supportsColor()) {
      output.write(colorize('Press any key to continue...', 'dim'));
    } else {
      output.write('Press any key to continue...');
    }
    output.write('\n');
  }

  /**
   * Check if page-based rendering is supported
   */
  function isSupported(): boolean {
    return page.isSupported();
  }

  /**
   * Get current terminal size
   */
  function getSize(): TerminalSize {
    return page.getSize();
  }

  /**
   * Get underlying page instance
   */
  function getPage(): PageTUI {
    return page;
  }

  return {
    clear,
    render,
    renderStep,
    updateStep,
    showNavigationHints,
    showHelp,
    isSupported,
    getSize,
    getPage,
  };
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Format a wizard step title with optional icon
 *
 * @param stepNumber - Step number
 * @param title - Step title
 * @param options - Formatting options
 * @returns Formatted step title
 */
export function formatStepTitle(
  stepNumber: number,
  title: string,
  options: { showIcon?: boolean; icon?: string } = {}
): string {
  const { showIcon = true, icon = symbols.arrow } = options;

  if (showIcon) {
    return `${icon} Step ${stepNumber}: ${title}`;
  }
  return `Step ${stepNumber}: ${title}`;
}

/**
 * Format step completion message
 *
 * @param stepNumber - Completed step number
 * @param message - Completion message
 * @returns Formatted completion message
 */
export function formatStepComplete(stepNumber: number, message?: string): string {
  const checkmark = supportsColor() ? colorize(symbols.success, 'green') : symbols.success;

  const text = message ?? `Step ${stepNumber} complete`;
  return `${checkmark} ${text}`;
}

/**
 * Format step error message
 *
 * @param stepNumber - Failed step number
 * @param error - Error message
 * @returns Formatted error message
 */
export function formatStepError(stepNumber: number, error: string): string {
  const cross = supportsColor() ? colorize(symbols.error, 'red') : symbols.error;
  return `${cross} Step ${stepNumber} failed: ${error}`;
}

/**
 * Create a progress bar for wizard steps
 *
 * @param currentStep - Current step (1-based)
 * @param totalSteps - Total number of steps
 * @param options - Formatting options
 * @returns Progress bar string
 */
export function createStepProgressBar(
  currentStep: number,
  totalSteps: number,
  options: { width?: number; showPercentage?: boolean } = {}
): string {
  const { width = 20, showPercentage = false } = options;
  const percent = Math.round((currentStep / totalSteps) * 100);
  const filled = Math.round((currentStep / totalSteps) * width);
  const empty = width - filled;

  let bar = '█'.repeat(filled) + '░'.repeat(empty);

  if (supportsColor()) {
    bar = colorize(bar, 'cyan');
  }

  if (showPercentage) {
    return `${bar} ${percent}%`;
  }

  return `${bar} ${currentStep}/${totalSteps}`;
}
