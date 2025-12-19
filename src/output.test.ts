import { describe, it, expect } from 'vitest';
import type { WPConfig } from './config.js';
import { formatCompressedJson } from './output.js';

describe('output/formatCompressedJson', () => {
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

  it('wraps payload in an envelope with _meta and data', () => {
    const payload = { foo: 'bar' };

    const { json, compression } = formatCompressedJson(payload, baseConfig);

    expect(compression.mode).toBe('compact');

    const parsed = JSON.parse(json) as { _meta: { mode: string }; data: { foo: string } };
    expect(parsed._meta.mode).toBe('compact');
    expect(parsed.data.foo).toBe('bar');
  });

  it('respects compact=false option', () => {
    const payload = { foo: 'bar' };

    const { json, compression } = formatCompressedJson(payload, baseConfig, { compact: false });

    expect(compression.mode).toBe('full');

    const parsed = JSON.parse(json) as { _meta: { mode: string } };
    expect(parsed._meta.mode).toBe('full');
  });
});
