/**
 * Wizard Page Tests
 *
 * @package WP_Navigator_Pro
 * @since 2.5.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Writable } from 'stream';
import {
  createWizardPage,
  formatStepTitle,
  formatStepComplete,
  formatStepError,
  createStepProgressBar,
  type WizardPage,
} from './wizard-page.js';
import { CLEAR_SCREEN, CURSOR_HOME } from './ansi.js';
import { symbols } from './components.js';

/**
 * Create a mock output stream that captures writes
 */
function createMockOutput(): { stream: NodeJS.WriteStream; output: string[]; clear: () => void } {
  const output: string[] = [];

  const stream = new Writable({
    write(chunk, encoding, callback) {
      output.push(chunk.toString());
      callback();
    },
  }) as unknown as NodeJS.WriteStream;

  // Mock isTTY for testing TTY behavior
  Object.defineProperty(stream, 'isTTY', { value: true, writable: true });

  return {
    stream,
    output,
    clear: () => {
      output.length = 0;
    },
  };
}

describe('Wizard Page', () => {
  const originalIsTTY = process.stdout.isTTY;
  const originalColumns = process.stdout.columns;
  const originalRows = process.stdout.rows;
  const originalTerm = process.env.TERM;

  beforeEach(() => {
    // Set up TTY environment
    Object.defineProperty(process.stdout, 'isTTY', { value: true, writable: true });
    Object.defineProperty(process.stdout, 'columns', { value: 80, writable: true });
    Object.defineProperty(process.stdout, 'rows', { value: 24, writable: true });
    process.env.TERM = 'xterm-256color';
  });

  afterEach(() => {
    Object.defineProperty(process.stdout, 'isTTY', { value: originalIsTTY, writable: true });
    Object.defineProperty(process.stdout, 'columns', { value: originalColumns, writable: true });
    Object.defineProperty(process.stdout, 'rows', { value: originalRows, writable: true });
    if (originalTerm === undefined) {
      delete process.env.TERM;
    } else {
      process.env.TERM = originalTerm;
    }
  });

  describe('createWizardPage', () => {
    it('should create a wizard page instance', () => {
      const mock = createMockOutput();
      const wizardPage = createWizardPage({
        title: 'Test Wizard',
        currentStep: 1,
        totalSteps: 5,
        output: mock.stream,
      });

      expect(wizardPage).toBeDefined();
      expect(typeof wizardPage.clear).toBe('function');
      expect(typeof wizardPage.render).toBe('function');
      expect(typeof wizardPage.renderStep).toBe('function');
      expect(typeof wizardPage.updateStep).toBe('function');
      expect(typeof wizardPage.showNavigationHints).toBe('function');
      expect(typeof wizardPage.isSupported).toBe('function');
      expect(typeof wizardPage.getSize).toBe('function');
      expect(typeof wizardPage.getPage).toBe('function');
    });

    it('should return the underlying page instance', () => {
      const mock = createMockOutput();
      const wizardPage = createWizardPage({
        title: 'Test Wizard',
        currentStep: 1,
        totalSteps: 3,
        output: mock.stream,
      });

      const page = wizardPage.getPage();
      expect(page).toBeDefined();
      expect(typeof page.clear).toBe('function');
    });
  });

  describe('renderStep', () => {
    it('should render a complete step with header and footer', () => {
      const mock = createMockOutput();
      const wizardPage = createWizardPage({
        title: 'WP Navigator Setup',
        currentStep: 2,
        totalSteps: 5,
        output: mock.stream,
      });

      wizardPage.renderStep('Step 2 content here');

      const combined = mock.output.join('');
      expect(combined).toContain('WP Navigator Setup');
      expect(combined).toContain('2/5');
      expect(combined).toContain('Step 2 content here');
    });

    it('should include back hint for step > 1', () => {
      const mock = createMockOutput();
      const wizardPage = createWizardPage({
        title: 'Wizard',
        currentStep: 2,
        totalSteps: 3,
        showBackHint: true,
        output: mock.stream,
      });

      wizardPage.renderStep('Content');

      const combined = mock.output.join('');
      expect(combined).toContain('[B]ack');
    });

    it('should not include back hint for step 1', () => {
      const mock = createMockOutput();
      const wizardPage = createWizardPage({
        title: 'Wizard',
        currentStep: 1,
        totalSteps: 3,
        output: mock.stream,
      });

      wizardPage.renderStep('Content');

      const combined = mock.output.join('');
      expect(combined).not.toContain('[B]ack');
    });

    it('should include help and quit hints by default', () => {
      const mock = createMockOutput();
      const wizardPage = createWizardPage({
        title: 'Wizard',
        currentStep: 1,
        totalSteps: 3,
        output: mock.stream,
      });

      wizardPage.renderStep('Content');

      const combined = mock.output.join('');
      expect(combined).toContain('[H]elp');
      expect(combined).toContain('[Q]uit');
    });

    it('should use custom footer when provided', () => {
      const mock = createMockOutput();
      const wizardPage = createWizardPage({
        title: 'Wizard',
        currentStep: 1,
        totalSteps: 3,
        customFooter: 'Custom footer text',
        output: mock.stream,
      });

      wizardPage.renderStep('Content');

      const combined = mock.output.join('');
      expect(combined).toContain('Custom footer text');
      expect(combined).not.toContain('[H]elp');
    });
  });

  describe('updateStep', () => {
    it('should update current step', () => {
      const mock = createMockOutput();
      const wizardPage = createWizardPage({
        title: 'Wizard',
        currentStep: 1,
        totalSteps: 5,
        output: mock.stream,
      });

      wizardPage.updateStep(3);
      wizardPage.renderStep('Step 3');

      const combined = mock.output.join('');
      expect(combined).toContain('3/5');
    });

    it('should update total steps if provided', () => {
      const mock = createMockOutput();
      const wizardPage = createWizardPage({
        title: 'Wizard',
        currentStep: 1,
        totalSteps: 3,
        output: mock.stream,
      });

      wizardPage.updateStep(2, 6);
      wizardPage.renderStep('Step 2');

      const combined = mock.output.join('');
      expect(combined).toContain('2/6');
    });

    it('should enable back hint after updating to step > 1', () => {
      const mock = createMockOutput();
      const wizardPage = createWizardPage({
        title: 'Wizard',
        currentStep: 1,
        totalSteps: 3,
        output: mock.stream,
      });

      // Initially step 1 - no back hint
      wizardPage.renderStep('Step 1');
      expect(mock.output.join('')).not.toContain('[B]ack');

      mock.clear();
      wizardPage.updateStep(2);
      wizardPage.renderStep('Step 2');
      expect(mock.output.join('')).toContain('[B]ack');
    });
  });

  describe('isSupported', () => {
    it('should return true in TTY environment', () => {
      const mock = createMockOutput();
      const wizardPage = createWizardPage({
        title: 'Wizard',
        currentStep: 1,
        totalSteps: 3,
        output: mock.stream,
      });

      expect(wizardPage.isSupported()).toBe(true);
    });

    it('should return false in non-TTY environment', () => {
      const mock = createMockOutput();
      Object.defineProperty(mock.stream, 'isTTY', { value: false, writable: true });

      const wizardPage = createWizardPage({
        title: 'Wizard',
        currentStep: 1,
        totalSteps: 3,
        output: mock.stream,
      });

      expect(wizardPage.isSupported()).toBe(false);
    });
  });
});

describe('formatStepTitle', () => {
  it('should format step title with icon', () => {
    const title = formatStepTitle(1, 'Configure WordPress');

    expect(title).toContain('Step 1');
    expect(title).toContain('Configure WordPress');
    expect(title).toContain(symbols.arrow);
  });

  it('should format step title without icon', () => {
    const title = formatStepTitle(2, 'Install Plugin', { showIcon: false });

    expect(title).toBe('Step 2: Install Plugin');
    expect(title).not.toContain(symbols.arrow);
  });

  it('should use custom icon', () => {
    const title = formatStepTitle(3, 'Verify', { icon: '★' });

    expect(title).toContain('★');
    expect(title).toContain('Step 3');
  });
});

describe('formatStepComplete', () => {
  it('should format completion message', () => {
    const message = formatStepComplete(1);

    expect(message).toContain(symbols.success);
    expect(message).toContain('Step 1 complete');
  });

  it('should use custom message', () => {
    const message = formatStepComplete(2, 'Configuration saved!');

    expect(message).toContain(symbols.success);
    expect(message).toContain('Configuration saved!');
  });
});

describe('formatStepError', () => {
  it('should format error message', () => {
    const message = formatStepError(1, 'Connection failed');

    expect(message).toContain(symbols.error);
    expect(message).toContain('Step 1 failed');
    expect(message).toContain('Connection failed');
  });
});

describe('createStepProgressBar', () => {
  it('should create progress bar with step count', () => {
    const bar = createStepProgressBar(2, 5);

    expect(bar).toContain('█');
    expect(bar).toContain('░');
    expect(bar).toContain('2/5');
  });

  it('should show percentage when requested', () => {
    const bar = createStepProgressBar(2, 5, { showPercentage: true });

    expect(bar).toContain('40%');
    expect(bar).not.toContain('2/5');
  });

  it('should respect custom width', () => {
    const bar = createStepProgressBar(5, 10, { width: 10 });

    // 5/10 = 50%, so 5 filled + 5 empty + suffix
    const barPart = bar.split(' ')[0];
    expect(barPart.length).toBeLessThanOrEqual(10);
  });

  it('should handle 100% progress', () => {
    const bar = createStepProgressBar(5, 5);

    expect(bar).toContain('5/5');
    expect(bar).toContain('█');
    expect(bar).not.toContain('░');
  });

  it('should handle 0% progress', () => {
    const bar = createStepProgressBar(0, 5);

    expect(bar).toContain('0/5');
    expect(bar).not.toContain('█');
    expect(bar).toContain('░');
  });
});
