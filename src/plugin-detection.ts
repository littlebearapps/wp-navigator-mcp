/**
 * Plugin Detection Module
 *
 * Detects WP Navigator plugin edition (Free/Pro), version, and compatibility.
 * Used during init wizard and status commands.
 *
 * @package WP_Navigator_MCP
 * @since 1.2.0
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// =============================================================================
// Types
// =============================================================================

/**
 * Plugin edition: "free" or "pro"
 */
export type PluginEdition = 'free' | 'pro';

/**
 * MCP compatibility info from introspect endpoint
 */
export interface McpCompat {
  min_version: string;
  max_version: string;
  tested_up_to: string;
}

/**
 * Plugin info from introspect endpoint
 */
export interface PluginInfo {
  name: string;
  version: string;
  edition: PluginEdition;
  mcp_compat?: McpCompat;
}

/**
 * Full introspect response from WP Navigator plugin
 */
export interface IntrospectResponse {
  plugin: PluginInfo;
  site?: {
    name?: string;
    url?: string;
    version?: string;
  };
  policy?: {
    categories?: Record<string, boolean>;
    [key: string]: unknown;
  };
  capabilities?: string[];
  environment?: string;
}

/**
 * Result of plugin detection
 */
export interface PluginDetectionResult {
  detected: boolean;
  edition?: PluginEdition;
  version?: string;
  siteName?: string;
  siteUrl?: string;
  mcpCompat?: McpCompat;
  capabilities?: string[];
  policy?: Record<string, boolean>;
  error?: string;
  errorCode?: 'NOT_FOUND' | 'AUTH_FAILED' | 'NETWORK_ERROR' | 'INVALID_RESPONSE' | 'OUTDATED';
  fullResponse?: IntrospectResponse;
}

/**
 * Compatibility check result
 */
export interface CompatibilityResult {
  compatible: boolean;
  mcpVersion: string;
  pluginVersion: string;
  message: string;
  warning?: string;
}

// =============================================================================
// Version Utilities
// =============================================================================

/**
 * Get MCP package version from package.json
 */
export function getMcpVersion(): string {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const packagePath = join(__dirname, '..', 'package.json');
    const packageJson = JSON.parse(readFileSync(packagePath, 'utf-8'));
    return packageJson.version || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

/**
 * Compare semver versions.
 * Returns: -1 if a < b, 0 if a == b, 1 if a > b
 */
export function compareSemver(a: string, b: string): number {
  const partsA = a.split('.').map(Number);
  const partsB = b.split('.').map(Number);

  for (let i = 0; i < 3; i++) {
    const partA = partsA[i] || 0;
    const partB = partsB[i] || 0;
    if (partA < partB) return -1;
    if (partA > partB) return 1;
  }
  return 0;
}

// =============================================================================
// Plugin Detection
// =============================================================================

/**
 * Detect WP Navigator plugin via introspect endpoint
 *
 * @param siteUrl - WordPress site URL (e.g., https://example.com)
 * @param username - WordPress username
 * @param password - WordPress application password
 * @param timeoutMs - Request timeout in milliseconds (default: 15000)
 * @returns Plugin detection result
 */
export async function detectPlugin(
  siteUrl: string,
  username: string,
  password: string,
  timeoutMs: number = 15000
): Promise<PluginDetectionResult> {
  // Normalize site URL
  const normalizedUrl = siteUrl.replace(/\/+$/, '');
  const introspectUrl = `${normalizedUrl}/wp-json/wpnav/v1/introspect`;

  const auth = Buffer.from(`${username}:${password}`).toString('base64');
  const headers = {
    Authorization: `Basic ${auth}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  try {
    const response = await fetch(introspectUrl, {
      headers,
      signal: AbortSignal.timeout(timeoutMs),
    });

    // Handle HTTP errors
    if (response.status === 401) {
      return {
        detected: false,
        error: 'Authentication failed. Check your username and Application Password.',
        errorCode: 'AUTH_FAILED',
      };
    }

    if (response.status === 403) {
      return {
        detected: false,
        error: 'Access denied. Ensure the user has Administrator permissions.',
        errorCode: 'AUTH_FAILED',
      };
    }

    if (response.status === 404) {
      return {
        detected: false,
        error: 'WP Navigator plugin not found. Install and activate the plugin first.',
        errorCode: 'NOT_FOUND',
      };
    }

    if (!response.ok) {
      return {
        detected: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
        errorCode: 'NETWORK_ERROR',
      };
    }

    // Parse response
    const contentType = response.headers.get('content-type');
    if (!contentType?.includes('application/json')) {
      return {
        detected: false,
        error: 'WordPress returned HTML instead of JSON. Check plugin is activated and REST API is accessible.',
        errorCode: 'INVALID_RESPONSE',
      };
    }

    const data: IntrospectResponse = await response.json();

    // Validate required fields
    if (!data.plugin || !data.plugin.version) {
      return {
        detected: false,
        error: 'Invalid introspect response. Plugin may be outdated.',
        errorCode: 'INVALID_RESPONSE',
      };
    }

    // Determine edition from response
    // The plugin should report edition, but we fall back to detection heuristics
    const edition = determineEdition(data);

    return {
      detected: true,
      edition,
      version: data.plugin.version,
      siteName: data.site?.name,
      siteUrl: data.site?.url,
      mcpCompat: data.plugin.mcp_compat,
      capabilities: data.capabilities,
      policy: data.policy?.categories,
      fullResponse: data,
    };
  } catch (err) {
    if (err instanceof Error) {
      if (err.name === 'AbortError' || err.message.includes('timeout')) {
        return {
          detected: false,
          error: 'Connection timed out. Check the URL and network connectivity.',
          errorCode: 'NETWORK_ERROR',
        };
      }
      if (err.message.includes('ENOTFOUND') || err.message.includes('getaddrinfo')) {
        return {
          detected: false,
          error: 'Host not found. Check the URL is correct.',
          errorCode: 'NETWORK_ERROR',
        };
      }
      if (err.message.includes('ECONNREFUSED')) {
        return {
          detected: false,
          error: 'Connection refused. Is the WordPress server running?',
          errorCode: 'NETWORK_ERROR',
        };
      }
      if (err.message.includes('certificate')) {
        return {
          detected: false,
          error: 'SSL certificate error. Try using http:// for local development.',
          errorCode: 'NETWORK_ERROR',
        };
      }
      return {
        detected: false,
        error: err.message,
        errorCode: 'NETWORK_ERROR',
      };
    }
    return {
      detected: false,
      error: 'Unknown connection error',
      errorCode: 'NETWORK_ERROR',
    };
  }
}

/**
 * Determine plugin edition from introspect response
 *
 * The plugin should explicitly report edition, but we also use heuristics:
 * - Check plugin.edition field (canonical)
 * - Check plugin.name for "Pro" suffix
 * - Check capabilities for Pro-only features
 */
function determineEdition(data: IntrospectResponse): PluginEdition {
  // Check explicit edition field (canonical source)
  if (data.plugin.edition) {
    return data.plugin.edition;
  }

  // Check plugin name for "Pro" indicator
  if (data.plugin.name?.toLowerCase().includes('pro')) {
    return 'pro';
  }

  // Check for Pro-only capabilities
  const proCapabilities = [
    'bulk_operations',
    'advanced_rollback',
    'content_staging',
    'team_management',
    'api_access',
  ];

  if (data.capabilities?.some((cap) => proCapabilities.includes(cap))) {
    return 'pro';
  }

  // Default to free
  return 'free';
}

// =============================================================================
// Compatibility Checking
// =============================================================================

/**
 * Check MCP compatibility with plugin
 *
 * @param mcpCompat - MCP compatibility info from introspect
 * @param pluginVersion - Plugin version string
 * @returns Compatibility result
 */
export function checkMcpCompatibility(
  mcpCompat: McpCompat | undefined,
  pluginVersion: string
): CompatibilityResult {
  const mcpVersion = getMcpVersion();

  // If plugin doesn't provide mcp_compat, assume compatible (backward compat)
  if (!mcpCompat) {
    return {
      compatible: true,
      mcpVersion,
      pluginVersion,
      message: `MCP ${mcpVersion} compatible (plugin does not report mcp_compat)`,
    };
  }

  const { min_version, max_version, tested_up_to } = mcpCompat;

  // Check if MCP version is below minimum
  if (compareSemver(mcpVersion, min_version) < 0) {
    return {
      compatible: false,
      mcpVersion,
      pluginVersion,
      message: `MCP ${mcpVersion} is below minimum required version ${min_version}`,
      warning: `Update MCP: npm install @littlebearapps/wp-navigator-mcp@latest`,
    };
  }

  // Check if MCP version exceeds maximum
  if (compareSemver(mcpVersion, max_version) > 0) {
    return {
      compatible: false,
      mcpVersion,
      pluginVersion,
      message: `MCP ${mcpVersion} exceeds maximum supported version ${max_version}`,
      warning: `Plugin may need updating. Check wpnav.ai for latest version.`,
    };
  }

  // Check if MCP version exceeds tested version (warning only)
  if (compareSemver(mcpVersion, tested_up_to) > 0) {
    return {
      compatible: true,
      mcpVersion,
      pluginVersion,
      message: `MCP ${mcpVersion} compatible (untested with plugin ${pluginVersion})`,
      warning: `MCP ${mcpVersion} is newer than tested version ${tested_up_to}. Minor issues possible.`,
    };
  }

  return {
    compatible: true,
    mcpVersion,
    pluginVersion,
    message: `MCP ${mcpVersion} compatible with plugin ${pluginVersion}`,
  };
}

// =============================================================================
// Display Helpers
// =============================================================================

/**
 * Format plugin detection result for display
 *
 * @param result - Plugin detection result
 * @returns Formatted message string
 */
export function formatPluginMessage(result: PluginDetectionResult): string {
  if (!result.detected) {
    return result.error || 'Plugin not detected';
  }

  const editionLabel = result.edition === 'pro' ? 'Pro' : 'Free';
  const proNote = result.edition === 'pro' ? ' (Pro features available)' : '';

  return `WP Navigator ${editionLabel} v${result.version} detected${proNote}`;
}

/**
 * Format compatibility result for display
 *
 * @param result - Compatibility check result
 * @returns Formatted message string
 */
export function formatCompatibilityMessage(result: CompatibilityResult): string {
  if (!result.compatible) {
    return `${result.message}\n${result.warning || ''}`;
  }

  if (result.warning) {
    return `${result.message}\nWarning: ${result.warning}`;
  }

  return result.message;
}

/**
 * Get edition-specific features description
 *
 * @param edition - Plugin edition
 * @returns Feature description
 */
export function getEditionFeatures(edition: PluginEdition): string[] {
  const coreFeatures = [
    'Content management (pages, posts, media)',
    'Plugin activation/deactivation',
    'Theme management',
    'Site snapshots',
    'Manifest-based sync',
  ];

  if (edition === 'pro') {
    return [
      ...coreFeatures,
      'Server-side rollback',
      'Bulk operations',
      'Content staging',
      'Advanced policy controls',
      'Team management',
    ];
  }

  return coreFeatures;
}
