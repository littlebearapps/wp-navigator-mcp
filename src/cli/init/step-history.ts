/**
 * Step History Module
 *
 * Manages wizard step state for back navigation.
 * Preserves collected data when navigating between steps.
 *
 * @package WP_Navigator_Pro
 * @since 2.5.0
 *
 * @example
 * import { createStepHistory } from './step-history.js';
 *
 * const history = createStepHistory();
 * history.push({ stepNumber: 1, stepName: 'Welcome', data: {} });
 * history.push({ stepNumber: 2, stepName: 'Site URL', data: { url: 'https://example.com' } });
 *
 * const prev = history.pop(); // Returns step 2 data
 * const current = history.peek(); // Returns step 1 data without removing
 */

// =============================================================================
// Types
// =============================================================================

/**
 * Represents a completed wizard step with its collected data
 */
export interface StepHistoryEntry {
  /** Step number (1-based) */
  stepNumber: number;
  /** Step name for display/logging */
  stepName: string;
  /** Data collected during this step */
  data: Record<string, unknown>;
  /** When this step was completed */
  timestamp: Date;
}

/**
 * Step history controller interface
 */
export interface StepHistory {
  /** Add a completed step to history */
  push(entry: Omit<StepHistoryEntry, 'timestamp'>): void;
  /** Remove and return the most recent step (for back navigation) */
  pop(): StepHistoryEntry | undefined;
  /** View the most recent step without removing it */
  peek(): StepHistoryEntry | undefined;
  /** Get step at specific index (0 = oldest) */
  get(index: number): StepHistoryEntry | undefined;
  /** Clear all history */
  clear(): void;
  /** Get number of steps in history */
  size(): number;
  /** Check if history is empty */
  isEmpty(): boolean;
  /** Get all entries (oldest first) - useful for logging */
  getAll(): StepHistoryEntry[];
  /** Get data from a specific step by name */
  getStepData(stepName: string): Record<string, unknown> | undefined;
  /** Get accumulated data from all steps */
  getAccumulatedData(): Record<string, unknown>;
  /** Check if a specific step exists in history */
  hasStep(stepName: string): boolean;
}

/**
 * Options for step history creation
 */
export interface StepHistoryOptions {
  /** Maximum number of steps to retain (default: unlimited) */
  maxSize?: number;
}

// =============================================================================
// Deep Clone Utility
// =============================================================================

/**
 * Deep clone an object to prevent mutation of stored data
 *
 * @param obj - Object to clone
 * @returns Deep cloned object
 */
function deepClone<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (obj instanceof Date) {
    return new Date(obj.getTime()) as T;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => deepClone(item)) as T;
  }

  if (typeof obj === 'object') {
    const cloned: Record<string, unknown> = {};
    for (const key of Object.keys(obj as Record<string, unknown>)) {
      cloned[key] = deepClone((obj as Record<string, unknown>)[key]);
    }
    return cloned as T;
  }

  return obj;
}

// =============================================================================
// Step History Factory
// =============================================================================

/**
 * Create a new step history instance
 *
 * @param options - Step history configuration
 * @returns StepHistory instance
 */
export function createStepHistory(options: StepHistoryOptions = {}): StepHistory {
  const { maxSize } = options;

  // Internal stack storage
  const stack: StepHistoryEntry[] = [];

  /**
   * Add a completed step to history
   */
  function push(entry: Omit<StepHistoryEntry, 'timestamp'>): void {
    const fullEntry: StepHistoryEntry = {
      stepNumber: entry.stepNumber,
      stepName: entry.stepName,
      data: deepClone(entry.data), // Deep clone to prevent external mutations
      timestamp: new Date(),
    };

    stack.push(fullEntry);

    // Enforce max size if specified
    if (maxSize !== undefined && stack.length > maxSize) {
      stack.shift(); // Remove oldest entry
    }
  }

  /**
   * Remove and return the most recent step
   */
  function pop(): StepHistoryEntry | undefined {
    const entry = stack.pop();
    if (entry) {
      return deepClone(entry); // Return clone to prevent mutations
    }
    return undefined;
  }

  /**
   * View the most recent step without removing it
   */
  function peek(): StepHistoryEntry | undefined {
    if (stack.length === 0) {
      return undefined;
    }
    return deepClone(stack[stack.length - 1]);
  }

  /**
   * Get step at specific index
   */
  function get(index: number): StepHistoryEntry | undefined {
    if (index < 0 || index >= stack.length) {
      return undefined;
    }
    return deepClone(stack[index]);
  }

  /**
   * Clear all history
   */
  function clear(): void {
    stack.length = 0;
  }

  /**
   * Get number of steps in history
   */
  function size(): number {
    return stack.length;
  }

  /**
   * Check if history is empty
   */
  function isEmpty(): boolean {
    return stack.length === 0;
  }

  /**
   * Get all entries (oldest first)
   */
  function getAll(): StepHistoryEntry[] {
    return stack.map((entry) => deepClone(entry));
  }

  /**
   * Get data from a specific step by name
   */
  function getStepData(stepName: string): Record<string, unknown> | undefined {
    const entry = stack.find((e) => e.stepName === stepName);
    if (entry) {
      return deepClone(entry.data);
    }
    return undefined;
  }

  /**
   * Get accumulated data from all steps
   * Later steps override earlier steps for same keys
   */
  function getAccumulatedData(): Record<string, unknown> {
    const accumulated: Record<string, unknown> = {};
    for (const entry of stack) {
      Object.assign(accumulated, deepClone(entry.data));
    }
    return accumulated;
  }

  /**
   * Check if a specific step exists in history
   */
  function hasStep(stepName: string): boolean {
    return stack.some((e) => e.stepName === stepName);
  }

  return {
    push,
    pop,
    peek,
    get,
    clear,
    size,
    isEmpty,
    getAll,
    getStepData,
    getAccumulatedData,
    hasStep,
  };
}

// =============================================================================
// Utility Types for Wizard Steps
// =============================================================================

/**
 * Result of executing a wizard step
 */
export interface StepResult {
  /** Whether the step completed successfully */
  success: boolean;
  /** Data collected during the step */
  data: Record<string, unknown>;
  /** Error message if step failed */
  error?: string;
  /** Whether to skip remaining steps and finish early */
  skipRemaining?: boolean;
}

/**
 * Navigation action requested by user
 */
export type NavigationAction =
  | { type: 'continue'; data: Record<string, unknown> }
  | { type: 'back' }
  | { type: 'help' }
  | { type: 'quit' }
  | { type: 'retry' };

/**
 * Wizard step definition
 */
export interface WizardStepDefinition {
  /** Step number (1-based) */
  number: number;
  /** Step name (unique identifier) */
  name: string;
  /** Display title for the step */
  title: string;
  /** Help text shown when user presses H */
  help: string;
  /** Whether back navigation is allowed (false for step 1) */
  canGoBack: boolean;
  /** Execute the step logic */
  execute: (accumulatedData: Record<string, unknown>) => Promise<StepResult>;
}
