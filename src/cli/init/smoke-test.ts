/**
 * Smoke Test Module
 *
 * Verifies WP Navigator connection after configuration is saved.
 * Calls the introspect endpoint and displays site summary.
 *
 * @package WP_Navigator_MCP
 * @since 2.1.0
 */

import {
  detectPlugin,
  type PluginEdition,
  type PluginDetectionResult,
} from '../../plugin-detection.js';
import { toolRegistry } from '../../tool-registry/index.js';
import { success, error as errorMessage, info, keyValue } from '../tui/components.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Smoke test result
 */
export interface SmokeTestResult {
  success: boolean;
  siteName?: string;
  siteUrl?: string;
  wordpressVersion?: string;
  pluginVersion?: string;
  pluginEdition?: PluginEdition;
  toolCount?: number;
  error?: SmokeTestError;
}

/**
 * Smoke test error with remediation guidance
 */
export interface SmokeTestError {
  code:
    | 'AUTH_FAILED'
    | 'NOT_FOUND'
    | 'NETWORK_ERROR'
    | 'SSL_ERROR'
    | 'INVALID_RESPONSE'
    | 'UNKNOWN';
  message: string;
  remediation: string;
}

// =============================================================================
// Smoke Test Implementation
// =============================================================================

/**
 * Run smoke test by calling the introspect endpoint
 *
 * @param siteUrl - WordPress site URL
 * @param username - WordPress username
 * @param password - Application password
 * @param timeoutMs - Request timeout (default: 15000)
 * @returns Smoke test result with site info or error
 */
export async function runSmokeTest(
  siteUrl: string,
  username: string,
  password: string,
  timeoutMs: number = 15000
): Promise<SmokeTestResult> {
  try {
    // Use detectPlugin which calls the introspect endpoint
    const result: PluginDetectionResult = await detectPlugin(
      siteUrl,
      username,
      password,
      timeoutMs
    );

    if (!result.detected) {
      return {
        success: false,
        error: mapDetectionError(result),
      };
    }

    // Get tool count from registry
    const toolCount = toolRegistry.getAllDefinitions().length;

    // Extract WordPress version from full response
    const wpVersion = result.fullResponse?.site?.version || 'Unknown';

    return {
      success: true,
      siteName: result.siteName || result.fullResponse?.site?.name || 'Unknown',
      siteUrl: result.siteUrl || result.fullResponse?.site?.url || siteUrl,
      wordpressVersion: wpVersion,
      pluginVersion: result.version,
      pluginEdition: result.edition,
      toolCount,
    };
  } catch (err) {
    return {
      success: false,
      error: parseError(err),
    };
  }
}

/**
 * Map detection result error to smoke test error
 */
function mapDetectionError(result: PluginDetectionResult): SmokeTestError {
  const errorCode = result.errorCode || 'UNKNOWN';
  const message = result.error || 'Unknown error occurred';

  switch (errorCode) {
    case 'AUTH_FAILED':
      return {
        code: 'AUTH_FAILED',
        message,
        remediation:
          'Application password invalid or expired.\n' +
          '\n' +
          'How to fix:\n' +
          '1. Go to WordPress Admin → Users → Profile\n' +
          '2. Scroll to "Application Passwords" section\n' +
          '3. Revoke existing "wp-navigator" password if present\n' +
          '4. Generate a new password and update .wpnav.env',
      };

    case 'NOT_FOUND':
      return {
        code: 'NOT_FOUND',
        message,
        remediation:
          'WP Navigator plugin not found or not activated.\n' +
          '\n' +
          'How to fix:\n' +
          '1. Go to WordPress Admin → Plugins\n' +
          '2. Install and activate "WP Navigator" (Free or Pro)\n' +
          '3. Download from: https://wpnav.ai/download',
      };

    case 'NETWORK_ERROR':
      // Check for SSL-specific errors
      if (message.includes('certificate') || message.includes('SSL')) {
        return {
          code: 'SSL_ERROR',
          message: 'SSL certificate error',
          remediation:
            'SSL certificate validation failed.\n' +
            '\n' +
            'For local development:\n' +
            '• Use http:// instead of https://\n' +
            '• Or set ALLOW_INSECURE_HTTP=1 in .wpnav.env\n' +
            '\n' +
            'For production:\n' +
            '• Ensure your SSL certificate is valid\n' +
            '• Check certificate chain is complete',
        };
      }
      return {
        code: 'NETWORK_ERROR',
        message,
        remediation:
          'Cannot reach the WordPress site.\n' +
          '\n' +
          'How to fix:\n' +
          '1. Verify the URL is correct\n' +
          '2. Check the site is accessible in your browser\n' +
          '3. Check for firewall or VPN issues\n' +
          '4. For local dev, ensure the server is running',
      };

    case 'INVALID_RESPONSE':
      return {
        code: 'INVALID_RESPONSE',
        message,
        remediation:
          'WordPress returned an unexpected response.\n' +
          '\n' +
          'How to fix:\n' +
          '1. Check WP Navigator plugin is activated\n' +
          '2. Verify REST API is not disabled\n' +
          '3. Check for plugin conflicts\n' +
          '4. Review WordPress debug.log for errors',
      };

    default:
      return {
        code: 'UNKNOWN',
        message,
        remediation:
          'An unexpected error occurred.\n' + '\n' + 'Run `wpnav doctor` for detailed diagnostics.',
      };
  }
}

/**
 * Parse raw error into SmokeTestError
 */
function parseError(err: unknown): SmokeTestError {
  const message = err instanceof Error ? err.message : String(err);

  // Check for specific error patterns
  if (message.includes('401') || message.includes('Unauthorized')) {
    return mapDetectionError({
      detected: false,
      errorCode: 'AUTH_FAILED',
      error: message,
    });
  }

  if (message.includes('404') || message.includes('Not Found')) {
    return mapDetectionError({
      detected: false,
      errorCode: 'NOT_FOUND',
      error: message,
    });
  }

  if (message.includes('certificate') || message.includes('SSL') || message.includes('CERT')) {
    return {
      code: 'SSL_ERROR',
      message: 'SSL certificate error',
      remediation:
        'SSL certificate validation failed.\n' +
        '\n' +
        'For local development:\n' +
        '• Use http:// instead of https://\n' +
        '• Or set ALLOW_INSECURE_HTTP=1 in .wpnav.env',
    };
  }

  if (
    message.includes('ECONNREFUSED') ||
    message.includes('ENOTFOUND') ||
    message.includes('timeout') ||
    message.includes('getaddrinfo')
  ) {
    return mapDetectionError({
      detected: false,
      errorCode: 'NETWORK_ERROR',
      error: message,
    });
  }

  return {
    code: 'UNKNOWN',
    message,
    remediation: 'Run `wpnav doctor` for detailed diagnostics.',
  };
}

// =============================================================================
// Display Functions
// =============================================================================

/**
 * Display smoke test result in TUI format
 *
 * Success format:
 * ```
 * ✓ Connection verified!
 *   Site: example.com
 *   WordPress: 6.4.2
 *   WP Navigator: Pro v1.5.0
 *   Tools available: 65
 * ```
 *
 * @param result - Smoke test result
 */
export function displaySmokeTestResult(result: SmokeTestResult): void {
  if (result.success) {
    success('Connection verified!');
    if (result.siteName) {
      keyValue('Site', result.siteName);
    }
    if (result.wordpressVersion && result.wordpressVersion !== 'Unknown') {
      keyValue('WordPress', result.wordpressVersion);
    }
    if (result.pluginVersion && result.pluginEdition) {
      const editionLabel = result.pluginEdition === 'pro' ? 'Pro' : 'Free';
      keyValue('WP Navigator', `${editionLabel} v${result.pluginVersion}`);
    }
    if (result.toolCount) {
      keyValue('Tools available', String(result.toolCount));
    }
  } else if (result.error) {
    errorMessage(`Connection failed: ${result.error.message}`);
    console.error('');
    info('How to fix:');
    // Split remediation into lines and display each
    const lines = result.error.remediation.split('\n');
    for (const line of lines) {
      console.error(`  ${line}`);
    }
  }
}
