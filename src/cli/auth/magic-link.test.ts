/**
 * Magic Link Parser and Exchange Tests
 *
 * @module cli/auth/magic-link.test
 * @since v2.7.0
 */

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';

// Mock cross-fetch module - must use hoisted pattern
vi.mock('cross-fetch', () => {
  const mockFn = vi.fn();
  return {
    default: mockFn,
  };
});

import fetch from 'cross-fetch';
import {
  parseMagicLink,
  isExpired,
  buildExchangeUrl,
  exchangeToken,
  processMagicLink,
  formatErrorMessage,
  formatSuccessMessage,
  type ParsedMagicLink,
  type MagicLinkExchangeResponse,
} from './magic-link.js';

// Get the mocked fetch function
const mockFetch = fetch as Mock;

// =============================================================================
// Test Fixtures
// =============================================================================

const validMagicLink =
  'wpnav://connect?site=example.com&token=abc123def456ghi789jkl012mno345pqr&expires=9999999999';

const futureExpiry = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
const pastExpiry = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago

const mockExchangeResponse: MagicLinkExchangeResponse = {
  site_url: 'https://example.com',
  username: 'admin',
  app_password: 'xxxx xxxx xxxx xxxx xxxx xxxx',
  site_name: 'My WordPress Site',
  plugin_version: '1.5.0',
  plugin_edition: 'pro',
};

// =============================================================================
// Parser Tests
// =============================================================================

describe('Magic Link Parser', () => {
  describe('parseMagicLink', () => {
    it('parses valid magic link with all parameters', () => {
      const url = `wpnav://connect?site=example.com&token=abc123def456ghi789jkl012mno345pqr&expires=${futureExpiry}`;
      const result = parseMagicLink(url);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.link.site).toBe('example.com');
        expect(result.link.token).toBe('abc123def456ghi789jkl012mno345pqr');
        expect(result.link.expires).toBe(futureExpiry);
        expect(result.link.protocol).toBe('https');
      }
    });

    it('parses magic link with URL-encoded site', () => {
      const encodedSite = encodeURIComponent('my-site.example.com');
      const url = `wpnav://connect?site=${encodedSite}&token=abc123def456ghi789jkl012mno345pqr&expires=${futureExpiry}`;
      const result = parseMagicLink(url);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.link.site).toBe('my-site.example.com');
      }
    });

    it('parses magic link with http:// prefix in site parameter', () => {
      const url = `wpnav://connect?site=http://localhost:8080&token=abc123def456ghi789jkl012mno345pqr&expires=${futureExpiry}`;
      const result = parseMagicLink(url);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.link.site).toBe('localhost:8080');
        expect(result.link.protocol).toBe('http');
      }
    });

    it('parses magic link with https:// prefix in site parameter', () => {
      const url = `wpnav://connect?site=https://secure.example.com&token=abc123def456ghi789jkl012mno345pqr&expires=${futureExpiry}`;
      const result = parseMagicLink(url);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.link.site).toBe('secure.example.com');
        expect(result.link.protocol).toBe('https');
      }
    });

    it('handles case-insensitive protocol', () => {
      const url = `WPNAV://CONNECT?site=example.com&token=abc123def456ghi789jkl012mno345pqr&expires=${futureExpiry}`;
      const result = parseMagicLink(url);

      expect(result.success).toBe(true);
    });

    it('strips leading/trailing whitespace', () => {
      const url = `  wpnav://connect?site=example.com&token=abc123def456ghi789jkl012mno345pqr&expires=${futureExpiry}  `;
      const result = parseMagicLink(url);

      expect(result.success).toBe(true);
    });

    it('returns error for invalid protocol', () => {
      const url = `https://connect?site=example.com&token=abc123&expires=${futureExpiry}`;
      const result = parseMagicLink(url);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('INVALID_FORMAT');
      }
    });

    it('returns error for missing site parameter', () => {
      const url = `wpnav://connect?token=abc123def456ghi789jkl012mno345pqr&expires=${futureExpiry}`;
      const result = parseMagicLink(url);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('MISSING_SITE');
      }
    });

    it('returns error for missing token parameter', () => {
      const url = `wpnav://connect?site=example.com&expires=${futureExpiry}`;
      const result = parseMagicLink(url);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('MISSING_TOKEN');
      }
    });

    it('returns error for missing expires parameter', () => {
      const url = 'wpnav://connect?site=example.com&token=abc123def456ghi789jkl012mno345pqr';
      const result = parseMagicLink(url);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('MISSING_EXPIRES');
      }
    });

    it('returns error for invalid expires (not a number)', () => {
      const url =
        'wpnav://connect?site=example.com&token=abc123def456ghi789jkl012mno345pqr&expires=invalid';
      const result = parseMagicLink(url);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('INVALID_EXPIRES');
      }
    });

    it('returns error for invalid expires (too far in past)', () => {
      const veryOldExpiry = 946684800; // Year 2000
      const url = `wpnav://connect?site=example.com&token=abc123def456ghi789jkl012mno345pqr&expires=${veryOldExpiry}`;
      const result = parseMagicLink(url);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('INVALID_EXPIRES');
      }
    });

    it('returns error for short token', () => {
      const url = `wpnav://connect?site=example.com&token=short&expires=${futureExpiry}`;
      const result = parseMagicLink(url);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('INVALID_TOKEN');
      }
    });

    it('returns error for token with invalid characters', () => {
      const url = `wpnav://connect?site=example.com&token=abc123!@#$%^def456ghi789jkl012mno&expires=${futureExpiry}`;
      const result = parseMagicLink(url);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('INVALID_TOKEN');
      }
    });

    it('returns error for malformed URL', () => {
      const url = 'wpnav://not-a-valid-url';
      const result = parseMagicLink(url);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('INVALID_FORMAT');
      }
    });

    it('returns error for wrong path', () => {
      const url = `wpnav://disconnect?site=example.com&token=abc123def456ghi789jkl012mno345pqr&expires=${futureExpiry}`;
      const result = parseMagicLink(url);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('INVALID_FORMAT');
      }
    });
  });

  describe('isExpired', () => {
    it('returns false for future timestamp', () => {
      const link: ParsedMagicLink = {
        site: 'example.com',
        token: 'abc123def456ghi789jkl012mno345pqr',
        expires: futureExpiry,
        protocol: 'https',
      };

      expect(isExpired(link)).toBe(false);
    });

    it('returns true for past timestamp', () => {
      const link: ParsedMagicLink = {
        site: 'example.com',
        token: 'abc123def456ghi789jkl012mno345pqr',
        expires: pastExpiry,
        protocol: 'https',
      };

      expect(isExpired(link)).toBe(true);
    });

    it('returns true for exact current timestamp', () => {
      const now = Math.floor(Date.now() / 1000);
      const link: ParsedMagicLink = {
        site: 'example.com',
        token: 'abc123def456ghi789jkl012mno345pqr',
        expires: now,
        protocol: 'https',
      };

      expect(isExpired(link, now)).toBe(true);
    });

    it('uses custom now parameter', () => {
      const link: ParsedMagicLink = {
        site: 'example.com',
        token: 'abc123def456ghi789jkl012mno345pqr',
        expires: 1000,
        protocol: 'https',
      };

      // With now=500, expires=1000 should not be expired
      expect(isExpired(link, 500)).toBe(false);

      // With now=1500, expires=1000 should be expired
      expect(isExpired(link, 1500)).toBe(true);
    });
  });

  describe('buildExchangeUrl', () => {
    it('builds HTTPS URL correctly', () => {
      const url = buildExchangeUrl('example.com', 'https');
      expect(url).toBe('https://example.com/wp-json/wpnav/v1/auth/exchange-token');
    });

    it('builds HTTP URL correctly', () => {
      const url = buildExchangeUrl('localhost:8080', 'http');
      expect(url).toBe('http://localhost:8080/wp-json/wpnav/v1/auth/exchange-token');
    });

    it('handles site with trailing slash', () => {
      const url = buildExchangeUrl('example.com/', 'https');
      expect(url).toBe('https://example.com/wp-json/wpnav/v1/auth/exchange-token');
    });

    it('handles site with multiple trailing slashes', () => {
      const url = buildExchangeUrl('example.com///', 'https');
      expect(url).toBe('https://example.com/wp-json/wpnav/v1/auth/exchange-token');
    });
  });
});

// =============================================================================
// Exchange Tests (with mocked fetch)
// =============================================================================

describe('Magic Link Exchange', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('exchangeToken', () => {
    it('returns HTTPS_REQUIRED for non-localhost HTTP without allowInsecure', async () => {
      const link: ParsedMagicLink = {
        site: 'example.com',
        token: 'abc123def456ghi789jkl012mno345pqr',
        expires: futureExpiry,
        protocol: 'http',
      };

      const result = await exchangeToken(link, { allowInsecureHttp: false });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('HTTPS_REQUIRED');
      }
    });

    it('allows HTTP for localhost', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockExchangeResponse),
      });

      const link: ParsedMagicLink = {
        site: 'localhost:8080',
        token: 'abc123def456ghi789jkl012mno345pqr',
        expires: futureExpiry,
        protocol: 'http',
      };

      const result = await exchangeToken(link, { allowInsecureHttp: false });

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalled();
    });

    it('allows HTTP when allowInsecureHttp is true', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockExchangeResponse),
      });

      const link: ParsedMagicLink = {
        site: 'example.com',
        token: 'abc123def456ghi789jkl012mno345pqr',
        expires: futureExpiry,
        protocol: 'http',
      };

      const result = await exchangeToken(link, { allowInsecureHttp: true });

      expect(result.success).toBe(true);
    });

    it('handles successful exchange', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockExchangeResponse),
      });

      const link: ParsedMagicLink = {
        site: 'example.com',
        token: 'abc123def456ghi789jkl012mno345pqr',
        expires: futureExpiry,
        protocol: 'https',
      };

      const result = await exchangeToken(link);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.credentials.site_url).toBe('https://example.com');
        expect(result.credentials.username).toBe('admin');
        expect(result.credentials.app_password).toBe('xxxx xxxx xxxx xxxx xxxx xxxx');
        expect(result.credentials.site_name).toBe('My WordPress Site');
        expect(result.credentials.plugin_version).toBe('1.5.0');
        expect(result.credentials.plugin_edition).toBe('pro');
      }
    });

    it('handles 401 - token invalid', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        text: () =>
          Promise.resolve(
            JSON.stringify({
              code: 'wpnav_invalid_token',
              message: 'Invalid token',
            })
          ),
      });

      const link: ParsedMagicLink = {
        site: 'example.com',
        token: 'abc123def456ghi789jkl012mno345pqr',
        expires: futureExpiry,
        protocol: 'https',
      };

      const result = await exchangeToken(link);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('TOKEN_INVALID');
        expect(result.error.httpStatus).toBe(401);
      }
    });

    it('handles 401 - token already used', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        text: () =>
          Promise.resolve(
            JSON.stringify({
              code: 'wpnav_token_used',
              message: 'Token already used',
            })
          ),
      });

      const link: ParsedMagicLink = {
        site: 'example.com',
        token: 'abc123def456ghi789jkl012mno345pqr',
        expires: futureExpiry,
        protocol: 'https',
      };

      const result = await exchangeToken(link);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('TOKEN_USED');
      }
    });

    it('handles 404 - plugin not found', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        text: () => Promise.resolve('Not Found'),
      });

      const link: ParsedMagicLink = {
        site: 'example.com',
        token: 'abc123def456ghi789jkl012mno345pqr',
        expires: futureExpiry,
        protocol: 'https',
      };

      const result = await exchangeToken(link);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('PLUGIN_NOT_FOUND');
        expect(result.error.httpStatus).toBe(404);
      }
    });

    it('handles 410 - token expired', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 410,
        text: () =>
          Promise.resolve(
            JSON.stringify({
              code: 'wpnav_token_expired',
              message: 'Token expired',
            })
          ),
      });

      const link: ParsedMagicLink = {
        site: 'example.com',
        token: 'abc123def456ghi789jkl012mno345pqr',
        expires: futureExpiry,
        protocol: 'https',
      };

      const result = await exchangeToken(link);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('TOKEN_EXPIRED');
        expect(result.error.httpStatus).toBe(410);
      }
    });

    it('handles 500 server error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal Server Error'),
      });

      const link: ParsedMagicLink = {
        site: 'example.com',
        token: 'abc123def456ghi789jkl012mno345pqr',
        expires: futureExpiry,
        protocol: 'https',
      };

      const result = await exchangeToken(link);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('SERVER_ERROR');
        expect(result.error.httpStatus).toBe(500);
      }
    });

    it('handles network error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const link: ParsedMagicLink = {
        site: 'example.com',
        token: 'abc123def456ghi789jkl012mno345pqr',
        expires: futureExpiry,
        protocol: 'https',
      };

      const result = await exchangeToken(link);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NETWORK_ERROR');
      }
    });

    it('handles invalid response (missing fields)', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ site_url: 'https://example.com' }), // Missing username, app_password
      });

      const link: ParsedMagicLink = {
        site: 'example.com',
        token: 'abc123def456ghi789jkl012mno345pqr',
        expires: futureExpiry,
        protocol: 'https',
      };

      const result = await exchangeToken(link);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('INVALID_RESPONSE');
      }
    });
  });

  describe('processMagicLink', () => {
    it('returns error for invalid URL (mapped to INVALID_RESPONSE)', async () => {
      // Parse errors are mapped to INVALID_RESPONSE since processMagicLink
      // returns MagicLinkExchangeResult, not MagicLinkParseResult
      const result = await processMagicLink('https://not-a-magic-link.com');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('INVALID_RESPONSE');
        expect(result.error.message).toContain('Invalid Magic Link format');
      }
    });

    it('returns expired error for expired token', async () => {
      const expiredUrl = `wpnav://connect?site=example.com&token=abc123def456ghi789jkl012mno345pqr&expires=${pastExpiry}`;
      const result = await processMagicLink(expiredUrl);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('TOKEN_EXPIRED');
      }
    });

    it('performs full flow for valid magic link', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockExchangeResponse),
      });

      const url = `wpnav://connect?site=example.com&token=abc123def456ghi789jkl012mno345pqr&expires=${futureExpiry}`;
      const result = await processMagicLink(url);

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalled();
    });
  });
});

// =============================================================================
// Formatting Tests
// =============================================================================

describe('Magic Link Formatting', () => {
  describe('formatErrorMessage', () => {
    it('formats TOKEN_EXPIRED error with troubleshooting', () => {
      const message = formatErrorMessage({
        code: 'TOKEN_EXPIRED',
        message: 'Token expired',
      });

      expect(message).toContain('Token expired');
      expect(message).toContain('Magic Links expire after 15 minutes');
      expect(message).toContain('Generate a new link');
    });

    it('formats NETWORK_ERROR with site troubleshooting', () => {
      const message = formatErrorMessage({
        code: 'NETWORK_ERROR',
        message: 'Could not connect to example.com',
      });

      expect(message).toContain('Could not connect');
      expect(message).toContain('Check the WordPress site is accessible');
    });

    it('formats PLUGIN_NOT_FOUND with install guidance', () => {
      const message = formatErrorMessage({
        code: 'PLUGIN_NOT_FOUND',
        message: 'Plugin not found',
      });

      expect(message).toContain('Install and activate WP Navigator plugin');
      expect(message).toContain('wpnav.ai/download');
    });
  });

  describe('formatSuccessMessage', () => {
    it('formats credentials with all fields', () => {
      const message = formatSuccessMessage(mockExchangeResponse);

      expect(message).toContain('Successfully connected');
      expect(message).toContain('My WordPress Site');
      expect(message).toContain('https://example.com');
      expect(message).toContain('admin');
      expect(message).toContain('v1.5.0');
      expect(message).toContain('pro');
    });

    it('handles missing optional fields', () => {
      const minimalCredentials: MagicLinkExchangeResponse = {
        site_url: 'https://example.com',
        username: 'admin',
        app_password: 'xxxx xxxx xxxx xxxx',
      };

      const message = formatSuccessMessage(minimalCredentials);

      expect(message).toContain('Successfully connected');
      expect(message).toContain('https://example.com');
      expect(message).toContain('admin');
    });
  });
});
