import { describe, it, expect } from 'vitest';
import type { WPConfig } from '../config.js';
import { createCompressionState, type CompressionOptions } from './index.js';

describe('compression/index', () => {
  const baseConfig: WPConfig = {
    baseUrl: 'https://example.com',
    restApi: 'https://example.com/wp-json',
    wpnavBase: 'https://example.com/wpnav',
    wpnavIntrospect: 'https://example.com/wpnav/v1/introspect',
    auth: {
      username: 'user',
      password: 'pass',
    },
    toggles: {
      enableWrites: true,
      allowInsecureHttp: false,
      toolTimeoutMs: 600000,
      maxResponseKb: 64,
      caBundlePath: undefined,
    },
    featureFlags: {
      workflowsEnabled: false,
      bulkValidatorEnabled: false,
      seoAuditEnabled: false,
      contentReviewerEnabled: false,
      migrationPlannerEnabled: false,
      performanceAnalyzerEnabled: false,
    },
  };

  it('creates compact mode by default', () => {
    const state = createCompressionState(baseConfig);
    expect(state.mode).toBe('compact');
    expect(state.maxResponseBytes).toBe(64 * 1024);
  });

  it('respects explicit compact option', () => {
    const options: CompressionOptions = { compact: false };
    const state = createCompressionState(baseConfig, options);
    expect(state.mode).toBe('full');
  });
});
