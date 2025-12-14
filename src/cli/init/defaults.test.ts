/**
 * Tests for Express Mode Defaults
 *
 * @package WP_Navigator_MCP
 * @since 2.1.0
 */

import { describe, it, expect } from 'vitest';
import {
  detectEnvironment,
  isLocalUrl,
  getExpressDefaults,
  formatAppliedDefaults,
  describeDefaults,
} from './defaults.js';

describe('Express Mode Defaults', () => {
  describe('detectEnvironment', () => {
    it('detects localhost as local', () => {
      expect(detectEnvironment('http://localhost')).toBe('local');
      expect(detectEnvironment('http://localhost:8080')).toBe('local');
      expect(detectEnvironment('https://localhost')).toBe('local');
    });

    it('detects 127.0.0.1 as local', () => {
      expect(detectEnvironment('http://127.0.0.1')).toBe('local');
      expect(detectEnvironment('http://127.0.0.1:3000')).toBe('local');
    });

    it('detects .local domains as local', () => {
      expect(detectEnvironment('http://mysite.local')).toBe('local');
      expect(detectEnvironment('https://wordpress.local')).toBe('local');
      expect(detectEnvironment('http://mysite.local:8080')).toBe('local');
    });

    it('detects .test domains as local', () => {
      expect(detectEnvironment('http://mysite.test')).toBe('local');
      expect(detectEnvironment('https://wordpress.test')).toBe('local');
    });

    it('detects .dev domains as local', () => {
      expect(detectEnvironment('http://mysite.dev')).toBe('local');
      expect(detectEnvironment('https://wordpress.dev')).toBe('local');
    });

    it('detects DDEV sites as local', () => {
      expect(detectEnvironment('https://mysite.ddev.site')).toBe('local');
    });

    it('detects Lando sites as local', () => {
      expect(detectEnvironment('https://mysite.lndo.site')).toBe('local');
    });

    it('detects LocalWP sites as local', () => {
      expect(detectEnvironment('http://mysite.localwp.internal')).toBe('local');
    });

    it('detects production domains', () => {
      expect(detectEnvironment('https://example.com')).toBe('production');
      expect(detectEnvironment('https://www.mysite.com')).toBe('production');
      expect(detectEnvironment('https://blog.example.org')).toBe('production');
    });

    it('handles URLs with paths', () => {
      expect(detectEnvironment('http://localhost/wordpress')).toBe('local');
      expect(detectEnvironment('https://example.com/blog')).toBe('production');
    });

    it('is case insensitive', () => {
      expect(detectEnvironment('HTTP://LOCALHOST')).toBe('local');
      expect(detectEnvironment('HTTPS://MySite.LOCAL')).toBe('local');
    });
  });

  describe('isLocalUrl', () => {
    it('returns true for local URLs', () => {
      expect(isLocalUrl('http://localhost')).toBe(true);
      expect(isLocalUrl('https://mysite.local')).toBe(true);
    });

    it('returns false for production URLs', () => {
      expect(isLocalUrl('https://example.com')).toBe(false);
      expect(isLocalUrl('https://mysite.org')).toBe(false);
    });
  });

  describe('getExpressDefaults', () => {
    it('returns careful safety mode for local', () => {
      const defaults = getExpressDefaults({
        siteUrl: 'http://localhost',
        isLocal: true,
      });

      expect(defaults.environment).toBe('local');
      expect(defaults.safetyMode).toBe('careful');
      expect(defaults.setupDepth).toBe('quick');
      expect(defaults.mcpSetup).toBe(false);
    });

    it('returns safe safety mode for production', () => {
      const defaults = getExpressDefaults({
        siteUrl: 'https://example.com',
        isLocal: false,
      });

      expect(defaults.environment).toBe('production');
      expect(defaults.safetyMode).toBe('safe');
      expect(defaults.setupDepth).toBe('quick');
      expect(defaults.mcpSetup).toBe(false);
    });

    it('always uses quick setup depth', () => {
      const localDefaults = getExpressDefaults({ siteUrl: 'http://localhost', isLocal: true });
      const prodDefaults = getExpressDefaults({ siteUrl: 'https://example.com', isLocal: false });

      expect(localDefaults.setupDepth).toBe('quick');
      expect(prodDefaults.setupDepth).toBe('quick');
    });

    it('skips MCP setup by default', () => {
      const defaults = getExpressDefaults({ siteUrl: 'http://localhost', isLocal: true });
      expect(defaults.mcpSetup).toBe(false);
    });
  });

  describe('formatAppliedDefaults', () => {
    it('formats defaults as indented lines', () => {
      const defaults = {
        environment: 'local' as const,
        safetyMode: 'careful' as const,
        setupDepth: 'quick' as const,
        mcpSetup: false,
      };

      const formatted = formatAppliedDefaults(defaults);

      expect(formatted).toContain('Environment: local');
      expect(formatted).toContain('Safety mode: careful');
      expect(formatted).toContain('Setup depth: quick');
      expect(formatted).toContain('MCP setup: skipped');
    });

    it('shows enabled for MCP setup when true', () => {
      const defaults = {
        environment: 'production' as const,
        safetyMode: 'safe' as const,
        setupDepth: 'quick' as const,
        mcpSetup: true,
      };

      const formatted = formatAppliedDefaults(defaults);
      expect(formatted).toContain('MCP setup: enabled');
    });
  });

  describe('describeDefaults', () => {
    it('describes local defaults', () => {
      const defaults = {
        environment: 'local' as const,
        safetyMode: 'careful' as const,
        setupDepth: 'quick' as const,
        mcpSetup: false,
      };

      const description = describeDefaults(defaults);
      expect(description).toContain('local development');
      expect(description).toContain('careful');
    });

    it('describes production defaults', () => {
      const defaults = {
        environment: 'production' as const,
        safetyMode: 'safe' as const,
        setupDepth: 'quick' as const,
        mcpSetup: false,
      };

      const description = describeDefaults(defaults);
      expect(description).toContain('production');
      expect(description).toContain('safe');
    });
  });
});
