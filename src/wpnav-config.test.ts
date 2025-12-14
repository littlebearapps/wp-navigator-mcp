/**
 * Tests for wpnav.config.json schema and loader
 *
 * @package WP_Navigator_MCP
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  CONFIG_SCHEMA_VERSION,
  discoverConfigFile,
  resolveEnvVars,
  containsEnvVars,
  parseConfigFile,
  resolveConfig,
  loadWpnavConfig,
  toLegacyConfig,
  ConfigValidationError,
  type WPNavConfigFile,
} from './wpnav-config.js';

// Mock fs module
vi.mock('fs');
const mockFs = vi.mocked(fs);

describe('wpnav-config', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Clear env vars
    delete process.env.WP_APP_PASS;
    delete process.env.MY_SECRET;
    delete process.env.WP_BASE_URL;
    delete process.env.WP_REST_API;
    delete process.env.WPNAV_BASE;
    delete process.env.WPNAV_INTROSPECT;
    delete process.env.WP_APP_USER;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('CONFIG_SCHEMA_VERSION', () => {
    it('should be defined', () => {
      expect(CONFIG_SCHEMA_VERSION).toBe('1.0');
    });
  });

  describe('resolveEnvVars', () => {
    it('should resolve $VAR_NAME syntax at end of string', () => {
      process.env.MY_SECRET = 'secret123';
      expect(resolveEnvVars('prefix_$MY_SECRET')).toBe('prefix_secret123');
    });

    it('should resolve $VAR_NAME syntax followed by non-identifier char', () => {
      process.env.MY_SECRET = 'secret123';
      expect(resolveEnvVars('$MY_SECRET/path')).toBe('secret123/path');
      expect(resolveEnvVars('$MY_SECRET:value')).toBe('secret123:value');
      expect(resolveEnvVars('$MY_SECRET-suffix')).toBe('secret123-suffix');
    });

    it('should resolve ${VAR_NAME} syntax with explicit boundaries', () => {
      process.env.MY_SECRET = 'secret123';
      expect(resolveEnvVars('prefix_${MY_SECRET}_suffix')).toBe('prefix_secret123_suffix');
    });

    it('should resolve multiple env vars', () => {
      process.env.VAR_A = 'aaa';
      process.env.VAR_B = 'bbb';
      expect(resolveEnvVars('$VAR_A and ${VAR_B}')).toBe('aaa and bbb');
    });

    it('should throw for undefined env vars', () => {
      expect(() => resolveEnvVars('$UNDEFINED_VAR')).toThrow(
        'Environment variable UNDEFINED_VAR is not set'
      );
    });

    it('should return string unchanged if no env vars', () => {
      expect(resolveEnvVars('plain string')).toBe('plain string');
    });

    it('should handle empty string', () => {
      expect(resolveEnvVars('')).toBe('');
    });
  });

  describe('containsEnvVars', () => {
    it('should detect $VAR_NAME', () => {
      expect(containsEnvVars('$MY_VAR')).toBe(true);
    });

    it('should detect ${VAR_NAME}', () => {
      expect(containsEnvVars('${MY_VAR}')).toBe(true);
    });

    it('should return false for plain strings', () => {
      expect(containsEnvVars('no env vars here')).toBe(false);
    });
  });

  describe('discoverConfigFile', () => {
    it('should find wpnav.config.json in current directory', () => {
      const testDir = '/test/project';
      mockFs.existsSync.mockImplementation((p) => {
        return p === path.join(testDir, 'wpnav.config.json');
      });

      const result = discoverConfigFile(testDir);

      expect(result.found).toBe(true);
      expect(result.path).toBe(path.join(testDir, 'wpnav.config.json'));
    });

    it('should find .wpnav.config.json (hidden file)', () => {
      const testDir = '/test/project';
      mockFs.existsSync.mockImplementation((p) => {
        return p === path.join(testDir, '.wpnav.config.json');
      });

      const result = discoverConfigFile(testDir);

      expect(result.found).toBe(true);
      expect(result.path).toBe(path.join(testDir, '.wpnav.config.json'));
    });

    it('should prefer wpnav.config.json over .wpnav.config.json', () => {
      const testDir = '/test/project';
      mockFs.existsSync.mockImplementation((p) => {
        return (
          p === path.join(testDir, 'wpnav.config.json') ||
          p === path.join(testDir, '.wpnav.config.json')
        );
      });

      const result = discoverConfigFile(testDir);

      expect(result.found).toBe(true);
      expect(result.path).toBe(path.join(testDir, 'wpnav.config.json'));
    });

    it('should walk up directory tree', () => {
      const testDir = '/test/project/src/deep';
      const parentConfig = '/test/project/wpnav.config.json';

      mockFs.existsSync.mockImplementation((p) => {
        return p === parentConfig;
      });

      const result = discoverConfigFile(testDir);

      expect(result.found).toBe(true);
      expect(result.path).toBe(parentConfig);
      expect(result.searched.length).toBeGreaterThan(1);
    });

    it('should return not found if no config exists', () => {
      mockFs.existsSync.mockReturnValue(false);

      const result = discoverConfigFile('/test/project');

      expect(result.found).toBe(false);
      expect(result.path).toBeUndefined();
      expect(result.searched.length).toBeGreaterThan(0);
    });

    it('should track searched directories', () => {
      mockFs.existsSync.mockReturnValue(false);

      const result = discoverConfigFile('/a/b/c');

      expect(result.searched).toContain('/a/b/c');
      expect(result.searched).toContain('/a/b');
      expect(result.searched).toContain('/a');
    });
  });

  describe('parseConfigFile', () => {
    const validConfig: WPNavConfigFile = {
      config_version: '1.0',
      environments: {
        default: {
          site: 'https://example.com',
          user: 'admin',
          password: '$WP_APP_PASS',
        },
      },
    };

    it('should parse valid config file', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(validConfig));

      const result = parseConfigFile('/test/wpnav.config.json');

      expect(result.config_version).toBe('1.0');
      expect(result.environments.default.site).toBe('https://example.com');
    });

    it('should throw for missing file', () => {
      mockFs.existsSync.mockReturnValue(false);

      expect(() => parseConfigFile('/test/missing.json')).toThrow(ConfigValidationError);
    });

    it('should throw for invalid JSON', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('not valid json');

      expect(() => parseConfigFile('/test/invalid.json')).toThrow(ConfigValidationError);
    });

    it('should throw for missing config_version', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify({ environments: {} }));

      expect(() => parseConfigFile('/test/bad.json')).toThrow(/config_version/);
    });

    it('should throw for missing environments', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify({ config_version: '1.0' }));

      expect(() => parseConfigFile('/test/bad.json')).toThrow(/environments/);
    });

    it('should throw for empty environments', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(
        JSON.stringify({ config_version: '1.0', environments: {} })
      );

      expect(() => parseConfigFile('/test/bad.json')).toThrow(/At least one environment/);
    });

    it('should throw for environment missing site', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(
        JSON.stringify({
          config_version: '1.0',
          environments: {
            default: { user: 'admin', password: 'pass' },
          },
        })
      );

      expect(() => parseConfigFile('/test/bad.json')).toThrow(/site/);
    });

    it('should throw for environment missing user', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(
        JSON.stringify({
          config_version: '1.0',
          environments: {
            default: { site: 'https://example.com', password: 'pass' },
          },
        })
      );

      expect(() => parseConfigFile('/test/bad.json')).toThrow(/user/);
    });

    it('should throw for environment missing password', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(
        JSON.stringify({
          config_version: '1.0',
          environments: {
            default: { site: 'https://example.com', user: 'admin' },
          },
        })
      );

      expect(() => parseConfigFile('/test/bad.json')).toThrow(/password/);
    });
  });

  describe('resolveConfig', () => {
    const baseConfig: WPNavConfigFile = {
      config_version: '1.0',
      environments: {
        default: {
          site: 'https://example.com',
          user: 'admin',
          password: 'plainpass',
        },
        staging: {
          site: 'https://staging.example.com',
          user: 'stage_admin',
          password: '$WP_APP_PASS',
        },
      },
    };

    it('should resolve default environment', () => {
      const result = resolveConfig(baseConfig, '/test/config.json');

      expect(result.environment).toBe('default');
      expect(result.site).toBe('https://example.com');
      expect(result.user).toBe('admin');
      expect(result.password).toBe('plainpass');
    });

    it('should resolve specified environment', () => {
      process.env.WP_APP_PASS = 'secret_pass';
      const result = resolveConfig(baseConfig, '/test/config.json', 'staging');

      expect(result.environment).toBe('staging');
      expect(result.site).toBe('https://staging.example.com');
      expect(result.password).toBe('secret_pass');
    });

    it('should use default_environment if specified', () => {
      const config: WPNavConfigFile = {
        ...baseConfig,
        default_environment: 'staging',
      };
      process.env.WP_APP_PASS = 'secret_pass';

      const result = resolveConfig(config, '/test/config.json');

      expect(result.environment).toBe('staging');
    });

    it('should throw for unknown environment', () => {
      expect(() => resolveConfig(baseConfig, '/test/config.json', 'unknown')).toThrow(
        /Environment 'unknown' not found/
      );
    });

    it('should build URLs correctly', () => {
      const result = resolveConfig(baseConfig, '/test/config.json');

      expect(result.rest_api).toBe('https://example.com/wp-json');
      expect(result.wpnav_base).toBe('https://example.com/wp-json/wpnav/v1');
      expect(result.wpnav_introspect).toBe('https://example.com/wp-json/wpnav/v1/introspect');
    });

    it('should use custom URLs if provided', () => {
      const config: WPNavConfigFile = {
        config_version: '1.0',
        environments: {
          default: {
            site: 'https://example.com',
            rest_api: 'https://api.example.com/wp-json',
            wpnav_base: 'https://api.example.com/wp-json/wpnav/v1',
            user: 'admin',
            password: 'pass',
          },
        },
      };

      const result = resolveConfig(config, '/test/config.json');

      expect(result.rest_api).toBe('https://api.example.com/wp-json');
      expect(result.wpnav_base).toBe('https://api.example.com/wp-json/wpnav/v1');
    });

    it('should strip trailing slash from site', () => {
      const config: WPNavConfigFile = {
        config_version: '1.0',
        environments: {
          default: {
            site: 'https://example.com/',
            user: 'admin',
            password: 'pass',
          },
        },
      };

      const result = resolveConfig(config, '/test/config.json');

      expect(result.site).toBe('https://example.com');
    });

    it('should apply default safety settings', () => {
      const result = resolveConfig(baseConfig, '/test/config.json');

      expect(result.safety.enable_writes).toBe(true);
      expect(result.safety.allow_insecure_http).toBe(false);
      expect(result.safety.tool_timeout_ms).toBe(600000);
      expect(result.safety.max_response_kb).toBe(64);
    });

    it('should merge global and environment safety settings', () => {
      const config: WPNavConfigFile = {
        config_version: '1.0',
        safety: {
          enable_writes: true,
          tool_timeout_ms: 300000,
        },
        environments: {
          default: {
            site: 'https://example.com',
            user: 'admin',
            password: 'pass',
            safety: {
              max_response_kb: 128,
            },
          },
        },
      };

      const result = resolveConfig(config, '/test/config.json');

      // Global setting
      expect(result.safety.enable_writes).toBe(true);
      expect(result.safety.tool_timeout_ms).toBe(300000);
      // Environment override
      expect(result.safety.max_response_kb).toBe(128);
      // Default
      expect(result.safety.allow_insecure_http).toBe(false);
    });

    it('should throw if sign_headers enabled without hmac_secret', () => {
      const config: WPNavConfigFile = {
        config_version: '1.0',
        environments: {
          default: {
            site: 'https://example.com',
            user: 'admin',
            password: 'pass',
            safety: {
              sign_headers: true,
            },
          },
        },
      };

      expect(() => resolveConfig(config, '/test/config.json')).toThrow(/hmac_secret/);
    });

    it('should resolve env vars in hmac_secret', () => {
      process.env.MY_SECRET = 'hmac_secret_value';
      const config: WPNavConfigFile = {
        config_version: '1.0',
        environments: {
          default: {
            site: 'https://example.com',
            user: 'admin',
            password: 'pass',
            safety: {
              sign_headers: true,
              hmac_secret: '$MY_SECRET',
            },
          },
        },
      };

      const result = resolveConfig(config, '/test/config.json');

      expect(result.safety.hmac_secret).toBe('hmac_secret_value');
    });
  });

  describe('loadWpnavConfig', () => {
    it('should load from explicit path', () => {
      const validConfig: WPNavConfigFile = {
        config_version: '1.0',
        environments: {
          default: {
            site: 'https://example.com',
            user: 'admin',
            password: 'pass',
          },
        },
      };

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(validConfig));

      const result = loadWpnavConfig({ configPath: '/explicit/config.json' });

      expect(result.success).toBe(true);
      expect(result.source).toBe('file');
      expect(result.config?.site).toBe('https://example.com');
    });

    it('should discover config via walk-up', () => {
      const validConfig: WPNavConfigFile = {
        config_version: '1.0',
        environments: {
          default: {
            site: 'https://example.com',
            user: 'admin',
            password: 'pass',
          },
        },
      };

      mockFs.existsSync.mockImplementation((p) => {
        return p === '/test/wpnav.config.json';
      });
      mockFs.readFileSync.mockReturnValue(JSON.stringify(validConfig));

      const result = loadWpnavConfig({ startDir: '/test/src/deep' });

      expect(result.success).toBe(true);
      expect(result.source).toBe('file');
    });

    it('should fall back to env vars', () => {
      mockFs.existsSync.mockReturnValue(false);

      process.env.WP_BASE_URL = 'https://env.example.com';
      process.env.WP_REST_API = 'https://env.example.com/wp-json';
      process.env.WPNAV_BASE = 'https://env.example.com/wp-json/wpnav/v1';
      process.env.WPNAV_INTROSPECT = 'https://env.example.com/wp-json/wpnav/v1/introspect';
      process.env.WP_APP_USER = 'env_user';
      process.env.WP_APP_PASS = 'env_pass';

      const result = loadWpnavConfig({ fallbackToEnv: true });

      expect(result.success).toBe(true);
      expect(result.source).toBe('env');
      expect(result.config?.site).toBe('https://env.example.com');
    });

    it('should fail if no config and env vars missing', () => {
      mockFs.existsSync.mockReturnValue(false);

      const result = loadWpnavConfig({ fallbackToEnv: true });

      expect(result.success).toBe(false);
      expect(result.error).toContain('No wpnav.config.json found');
    });

    it('should not fall back to env if disabled', () => {
      mockFs.existsSync.mockReturnValue(false);

      process.env.WP_BASE_URL = 'https://env.example.com';
      process.env.WP_REST_API = 'https://env.example.com/wp-json';
      process.env.WPNAV_BASE = 'https://env.example.com/wp-json/wpnav/v1';
      process.env.WPNAV_INTROSPECT = 'https://env.example.com/wp-json/wpnav/v1/introspect';
      process.env.WP_APP_USER = 'env_user';
      process.env.WP_APP_PASS = 'env_pass';

      const result = loadWpnavConfig({ fallbackToEnv: false });

      expect(result.success).toBe(false);
    });

    it('should include searched directories in error details', () => {
      mockFs.existsSync.mockReturnValue(false);

      const result = loadWpnavConfig({ startDir: '/test/dir' });

      expect(result.errorDetails?.searched).toBeDefined();
      expect(result.errorDetails?.searched?.length).toBeGreaterThan(0);
    });
  });

  describe('toLegacyConfig', () => {
    it('should convert resolved config to legacy format', () => {
      const resolved = {
        environment: 'default',
        config_path: '/test/config.json',
        site: 'https://example.com',
        rest_api: 'https://example.com/wp-json',
        wpnav_base: 'https://example.com/wp-json/wpnav/v1',
        wpnav_introspect: 'https://example.com/wp-json/wpnav/v1/introspect',
        user: 'admin',
        password: 'secret',
        safety: {
          enable_writes: true,
          allow_insecure_http: false,
          tool_timeout_ms: 300000,
          max_response_kb: 128,
          sign_headers: false,
          hmac_secret: '',
          ca_bundle: '',
        },
        features: {
          workflows: true,
          bulk_validator: false,
          seo_audit: false,
          content_reviewer: false,
          migration_planner: false,
          performance_analyzer: false,
        },
      };

      const legacy = toLegacyConfig(resolved);

      expect(legacy.baseUrl).toBe('https://example.com');
      expect(legacy.restApi).toBe('https://example.com/wp-json');
      expect(legacy.wpnavBase).toBe('https://example.com/wp-json/wpnav/v1');
      expect(legacy.wpnavIntrospect).toBe('https://example.com/wp-json/wpnav/v1/introspect');
      expect(legacy.auth.username).toBe('admin');
      expect(legacy.auth.password).toBe('secret');
      expect(legacy.toggles.enableWrites).toBe(true);
      expect(legacy.toggles.toolTimeoutMs).toBe(300000);
      expect(legacy.featureFlags.workflowsEnabled).toBe(true);
    });
  });
});
