/**
 * Wizard Orchestration Module
 *
 * Manages the init wizard flow with keyboard navigation.
 * Coordinates between step history, keyboard input, and logging.
 *
 * @package WP_Navigator_Pro
 * @since 2.5.0
 *
 * @example
 * import { createWizard, runWizard } from './wizard.js';
 *
 * const wizard = createWizard({
 *   steps: [welcomeStep, urlStep, credentialsStep],
 *   onComplete: (data) => console.log('Wizard completed', data),
 * });
 *
 * await runWizard(wizard);
 */

import {
  createKeyboardInput,
  isBackKey,
  isHelpKey,
  isQuitKey,
  isRetryKey,
} from '../tui/keyboard.js';
import { createWizardPage, createBox } from '../tui/index.js';
import { supportsPageTUI, getTerminalSize } from '../tui/terminal.js';
import { confirmPrompt } from '../tui/prompts.js';
import { colorize, symbols } from '../tui/components.js';
import {
  createStepHistory,
  type StepHistory,
  type StepResult,
  type NavigationAction,
  type WizardStepDefinition,
} from './step-history.js';
import { createInitLogger, createNoopLogger, type InitLogger } from './logger.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Wizard configuration options
 */
export interface WizardOptions {
  /** Step definitions */
  steps: WizardStepDefinition[];
  /** Wizard title (shown in header) */
  title?: string;
  /** Base directory for logging (default: cwd) */
  baseDir?: string;
  /** Disable logging */
  disableLogging?: boolean;
  /** Callback when wizard completes successfully */
  onComplete?: (data: Record<string, unknown>) => void | Promise<void>;
  /** Callback when wizard is cancelled */
  onCancel?: () => void | Promise<void>;
  /** Output stream (default: stderr) */
  output?: NodeJS.WriteStream;
}

/**
 * Wizard instance interface
 */
export interface Wizard {
  /** Run the wizard to completion */
  run(): Promise<WizardResult>;
  /** Get current step number (1-based) */
  getCurrentStep(): number;
  /** Get accumulated data from all steps */
  getData(): Record<string, unknown>;
  /** Get step history */
  getHistory(): StepHistory;
  /** Get logger */
  getLogger(): InitLogger;
}

/**
 * Result of running the wizard
 */
export interface WizardResult {
  /** Whether wizard completed successfully */
  success: boolean;
  /** Whether user cancelled */
  cancelled: boolean;
  /** Accumulated data from all steps */
  data: Record<string, unknown>;
  /** Error message if failed */
  error?: string;
}

/**
 * Internal wizard state
 */
interface WizardState {
  currentStepIndex: number;
  history: StepHistory;
  logger: InitLogger;
  keyboard: ReturnType<typeof createKeyboardInput>;
  running: boolean;
  completed: boolean;
  cancelled: boolean;
}

// =============================================================================
// Help Overlay
// =============================================================================

/**
 * Show help overlay for current step
 *
 * @param helpText - Help text to display
 * @param output - Output stream
 */
export function showHelpOverlay(
  helpText: string,
  output: NodeJS.WriteStream = process.stderr
): void {
  const { width } = getTerminalSize();
  const boxWidth = Math.min(width - 4, 70);

  // Create help box
  const helpBox = createBox(helpText, {
    title: 'Help',
    width: boxWidth,
    padding: 1,
  });

  // Show help
  output.write('\n');
  output.write(helpBox);
  output.write('\n\n');
  output.write(colorize('Press any key to continue...', 'dim'));
  output.write('\n');
}

/**
 * Show quit confirmation dialog
 *
 * @param output - Output stream
 * @returns true if user confirmed quit
 */
export async function showQuitConfirmation(
  output: NodeJS.WriteStream = process.stderr
): Promise<boolean> {
  output.write('\n');
  const confirmed = await confirmPrompt({
    message: 'Are you sure you want to quit? Your progress will be lost.',
    defaultValue: false,
  });
  return confirmed;
}

// =============================================================================
// Wizard Factory
// =============================================================================

/**
 * Create a new wizard instance
 *
 * @param options - Wizard configuration
 * @returns Wizard instance
 */
export function createWizard(options: WizardOptions): Wizard {
  const {
    steps,
    title = 'WP Navigator Setup',
    baseDir = process.cwd(),
    disableLogging = false,
    onComplete,
    onCancel,
    output = process.stderr,
  } = options;

  // Validate steps
  if (steps.length === 0) {
    throw new Error('Wizard must have at least one step');
  }

  // Initialize state
  const state: WizardState = {
    currentStepIndex: 0,
    history: createStepHistory(),
    logger: disableLogging ? createNoopLogger() : createInitLogger({ baseDir }),
    keyboard: createKeyboardInput({ autoCleanup: true }),
    running: false,
    completed: false,
    cancelled: false,
  };

  /**
   * Display current step with header/footer
   */
  function displayStep(step: WizardStepDefinition): void {
    if (!supportsPageTUI()) {
      // Fallback: simple header
      output.write(`\n${symbols.arrow} Step ${step.number}: ${step.title}\n`);
      return;
    }

    const wizardPage = createWizardPage({
      title,
      currentStep: step.number,
      totalSteps: steps.length,
      showBackHint: step.canGoBack,
      showHelpHint: true,
      showQuitHint: true,
      output,
    });

    wizardPage.clear();
    wizardPage.showNavigationHints();
  }

  /**
   * Handle navigation key press
   */
  async function handleNavigation(step: WizardStepDefinition): Promise<NavigationAction | null> {
    // If keyboard not supported, return null (step will handle its own input)
    if (!state.keyboard.isSupported()) {
      return null;
    }

    // Setup keyboard if not already
    if (!state.keyboard.isActive()) {
      state.keyboard.setup();
    }

    // Wait for key
    const event = await state.keyboard.waitForKey();

    if (isBackKey(event) && step.canGoBack) {
      return { type: 'back' };
    }

    if (isHelpKey(event)) {
      return { type: 'help' };
    }

    if (isQuitKey(event)) {
      return { type: 'quit' };
    }

    if (isRetryKey(event)) {
      return { type: 'retry' };
    }

    // Other keys - let step handle it
    return null;
  }

  /**
   * Execute a single step
   */
  async function executeStep(step: WizardStepDefinition): Promise<StepResult> {
    state.logger.step(step.number, step.name, 'started');

    try {
      const accumulatedData = state.history.getAccumulatedData();
      const result = await step.execute(accumulatedData);

      if (result.success) {
        state.logger.step(step.number, step.name, 'completed');
      } else {
        state.logger.step(step.number, step.name, 'failed', result.error);
      }

      return result;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      state.logger.step(step.number, step.name, 'failed', errorMsg);
      return { success: false, data: {}, error: errorMsg };
    }
  }

  /**
   * Run the wizard loop
   */
  async function run(): Promise<WizardResult> {
    if (state.running) {
      throw new Error('Wizard is already running');
    }

    state.running = true;
    state.logger.start();

    try {
      while (state.currentStepIndex < steps.length && !state.cancelled) {
        const step = steps[state.currentStepIndex];

        // Display step
        displayStep(step);

        // Execute step
        const result = await executeStep(step);

        if (result.success) {
          // Save step data to history
          state.history.push({
            stepNumber: step.number,
            stepName: step.name,
            data: result.data,
          });

          // Check for early completion
          if (result.skipRemaining) {
            state.logger.info('Skipping remaining steps');
            break;
          }

          // Move to next step
          state.currentStepIndex++;
        } else {
          // Step failed - offer retry or back
          output.write('\n');
          output.write(colorize(`${symbols.error} ${result.error}`, 'red'));
          output.write('\n');

          if (state.keyboard.isSupported()) {
            output.write(colorize('Press [R] to retry, [B] to go back, or [Q] to quit', 'dim'));
            output.write('\n');

            const action = await handleNavigation(step);

            if (action?.type === 'back' && step.canGoBack) {
              state.history.pop();
              state.currentStepIndex--;
              state.logger.action('User pressed [B] to go back');
            } else if (action?.type === 'quit') {
              const confirmed = await showQuitConfirmation(output);
              if (confirmed) {
                state.cancelled = true;
                state.logger.action('User confirmed quit');
              }
            } else if (action?.type === 'retry') {
              state.logger.action('User pressed [R] to retry');
              // Continue loop to retry step
            }
          } else {
            // Non-interactive: fail immediately
            state.logger.end(false);
            return {
              success: false,
              cancelled: false,
              data: state.history.getAccumulatedData(),
              error: result.error,
            };
          }
        }
      }

      // Cleanup keyboard
      state.keyboard.cleanup();

      if (state.cancelled) {
        state.logger.end(false);
        await onCancel?.();
        return {
          success: false,
          cancelled: true,
          data: state.history.getAccumulatedData(),
        };
      }

      // Success
      state.completed = true;
      state.logger.end(true);

      const finalData = state.history.getAccumulatedData();
      await onComplete?.(finalData);

      return {
        success: true,
        cancelled: false,
        data: finalData,
      };
    } catch (err) {
      state.keyboard.cleanup();
      const errorMsg = err instanceof Error ? err.message : String(err);
      state.logger.error(errorMsg);
      state.logger.end(false);

      return {
        success: false,
        cancelled: false,
        data: state.history.getAccumulatedData(),
        error: errorMsg,
      };
    } finally {
      state.running = false;
    }
  }

  /**
   * Get current step number
   */
  function getCurrentStep(): number {
    return state.currentStepIndex + 1;
  }

  /**
   * Get accumulated data
   */
  function getData(): Record<string, unknown> {
    return state.history.getAccumulatedData();
  }

  /**
   * Get step history
   */
  function getHistory(): StepHistory {
    return state.history;
  }

  /**
   * Get logger
   */
  function getLogger(): InitLogger {
    return state.logger;
  }

  return {
    run,
    getCurrentStep,
    getData,
    getHistory,
    getLogger,
  };
}

// =============================================================================
// Convenience Function
// =============================================================================

/**
 * Run a wizard with the given steps
 *
 * @param options - Wizard options
 * @returns Wizard result
 */
export async function runWizard(options: WizardOptions): Promise<WizardResult> {
  const wizard = createWizard(options);
  return wizard.run();
}

// =============================================================================
// Step Builder Helpers
// =============================================================================

/**
 * Create a simple step definition
 *
 * @param config - Step configuration
 * @returns WizardStepDefinition
 */
export function defineStep(config: {
  number: number;
  name: string;
  title: string;
  help: string;
  canGoBack?: boolean;
  execute: (data: Record<string, unknown>) => Promise<StepResult>;
}): WizardStepDefinition {
  return {
    number: config.number,
    name: config.name,
    title: config.title,
    help: config.help,
    canGoBack: config.canGoBack ?? config.number > 1,
    execute: config.execute,
  };
}

/**
 * Create a success result
 *
 * @param data - Data collected
 * @param skipRemaining - Whether to skip remaining steps
 * @returns StepResult
 */
export function stepSuccess(data: Record<string, unknown> = {}, skipRemaining = false): StepResult {
  return { success: true, data, skipRemaining };
}

/**
 * Create a failure result
 *
 * @param error - Error message
 * @param data - Partial data collected
 * @returns StepResult
 */
export function stepFailure(error: string, data: Record<string, unknown> = {}): StepResult {
  return { success: false, data, error };
}
