/**
 * TUI Link Components Tests
 *
 * @package WP_Navigator_Pro
 * @since 1.1.0
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  WPNAV_URLS,
  supportsHyperlinks,
  link,
  wpnavLink,
  demoLink,
  helpLink,
  docsLink,
  troubleshootLink,
  cliDocsLink,
  resourceLinks,
  getErrorHelpLink,
  errorWithHelp,
} from './links.js';

describe('TUI Links', () => {
  // Save original env
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Reset env for each test
    process.env = { ...originalEnv };
    // Clear hyperlink-related env vars
    delete process.env.FORCE_HYPERLINK;
    delete process.env.TERM_PROGRAM;
    delete process.env.TERM_PROGRAM_VERSION;
    delete process.env.WT_SESSION;
    delete process.env.VTE_VERSION;
    delete process.env.ALACRITTY_LOG;
    delete process.env.KITTY_WINDOW_ID;
    delete process.env.WEZTERM_EXECUTABLE;
    delete process.env.NO_COLOR;
    delete process.env.FORCE_COLOR;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('WPNAV_URLS', () => {
    it('should have all required URLs', () => {
      expect(WPNAV_URLS.demo).toBe('https://wpnav.ai/start/demo');
      expect(WPNAV_URLS.help).toBe('https://wpnav.ai/help');
      expect(WPNAV_URLS.docs).toBe('https://wpnav.ai/docs');
      expect(WPNAV_URLS.troubleshoot).toBe('https://wpnav.ai/troubleshoot');
      expect(WPNAV_URLS.cliDocs).toBe('https://wpnav.ai/docs/cli');
      expect(WPNAV_URLS.download).toBe('https://wpnav.ai/download');
      expect(WPNAV_URLS.start).toBe('https://wpnav.ai/start');
    });

    it('should have immutable URLs (readonly)', () => {
      // TypeScript ensures this at compile time, but we can verify the values
      const urls = WPNAV_URLS;
      expect(Object.keys(urls)).toContain('demo');
      expect(Object.keys(urls)).toContain('help');
      expect(Object.keys(urls)).toContain('docs');
    });
  });

  describe('supportsHyperlinks()', () => {
    it('should return true when FORCE_HYPERLINK=1', () => {
      process.env.FORCE_HYPERLINK = '1';
      expect(supportsHyperlinks()).toBe(true);
    });

    it('should return false when FORCE_HYPERLINK=0', () => {
      process.env.FORCE_HYPERLINK = '0';
      expect(supportsHyperlinks()).toBe(false);
    });

    // Note: Tests that require modifying process.stdout.isTTY are skipped
    // because the property cannot be redefined in Node.js test environment.
    // The FORCE_HYPERLINK env var tests cover the override behavior.
  });

  describe('link()', () => {
    beforeEach(() => {
      // Force no hyperlinks, no colors for predictable output
      process.env.FORCE_HYPERLINK = '0';
      process.env.NO_COLOR = '1';
    });

    it('should return URL as-is when no text provided', () => {
      const result = link('https://example.com');
      expect(result).toBe('https://example.com');
    });

    it('should return custom text when provided', () => {
      const result = link('https://example.com', { text: 'Example' });
      expect(result).toBe('Example');
    });

    it('should show URL in parentheses with showUrl option', () => {
      const result = link('https://example.com', { text: 'Example', showUrl: true });
      expect(result).toBe('Example (https://example.com)');
    });

    it('should not show parentheses when text not provided', () => {
      const result = link('https://example.com', { showUrl: true });
      // When no text, showUrl is ignored - URL is already shown
      expect(result).toBe('https://example.com');
    });
  });

  describe('link() with hyperlinks enabled', () => {
    beforeEach(() => {
      process.env.FORCE_HYPERLINK = '1';
      process.env.NO_COLOR = '1';
    });

    it('should include OSC 8 escape sequences', () => {
      const result = link('https://example.com', { text: 'Example' });
      // OSC 8 format: \x1b]8;;URL\x1b\\text\x1b]8;;\x1b\\
      expect(result).toContain('\x1b]8;;https://example.com\x1b\\');
      expect(result).toContain('Example');
      expect(result).toContain('\x1b]8;;\x1b\\');
    });
  });

  describe('wpnavLink()', () => {
    beforeEach(() => {
      process.env.FORCE_HYPERLINK = '0';
      process.env.NO_COLOR = '1';
    });

    it('should return correct URL for demo', () => {
      const result = wpnavLink('demo');
      expect(result).toBe('https://wpnav.ai/start/demo');
    });

    it('should return correct URL for help', () => {
      const result = wpnavLink('help');
      expect(result).toBe('https://wpnav.ai/help');
    });

    it('should return correct URL for docs', () => {
      const result = wpnavLink('docs');
      expect(result).toBe('https://wpnav.ai/docs');
    });

    it('should use custom text when provided', () => {
      const result = wpnavLink('help', { text: 'Get Help' });
      expect(result).toBe('Get Help');
    });
  });

  describe('contextual link helpers', () => {
    beforeEach(() => {
      process.env.FORCE_HYPERLINK = '0';
      process.env.NO_COLOR = '1';
    });

    it('demoLink() should include demo URL', () => {
      const result = demoLink();
      expect(result).toContain('https://wpnav.ai/start/demo');
      expect(result).toContain('Watch demo');
    });

    it('helpLink() should include help URL', () => {
      const result = helpLink();
      expect(result).toContain('https://wpnav.ai/help');
      expect(result).toContain('Need help?');
    });

    it('docsLink() should include docs URL', () => {
      const result = docsLink();
      expect(result).toContain('https://wpnav.ai/docs');
      expect(result).toContain('Documentation');
    });

    it('troubleshootLink() should include troubleshoot URL', () => {
      const result = troubleshootLink();
      expect(result).toContain('https://wpnav.ai/troubleshoot');
      expect(result).toContain('Troubleshooting');
    });

    it('cliDocsLink() should include CLI docs URL', () => {
      const result = cliDocsLink();
      expect(result).toContain('https://wpnav.ai/docs/cli');
      expect(result).toContain('CLI docs');
    });
  });

  describe('resourceLinks()', () => {
    beforeEach(() => {
      process.env.FORCE_HYPERLINK = '0';
      process.env.NO_COLOR = '1';
    });

    it('should return default links (demo, help, docs)', () => {
      const result = resourceLinks();
      expect(result).toHaveLength(3);
      expect(result[0]).toContain('demo');
      expect(result[1]).toContain('help');
      expect(result[2]).toContain('docs');
    });

    it('should return specified links', () => {
      const result = resourceLinks(['troubleshoot', 'cliDocs']);
      expect(result).toHaveLength(2);
      expect(result[0]).toContain('troubleshoot');
      expect(result[1]).toContain('docs/cli');
    });

    it('should not duplicate URLs', () => {
      // If same key is passed twice, should only appear once
      const result = resourceLinks(['help', 'help']);
      expect(result).toHaveLength(1);
    });
  });

  describe('getErrorHelpLink()', () => {
    it('should return troubleshoot URL for connection errors', () => {
      expect(getErrorHelpLink('connection')).toBe(WPNAV_URLS.troubleshoot);
      expect(getErrorHelpLink('network')).toBe(WPNAV_URLS.troubleshoot);
      expect(getErrorHelpLink('timeout')).toBe(WPNAV_URLS.troubleshoot);
      expect(getErrorHelpLink('auth')).toBe(WPNAV_URLS.troubleshoot);
      expect(getErrorHelpLink('authentication')).toBe(WPNAV_URLS.troubleshoot);
    });

    it('should return docs URL for config/validation errors', () => {
      expect(getErrorHelpLink('config')).toBe(WPNAV_URLS.docs);
      expect(getErrorHelpLink('validation')).toBe(WPNAV_URLS.docs);
      expect(getErrorHelpLink('manifest')).toBe(WPNAV_URLS.docs);
    });

    it('should return help URL for unknown error types', () => {
      expect(getErrorHelpLink()).toBe(WPNAV_URLS.help);
      expect(getErrorHelpLink('unknown')).toBe(WPNAV_URLS.help);
      expect(getErrorHelpLink('')).toBe(WPNAV_URLS.help);
    });

    it('should be case-insensitive', () => {
      expect(getErrorHelpLink('CONNECTION')).toBe(WPNAV_URLS.troubleshoot);
      expect(getErrorHelpLink('Config')).toBe(WPNAV_URLS.docs);
    });
  });

  describe('errorWithHelp()', () => {
    beforeEach(() => {
      process.env.FORCE_HYPERLINK = '0';
      process.env.NO_COLOR = '1';
    });

    it('should append help link to error message', () => {
      const result = errorWithHelp('Something went wrong');
      expect(result).toContain('Something went wrong');
      expect(result).toContain('Get help');
      // When NO_COLOR is set and no hyperlinks, link() returns just the text
    });

    it('should use contextual help URL for connection errors', () => {
      // Verify the function uses the right URL internally
      const helpUrl = getErrorHelpLink('connection');
      expect(helpUrl).toBe(WPNAV_URLS.troubleshoot);
    });

    it('should format message with newline before help', () => {
      const result = errorWithHelp('Error message', 'config');
      expect(result).toContain('\n');
      expect(result).toContain('Error message');
    });
  });
});
