/**
 * Magic Link Authentication
 *
 * Handles parsing and exchanging Magic Link tokens for WordPress credentials.
 * Magic Links enable zero-CLI setup: users copy a link from WordPress admin
 * and paste it into `wpnav connect` to authenticate automatically.
 *
 * @module cli/auth/magic-link
 * @since v2.7.0
 */

import fetch from 'cross-fetch';

// =============================================================================
// Types
// =============================================================================

/**
 * Parsed Magic Link structure
 */
export interface ParsedMagicLink {
  /** Site domain or URL (e.g., "example.com" or "https://example.com") */
  site: string;
  /** Cryptographically secure token (32+ chars) */
  token: string;
  /** Unix timestamp (seconds) when token expires */
  expires: number;
  /** Protocol to use for exchange (inferred from site or defaults to https) */
  protocol: 'https' | 'http';
}

/**
 * Result of parsing a Magic Link URL
 */
export type MagicLinkParseResult =
  | { success: true; link: ParsedMagicLink }
  | { success: false; error: MagicLinkError };

/**
 * Error codes for Magic Link parsing
 */
export type MagicLinkErrorCode =
  | 'INVALID_FORMAT' // Not a valid wpnav:// URL
  | 'MISSING_SITE' // site parameter missing
  | 'MISSING_TOKEN' // token parameter missing
  | 'MISSING_EXPIRES' // expires parameter missing
  | 'INVALID_EXPIRES' // expires not a valid timestamp
  | 'TOKEN_EXPIRED' // Token has already expired (client-side check)
  | 'INVALID_SITE' // Site URL malformed
  | 'INVALID_TOKEN'; // Token format invalid

/**
 * Magic Link parse error
 */
export interface MagicLinkError {
  code: MagicLinkErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Response from plugin's magic-link/exchange endpoint
 */
export interface MagicLinkExchangeResponse {
  /** Full site URL with protocol */
  site_url: string;
  /** WordPress username */
  username: string;
  /** Application Password (formatted with spaces) */
  app_password: string;
  /** WordPress site name (optional) */
  site_name?: string;
  /** Plugin version (optional) */
  plugin_version?: string;
  /** Plugin edition (optional) */
  plugin_edition?: 'free' | 'pro';
}

/**
 * Result of exchanging a Magic Link token
 */
export type MagicLinkExchangeResult =
  | { success: true; credentials: MagicLinkExchangeResponse }
  | { success: false; error: MagicLinkExchangeError };

/**
 * Error codes for Magic Link exchange
 */
export type MagicLinkExchangeErrorCode =
  | 'NETWORK_ERROR' // Could not connect to site
  | 'PLUGIN_NOT_FOUND' // WP Navigator plugin not installed (404)
  | 'TOKEN_INVALID' // Token doesn't exist (401)
  | 'TOKEN_EXPIRED' // Token expired on server (410)
  | 'TOKEN_USED' // Token already redeemed (401)
  | 'HTTPS_REQUIRED' // Site requires HTTPS for exchange
  | 'SERVER_ERROR' // Unexpected server error (5xx)
  | 'INVALID_RESPONSE'; // Response not in expected format

/**
 * Magic Link exchange error
 */
export interface MagicLinkExchangeError {
  code: MagicLinkExchangeErrorCode;
  message: string;
  httpStatus?: number;
  details?: Record<string, unknown>;
}

/**
 * Options for token exchange
 */
export interface ExchangeOptions {
  /** Request timeout in milliseconds (default: 15000) */
  timeoutMs?: number;
  /** Allow HTTP for localhost development (default: false) */
  allowInsecureHttp?: boolean;
}

// =============================================================================
// Constants
// =============================================================================

/** Magic Link URL protocol */
const MAGIC_LINK_PROTOCOL = 'wpnav:';

/** Magic Link URL path */
const MAGIC_LINK_PATH = 'connect';

/** Minimum token length */
const MIN_TOKEN_LENGTH = 32;

/** Default exchange timeout */
const DEFAULT_TIMEOUT_MS = 15000;

/** Plugin exchange endpoint path (matches wp-navigator-pro v1.9.0+) */
const EXCHANGE_ENDPOINT = '/wp-json/wpnav/v1/auth/exchange-token';

/** Localhost patterns for allowing HTTP */
const LOCALHOST_PATTERNS = [
  'localhost',
  '127.0.0.1',
  '::1',
  /\.local$/,
  /\.test$/,
  /\.dev$/,
  /\.ddev\.site$/,
  /\.lndo\.site$/,
  /\.localwp\.internal$/,
];

// =============================================================================
// Parser Functions
// =============================================================================

/**
 * Parse a Magic Link URL into its components
 *
 * @param url - The full magic link URL (wpnav://connect?...)
 * @returns Parse result with either parsed link or error
 *
 * @example
 * ```ts
 * const result = parseMagicLink('wpnav://connect?site=example.com&token=abc123&expires=1705312800');
 * if (result.success) {
 *   console.log(result.link.site); // 'example.com'
 * }
 * ```
 */
export function parseMagicLink(url: string): MagicLinkParseResult {
  // Normalize and trim
  const trimmed = url.trim();

  // Check protocol (case-insensitive)
  const lowerUrl = trimmed.toLowerCase();
  if (!lowerUrl.startsWith(`${MAGIC_LINK_PROTOCOL}//`)) {
    return {
      success: false,
      error: {
        code: 'INVALID_FORMAT',
        message: `Invalid Magic Link format. Expected URL starting with "${MAGIC_LINK_PROTOCOL}//"`,
        details: { received: trimmed.substring(0, 50) },
      },
    };
  }

  // Parse URL (replace wpnav: with https: for URL parsing)
  // Note: wpnav://connect?... → https://connect?... where "connect" becomes the hostname
  let parsed: URL;
  try {
    const normalizedUrl = trimmed.replace(/^wpnav:/i, 'https:');
    parsed = new URL(normalizedUrl);
  } catch {
    return {
      success: false,
      error: {
        code: 'INVALID_FORMAT',
        message: 'Invalid Magic Link URL format',
        details: { received: trimmed.substring(0, 50) },
      },
    };
  }

  // Check hostname is 'connect' (wpnav://connect → hostname="connect")
  if (parsed.hostname !== MAGIC_LINK_PATH) {
    return {
      success: false,
      error: {
        code: 'INVALID_FORMAT',
        message: `Invalid Magic Link format. Expected "wpnav://${MAGIC_LINK_PATH}?..."`,
        details: { received: parsed.hostname },
      },
    };
  }

  // Extract parameters
  const params = parsed.searchParams;

  // Validate site
  const site = params.get('site');
  if (!site) {
    return {
      success: false,
      error: {
        code: 'MISSING_SITE',
        message: 'Magic Link is missing the "site" parameter',
      },
    };
  }

  // Validate and parse site URL
  const siteResult = parseSiteParameter(site);
  if (!siteResult.success) {
    return {
      success: false,
      error: {
        code: 'INVALID_SITE',
        message: `Invalid site URL: ${siteResult.error}`,
        details: { site },
      },
    };
  }

  // Validate token
  const token = params.get('token');
  if (!token) {
    return {
      success: false,
      error: {
        code: 'MISSING_TOKEN',
        message: 'Magic Link is missing the "token" parameter',
      },
    };
  }

  // Validate token format (alphanumeric, min length)
  if (token.length < MIN_TOKEN_LENGTH) {
    return {
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: `Token too short. Expected at least ${MIN_TOKEN_LENGTH} characters`,
        details: { tokenLength: token.length },
      },
    };
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(token)) {
    return {
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message:
          'Token contains invalid characters. Expected alphanumeric characters, underscores, or hyphens only',
      },
    };
  }

  // Validate expires
  const expiresStr = params.get('expires');
  if (!expiresStr) {
    return {
      success: false,
      error: {
        code: 'MISSING_EXPIRES',
        message: 'Magic Link is missing the "expires" parameter',
      },
    };
  }

  const expires = parseInt(expiresStr, 10);
  if (!Number.isFinite(expires) || expires <= 0) {
    return {
      success: false,
      error: {
        code: 'INVALID_EXPIRES',
        message: 'Invalid expires timestamp',
        details: { expires: expiresStr },
      },
    };
  }

  // Validate timestamp is reasonable (not too far in past or future)
  const now = Math.floor(Date.now() / 1000);
  const oneYearAgo = now - 365 * 24 * 60 * 60;
  const oneYearFromNow = now + 365 * 24 * 60 * 60;

  if (expires < oneYearAgo || expires > oneYearFromNow) {
    return {
      success: false,
      error: {
        code: 'INVALID_EXPIRES',
        message: 'Expires timestamp is outside reasonable range',
        details: { expires, now },
      },
    };
  }

  return {
    success: true,
    link: {
      site: siteResult.site,
      token,
      expires,
      protocol: siteResult.protocol,
    },
  };
}

/**
 * Parse and normalize site parameter
 */
function parseSiteParameter(site: string):
  | {
      success: true;
      site: string;
      protocol: 'http' | 'https';
    }
  | {
      success: false;
      error: string;
    } {
  // Decode URL-encoded characters
  const decoded = decodeURIComponent(site);

  // Determine protocol and clean site
  let protocol: 'http' | 'https' = 'https';
  let cleanSite = decoded;

  if (decoded.startsWith('http://')) {
    protocol = 'http';
    cleanSite = decoded.slice(7);
  } else if (decoded.startsWith('https://')) {
    protocol = 'https';
    cleanSite = decoded.slice(8);
  }

  // Remove trailing slashes and paths
  cleanSite = cleanSite.split('/')[0];

  // Validate hostname format
  if (!cleanSite || cleanSite.length < 3) {
    return { success: false, error: 'Site hostname too short' };
  }

  // Basic hostname validation (allow localhost, IP addresses, and domain names)
  const hostnamePattern =
    /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*$/;
  const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/;
  const localhostPattern = /^localhost(:\d+)?$/;

  // Extract hostname without port
  const [hostname] = cleanSite.split(':');

  if (
    !hostnamePattern.test(hostname) &&
    !ipPattern.test(hostname) &&
    !localhostPattern.test(hostname)
  ) {
    return { success: false, error: 'Invalid hostname format' };
  }

  return { success: true, site: cleanSite, protocol };
}

/**
 * Check if a Magic Link has expired (client-side check)
 *
 * @param link - Parsed magic link
 * @param now - Current time in seconds (default: Date.now() / 1000)
 * @returns true if the token has expired
 */
export function isExpired(link: ParsedMagicLink, now?: number): boolean {
  const currentTime = now ?? Math.floor(Date.now() / 1000);
  return currentTime >= link.expires;
}

/**
 * Build the exchange endpoint URL from site info
 *
 * @param site - Site domain (e.g., "example.com")
 * @param protocol - HTTP or HTTPS
 * @returns Full exchange endpoint URL
 */
export function buildExchangeUrl(site: string, protocol: 'http' | 'https'): string {
  // Remove any trailing slashes from site
  const cleanSite = site.replace(/\/+$/, '');
  return `${protocol}://${cleanSite}${EXCHANGE_ENDPOINT}`;
}

/**
 * Check if a site is localhost (allows HTTP)
 */
function isLocalhost(site: string): boolean {
  const [hostname] = site.split(':');
  for (const pattern of LOCALHOST_PATTERNS) {
    if (typeof pattern === 'string') {
      if (hostname === pattern) return true;
    } else {
      if (pattern.test(hostname)) return true;
    }
  }
  return false;
}

// =============================================================================
// Exchange Functions
// =============================================================================

/**
 * Exchange a Magic Link token for WordPress credentials
 *
 * @param link - Parsed magic link
 * @param options - Exchange options (timeout, allowInsecure)
 * @returns Exchange result with credentials or error
 *
 * @example
 * ```ts
 * const result = await exchangeToken(parsedLink, { timeoutMs: 10000 });
 * if (result.success) {
 *   console.log(result.credentials.username);
 * }
 * ```
 */
export async function exchangeToken(
  link: ParsedMagicLink,
  options: ExchangeOptions = {}
): Promise<MagicLinkExchangeResult> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, allowInsecureHttp = false } = options;

  // Check HTTPS requirement
  if (link.protocol === 'http' && !allowInsecureHttp && !isLocalhost(link.site)) {
    return {
      success: false,
      error: {
        code: 'HTTPS_REQUIRED',
        message: `HTTPS is required for non-localhost sites. Use --local flag for local development.`,
        details: { site: link.site, protocol: link.protocol },
      },
    };
  }

  // Build exchange URL
  const url = buildExchangeUrl(link.site, link.protocol);

  // Set up abort controller for timeout
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ token: link.token }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    // Handle success
    if (response.ok) {
      const data = await response.json();

      // Validate response structure
      if (!data.site_url || !data.username || !data.app_password) {
        return {
          success: false,
          error: {
            code: 'INVALID_RESPONSE',
            message: 'Invalid response from plugin: missing required fields',
            details: { receivedKeys: Object.keys(data) },
          },
        };
      }

      return {
        success: true,
        credentials: {
          site_url: data.site_url,
          username: data.username,
          app_password: data.app_password,
          site_name: data.site_name,
          plugin_version: data.plugin_version,
          plugin_edition: data.plugin_edition,
        },
      };
    }

    // Handle error responses
    const errorBody = await response.text();
    let errorData: { code?: string; message?: string } = {};

    try {
      errorData = JSON.parse(errorBody);
    } catch {
      // Non-JSON error response
    }

    // Map HTTP status to error code
    switch (response.status) {
      case 401:
        // Check for specific error codes from plugin
        if (errorData.code === 'wpnav_token_used') {
          return {
            success: false,
            error: {
              code: 'TOKEN_USED',
              message:
                'This Magic Link has already been used. Generate a new one from WordPress admin.',
              httpStatus: 401,
            },
          };
        }
        return {
          success: false,
          error: {
            code: 'TOKEN_INVALID',
            message:
              errorData.message || 'Invalid token. Generate a new Magic Link from WordPress admin.',
            httpStatus: 401,
          },
        };

      case 404:
        return {
          success: false,
          error: {
            code: 'PLUGIN_NOT_FOUND',
            message:
              'WP Navigator plugin not found. Install and activate it on your WordPress site.',
            httpStatus: 404,
            details: { url },
          },
        };

      case 410:
        return {
          success: false,
          error: {
            code: 'TOKEN_EXPIRED',
            message: 'This Magic Link has expired. Generate a new one from WordPress admin.',
            httpStatus: 410,
          },
        };

      default:
        if (response.status >= 500) {
          return {
            success: false,
            error: {
              code: 'SERVER_ERROR',
              message:
                errorData.message ||
                `Server error (${response.status}). Check WordPress site is accessible.`,
              httpStatus: response.status,
            },
          };
        }

        return {
          success: false,
          error: {
            code: 'SERVER_ERROR',
            message: errorData.message || `Unexpected error (${response.status})`,
            httpStatus: response.status,
            details: { body: errorBody.substring(0, 200) },
          },
        };
    }
  } catch (err: unknown) {
    clearTimeout(timeout);

    if (err instanceof Error) {
      // Handle abort (timeout)
      if (err.name === 'AbortError') {
        return {
          success: false,
          error: {
            code: 'NETWORK_ERROR',
            message: `Request timed out after ${timeoutMs}ms. Check the site is accessible.`,
            details: { url, timeoutMs },
          },
        };
      }

      // Handle network errors
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: `Could not connect to ${link.site}. Check the URL and try again.`,
          details: { url, error: err.message },
        },
      };
    }

    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: `Could not connect to ${link.site}. Check the URL and try again.`,
        details: { url },
      },
    };
  }
}

/**
 * Full Magic Link flow: parse, validate expiry, exchange
 *
 * @param url - Raw magic link URL
 * @param options - Exchange options
 * @returns Exchange result with credentials or error
 *
 * @example
 * ```ts
 * const result = await processMagicLink('wpnav://connect?site=...&token=...&expires=...');
 * if (result.success) {
 *   console.log(`Connected to ${result.credentials.site_name}`);
 * }
 * ```
 */
export async function processMagicLink(
  url: string,
  options: ExchangeOptions = {}
): Promise<MagicLinkExchangeResult> {
  // Step 1: Parse the magic link URL
  const parseResult = parseMagicLink(url);
  if (!parseResult.success) {
    // Map parse errors to exchange error codes
    // TOKEN_EXPIRED is valid for both parse and exchange
    const code = parseResult.error.code === 'TOKEN_EXPIRED' ? 'TOKEN_EXPIRED' : 'INVALID_RESPONSE'; // Other parse errors map to INVALID_RESPONSE

    return {
      success: false,
      error: {
        code: code as MagicLinkExchangeErrorCode,
        message: parseResult.error.message,
        details: parseResult.error.details,
      },
    };
  }

  const link = parseResult.link;

  // Step 2: Check expiry (client-side)
  if (isExpired(link)) {
    const expiresDate = new Date(link.expires * 1000).toLocaleString();
    return {
      success: false,
      error: {
        code: 'TOKEN_EXPIRED',
        message: `This Magic Link expired on ${expiresDate}. Generate a new one from WordPress admin.`,
        details: { expires: link.expires },
      },
    };
  }

  // Step 3: Exchange token for credentials
  return exchangeToken(link, options);
}

// =============================================================================
// Formatting Functions
// =============================================================================

/**
 * Format error message for TUI display
 *
 * @param error - Magic link error (parse or exchange)
 * @returns Formatted error message with troubleshooting tips
 */
export function formatErrorMessage(error: MagicLinkError | MagicLinkExchangeError): string {
  const lines: string[] = [];

  // Add main error message
  lines.push(`Error: ${error.message}`);
  lines.push('');

  // Add troubleshooting based on error code
  lines.push('Troubleshooting:');

  switch (error.code) {
    case 'INVALID_FORMAT':
    case 'MISSING_SITE':
    case 'MISSING_TOKEN':
    case 'MISSING_EXPIRES':
    case 'INVALID_EXPIRES':
    case 'INVALID_TOKEN':
      lines.push('  * Check you copied the complete Magic Link URL');
      lines.push('  * The URL should start with "wpnav://connect?"');
      lines.push('  * Generate a fresh link from WordPress admin');
      break;

    case 'TOKEN_EXPIRED':
      lines.push('  * Magic Links expire after 15 minutes');
      lines.push('  * Generate a new link from WordPress admin:');
      lines.push('    WP Navigator > Settings > "Connect AI Assistant"');
      break;

    case 'TOKEN_USED':
      lines.push('  * Magic Links can only be used once for security');
      lines.push('  * Generate a new link from WordPress admin:');
      lines.push('    WP Navigator > Settings > "Connect AI Assistant"');
      break;

    case 'TOKEN_INVALID':
      lines.push('  * The token may have been revoked or never existed');
      lines.push('  * Generate a new link from WordPress admin');
      break;

    case 'NETWORK_ERROR':
      lines.push('  * Check the WordPress site is accessible');
      lines.push('  * Verify firewall/security plugins allow REST API access');
      lines.push('  * Try accessing the site in a browser first');
      break;

    case 'PLUGIN_NOT_FOUND':
      lines.push('  * Install and activate WP Navigator plugin on WordPress');
      lines.push('  * Visit: https://wpnav.ai/download');
      lines.push('  * Then generate a new Magic Link');
      break;

    case 'HTTPS_REQUIRED':
      lines.push('  * HTTPS is required for security');
      lines.push('  * For local development, use: wpnav connect --local <url>');
      break;

    case 'SERVER_ERROR':
      lines.push('  * Check WordPress debug logs for errors');
      lines.push('  * Verify the plugin is activated and up to date');
      lines.push('  * Try again in a few minutes');
      break;

    default:
      lines.push('  * Visit: https://wpnav.ai/docs/magic-link');
      lines.push('  * For help: https://wpnav.ai/help');
  }

  lines.push('');
  lines.push('Need help? https://wpnav.ai/help');

  return lines.join('\n');
}

/**
 * Format success message for TUI display
 *
 * @param credentials - Exchange response credentials
 * @returns Formatted success message
 */
export function formatSuccessMessage(credentials: MagicLinkExchangeResponse): string {
  const lines: string[] = [];

  lines.push('Successfully connected!');
  lines.push('');
  lines.push(`Site:     ${credentials.site_name || credentials.site_url}`);
  lines.push(`URL:      ${credentials.site_url}`);
  lines.push(`Username: ${credentials.username}`);

  if (credentials.plugin_version) {
    const edition = credentials.plugin_edition ? ` (${credentials.plugin_edition})` : '';
    lines.push(`Plugin:   v${credentials.plugin_version}${edition}`);
  }

  return lines.join('\n');
}
