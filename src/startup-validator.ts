/**
 * Startup Validator for WP Navigator MCP Server
 *
 * Validates connection and environment before accepting requests.
 *
 * @since 1.2.0
 */

import type { WPConfig } from './config.js';
import { logger } from './logger.js';
import { detectAgent, getAgentName } from './agent-detection.js';

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

	const checks = {
		rest: await checkRestAPI(wpRequest, config),
		auth: await checkAuthentication(wpRequest, config),
		plugin: await checkPlugin(wpRequest, config),
		policy: await checkPolicy(wpRequest, config),
	};

	const warnings = collectWarnings(config);

	const allPassed = Object.values(checks).every(check => check.ok);

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
 * Check policy configuration.
 */
async function checkPolicy(
	wpRequest: (endpoint: string, options?: RequestInit) => Promise<any>,
	config: WPConfig
): Promise<StartupCheckResult> {
	try {
		const endpoint = config.wpnavIntrospect.replace(config.restApi, '');
		const data = await wpRequest(endpoint);

		const categories = data.policy?.categories || {};
		const enabled = Object.keys(categories).filter(k => categories[k]);

		return {
			ok: true,
			message: `Policy: ${enabled.join(', ') || 'None enabled'}`,
			details: data.policy,
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

	if (config.baseUrl.startsWith('http://localhost') || config.baseUrl.startsWith('http://127.0.0.1')) {
		warnings.push('Local development detected');
	}

	return warnings;
}

/**
 * Print startup summary.
 */
export function printStartupSummary(validation: StartupValidation, config: WPConfig): void {
	console.log('\n🚀 WP Navigator Pro MCP Server\n');
	console.log('━'.repeat(50));

	// Connection info
	console.log(`\n✓ WordPress: ${config.baseUrl}`);
	console.log(`✓ REST API: ${config.wpnavBase}`);

	if (validation.checks.auth.ok) {
		console.log(`✓ ${validation.checks.auth.message}`);
	}

	if (validation.checks.plugin.ok) {
		console.log(`✓ ${validation.checks.plugin.message}`);
	}

	if (validation.checks.policy.ok) {
		console.log(`✓ ${validation.checks.policy.message}`);
	}

	// Warnings
	if (validation.warnings.length > 0) {
		console.log('\n⚠️  Warnings:');
		validation.warnings.forEach(warning => {
			console.log(`   - ${warning}`);
		});
	}

	// Status
	console.log('\n' + '━'.repeat(50));

	if (validation.allPassed) {
		const agentName = getAgentName();
		console.log(`\n✅ Ready! Waiting for requests from ${agentName}...\n`);
		console.log('💡 Tip: Try "Use wpnav_introspect to check your site"\n');
	} else {
		console.log('\n❌ Startup validation failed\n');

		Object.entries(validation.checks).forEach(([key, check]) => {
			if (!check.ok) {
				console.log(`   ✗ ${key}: ${check.message}`);
			}
		});

		console.log('\n📚 Troubleshooting: https://wpnav.ai/help/connection-errors\n');
		process.exit(1);
	}
}

/**
 * Print friendly error with solution.
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
