import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

export type WPConfig = {
  baseUrl: string;
  restApi: string;
  wpnavBase: string;
  wpnavIntrospect: string;
  auth: {
    username: string;
    password: string;
    signHeaders?: boolean; // WPNAV_SIGN_HEADERS (default false) - v1.2.0 actor attribution
    hmacSecret?: string; // WPNAV_HMAC_SECRET (optional) - v1.2.0 actor attribution
  };
  toggles: {
    enableWrites: boolean; // WPNAV_ENABLE_WRITES (default false)
    allowInsecureHttp: boolean; // ALLOW_INSECURE_HTTP (default false)
    toolTimeoutMs: number; // WPNAV_TOOL_TIMEOUT_MS (default 600000)
    maxResponseKb: number; // WPNAV_MAX_RESPONSE_KB (default 64)
    caBundlePath?: string; // WPNAV_CA_BUNDLE (optional)
  };
  featureFlags: {
    // v1.3.0 AI Tools feature flags
    workflowsEnabled: boolean; // WPNAV_FLAG_WORKFLOWS_ENABLED (default false)
    bulkValidatorEnabled: boolean; // WPNAV_FLAG_WP_BULK_VALIDATOR_ENABLED (default false)
    seoAuditEnabled: boolean; // WPNAV_FLAG_WP_SEO_AUDIT_ENABLED (default false)
    contentReviewerEnabled: boolean; // WPNAV_FLAG_WP_CONTENT_REVIEWER_ENABLED (default false)
    migrationPlannerEnabled: boolean; // WPNAV_FLAG_WP_MIGRATION_PLANNER_ENABLED (default false)
    performanceAnalyzerEnabled: boolean; // WPNAV_FLAG_WP_PERFORMANCE_ANALYZER_ENABLED (default false)
  };
};

export const REQUIRED_ENV_VARS = [
  'WP_BASE_URL',
  'WP_REST_API',
  'WPNAV_BASE',
  'WPNAV_INTROSPECT',
  'WP_APP_USER',
  'WP_APP_PASS',
] as const;

/**
 * Load configuration from a JSON file (argv[2]) or from ../../.local-wp.env.
 * Mirrors the existing behavior and log lines for continuity.
 */
export function loadEnvFromArgOrDotEnv(argvPath?: string) {
  const configPath = argvPath ?? process.argv[2];

  if (configPath && fs.existsSync(configPath)) {
    try {
      const configData = JSON.parse(fs.readFileSync(configPath, 'utf8')) as Record<string, string>;
      Object.entries(configData).forEach(([key, value]) => {
        process.env[key] = String(value);
      });
      console.error(`✓ Loaded configuration from: ${configPath}`);
      return;
    } catch (e) {
      console.error(`❌ Failed to parse config file: ${configPath}`);
      console.error(String(e));
    }
  }

  // Try .local-wp.env (for local development)
  const envPath = path.resolve(process.cwd(), '../../.local-wp.env');
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    console.error(`✓ Loaded environment from: ${envPath}`);
  } else {
    console.error(`⚠ Warning: No config file found`);
    console.error('  Using environment variables from shell');
  }
}

/**
 * Validate required env vars and produce a typed configuration object.
 * Exits the process with code 1 if required env vars are missing (matches prior behavior).
 */
export function getConfigOrExit(): WPConfig {
  const missing = (REQUIRED_ENV_VARS as readonly string[]).filter((k) => !process.env[k] || process.env[k] === '');
  if (missing.length > 0) {
    console.error(`❌ Missing required environment variables: ${missing.join(', ')}`);
    console.error('   Please check your configuration file or .local-wp.env');
    process.exit(1);
  }

  const signHeaders = readBool(process.env.WPNAV_SIGN_HEADERS, false);
  const hmacSecret = process.env.WPNAV_HMAC_SECRET || '';

  // Validate: if signing is enabled, secret is required
  if (signHeaders && !hmacSecret) {
    console.error('❌ WPNAV_SIGN_HEADERS=1 requires WPNAV_HMAC_SECRET to be set');
    console.error('   Please configure a shared secret in .local-wp.env or config file');
    process.exit(1);
  }

  return {
    baseUrl: process.env.WP_BASE_URL!,
    restApi: process.env.WP_REST_API!,
    wpnavBase: process.env.WPNAV_BASE!,
    wpnavIntrospect: process.env.WPNAV_INTROSPECT!,
    auth: {
      username: process.env.WP_APP_USER!,
      password: process.env.WP_APP_PASS!,
      signHeaders,
      hmacSecret: signHeaders ? hmacSecret : undefined,
    },
    toggles: {
      enableWrites: readBool(process.env.WPNAV_ENABLE_WRITES, false),
      allowInsecureHttp: readBool(process.env.ALLOW_INSECURE_HTTP, false),
      toolTimeoutMs: readInt(process.env.WPNAV_TOOL_TIMEOUT_MS, 600000),
      maxResponseKb: readInt(process.env.WPNAV_MAX_RESPONSE_KB, 64),
      caBundlePath: process.env.WPNAV_CA_BUNDLE || undefined,
    },
    featureFlags: {
      workflowsEnabled: readBool(process.env.WPNAV_FLAG_WORKFLOWS_ENABLED, false),
      bulkValidatorEnabled: readBool(process.env.WPNAV_FLAG_WP_BULK_VALIDATOR_ENABLED, false),
      seoAuditEnabled: readBool(process.env.WPNAV_FLAG_WP_SEO_AUDIT_ENABLED, false),
      contentReviewerEnabled: readBool(process.env.WPNAV_FLAG_WP_CONTENT_REVIEWER_ENABLED, false),
      migrationPlannerEnabled: readBool(process.env.WPNAV_FLAG_WP_MIGRATION_PLANNER_ENABLED, false),
      performanceAnalyzerEnabled: readBool(process.env.WPNAV_FLAG_WP_PERFORMANCE_ANALYZER_ENABLED, false),
    },
  } satisfies WPConfig;
}

/**
 * Redact secrets for logs.
 */
export function redact(value?: string | null): string {
  if (!value) return '';
  if (value.length <= 4) return '****';
  return `${value.slice(0, 2)}****${value.slice(-2)}`;
}

function readBool(v: string | undefined, defaultVal: boolean): boolean {
  if (v == null) return defaultVal;
  const s = String(v).trim().toLowerCase();
  return s === '1' || s === 'true' || s === 'yes' || s === 'on';
}

function readInt(v: string | undefined, defaultVal: number): number {
  const n = v != null ? parseInt(String(v), 10) : NaN;
  return Number.isFinite(n) ? n : defaultVal;
}
