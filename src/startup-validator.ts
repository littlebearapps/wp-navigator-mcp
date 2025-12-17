/**
 * Startup Validator for WP Navigator MCP Server
 *
 * Validates connection and environment before accepting requests.
 *
 * @since 1.2.0
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import type { WPConfig } from './config.js';
import { logger } from './logger.js';
import { detectAgent, getAgentName } from './agent-detection.js';

/**
 * Get MCP package version from package.json
 */
function getMcpVersion(): string {
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
function compareSemver(a: string, b: string): number {
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

interface McpCompat {
  min_version: string;
  max_version: string;
  tested_up_to: string;
}

interface CompatibilityResult {
  compatible: boolean;
  mcpVersion: string;
  pluginVersion: string;
  message: string;
  warning?: string;
}

/**
 * Check MCP compatibility with plugin.
 */
export function checkCompatibility(introspectData: any): CompatibilityResult {
  const mcpVersion = getMcpVersion();
  const pluginVersion = introspectData?.plugin?.version || 'unknown';
  const mcpCompat: McpCompat | undefined = introspectData?.plugin?.mcp_compat;

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
      message: `MCP ${mcpVersion} below minimum ${min_version}`,
      warning: `Update MCP: npm install @littlebearapps/wp-navigator-mcp@latest`,
    };
  }

  // Check if MCP version exceeds maximum
  if (compareSemver(mcpVersion, max_version) > 0) {
    return {
      compatible: false,
      mcpVersion,
      pluginVersion,
      message: `MCP ${mcpVersion} exceeds max ${max_version}`,
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
      warning: `MCP ${mcpVersion} > tested ${tested_up_to}. Minor issues possible.`,
    };
  }

  return {
    compatible: true,
    mcpVersion,
    pluginVersion,
    message: `MCP ${mcpVersion} compatible with plugin ${pluginVersion}`,
  };
}

interface StartupCheckResult {
  ok: boolean;
  message: string;
  details?: any;
}

interface StartupValidation {
  allPassed: boolean;
  checks: {
    rest: StartupCheckResult;
    auth: StartupCheckResult;
    plugin: StartupCheckResult;
    policy: StartupCheckResult;
    compat: StartupCheckResult;
  };
  warnings: string[];
}

/**
 * Run all startup validation checks.
 */
export async function validateStartup(
  wpRequest: (endpoint: string, options?: RequestInit) => Promise<any>,
  config: WPConfig
): Promise<StartupValidation> {
  logger.info('Running startup validation...');

  const rest = await checkRestAPI(wpRequest, config);
  const auth = await checkAuthentication(wpRequest, config);
  const plugin = await checkPlugin(wpRequest, config);
  const policy = await checkPolicy(wpRequest, config);

  // Compatibility check (uses introspect data from policy check)
  let compat: StartupCheckResult;
  let compatResult: CompatibilityResult | null = null;
  if (policy.details) {
    compatResult = checkCompatibility(policy.details);
    compat = {
      ok: compatResult.compatible,
      message: compatResult.message,
      details: {
        mcpVersion: compatResult.mcpVersion,
        pluginVersion: compatResult.pluginVersion,
      },
    };
  } else {
    compat = {
      ok: true,
      message: 'Compatibility: skipped (no introspect data)',
    };
  }

  const checks = { rest, auth, plugin, policy, compat };
  const warnings = collectWarnings(config);

  // Add compat warning if present
  if (compatResult?.warning) {
    warnings.push(compatResult.warning);
  }

  // Compat issues are warnings only, don't fail startup
  const criticalChecks = { rest, auth, plugin, policy };
  const allPassed = Object.values(criticalChecks).every((check) => check.ok);

  return { allPassed, checks, warnings };
}

/**
 * Check REST API reachability.
 */
async function checkRestAPI(
  wpRequest: (endpoint: string, options?: RequestInit) => Promise<any>,
  config: WPConfig
): Promise<StartupCheckResult> {
  try {
    const response = await wpRequest('/');

    return {
      ok: true,
      message: 'REST API reachable',
      details: response,
    };
  } catch (error: any) {
    return {
      ok: false,
      message: `REST API unreachable: ${error.message}`,
    };
  }
}

/**
 * Check authentication.
 */
async function checkAuthentication(
  wpRequest: (endpoint: string, options?: RequestInit) => Promise<any>,
  config: WPConfig
): Promise<StartupCheckResult> {
  try {
    const data = await wpRequest('/wp/v2/users/me');

    return {
      ok: true,
      message: `Authenticated as: ${data.name || 'unknown'}`,
      details: { username: data.slug, roles: data.roles },
    };
  } catch (error: any) {
    if (error.message.includes('401')) {
      return {
        ok: false,
        message: 'Authentication failed (401 Unauthorized)',
      };
    }
    return {
      ok: false,
      message: `Auth check failed: ${error.message}`,
    };
  }
}

/**
 * Check plugin availability.
 */
async function checkPlugin(
  wpRequest: (endpoint: string, options?: RequestInit) => Promise<any>,
  config: WPConfig
): Promise<StartupCheckResult> {
  try {
    // Note: wpnavBase already includes the full URL
    const endpoint = config.wpnavBase.replace(config.restApi, '') + '/ping';
    const data = await wpRequest(endpoint);

    return {
      ok: true,
      message: `Plugin v${data.version || 'unknown'} active`,
      details: data,
    };
  } catch (error: any) {
    return {
      ok: false,
      message: `Plugin check failed: ${error.message}`,
    };
  }
}

/**
 * Check policy configuration (also returns full introspect data for compat check).
 */
async function checkPolicy(
  wpRequest: (endpoint: string, options?: RequestInit) => Promise<any>,
  config: WPConfig
): Promise<StartupCheckResult> {
  try {
    const endpoint = config.wpnavIntrospect.replace(config.restApi, '');
    const data = await wpRequest(endpoint);

    const categories = data.policy?.categories || {};
    const enabled = Object.keys(categories).filter((k) => categories[k]);

    return {
      ok: true,
      message: `Policy: ${enabled.join(', ') || 'None enabled'}`,
      details: data, // Full introspect data (includes plugin.mcp_compat)
    };
  } catch (error: any) {
    return {
      ok: false,
      message: `Policy check failed: ${error.message}`,
    };
  }
}

/**
 * Collect environment warnings.
 */
function collectWarnings(config: WPConfig): string[] {
  const warnings: string[] = [];

  if (!config.toggles.enableWrites) {
    warnings.push('Writes disabled (read-only mode)');
  }

  if (config.toggles.allowInsecureHttp) {
    warnings.push('Insecure HTTP allowed (dev mode)');
  }

  if (
    config.baseUrl.startsWith('http://localhost') ||
    config.baseUrl.startsWith('http://127.0.0.1')
  ) {
    warnings.push('Local development detected');
  }

  return warnings;
}

/**
 * Print startup summary.
 *
 * IMPORTANT: Uses console.error (stderr) instead of console.log (stdout)
 * because MCP protocol uses stdout exclusively for JSON-RPC messages.
 * Writing non-JSON to stdout breaks MCP client connections (e.g., Codex CLI).
 */
export function printStartupSummary(validation: StartupValidation, config: WPConfig): void {
  console.error('\n🚀 WP Navigator Pro MCP Server\n');
  console.error('━'.repeat(50));

  // Connection info
  console.error(`\n✓ WordPress: ${config.baseUrl}`);
  console.error(`✓ REST API: ${config.wpnavBase}`);

  if (validation.checks.auth.ok) {
    console.error(`✓ ${validation.checks.auth.message}`);
  }

  if (validation.checks.plugin.ok) {
    console.error(`✓ ${validation.checks.plugin.message}`);
  }

  if (validation.checks.policy.ok) {
    console.error(`✓ ${validation.checks.policy.message}`);
  }

  // Compatibility status
  if (validation.checks.compat) {
    const icon = validation.checks.compat.ok ? '✓' : '⚠️';
    console.error(`${icon} ${validation.checks.compat.message}`);
  }

  // Warnings
  if (validation.warnings.length > 0) {
    console.error('\n⚠️  Warnings:');
    validation.warnings.forEach((warning) => {
      console.error(`   - ${warning}`);
    });
  }

  // Status
  console.error('\n' + '━'.repeat(50));

  if (validation.allPassed) {
    const agentName = getAgentName();
    console.error(`\n✅ Ready! Waiting for requests from ${agentName}...\n`);
    console.error('💡 Tip: Try "Use wpnav_introspect to check your site"\n');
  } else {
    console.error('\n❌ Startup validation failed\n');

    Object.entries(validation.checks).forEach(([key, check]) => {
      if (!check.ok) {
        console.error(`   ✗ ${key}: ${check.message}`);
      }
    });

    console.error('\n📚 Troubleshooting: https://wpnav.ai/help/connection-errors\n');
    process.exit(1);
  }
}

/**
 * Print friendly error with solution.
 *
 * Note: Already uses console.error (correct for MCP servers).
 */
export function printFriendlyError(error: Error): void {
  console.error('\n❌ Connection Error\n');
  console.error('━'.repeat(50));
  console.error(`\n${error.message}\n`);

  // Common errors with solutions
  if (error.message.includes('ECONNREFUSED')) {
    console.error('💡 Solution:');
    console.error('   - Check if WordPress is running');
    console.error('   - Verify WP_BASE_URL in your config');
    console.error('   - Ensure site is accessible\n');
  } else if (error.message.includes('401')) {
    console.error('💡 Solution:');
    console.error('   - Application Password is incorrect');
    console.error('   - Regenerate password in WordPress admin');
    console.error('   - Check WP_APP_USER and WP_APP_PASS\n');
  } else if (error.message.includes('403')) {
    console.error('💡 Solution:');
    console.error('   - WAF blocking detected');
    console.error('   - Add /wp-json/wpnav/* to WAF allowlist');
    console.error('   - Check security plugin settings\n');
  } else {
    console.error('📚 Troubleshooting: https://wpnav.ai/help\n');
  }

  process.exit(1);
}
