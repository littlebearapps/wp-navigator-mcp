/**
 * Export Environment Command Tests
 *
 * @package WP_Navigator_MCP
 * @since 2.3.0
 */

import { describe, it, expect } from 'vitest';
import {
  configToEnvVars,
  formatAsShell,
  formatAsDocker,
  formatAsGitHub,
  type ExportFormat,
} from './export-env.js';
import type { ResolvedConfig } from '../../wpnav-config.js';

// Mock config for testing
const mockConfig: ResolvedConfig = {
  config_path: './wpnav.config.json',
  environment: 'production',
  site: 'https://example.com',
  rest_api: 'https://example.com/wp-json',
  wpnav_base: 'https://example.com/wp-json/wpnav/v1',
  wpnav_introspect: 'https://example.com/wp-json/wpnav/v1/introspect',
  user: 'admin',
  password: 'xxxx xxxx xxxx xxxx',
  safety: {
    enable_writes: false,
    allow_insecure_http: false,
    tool_timeout_ms: 600000,
    max_response_kb: 64,
    sign_headers: false,
    hmac_secret: '',
    ca_bundle: '',
  },
  features: {
    workflows: false,
    bulk_validator: false,
    seo_audit: false,
    content_reviewer: false,
    migration_planner: false,
    performance_analyzer: false,
  },
  default_role: undefined,
};

describe('export-env', () => {
  describe('configToEnvVars', () => {
    it('converts config to environment variables', () => {
      const vars = configToEnvVars(mockConfig);

      expect(vars.WP_BASE_URL).toBe('https://example.com');
      expect(vars.WP_REST_API).toBe('https://example.com/wp-json');
      expect(vars.WPNAV_BASE).toBe('https://example.com/wp-json/wpnav/v1');
      expect(vars.WP_APP_USER).toBe('admin');
      expect(vars.WP_APP_PASS).toBe('xxxx xxxx xxxx xxxx');
      expect(vars.WPNAV_ENABLE_WRITES).toBe('0');
    });

    it('includes safety settings', () => {
      const configWithSafety: ResolvedConfig = {
        ...mockConfig,
        safety: {
          ...mockConfig.safety,
          enable_writes: true,
          allow_insecure_http: true,
          tool_timeout_ms: 300000,
          max_response_kb: 128,
        },
      };

      const vars = configToEnvVars(configWithSafety);

      expect(vars.WPNAV_ENABLE_WRITES).toBe('1');
      expect(vars.ALLOW_INSECURE_HTTP).toBe('1');
      expect(vars.WPNAV_TOOL_TIMEOUT_MS).toBe('300000');
      expect(vars.WPNAV_MAX_RESPONSE_KB).toBe('128');
    });

    it('includes optional safety settings when set', () => {
      const configWithHmac: ResolvedConfig = {
        ...mockConfig,
        safety: {
          ...mockConfig.safety,
          sign_headers: true,
          hmac_secret: 'secret123',
          ca_bundle: '/path/to/ca.pem',
        },
      };

      const vars = configToEnvVars(configWithHmac);

      expect(vars.WPNAV_SIGN_HEADERS).toBe('1');
      expect(vars.WPNAV_HMAC_SECRET).toBe('secret123');
      expect(vars.WPNAV_CA_BUNDLE).toBe('/path/to/ca.pem');
    });

    it('includes feature flags when enabled', () => {
      const configWithFeatures: ResolvedConfig = {
        ...mockConfig,
        features: {
          workflows: true,
          bulk_validator: true,
          seo_audit: false,
          content_reviewer: false,
          migration_planner: false,
          performance_analyzer: false,
        },
      };

      const vars = configToEnvVars(configWithFeatures);

      expect(vars.WPNAV_FLAG_WORKFLOWS_ENABLED).toBe('1');
      expect(vars.WPNAV_FLAG_WP_BULK_VALIDATOR_ENABLED).toBe('1');
      expect(vars.WPNAV_FLAG_WP_SEO_AUDIT_ENABLED).toBeUndefined();
    });

    it('includes environment and role when set', () => {
      const configWithRole: ResolvedConfig = {
        ...mockConfig,
        environment: 'staging',
        default_role: 'content-editor',
      };

      const vars = configToEnvVars(configWithRole);

      // WPNAV_ENV is the short form (preferred), WPNAV_ENVIRONMENT is legacy
      expect(vars.WPNAV_ENV).toBe('staging');
      expect(vars.WPNAV_ENVIRONMENT).toBe('staging');
      expect(vars.WPNAV_ROLE).toBe('content-editor');
    });
  });

  describe('formatAsShell', () => {
    it('formats variables as shell export statements', () => {
      const vars = {
        WP_BASE_URL: 'https://example.com',
        WP_APP_USER: 'admin',
      };

      const output = formatAsShell(vars);

      expect(output).toContain('# WP Navigator Environment Variables');
      expect(output).toContain('export WP_BASE_URL="https://example.com"');
      expect(output).toContain('export WP_APP_USER="admin"');
    });

    it('includes config path in header', () => {
      const vars = { WP_BASE_URL: 'https://example.com' };
      const output = formatAsShell(vars, './custom/path.json');

      expect(output).toContain('# Generated from ./custom/path.json');
    });

    it('escapes quotes in values', () => {
      const vars = { TEST_VAR: 'value with "quotes"' };
      const output = formatAsShell(vars);

      expect(output).toContain('export TEST_VAR="value with \\"quotes\\""');
    });
  });

  describe('formatAsDocker', () => {
    it('formats variables as Docker ENV statements', () => {
      const vars = {
        WP_BASE_URL: 'https://example.com',
        WP_APP_USER: 'admin',
      };

      const output = formatAsDocker(vars);

      expect(output).toContain('# WP Navigator Environment Variables');
      expect(output).toContain('ENV WP_BASE_URL=https://example.com');
      expect(output).toContain('ENV WP_APP_USER=admin');
    });

    it('quotes values with spaces', () => {
      const vars = { WP_APP_PASS: 'xxxx xxxx xxxx xxxx' };
      const output = formatAsDocker(vars);

      expect(output).toContain('ENV WP_APP_PASS="xxxx xxxx xxxx xxxx"');
    });
  });

  describe('formatAsGitHub', () => {
    it('formats variables as GitHub Actions env format', () => {
      const vars = {
        WP_BASE_URL: 'https://example.com',
        WP_APP_USER: 'admin',
      };

      const output = formatAsGitHub(vars);

      expect(output).toContain('# WP Navigator Environment Variables');
      expect(output).toContain('env:');
      expect(output).toContain('  WP_BASE_URL: "https://example.com"');
      expect(output).toContain('  WP_APP_USER: "admin"');
    });

    it('includes comment about usage', () => {
      const vars = { WP_BASE_URL: 'https://example.com' };
      const output = formatAsGitHub(vars);

      expect(output).toContain('# Add to .github/workflows/*.yml');
    });
  });
});
