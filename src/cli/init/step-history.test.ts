/**
 * Step History Tests
 *
 * @package WP_Navigator_Pro
 * @since 2.5.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createStepHistory, type StepHistoryEntry } from './step-history.js';

describe('Step History', () => {
  describe('createStepHistory', () => {
    it('should create an empty history', () => {
      const history = createStepHistory();
      expect(history.size()).toBe(0);
      expect(history.isEmpty()).toBe(true);
    });
  });

  describe('push', () => {
    it('should add entries to history', () => {
      const history = createStepHistory();

      history.push({ stepNumber: 1, stepName: 'Welcome', data: {} });
      expect(history.size()).toBe(1);
      expect(history.isEmpty()).toBe(false);

      history.push({ stepNumber: 2, stepName: 'Site URL', data: { url: 'https://example.com' } });
      expect(history.size()).toBe(2);
    });

    it('should add timestamp automatically', () => {
      const history = createStepHistory();
      const before = new Date();

      history.push({ stepNumber: 1, stepName: 'Welcome', data: {} });

      const after = new Date();
      const entry = history.peek();

      expect(entry).toBeDefined();
      expect(entry!.timestamp).toBeInstanceOf(Date);
      expect(entry!.timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(entry!.timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('should deep clone data to prevent external mutations', () => {
      const history = createStepHistory();
      const data = { nested: { value: 'original' } };

      history.push({ stepNumber: 1, stepName: 'Test', data });

      // Mutate original data
      data.nested.value = 'mutated';

      // History should still have original value
      const entry = history.peek();
      expect((entry!.data.nested as { value: string }).value).toBe('original');
    });

    it('should respect maxSize option', () => {
      const history = createStepHistory({ maxSize: 2 });

      history.push({ stepNumber: 1, stepName: 'Step1', data: {} });
      history.push({ stepNumber: 2, stepName: 'Step2', data: {} });
      history.push({ stepNumber: 3, stepName: 'Step3', data: {} });

      expect(history.size()).toBe(2);

      // Should have removed oldest entry (Step1)
      const all = history.getAll();
      expect(all[0].stepName).toBe('Step2');
      expect(all[1].stepName).toBe('Step3');
    });
  });

  describe('pop', () => {
    it('should return undefined for empty history', () => {
      const history = createStepHistory();
      expect(history.pop()).toBeUndefined();
    });

    it('should remove and return most recent entry', () => {
      const history = createStepHistory();

      history.push({ stepNumber: 1, stepName: 'Step1', data: { a: 1 } });
      history.push({ stepNumber: 2, stepName: 'Step2', data: { b: 2 } });

      const popped = history.pop();

      expect(popped).toBeDefined();
      expect(popped!.stepNumber).toBe(2);
      expect(popped!.stepName).toBe('Step2');
      expect(popped!.data).toEqual({ b: 2 });
      expect(history.size()).toBe(1);
    });

    it('should return deep clone to prevent mutations', () => {
      const history = createStepHistory();
      history.push({ stepNumber: 1, stepName: 'Test', data: { value: 'original' } });

      const popped = history.pop();
      popped!.data.value = 'mutated';

      // Push back and check (though history should be empty now)
      history.push({ stepNumber: 1, stepName: 'Test', data: { value: 'new' } });
      const newEntry = history.peek();
      expect(newEntry!.data.value).toBe('new');
    });
  });

  describe('peek', () => {
    it('should return undefined for empty history', () => {
      const history = createStepHistory();
      expect(history.peek()).toBeUndefined();
    });

    it('should return most recent entry without removing it', () => {
      const history = createStepHistory();

      history.push({ stepNumber: 1, stepName: 'Step1', data: {} });
      history.push({ stepNumber: 2, stepName: 'Step2', data: {} });

      const peeked = history.peek();

      expect(peeked).toBeDefined();
      expect(peeked!.stepNumber).toBe(2);
      expect(history.size()).toBe(2); // Size unchanged
    });

    it('should return deep clone to prevent mutations', () => {
      const history = createStepHistory();
      history.push({ stepNumber: 1, stepName: 'Test', data: { value: 'original' } });

      const peeked = history.peek();
      peeked!.data.value = 'mutated';

      // Original in history should be unchanged
      const peekedAgain = history.peek();
      expect(peekedAgain!.data.value).toBe('original');
    });
  });

  describe('get', () => {
    it('should return undefined for invalid index', () => {
      const history = createStepHistory();
      history.push({ stepNumber: 1, stepName: 'Test', data: {} });

      expect(history.get(-1)).toBeUndefined();
      expect(history.get(1)).toBeUndefined();
      expect(history.get(100)).toBeUndefined();
    });

    it('should return entry at specified index (oldest first)', () => {
      const history = createStepHistory();

      history.push({ stepNumber: 1, stepName: 'Step1', data: {} });
      history.push({ stepNumber: 2, stepName: 'Step2', data: {} });
      history.push({ stepNumber: 3, stepName: 'Step3', data: {} });

      expect(history.get(0)?.stepName).toBe('Step1');
      expect(history.get(1)?.stepName).toBe('Step2');
      expect(history.get(2)?.stepName).toBe('Step3');
    });
  });

  describe('clear', () => {
    it('should remove all entries', () => {
      const history = createStepHistory();

      history.push({ stepNumber: 1, stepName: 'Step1', data: {} });
      history.push({ stepNumber: 2, stepName: 'Step2', data: {} });

      expect(history.size()).toBe(2);

      history.clear();

      expect(history.size()).toBe(0);
      expect(history.isEmpty()).toBe(true);
    });
  });

  describe('getAll', () => {
    it('should return empty array for empty history', () => {
      const history = createStepHistory();
      expect(history.getAll()).toEqual([]);
    });

    it('should return all entries in order (oldest first)', () => {
      const history = createStepHistory();

      history.push({ stepNumber: 1, stepName: 'Step1', data: { a: 1 } });
      history.push({ stepNumber: 2, stepName: 'Step2', data: { b: 2 } });

      const all = history.getAll();

      expect(all.length).toBe(2);
      expect(all[0].stepName).toBe('Step1');
      expect(all[1].stepName).toBe('Step2');
    });

    it('should return deep clones', () => {
      const history = createStepHistory();
      history.push({ stepNumber: 1, stepName: 'Test', data: { value: 'original' } });

      const all = history.getAll();
      all[0].data.value = 'mutated';

      const allAgain = history.getAll();
      expect(allAgain[0].data.value).toBe('original');
    });
  });

  describe('getStepData', () => {
    it('should return undefined for non-existent step', () => {
      const history = createStepHistory();
      history.push({ stepNumber: 1, stepName: 'Step1', data: {} });

      expect(history.getStepData('NonExistent')).toBeUndefined();
    });

    it('should return data for existing step by name', () => {
      const history = createStepHistory();

      history.push({ stepNumber: 1, stepName: 'Welcome', data: { mode: 'guided' } });
      history.push({
        stepNumber: 2,
        stepName: 'Site URL',
        data: { url: 'https://example.com' },
      });

      const welcomeData = history.getStepData('Welcome');
      expect(welcomeData).toEqual({ mode: 'guided' });

      const urlData = history.getStepData('Site URL');
      expect(urlData).toEqual({ url: 'https://example.com' });
    });
  });

  describe('getAccumulatedData', () => {
    it('should return empty object for empty history', () => {
      const history = createStepHistory();
      expect(history.getAccumulatedData()).toEqual({});
    });

    it('should merge data from all steps', () => {
      const history = createStepHistory();

      history.push({ stepNumber: 1, stepName: 'Step1', data: { a: 1, b: 2 } });
      history.push({ stepNumber: 2, stepName: 'Step2', data: { c: 3, d: 4 } });

      const accumulated = history.getAccumulatedData();

      expect(accumulated).toEqual({ a: 1, b: 2, c: 3, d: 4 });
    });

    it('should let later steps override earlier steps for same keys', () => {
      const history = createStepHistory();

      history.push({ stepNumber: 1, stepName: 'Step1', data: { shared: 'first', a: 1 } });
      history.push({ stepNumber: 2, stepName: 'Step2', data: { shared: 'second', b: 2 } });

      const accumulated = history.getAccumulatedData();

      expect(accumulated).toEqual({ shared: 'second', a: 1, b: 2 });
    });
  });

  describe('hasStep', () => {
    it('should return false for empty history', () => {
      const history = createStepHistory();
      expect(history.hasStep('Anything')).toBe(false);
    });

    it('should return true for existing step', () => {
      const history = createStepHistory();
      history.push({ stepNumber: 1, stepName: 'Welcome', data: {} });

      expect(history.hasStep('Welcome')).toBe(true);
    });

    it('should return false for non-existent step', () => {
      const history = createStepHistory();
      history.push({ stepNumber: 1, stepName: 'Welcome', data: {} });

      expect(history.hasStep('Goodbye')).toBe(false);
    });
  });

  describe('typical wizard flow', () => {
    it('should support forward navigation', () => {
      const history = createStepHistory();

      // User progresses through wizard
      history.push({ stepNumber: 1, stepName: 'Welcome', data: { mode: 'guided' } });
      history.push({ stepNumber: 2, stepName: 'Site URL', data: { url: 'https://test.com' } });
      history.push({ stepNumber: 3, stepName: 'Credentials', data: { user: 'admin' } });

      expect(history.size()).toBe(3);
      expect(history.getAccumulatedData()).toEqual({
        mode: 'guided',
        url: 'https://test.com',
        user: 'admin',
      });
    });

    it('should support back navigation with data preservation', () => {
      const history = createStepHistory();

      // User progresses to step 3
      history.push({ stepNumber: 1, stepName: 'Welcome', data: { mode: 'guided' } });
      history.push({ stepNumber: 2, stepName: 'Site URL', data: { url: 'https://test.com' } });
      history.push({ stepNumber: 3, stepName: 'Credentials', data: { user: 'admin' } });

      // User goes back
      const step3 = history.pop();
      expect(step3?.stepName).toBe('Credentials');
      expect(history.size()).toBe(2);

      // Previous data still accessible
      const currentData = history.getAccumulatedData();
      expect(currentData).toEqual({
        mode: 'guided',
        url: 'https://test.com',
      });

      // User can see current step data
      const currentStep = history.peek();
      expect(currentStep?.stepName).toBe('Site URL');
      expect(currentStep?.data.url).toBe('https://test.com');
    });

    it('should allow editing previous step and continuing', () => {
      const history = createStepHistory();

      // User completes steps 1-2
      history.push({ stepNumber: 1, stepName: 'Welcome', data: { mode: 'guided' } });
      history.push({
        stepNumber: 2,
        stepName: 'Site URL',
        data: { url: 'https://wrong-url.com' },
      });

      // User goes back to fix URL
      history.pop();

      // User re-enters step 2 with correct URL
      history.push({
        stepNumber: 2,
        stepName: 'Site URL',
        data: { url: 'https://correct-url.com' },
      });

      // Continue to step 3
      history.push({ stepNumber: 3, stepName: 'Credentials', data: { user: 'admin' } });

      const accumulated = history.getAccumulatedData();
      expect(accumulated.url).toBe('https://correct-url.com');
    });
  });
});
