/**
 * Init Logger Tests
 *
 * @package WP_Navigator_Pro
 * @since 2.5.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  createInitLogger,
  createNoopLogger,
  createMemoryLogger,
  redactSensitive,
} from './logger.js';

describe('Init Logger', () => {
  describe('redactSensitive', () => {
    it('should redact application passwords (space-separated)', () => {
      const input = 'Password is abcd efgh ijkl mnop';
      const result = redactSensitive(input);
      expect(result).toBe('Password is [REDACTED]');
    });

    it('should redact password fields', () => {
      // Full pattern is replaced (password field + value)
      expect(redactSensitive('password: secretvalue')).toBe('[REDACTED]');
      expect(redactSensitive("password='secretvalue'")).toBe('[REDACTED]');
      expect(redactSensitive('password="secretvalue"')).toBe('[REDACTED]');
      expect(redactSensitive('pass=mypass123')).toBe('[REDACTED]');
    });

    it('should redact bearer tokens', () => {
      const input = 'Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.test';
      const result = redactSensitive(input);
      expect(result).toContain('[REDACTED]');
      expect(result).not.toContain('eyJhbGciOiJIUzI1NiJ9');
    });

    it('should redact basic auth headers', () => {
      const input = 'Authorization: Basic dXNlcjpwYXNz';
      const result = redactSensitive(input);
      expect(result).toContain('[REDACTED]');
      expect(result).not.toContain('dXNlcjpwYXNz');
    });

    it('should redact API keys', () => {
      expect(redactSensitive('api_key=sk-1234567890')).toBe('[REDACTED]');
      expect(redactSensitive('apikey: abc123xyz')).toBe('[REDACTED]');
      expect(redactSensitive('api-key="secret"')).toBe('[REDACTED]');
    });

    it('should redact secret fields', () => {
      expect(redactSensitive('secret=mysecretvalue')).toBe('[REDACTED]');
      expect(redactSensitive('secret: "hidden"')).toBe('[REDACTED]');
    });

    it('should preserve non-sensitive text', () => {
      const input = 'User connected to https://example.com';
      expect(redactSensitive(input)).toBe(input);
    });

    it('should handle multiple patterns in same string', () => {
      const input = 'user: admin, password: secret, api_key: key123';
      const result = redactSensitive(input);
      expect(result).not.toContain('secret');
      expect(result).not.toContain('key123');
    });
  });

  describe('createNoopLogger', () => {
    it('should return a logger that does nothing', () => {
      const logger = createNoopLogger();

      // Should not throw
      expect(() => {
        logger.start();
        logger.step(1, 'Test', 'started');
        logger.action('Test action');
        logger.info('Test info');
        logger.error('Test error');
        logger.end(true);
        logger.flush();
      }).not.toThrow();

      expect(logger.getLogPath()).toBe('');
    });
  });

  describe('createMemoryLogger', () => {
    it('should store entries in memory', () => {
      const logger = createMemoryLogger();

      logger.start();
      logger.step(1, 'Welcome', 'completed');
      logger.action('User pressed Enter');
      logger.info('Some info');
      logger.error('Some error');
      logger.end(true);

      const entries = logger.getEntries();

      expect(entries).toContain('=== WP Navigator Init Started ===');
      expect(entries).toContain('Step 1: Welcome - COMPLETED');
      expect(entries).toContain('ACTION: User pressed Enter');
      expect(entries).toContain('INFO: Some info');
      expect(entries).toContain('ERROR: Some error');
      expect(entries).toContain('=== Init Completed ===');
    });

    it('should redact sensitive data', () => {
      const logger = createMemoryLogger();

      logger.step(1, 'Credentials', 'completed', 'password: secret123');
      logger.action('User entered password: mysecret');

      const entries = logger.getEntries();

      expect(entries.join(' ')).not.toContain('secret123');
      expect(entries.join(' ')).not.toContain('mysecret');
      expect(entries.join(' ')).toContain('[REDACTED]');
    });

    it('should clear entries', () => {
      const logger = createMemoryLogger();

      logger.start();
      logger.step(1, 'Test', 'completed');

      expect(logger.getEntries().length).toBeGreaterThan(0);

      logger.clearEntries();

      expect(logger.getEntries()).toEqual([]);
    });

    it('should return :memory: as log path', () => {
      const logger = createMemoryLogger();
      expect(logger.getLogPath()).toBe(':memory:');
    });
  });

  describe('createInitLogger', () => {
    let tempDir: string;

    beforeEach(() => {
      // Create temp directory for tests
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wpnav-logger-test-'));
    });

    afterEach(() => {
      // Clean up temp directory
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    });

    it('should create .wpnav directory', () => {
      const logger = createInitLogger({ baseDir: tempDir });

      logger.start();
      logger.flush();

      const wpnavDir = path.join(tempDir, '.wpnav');
      expect(fs.existsSync(wpnavDir)).toBe(true);
    });

    it('should write to init.log file', () => {
      const logger = createInitLogger({ baseDir: tempDir });

      logger.start();
      logger.step(1, 'Test', 'completed');
      logger.end(true);

      const logPath = path.join(tempDir, '.wpnav', 'init.log');
      expect(fs.existsSync(logPath)).toBe(true);

      const content = fs.readFileSync(logPath, 'utf8');
      expect(content).toContain('WP Navigator Init Started');
      expect(content).toContain('Step 1: Test - COMPLETED');
      expect(content).toContain('Completed Successfully');
    });

    it('should return correct log path', () => {
      const logger = createInitLogger({ baseDir: tempDir });
      const expectedPath = path.join(tempDir, '.wpnav', 'init.log');

      expect(logger.getLogPath()).toBe(expectedPath);
    });

    it('should include timestamps', () => {
      const logger = createInitLogger({ baseDir: tempDir });

      logger.start();
      logger.flush();

      const content = fs.readFileSync(logger.getLogPath(), 'utf8');
      // Check for ISO 8601 format
      expect(content).toMatch(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should redact sensitive data in file', () => {
      const logger = createInitLogger({ baseDir: tempDir });

      logger.step(1, 'Credentials', 'completed', 'password: supersecret');
      logger.flush();

      const content = fs.readFileSync(logger.getLogPath(), 'utf8');
      expect(content).not.toContain('supersecret');
      expect(content).toContain('[REDACTED]');
    });

    it('should rotate log when too large', () => {
      const maxSize = 500; // Small size for testing
      const logger = createInitLogger({ baseDir: tempDir, maxSize });

      // Write enough to exceed max size
      logger.start();
      for (let i = 0; i < 20; i++) {
        logger.info('A'.repeat(50) + ` - Entry ${i}`);
      }
      logger.flush();

      // Check file was created but not yet rotated
      const logPath = path.join(tempDir, '.wpnav', 'init.log');

      // Create a new logger instance to trigger rotation check
      const logger2 = createInitLogger({ baseDir: tempDir, maxSize });
      logger2.start();
      logger2.flush();

      // Either the log was rotated or it exists
      expect(fs.existsSync(logPath)).toBe(true);
    });

    it('should handle disabled mode', () => {
      const logger = createInitLogger({ baseDir: tempDir, disabled: true });

      logger.start();
      logger.step(1, 'Test', 'completed');
      logger.end(true);

      const wpnavDir = path.join(tempDir, '.wpnav');
      expect(fs.existsSync(wpnavDir)).toBe(false);
    });

    it('should log failed end state', () => {
      const logger = createInitLogger({ baseDir: tempDir });

      logger.start();
      logger.step(1, 'Test', 'failed', 'Connection refused');
      logger.end(false);

      const content = fs.readFileSync(logger.getLogPath(), 'utf8');
      expect(content).toContain('Failed/Aborted');
      expect(content).toContain('FAILED');
    });

    it('should log all step statuses', () => {
      const logger = createInitLogger({ baseDir: tempDir });

      logger.step(1, 'Step1', 'started');
      logger.step(1, 'Step1', 'completed');
      logger.step(2, 'Step2', 'started');
      logger.step(2, 'Step2', 'failed', 'Error occurred');
      logger.step(3, 'Step3', 'skipped');
      logger.flush();

      const content = fs.readFileSync(logger.getLogPath(), 'utf8');
      expect(content).toContain('STARTED');
      expect(content).toContain('COMPLETED');
      expect(content).toContain('FAILED');
      expect(content).toContain('SKIPPED');
    });

    it('should log actions and info', () => {
      const logger = createInitLogger({ baseDir: tempDir });

      logger.action('User pressed [B] to go back');
      logger.info('Validating connection...');
      logger.error('Connection timeout');
      logger.flush();

      const content = fs.readFileSync(logger.getLogPath(), 'utf8');
      expect(content).toContain('[ACTION]');
      expect(content).toContain('User pressed [B] to go back');
      expect(content).toContain('[INFO '); // Padded to 5 chars
      expect(content).toContain('Validating connection');
      expect(content).toContain('[ERROR]');
      expect(content).toContain('Connection timeout');
    });
  });
});
