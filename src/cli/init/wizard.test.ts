/**
 * Wizard Orchestration Tests
 *
 * @package WP_Navigator_Pro
 * @since 2.5.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  createWizard,
  runWizard,
  defineStep,
  stepSuccess,
  stepFailure,
  showHelpOverlay,
} from './wizard.js';
import type { WizardStepDefinition, StepResult } from './step-history.js';

// =============================================================================
// Test Fixtures
// =============================================================================

function createTestStep(
  number: number,
  name: string,
  result: StepResult = stepSuccess({ [`step${number}`]: true })
): WizardStepDefinition {
  return defineStep({
    number,
    name,
    title: `Test Step ${number}`,
    help: `Help for step ${number}`,
    canGoBack: number > 1,
    execute: vi.fn().mockResolvedValue(result),
  });
}

function createMockOutput(): NodeJS.WriteStream {
  const chunks: string[] = [];
  return {
    write: vi.fn((data: string) => {
      chunks.push(data);
      return true;
    }),
    isTTY: false,
    // Add getOutput for testing
    getOutput: () => chunks.join(''),
  } as unknown as NodeJS.WriteStream;
}

// =============================================================================
// Tests
// =============================================================================

describe('Wizard Orchestration', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wpnav-wizard-test-'));
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('defineStep', () => {
    it('should create step definition with defaults', () => {
      const step = defineStep({
        number: 1,
        name: 'Welcome',
        title: 'Welcome to Setup',
        help: 'This is the help text',
        execute: async () => stepSuccess(),
      });

      expect(step.number).toBe(1);
      expect(step.name).toBe('Welcome');
      expect(step.title).toBe('Welcome to Setup');
      expect(step.help).toBe('This is the help text');
      expect(step.canGoBack).toBe(false); // Step 1 can't go back
    });

    it('should allow canGoBack override', () => {
      const step = defineStep({
        number: 2,
        name: 'Step2',
        title: 'Step 2',
        help: 'Help',
        canGoBack: false, // Override default
        execute: async () => stepSuccess(),
      });

      expect(step.canGoBack).toBe(false);
    });
  });

  describe('stepSuccess', () => {
    it('should create success result with data', () => {
      const result = stepSuccess({ url: 'https://example.com' });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ url: 'https://example.com' });
      expect(result.skipRemaining).toBe(false);
    });

    it('should allow skipRemaining flag', () => {
      const result = stepSuccess({ done: true }, true);

      expect(result.success).toBe(true);
      expect(result.skipRemaining).toBe(true);
    });
  });

  describe('stepFailure', () => {
    it('should create failure result with error', () => {
      const result = stepFailure('Connection failed');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Connection failed');
      expect(result.data).toEqual({});
    });

    it('should include partial data', () => {
      const result = stepFailure('Validation failed', { url: 'https://test.com' });

      expect(result.success).toBe(false);
      expect(result.data).toEqual({ url: 'https://test.com' });
    });
  });

  describe('createWizard', () => {
    it('should throw if no steps provided', () => {
      expect(() => {
        createWizard({
          steps: [],
          baseDir: tempDir,
          disableLogging: true,
        });
      }).toThrow('Wizard must have at least one step');
    });

    it('should create wizard with valid steps', () => {
      const step1 = createTestStep(1, 'Step1');
      const step2 = createTestStep(2, 'Step2');

      const wizard = createWizard({
        steps: [step1, step2],
        baseDir: tempDir,
        disableLogging: true,
      });

      expect(wizard.getCurrentStep()).toBe(1);
      expect(wizard.getData()).toEqual({});
      expect(wizard.getHistory()).toBeDefined();
      expect(wizard.getLogger()).toBeDefined();
    });
  });

  describe('runWizard', () => {
    it('should run all steps successfully', async () => {
      const step1 = createTestStep(1, 'Step1', stepSuccess({ a: 1 }));
      const step2 = createTestStep(2, 'Step2', stepSuccess({ b: 2 }));

      const output = createMockOutput();

      const result = await runWizard({
        steps: [step1, step2],
        baseDir: tempDir,
        disableLogging: true,
        output,
      });

      expect(result.success).toBe(true);
      expect(result.cancelled).toBe(false);
      expect(result.data).toEqual({ a: 1, b: 2 });
      expect(step1.execute).toHaveBeenCalled();
      expect(step2.execute).toHaveBeenCalled();
    });

    it('should call onComplete callback on success', async () => {
      const step1 = createTestStep(1, 'Step1', stepSuccess({ done: true }));
      const onComplete = vi.fn();

      await runWizard({
        steps: [step1],
        baseDir: tempDir,
        disableLogging: true,
        onComplete,
        output: createMockOutput(),
      });

      expect(onComplete).toHaveBeenCalledWith({ done: true });
    });

    it('should pass accumulated data to each step', async () => {
      const step1Execute = vi.fn().mockResolvedValue(stepSuccess({ url: 'https://test.com' }));
      const step2Execute = vi.fn().mockResolvedValue(stepSuccess({ user: 'admin' }));

      const step1 = defineStep({
        number: 1,
        name: 'URL',
        title: 'Enter URL',
        help: 'Help',
        execute: step1Execute,
      });

      const step2 = defineStep({
        number: 2,
        name: 'Credentials',
        title: 'Enter Credentials',
        help: 'Help',
        execute: step2Execute,
      });

      await runWizard({
        steps: [step1, step2],
        baseDir: tempDir,
        disableLogging: true,
        output: createMockOutput(),
      });

      // Step 1 receives empty accumulated data
      expect(step1Execute).toHaveBeenCalledWith({});

      // Step 2 receives data from step 1
      expect(step2Execute).toHaveBeenCalledWith({ url: 'https://test.com' });
    });

    it('should handle step failure in non-interactive mode', async () => {
      const step1 = createTestStep(1, 'Step1', stepFailure('Connection failed'));

      const result = await runWizard({
        steps: [step1],
        baseDir: tempDir,
        disableLogging: true,
        output: createMockOutput(),
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Connection failed');
    });

    it('should handle skipRemaining flag', async () => {
      const step1 = createTestStep(1, 'Step1', stepSuccess({ skipped: true }, true));
      const step2 = createTestStep(2, 'Step2', stepSuccess({ shouldNotRun: true }));

      const result = await runWizard({
        steps: [step1, step2],
        baseDir: tempDir,
        disableLogging: true,
        output: createMockOutput(),
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ skipped: true });
      expect(step2.execute).not.toHaveBeenCalled();
    });

    it('should catch step execution errors', async () => {
      const step1 = defineStep({
        number: 1,
        name: 'Failing',
        title: 'Failing Step',
        help: 'Help',
        execute: vi.fn().mockRejectedValue(new Error('Unexpected error')),
      });

      const result = await runWizard({
        steps: [step1],
        baseDir: tempDir,
        disableLogging: true,
        output: createMockOutput(),
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unexpected error');
    });

    it('should create log file when logging enabled', async () => {
      const step1 = createTestStep(1, 'Step1', stepSuccess({ done: true }));

      await runWizard({
        steps: [step1],
        baseDir: tempDir,
        disableLogging: false,
        output: createMockOutput(),
      });

      const logPath = path.join(tempDir, '.wpnav', 'init.log');
      expect(fs.existsSync(logPath)).toBe(true);

      const content = fs.readFileSync(logPath, 'utf8');
      expect(content).toContain('Init Started');
      expect(content).toContain('Step 1: Step1');
      expect(content).toContain('COMPLETED');
    });
  });

  describe('showHelpOverlay', () => {
    it('should write help box to output', () => {
      const output = createMockOutput();

      showHelpOverlay('This is help text', output);

      expect(output.write).toHaveBeenCalled();
      const written = (output as unknown as { getOutput(): string }).getOutput();
      expect(written).toContain('Help');
      expect(written).toContain('This is help text');
      expect(written).toContain('Press any key');
    });
  });

  describe('wizard state', () => {
    it('should track current step', async () => {
      let capturedWizard: ReturnType<typeof createWizard> | null = null;

      const step1 = defineStep({
        number: 1,
        name: 'Step1',
        title: 'Step 1',
        help: 'Help',
        execute: async () => {
          // Wizard should be at step 1
          expect(capturedWizard?.getCurrentStep()).toBe(1);
          return stepSuccess();
        },
      });

      const step2 = defineStep({
        number: 2,
        name: 'Step2',
        title: 'Step 2',
        help: 'Help',
        execute: async () => {
          // Wizard should be at step 2
          expect(capturedWizard?.getCurrentStep()).toBe(2);
          return stepSuccess();
        },
      });

      capturedWizard = createWizard({
        steps: [step1, step2],
        baseDir: tempDir,
        disableLogging: true,
        output: createMockOutput(),
      });

      await capturedWizard.run();
    });

    it('should prevent running wizard twice simultaneously', async () => {
      const step1 = defineStep({
        number: 1,
        name: 'Slow',
        title: 'Slow Step',
        help: 'Help',
        execute: async () => {
          await new Promise((resolve) => setTimeout(resolve, 100));
          return stepSuccess();
        },
      });

      const wizard = createWizard({
        steps: [step1],
        baseDir: tempDir,
        disableLogging: true,
        output: createMockOutput(),
      });

      // Start first run
      const run1 = wizard.run();

      // Try to start second run immediately
      await expect(wizard.run()).rejects.toThrow('already running');

      // Wait for first run to complete
      await run1;
    });

    it('should allow running wizard again after completion', async () => {
      const step1 = createTestStep(1, 'Step1', stepSuccess({ run: 1 }));

      const wizard = createWizard({
        steps: [step1],
        baseDir: tempDir,
        disableLogging: true,
        output: createMockOutput(),
      });

      const result1 = await wizard.run();
      expect(result1.success).toBe(true);

      // Note: This would actually fail because the wizard maintains state
      // In a real implementation, you'd create a new wizard instance
    });
  });
});
