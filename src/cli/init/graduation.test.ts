/**
 * Tests for Graduation Prompt
 *
 * @package WP_Navigator_MCP
 * @since 2.1.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  generateGraduationPrompts,
  formatPromptForTerminal,
  isClipboardAvailable,
  type GraduationContext,
} from './graduation.js';

describe('Graduation Prompt', () => {
  describe('generateGraduationPrompts', () => {
    it('generates prompt with site URL hostname', () => {
      const context: GraduationContext = {
        siteUrl: 'https://example.com',
      };

      const prompts = generateGraduationPrompts(context);

      expect(prompts.primary).toContain('example.com');
      expect(prompts.primary).toContain('overview');
      expect(prompts.primary).toContain('5 most recent posts');
    });

    it('uses siteName when provided', () => {
      const context: GraduationContext = {
        siteUrl: 'https://example.com',
        siteName: 'My Awesome Blog',
      };

      const prompts = generateGraduationPrompts(context);

      expect(prompts.primary).toContain('My Awesome Blog');
      expect(prompts.primary).not.toContain('example.com');
    });

    it('generates alternative prompts', () => {
      const context: GraduationContext = {
        siteUrl: 'https://example.com',
      };

      const prompts = generateGraduationPrompts(context);

      expect(prompts.alternatives).toHaveLength(3);
      expect(prompts.alternatives[0]).toContain('SEO');
      expect(prompts.alternatives[1]).toContain('plugins');
      expect(prompts.alternatives[2]).toContain('30 days');
    });

    it('adds pro-only prompt for pro edition', () => {
      const context: GraduationContext = {
        siteUrl: 'https://example.com',
        pluginEdition: 'pro',
      };

      const prompts = generateGraduationPrompts(context);

      expect(prompts.alternatives).toHaveLength(4);
      expect(prompts.alternatives[3]).toContain('content performance');
    });

    it('does not add pro prompt for free edition', () => {
      const context: GraduationContext = {
        siteUrl: 'https://example.com',
        pluginEdition: 'free',
      };

      const prompts = generateGraduationPrompts(context);

      expect(prompts.alternatives).toHaveLength(3);
    });

    it('handles URLs with paths', () => {
      const context: GraduationContext = {
        siteUrl: 'https://example.com/wordpress',
      };

      const prompts = generateGraduationPrompts(context);

      expect(prompts.primary).toContain('example.com');
    });

    it('handles localhost URLs', () => {
      const context: GraduationContext = {
        siteUrl: 'http://localhost:8080',
      };

      const prompts = generateGraduationPrompts(context);

      expect(prompts.primary).toContain('localhost');
    });

    it('handles invalid URLs gracefully', () => {
      const context: GraduationContext = {
        siteUrl: 'not-a-valid-url',
      };

      const prompts = generateGraduationPrompts(context);

      expect(prompts.primary).toContain('not-a-valid-url');
    });
  });

  describe('formatPromptForTerminal', () => {
    it('returns short text unchanged', () => {
      const text = 'Short prompt';
      const formatted = formatPromptForTerminal(text, 60);

      expect(formatted).toBe('Short prompt');
    });

    it('wraps long text at word boundaries', () => {
      const text =
        'This is a very long prompt that should be wrapped across multiple lines for better terminal display';
      const formatted = formatPromptForTerminal(text, 30);

      const lines = formatted.split('\n');
      expect(lines.length).toBeGreaterThan(1);
      lines.forEach((line) => {
        expect(line.length).toBeLessThanOrEqual(30);
      });
    });

    it('handles single long word', () => {
      const text = 'supercalifragilisticexpialidocious';
      const formatted = formatPromptForTerminal(text, 20);

      // Single word should not be broken
      expect(formatted).toBe(text);
    });

    it('preserves spaces between words', () => {
      const text = 'word1 word2 word3';
      const formatted = formatPromptForTerminal(text, 100);

      expect(formatted).toBe('word1 word2 word3');
    });

    it('uses default width of 60', () => {
      const text = 'This is a prompt that will be wrapped at the default width of sixty characters';
      const formatted = formatPromptForTerminal(text);

      const lines = formatted.split('\n');
      lines.forEach((line) => {
        expect(line.length).toBeLessThanOrEqual(60);
      });
    });
  });

  describe('isClipboardAvailable', () => {
    const originalPlatform = process.platform;

    afterEach(() => {
      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('returns true for darwin', () => {
      Object.defineProperty(process, 'platform', { value: 'darwin' });
      expect(isClipboardAvailable()).toBe(true);
    });

    it('returns true for linux', () => {
      Object.defineProperty(process, 'platform', { value: 'linux' });
      expect(isClipboardAvailable()).toBe(true);
    });

    it('returns true for win32', () => {
      Object.defineProperty(process, 'platform', { value: 'win32' });
      expect(isClipboardAvailable()).toBe(true);
    });

    it('returns false for unsupported platforms', () => {
      Object.defineProperty(process, 'platform', { value: 'freebsd' });
      expect(isClipboardAvailable()).toBe(false);
    });
  });
});
