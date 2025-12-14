/**
 * WP Navigator Config File Schema and Loader
 *
 * Phase B1: wpnav.config.json schema with directory walk-up discovery,
 * environment variable substitution, and multi-environment support.
 *
 * @package WP_Navigator_MCP
 * @since 1.1.0
 */

import * as fs from 'fs';
import * as path from 'path';

// =============================================================================
// Schema Types
// =============================================================================

/**
 * Config file schema version for future migrations
 */
export const CONFIG_SCHEMA_VERSION = '1.0';

/**
 * Safety configuration for write operations
 */
export interface SafetyConfig {
  /** Enable write operations (default: false) */
  enable_writes?: boolean;
  /** Allow insecure HTTP for localhost development (default: false) */
  allow_insecure_http?: boolean;
  /** Per-tool timeout in milliseconds (default: 600000 = 10 min) */
  tool_timeout_ms?: number;
  /** Maximum response size in KB (default: 64) */
  max_response_kb?: number;
  /** Enable HMAC request signing (default: false) */
  sign_headers?: boolean;
  /** HMAC secret for request signing (required if sign_headers is true) */
  hmac_secret?: string;
  /** Custom CA bundle path for TLS verification */
  ca_bundle?: string;
}

/**
 * Feature flags for experimental/gated features
 */
export interface FeaturesConfig {
  /** Enable AI workflows (default: false) */
  workflows?: boolean;
  /** Enable bulk content validator (default: false) */
  bulk_validator?: boolean;
  /** Enable SEO audit tool (default: false) */
  seo_audit?: boolean;
  /** Enable content reviewer (default: false) */
  content_reviewer?: boolean;
  /** Enable migration planner (default: false) */
  migration_planner?: boolean;
  /** Enable performance analyzer (default: false) */
  performance_analyzer?: boolean;
}

/**
 * Detected plugin information (auto-populated during connection test)
 */
export interface DetectedPluginInfo {
  /** Plugin edition: "free" or "pro" */
  edition: 'free' | 'pro';
  /** Plugin version string */
  version: string;
  /** When plugin was last detected (ISO timestamp) */
  detected_at: string;
}

/**
 * Single environment configuration
 */
export interface EnvironmentConfig {
  /** WordPress site base URL */
  site: string;
  /** WordPress REST API base URL (defaults to {site}/wp-json) */
  rest_api?: string;
  /** WP Navigator plugin API base URL (defaults to {site}/wp-json/wpnav/v1) */
  wpnav_base?: string;
  /** WordPress application password username */
  user: string;
  /** WordPress application password (supports $ENV_VAR syntax) */
  password: string;
  /** Safety settings for this environment */
  safety?: SafetyConfig;
  /** Feature flags for this environment */
  features?: FeaturesConfig;
  /** Auto-detected plugin information (populated by configure/init commands) */
  detected_plugin?: DetectedPluginInfo;
  /** Default role for this environment (overrides global default_role) */
  default_role?: string;
}

/**
 * Root wpnav.config.json schema
 */
export interface WPNavConfigFile {
  /** Schema version for migration support */
  config_version: string;
  /** Default environment name (default: 'default') */
  default_environment?: string;
  /** Named environments (local, staging, production, etc.) */
  environments: Record<string, EnvironmentConfig>;
  /** Global safety settings (can be overridden per-environment) */
  safety?: SafetyConfig;
  /** Global feature flags (can be overridden per-environment) */
  features?: FeaturesConfig;
  /** Default role for AI context (can be overridden per-environment or via CLI --role) */
  default_role?: string;
}

/**
 * Resolved configuration after environment selection and defaults
 */
export interface ResolvedConfig {
  /** Which environment was resolved */
  environment: string;
  /** Path to the config file that was loaded */
  config_path: string;
  /** WordPress site base URL */
  site: string;
  /** WordPress REST API base URL */
  rest_api: string;
  /** WP Navigator plugin API base URL */
  wpnav_base: string;
  /** WP Navigator introspect endpoint */
  wpnav_introspect: string;
  /** Resolved username */
  user: string;
  /** Resolved password (after env var substitution) */
  password: string;
  /** Merged safety settings */
  safety: Required<SafetyConfig>;
  /** Merged feature flags */
  features: Required<FeaturesConfig>;
  /** Detected plugin information (may be undefined if not yet detected) */
  detected_plugin?: DetectedPluginInfo;
  /** Default role from config (env-level overrides global) */
  default_role?: string;
}

// =============================================================================
// Config Discovery
// =============================================================================

/** Config file names to search for (in priority order) */
const CONFIG_FILE_NAMES = ['wpnav.config.json', '.wpnav.config.json'];

/** Maximum directory levels to search upward */
const MAX_WALK_DEPTH = 10;

/**
 * Result of config file discovery
 */
export interface ConfigDiscoveryResult {
  /** Whether a config file was found */
  found: boolean;
  /** Absolute path to the config file (if found) */
  path?: string;
  /** Directories searched (for debugging) */
  searched: string[];
}

/**
 * Search for wpnav.config.json walking up the directory tree
 * Similar to how .eslintrc or .gitignore discovery works
 *
 * @param startDir - Directory to start searching from (defaults to cwd)
 * @returns Discovery result with path if found
 */
export function discoverConfigFile(startDir?: string): ConfigDiscoveryResult {
  const searchDir = startDir ? path.resolve(startDir) : process.cwd();
  const searched: string[] = [];
  let currentDir = searchDir;
  let depth = 0;

  while (depth < MAX_WALK_DEPTH) {
    searched.push(currentDir);

    for (const fileName of CONFIG_FILE_NAMES) {
      const configPath = path.join(currentDir, fileName);
      if (fs.existsSync(configPath)) {
        return {
          found: true,
          path: configPath,
          searched,
        };
      }
    }

    // Move to parent directory
    const parentDir = path.dirname(currentDir);

    // Stop if we've reached the root
    if (parentDir === currentDir) {
      break;
    }

    currentDir = parentDir;
    depth++;
  }

  return {
    found: false,
    searched,
  };
}

// =============================================================================
// Environment Variable Resolution
// =============================================================================

/**
 * Pattern for ${VAR_NAME} syntax (explicit boundaries)
 */
const ENV_VAR_BRACED_PATTERN = /\$\{([A-Z_][A-Z0-9_]*)\}/g;

/**
 * Pattern for $VAR_NAME syntax (simple, terminated by non-alphanumeric/non-underscore)
 * Uses word boundary to stop at non-identifier characters
 */
const ENV_VAR_SIMPLE_PATTERN = /\$([A-Z_][A-Z0-9_]*)(?![A-Z0-9_])/g;

/**
 * Resolve environment variable references in a string value
 *
 * Supports two syntaxes:
 *   - $VAR_NAME (simple, terminated by non-identifier char)
 *   - ${VAR_NAME} (explicit boundaries)
 *
 * @param value - String potentially containing env var references
 * @returns Resolved string with env vars substituted
 * @throws Error if referenced env var is not set
 */
export function resolveEnvVars(value: string): string {
  // First resolve ${VAR} syntax (more specific)
  let result = value.replace(ENV_VAR_BRACED_PATTERN, (match, varName) => {
    const envValue = process.env[varName];
    if (envValue === undefined) {
      throw new Error(`Environment variable ${varName} is not set (referenced as ${match})`);
    }
    return envValue;
  });

  // Then resolve $VAR syntax
  result = result.replace(ENV_VAR_SIMPLE_PATTERN, (match, varName) => {
    const envValue = process.env[varName];
    if (envValue === undefined) {
      throw new Error(`Environment variable ${varName} is not set (referenced as ${match})`);
    }
    return envValue;
  });

  return result;
}

/**
 * Check if a string contains environment variable references
 * Uses fresh regex instances to avoid stateful lastIndex issues
 */
export function containsEnvVars(value: string): boolean {
  const bracedPattern = /\$\{([A-Z_][A-Z0-9_]*)\}/;
  const simplePattern = /\$([A-Z_][A-Z0-9_]*)(?![A-Z0-9_])/;
  return bracedPattern.test(value) || simplePattern.test(value);
}

// =============================================================================
// Config Loading and Validation
// =============================================================================

/**
 * Error thrown when config validation fails
 */
export class ConfigValidationError extends Error {
  constructor(
    message: string,
    public readonly path?: string,
    public readonly field?: string
  ) {
    super(message);
    this.name = 'ConfigValidationError';
  }
}

/**
 * Validate config file structure
 */
function validateConfigFile(config: unknown, filePath: string): WPNavConfigFile {
  if (!config || typeof config !== 'object') {
    throw new ConfigValidationError('Config file must be a JSON object', filePath);
  }

  const obj = config as Record<string, unknown>;

  // Validate config_version
  if (!obj.config_version || typeof obj.config_version !== 'string') {
    throw new ConfigValidationError(
      'Missing or invalid config_version (expected string like "1.0")',
      filePath,
      'config_version'
    );
  }

  // Validate environments
  if (!obj.environments || typeof obj.environments !== 'object') {
    throw new ConfigValidationError(
      'Missing or invalid environments object',
      filePath,
      'environments'
    );
  }

  const envs = obj.environments as Record<string, unknown>;
  if (Object.keys(envs).length === 0) {
    throw new ConfigValidationError(
      'At least one environment must be defined',
      filePath,
      'environments'
    );
  }

  // Validate each environment
  for (const [envName, envConfig] of Object.entries(envs)) {
    validateEnvironmentConfig(envConfig, filePath, envName);
  }

  return config as WPNavConfigFile;
}

/**
 * Validate a single environment configuration
 */
function validateEnvironmentConfig(config: unknown, filePath: string, envName: string): void {
  if (!config || typeof config !== 'object') {
    throw new ConfigValidationError(
      `Environment '${envName}' must be an object`,
      filePath,
      `environments.${envName}`
    );
  }

  const env = config as Record<string, unknown>;

  // Required fields
  if (!env.site || typeof env.site !== 'string') {
    throw new ConfigValidationError(
      `Environment '${envName}' missing required 'site' URL`,
      filePath,
      `environments.${envName}.site`
    );
  }

  if (!env.user || typeof env.user !== 'string') {
    throw new ConfigValidationError(
      `Environment '${envName}' missing required 'user' field`,
      filePath,
      `environments.${envName}.user`
    );
  }

  if (!env.password || typeof env.password !== 'string') {
    throw new ConfigValidationError(
      `Environment '${envName}' missing required 'password' field`,
      filePath,
      `environments.${envName}.password`
    );
  }
}

/**
 * Parse and validate a config file
 *
 * @param filePath - Path to the config file
 * @returns Validated config file object
 */
export function parseConfigFile(filePath: string): WPNavConfigFile {
  if (!fs.existsSync(filePath)) {
    throw new ConfigValidationError(`Config file not found: ${filePath}`, filePath);
  }

  let content: string;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    throw new ConfigValidationError(
      `Failed to read config file: ${error instanceof Error ? error.message : String(error)}`,
      filePath
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    throw new ConfigValidationError(
      `Invalid JSON in config file: ${error instanceof Error ? error.message : String(error)}`,
      filePath
    );
  }

  return validateConfigFile(parsed, filePath);
}

// =============================================================================
// Config Resolution
// =============================================================================

/** Default safety settings - writes enabled by default, plugin guardrails handle safety */
const DEFAULT_SAFETY: Required<SafetyConfig> = {
  enable_writes: true,
  allow_insecure_http: false,
  tool_timeout_ms: 600000,
  max_response_kb: 64,
  sign_headers: false,
  hmac_secret: '',
  ca_bundle: '',
};

/** Default feature flags */
const DEFAULT_FEATURES: Required<FeaturesConfig> = {
  workflows: false,
  bulk_validator: false,
  seo_audit: false,
  content_reviewer: false,
  migration_planner: false,
  performance_analyzer: false,
};

/**
 * Merge safety configs with defaults
 */
function mergeSafety(global?: SafetyConfig, env?: SafetyConfig): Required<SafetyConfig> {
  return {
    ...DEFAULT_SAFETY,
    ...global,
    ...env,
  };
}

/**
 * Merge feature configs with defaults
 */
function mergeFeatures(global?: FeaturesConfig, env?: FeaturesConfig): Required<FeaturesConfig> {
  return {
    ...DEFAULT_FEATURES,
    ...global,
    ...env,
  };
}

/**
 * Resolve a config file to a specific environment
 *
 * @param config - Parsed config file
 * @param configPath - Path to the config file
 * @param environment - Environment to resolve (defaults to default_environment or 'default')
 * @returns Fully resolved configuration
 */
export function resolveConfig(
  config: WPNavConfigFile,
  configPath: string,
  environment?: string
): ResolvedConfig {
  // Determine which environment to use
  const envName = environment ?? config.default_environment ?? 'default';
  const envConfig = config.environments[envName];

  if (!envConfig) {
    const available = Object.keys(config.environments).join(', ');
    throw new ConfigValidationError(
      `Environment '${envName}' not found. Available: ${available}`,
      configPath,
      'environments'
    );
  }

  // Resolve env vars in password
  let password: string;
  try {
    password = resolveEnvVars(envConfig.password);
  } catch (error) {
    throw new ConfigValidationError(
      `Failed to resolve password for environment '${envName}': ${error instanceof Error ? error.message : String(error)}`,
      configPath,
      `environments.${envName}.password`
    );
  }

  // Build URLs with defaults
  const site = envConfig.site.replace(/\/$/, ''); // Remove trailing slash
  const restApi = envConfig.rest_api ?? `${site}/wp-json`;
  const wpnavBase = envConfig.wpnav_base ?? `${site}/wp-json/wpnav/v1`;
  const wpnavIntrospect = `${wpnavBase}/introspect`;

  // Merge safety and features (env overrides global)
  const safety = mergeSafety(config.safety, envConfig.safety);
  const features = mergeFeatures(config.features, envConfig.features);

  // Resolve env vars in hmac_secret if present
  if (safety.hmac_secret && containsEnvVars(safety.hmac_secret)) {
    try {
      safety.hmac_secret = resolveEnvVars(safety.hmac_secret);
    } catch (error) {
      throw new ConfigValidationError(
        `Failed to resolve hmac_secret: ${error instanceof Error ? error.message : String(error)}`,
        configPath,
        'safety.hmac_secret'
      );
    }
  }

  // Validate: if signing is enabled, secret is required
  if (safety.sign_headers && !safety.hmac_secret) {
    throw new ConfigValidationError(
      'sign_headers is enabled but hmac_secret is not set',
      configPath,
      'safety.hmac_secret'
    );
  }

  // Resolve default_role (env-level overrides global)
  const defaultRole = envConfig.default_role ?? config.default_role;

  return {
    environment: envName,
    config_path: configPath,
    site,
    rest_api: restApi,
    wpnav_base: wpnavBase,
    wpnav_introspect: wpnavIntrospect,
    user: envConfig.user,
    password,
    safety,
    features,
    detected_plugin: envConfig.detected_plugin,
    default_role: defaultRole,
  };
}

// =============================================================================
// High-Level Loading API
// =============================================================================

/**
 * Options for loading config
 */
export interface LoadConfigOptions {
  /** Explicit path to config file (skips discovery) */
  configPath?: string;
  /** Directory to start discovery from (defaults to cwd) */
  startDir?: string;
  /** Environment to resolve */
  environment?: string;
  /** Whether to fall back to env vars if no config file found */
  fallbackToEnv?: boolean;
}

/**
 * Result of config loading
 */
export interface LoadConfigResult {
  /** Whether config was loaded successfully */
  success: boolean;
  /** Resolved configuration (if successful) */
  config?: ResolvedConfig;
  /** Source of configuration ('file' or 'env') */
  source?: 'file' | 'env';
  /** Error message (if failed) */
  error?: string;
  /** Detailed error information */
  errorDetails?: {
    path?: string;
    field?: string;
    searched?: string[];
  };
}

/**
 * Load config from environment variables (fallback mode)
 *
 * v2.4.0: Supports new env var names (WPNAV_SITE_URL, WPNAV_USERNAME, WPNAV_APP_PASSWORD)
 * with fallback to legacy names (WP_BASE_URL, WP_APP_USER, WP_APP_PASS).
 * New names take precedence over legacy names.
 */
function loadFromEnvVars(): ResolvedConfig | null {
  // Get values with new names taking precedence over legacy
  const siteUrl = process.env.WPNAV_SITE_URL || process.env.WP_BASE_URL;
  const restApi = process.env.WP_REST_API;
  const wpnavBase = process.env.WPNAV_BASE;
  const wpnavIntrospect = process.env.WPNAV_INTROSPECT;
  const username = process.env.WPNAV_USERNAME || process.env.WP_APP_USER;
  const password = process.env.WPNAV_APP_PASSWORD || process.env.WP_APP_PASS;

  // Check if we have all required values
  if (!siteUrl || !restApi || !wpnavBase || !wpnavIntrospect || !username || !password) {
    return null;
  }

  return {
    environment: process.env.WPNAV_ENVIRONMENT ?? 'default',
    config_path: '[environment variables]',
    site: siteUrl,
    rest_api: restApi,
    wpnav_base: wpnavBase,
    wpnav_introspect: wpnavIntrospect,
    user: username,
    password: password,
    safety: {
      enable_writes: readBool(process.env.WPNAV_ENABLE_WRITES, true),
      allow_insecure_http: readBool(process.env.ALLOW_INSECURE_HTTP, false),
      tool_timeout_ms: readInt(process.env.WPNAV_TOOL_TIMEOUT_MS, 600000),
      max_response_kb: readInt(process.env.WPNAV_MAX_RESPONSE_KB, 64),
      sign_headers: readBool(process.env.WPNAV_SIGN_HEADERS, false),
      hmac_secret: process.env.WPNAV_HMAC_SECRET ?? '',
      ca_bundle: process.env.WPNAV_CA_BUNDLE ?? '',
    },
    features: {
      workflows: readBool(process.env.WPNAV_FLAG_WORKFLOWS_ENABLED, false),
      bulk_validator: readBool(process.env.WPNAV_FLAG_WP_BULK_VALIDATOR_ENABLED, false),
      seo_audit: readBool(process.env.WPNAV_FLAG_WP_SEO_AUDIT_ENABLED, false),
      content_reviewer: readBool(process.env.WPNAV_FLAG_WP_CONTENT_REVIEWER_ENABLED, false),
      migration_planner: readBool(process.env.WPNAV_FLAG_WP_MIGRATION_PLANNER_ENABLED, false),
      performance_analyzer: readBool(process.env.WPNAV_FLAG_WP_PERFORMANCE_ANALYZER_ENABLED, false),
    },
    default_role: process.env.WPNAV_ROLE,
  };
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

/**
 * Load wpnav.config.json with directory walk-up discovery
 *
 * @param options - Loading options
 * @returns Loading result with config or error
 */
export function loadWpnavConfig(options: LoadConfigOptions = {}): LoadConfigResult {
  const { configPath, startDir, environment, fallbackToEnv = true } = options;

  // If explicit path provided, use it directly
  if (configPath) {
    try {
      const config = parseConfigFile(configPath);
      const resolved = resolveConfig(config, configPath, environment);
      return {
        success: true,
        config: resolved,
        source: 'file',
      };
    } catch (error) {
      if (error instanceof ConfigValidationError) {
        return {
          success: false,
          error: error.message,
          errorDetails: {
            path: error.path,
            field: error.field,
          },
        };
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // Discover config file
  const discovery = discoverConfigFile(startDir);

  if (discovery.found && discovery.path) {
    try {
      const config = parseConfigFile(discovery.path);
      const resolved = resolveConfig(config, discovery.path, environment);
      return {
        success: true,
        config: resolved,
        source: 'file',
      };
    } catch (error) {
      if (error instanceof ConfigValidationError) {
        return {
          success: false,
          error: error.message,
          errorDetails: {
            path: error.path,
            field: error.field,
            searched: discovery.searched,
          },
        };
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        errorDetails: {
          searched: discovery.searched,
        },
      };
    }
  }

  // No config file found - try env vars fallback
  if (fallbackToEnv) {
    const envConfig = loadFromEnvVars();
    if (envConfig) {
      return {
        success: true,
        config: envConfig,
        source: 'env',
      };
    }
  }

  return {
    success: false,
    error: 'No wpnav.config.json found and required environment variables are not set',
    errorDetails: {
      searched: discovery.searched,
    },
  };
}

/**
 * Convert ResolvedConfig to the legacy WPConfig format for compatibility
 * with existing code (http.ts, tools, etc.)
 */
export function toLegacyConfig(resolved: ResolvedConfig): {
  baseUrl: string;
  restApi: string;
  wpnavBase: string;
  wpnavIntrospect: string;
  auth: {
    username: string;
    password: string;
    signHeaders?: boolean;
    hmacSecret?: string;
  };
  toggles: {
    enableWrites: boolean;
    allowInsecureHttp: boolean;
    toolTimeoutMs: number;
    maxResponseKb: number;
    caBundlePath?: string;
  };
  featureFlags: {
    workflowsEnabled: boolean;
    bulkValidatorEnabled: boolean;
    seoAuditEnabled: boolean;
    contentReviewerEnabled: boolean;
    migrationPlannerEnabled: boolean;
    performanceAnalyzerEnabled: boolean;
  };
} {
  return {
    baseUrl: resolved.site,
    restApi: resolved.rest_api,
    wpnavBase: resolved.wpnav_base,
    wpnavIntrospect: resolved.wpnav_introspect,
    auth: {
      username: resolved.user,
      password: resolved.password,
      signHeaders: resolved.safety.sign_headers || undefined,
      hmacSecret: resolved.safety.hmac_secret || undefined,
    },
    toggles: {
      enableWrites: resolved.safety.enable_writes,
      allowInsecureHttp: resolved.safety.allow_insecure_http,
      toolTimeoutMs: resolved.safety.tool_timeout_ms,
      maxResponseKb: resolved.safety.max_response_kb,
      caBundlePath: resolved.safety.ca_bundle || undefined,
    },
    featureFlags: {
      workflowsEnabled: resolved.features.workflows,
      bulkValidatorEnabled: resolved.features.bulk_validator,
      seoAuditEnabled: resolved.features.seo_audit,
      contentReviewerEnabled: resolved.features.content_reviewer,
      migrationPlannerEnabled: resolved.features.migration_planner,
      performanceAnalyzerEnabled: resolved.features.performance_analyzer,
    },
  };
}
