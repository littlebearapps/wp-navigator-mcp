/**
 * Express Mode Defaults
 *
 * Default value resolver for wpnav init --express mode.
 * Provides sensible defaults based on site URL and environment detection.
 *
 * @package WP_Navigator_MCP
 * @since 2.1.0
 */

// =============================================================================
// Types
// =============================================================================

export type Environment = 'local' | 'production';

export interface DefaultsContext {
  siteUrl: string;
  isLocal: boolean;
}

export interface AppliedDefaults {
  environment: Environment;
  safetyMode: 'safe' | 'careful';
  setupDepth: 'quick' | 'full';
  mcpSetup: boolean;
}

// =============================================================================
// Environment Detection
// =============================================================================

/**
 * Local development URL patterns
 */
const LOCAL_PATTERNS = [
  /^https?:\/\/localhost(:\d+)?/i,
  /^https?:\/\/127\.0\.0\.1(:\d+)?/i,
  /^https?:\/\/\[::1\](:\d+)?/i,
  /^https?:\/\/[^/]+\.local(:\d+)?(\/|$)/i,
  /^https?:\/\/[^/]+\.test(:\d+)?(\/|$)/i,
  /^https?:\/\/[^/]+\.dev(:\d+)?(\/|$)/i,
  /^https?:\/\/[^/]+\.ddev\.site(:\d+)?(\/|$)/i,
  /^https?:\/\/[^/]+\.lndo\.site(:\d+)?(\/|$)/i,
  /^https?:\/\/[^/]+\.localwp\.internal(:\d+)?(\/|$)/i,
];

/**
 * Detect if URL is local development environment
 */
export function detectEnvironment(siteUrl: string): Environment {
  const normalizedUrl = siteUrl.toLowerCase();

  for (const pattern of LOCAL_PATTERNS) {
    if (pattern.test(normalizedUrl)) {
      return 'local';
    }
  }

  return 'production';
}

/**
 * Check if URL matches local development patterns
 */
export function isLocalUrl(siteUrl: string): boolean {
  return detectEnvironment(siteUrl) === 'local';
}

// =============================================================================
// Defaults Resolution
// =============================================================================

/**
 * Get express mode defaults based on context
 *
 * Local environments use 'careful' safety (allows experimentation)
 * Production environments use 'safe' mode (conservative defaults)
 */
export function getExpressDefaults(context: DefaultsContext): AppliedDefaults {
  const environment = context.isLocal ? 'local' : 'production';

  return {
    environment,
    // Local: more permissive for development
    // Production: conservative for safety
    safetyMode: environment === 'local' ? 'careful' : 'safe',
    // Quick setup for express mode
    setupDepth: 'quick',
    // Skip MCP setup in express mode (can configure later)
    mcpSetup: false,
  };
}

// =============================================================================
// Formatting
// =============================================================================

/**
 * Format applied defaults for logging
 */
export function formatAppliedDefaults(defaults: AppliedDefaults): string {
  const lines = [
    `  Environment: ${defaults.environment}`,
    `  Safety mode: ${defaults.safetyMode}`,
    `  Setup depth: ${defaults.setupDepth}`,
    `  MCP setup: ${defaults.mcpSetup ? 'enabled' : 'skipped'}`,
  ];

  return lines.join('\n');
}

/**
 * Get human-readable description of defaults
 */
export function describeDefaults(defaults: AppliedDefaults): string {
  if (defaults.environment === 'local') {
    return 'Using local development defaults (careful mode, quick setup)';
  }
  return 'Using production defaults (safe mode, quick setup)';
}
