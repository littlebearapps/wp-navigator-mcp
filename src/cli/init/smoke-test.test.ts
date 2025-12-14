/**
 * Unit tests for smoke test module
 *
 * Tests error classification and result formatting
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { SmokeTestResult, SmokeTestError } from './smoke-test.js';

// Mock the dependencies before importing
vi.mock('../../plugin-detection.js', () => ({
  detectPlugin: vi.fn(),
}));

vi.mock('../../tool-registry/index.js', () => ({
  toolRegistry: {
    getAllDefinitions: vi.fn(() => Array(65).fill({})),
  },
}));

// Import after mocking
import { runSmokeTest, displaySmokeTestResult } from './smoke-test.js';
import { detectPlugin } from '../../plugin-detection.js';

const mockDetectPlugin = vi.mocked(detectPlugin);

describe('smoke-test', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Suppress console output during tests
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('runSmokeTest', () => {
    it('returns success with site info on successful detection', async () => {
      mockDetectPlugin.mockResolvedValue({
        detected: true,
        edition: 'pro',
        version: '1.5.0',
        siteName: 'My Site',
        siteUrl: 'https://example.com',
        fullResponse: {
          plugin: {
            name: 'WP Navigator Pro',
            version: '1.5.0',
            edition: 'pro',
          },
          site: {
            name: 'My Site',
            url: 'https://example.com',
            version: '6.4.2',
          },
        },
      });

      const result = await runSmokeTest(
        'https://example.com',
        'admin',
        'password'
      );

      expect(result.success).toBe(true);
      expect(result.siteName).toBe('My Site');
      expect(result.wordpressVersion).toBe('6.4.2');
      expect(result.pluginVersion).toBe('1.5.0');
      expect(result.pluginEdition).toBe('pro');
      expect(result.toolCount).toBe(65);
    });

    it('returns AUTH_FAILED error on 401', async () => {
      mockDetectPlugin.mockResolvedValue({
        detected: false,
        errorCode: 'AUTH_FAILED',
        error: 'Authentication failed',
      });

      const result = await runSmokeTest(
        'https://example.com',
        'admin',
        'wrong-password'
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('AUTH_FAILED');
      expect(result.error?.remediation).toContain('Application password');
    });

    it('returns NOT_FOUND error on 404', async () => {
      mockDetectPlugin.mockResolvedValue({
        detected: false,
        errorCode: 'NOT_FOUND',
        error: 'WP Navigator plugin not found',
      });

      const result = await runSmokeTest(
        'https://example.com',
        'admin',
        'password'
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NOT_FOUND');
      expect(result.error?.remediation).toContain('Install and activate');
    });

    it('returns NETWORK_ERROR on connection failure', async () => {
      mockDetectPlugin.mockResolvedValue({
        detected: false,
        errorCode: 'NETWORK_ERROR',
        error: 'Connection refused',
      });

      const result = await runSmokeTest(
        'https://example.com',
        'admin',
        'password'
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NETWORK_ERROR');
      expect(result.error?.remediation).toContain('Cannot reach');
    });

    it('returns SSL_ERROR on certificate failure', async () => {
      mockDetectPlugin.mockResolvedValue({
        detected: false,
        errorCode: 'NETWORK_ERROR',
        error: 'SSL certificate expired',
      });

      const result = await runSmokeTest(
        'https://example.com',
        'admin',
        'password'
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('SSL_ERROR');
      expect(result.error?.remediation).toContain('ALLOW_INSECURE_HTTP');
    });

    it('returns INVALID_RESPONSE on malformed response', async () => {
      mockDetectPlugin.mockResolvedValue({
        detected: false,
        errorCode: 'INVALID_RESPONSE',
        error: 'Unexpected response format',
      });

      const result = await runSmokeTest(
        'https://example.com',
        'admin',
        'password'
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_RESPONSE');
      expect(result.error?.remediation).toContain('REST API');
    });

    it('handles thrown errors gracefully', async () => {
      mockDetectPlugin.mockRejectedValue(new Error('ECONNREFUSED'));

      const result = await runSmokeTest(
        'https://example.com',
        'admin',
        'password'
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NETWORK_ERROR');
    });

    it('handles 401 in thrown error message', async () => {
      mockDetectPlugin.mockRejectedValue(new Error('HTTP 401 Unauthorized'));

      const result = await runSmokeTest(
        'https://example.com',
        'admin',
        'password'
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('AUTH_FAILED');
    });

    it('handles free edition correctly', async () => {
      mockDetectPlugin.mockResolvedValue({
        detected: true,
        edition: 'free',
        version: '1.0.0',
        siteName: 'Free Site',
        fullResponse: {
          plugin: {
            name: 'WP Navigator',
            version: '1.0.0',
            edition: 'free',
          },
          site: {
            name: 'Free Site',
            version: '6.3.0',
          },
        },
      });

      const result = await runSmokeTest(
        'https://example.com',
        'admin',
        'password'
      );

      expect(result.success).toBe(true);
      expect(result.pluginEdition).toBe('free');
      expect(result.pluginVersion).toBe('1.0.0');
    });
  });

  describe('displaySmokeTestResult', () => {
    it('displays success result correctly', () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result: SmokeTestResult = {
        success: true,
        siteName: 'Test Site',
        wordpressVersion: '6.4.2',
        pluginVersion: '1.5.0',
        pluginEdition: 'pro',
        toolCount: 65,
      };

      displaySmokeTestResult(result);

      // Check that output was produced (captured by console.error mock)
      expect(consoleError).toHaveBeenCalled();
    });

    it('displays error result correctly', () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result: SmokeTestResult = {
        success: false,
        error: {
          code: 'AUTH_FAILED',
          message: 'Authentication failed',
          remediation: 'Regenerate Application Password',
        },
      };

      displaySmokeTestResult(result);

      // Check that output was produced
      expect(consoleError).toHaveBeenCalled();
    });

    it('handles missing optional fields in success result', () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result: SmokeTestResult = {
        success: true,
        // All optional fields missing
      };

      // Should not throw
      expect(() => displaySmokeTestResult(result)).not.toThrow();
    });

    it('handles Unknown WordPress version', () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result: SmokeTestResult = {
        success: true,
        siteName: 'Test',
        wordpressVersion: 'Unknown',
        pluginVersion: '1.0.0',
        pluginEdition: 'free',
      };

      displaySmokeTestResult(result);

      // Should not display "Unknown" version
      const calls = consoleError.mock.calls.map((c) => c[0]);
      const hasUnknown = calls.some(
        (call) => typeof call === 'string' && call.includes('WordPress') && call.includes('Unknown')
      );
      expect(hasUnknown).toBe(false);
    });
  });
});
