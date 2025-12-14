/**
 * Plugin Settings Extractors Tests
 *
 * @package WP_Navigator_Pro
 * @since 2.1.0
 */

import { describe, it, expect } from 'vitest';
import {
  getExtractor,
  getSupportedPlugins,
  hasSpecificExtractor,
  woocommerceExtractor,
  yoastExtractor,
  rankmathExtractor,
  createGenericExtractor,
} from './index.js';

describe('Plugin Extractors Registry', () => {
  describe('getSupportedPlugins', () => {
    it('returns list of plugins with specific extractors', () => {
      const supported = getSupportedPlugins();
      expect(supported).toContain('woocommerce');
      expect(supported).toContain('wordpress-seo');
      expect(supported).toContain('seo-by-rank-math');
    });
  });

  describe('hasSpecificExtractor', () => {
    it('returns true for supported plugins', () => {
      expect(hasSpecificExtractor('woocommerce')).toBe(true);
      expect(hasSpecificExtractor('wordpress-seo')).toBe(true);
      expect(hasSpecificExtractor('seo-by-rank-math')).toBe(true);
    });

    it('returns true for slug aliases', () => {
      expect(hasSpecificExtractor('yoast-seo')).toBe(true);
      expect(hasSpecificExtractor('rankmath')).toBe(true);
    });

    it('returns false for unknown plugins', () => {
      expect(hasSpecificExtractor('unknown-plugin')).toBe(false);
      expect(hasSpecificExtractor('my-custom-plugin')).toBe(false);
    });
  });

  describe('getExtractor', () => {
    it('returns WooCommerce extractor for woocommerce slug', () => {
      const { extractor, isGeneric } = getExtractor('woocommerce');
      expect(isGeneric).toBe(false);
      expect(extractor.slug).toBe('woocommerce');
      expect(extractor.displayName).toBe('WooCommerce');
    });

    it('returns Yoast extractor for yoast-seo alias', () => {
      const { extractor, isGeneric } = getExtractor('yoast-seo');
      expect(isGeneric).toBe(false);
      expect(extractor.slug).toBe('wordpress-seo');
      expect(extractor.displayName).toBe('Yoast SEO');
    });

    it('returns generic extractor for unknown plugins', () => {
      const { extractor, isGeneric } = getExtractor('my-plugin', 'My Plugin');
      expect(isGeneric).toBe(true);
      expect(extractor.slug).toBe('my-plugin');
      expect(extractor.displayName).toBe('My Plugin');
      expect(extractor.optionPrefixes).toContain('my_plugin_');
    });
  });
});

describe('WooCommerce Extractor', () => {
  it('has correct metadata', () => {
    expect(woocommerceExtractor.slug).toBe('woocommerce');
    expect(woocommerceExtractor.displayName).toBe('WooCommerce');
    expect(woocommerceExtractor.optionPrefixes).toContain('woocommerce_');
  });

  it('extracts core WooCommerce options', () => {
    const options = {
      woocommerce_currency: 'USD',
      woocommerce_default_country: 'US:CA',
      woocommerce_calc_taxes: 'yes',
      woocommerce_api_secret: 'should-be-excluded', // Not in core options
    };

    const result = woocommerceExtractor.extract(options);
    expect(result.woocommerce_currency).toBe('USD');
    expect(result.woocommerce_default_country).toBe('US:CA');
    expect(result.woocommerce_calc_taxes).toBe('yes');
    expect(result.woocommerce_api_secret).toBeUndefined();
  });

  it('shouldInclude filters to core options', () => {
    expect(woocommerceExtractor.shouldInclude?.('woocommerce_currency')).toBe(true);
    expect(woocommerceExtractor.shouldInclude?.('woocommerce_random')).toBe(false);
  });
});

describe('Yoast Extractor', () => {
  it('has correct metadata', () => {
    expect(yoastExtractor.slug).toBe('wordpress-seo');
    expect(yoastExtractor.displayName).toBe('Yoast SEO');
    expect(yoastExtractor.optionPrefixes).toContain('wpseo_');
  });

  it('extracts Yoast SEO options', () => {
    const options = {
      wpseo: { version: '21.0' },
      wpseo_titles: { title: 'Site Title' },
      wpseo_license: { key: 'xxx' }, // Should be excluded
    };

    const result = yoastExtractor.extract(options);
    expect(result.wpseo).toEqual({ version: '21.0' });
    expect(result.wpseo_titles).toEqual({ title: 'Site Title' });
    expect(result.wpseo_license).toBeUndefined();
  });
});

describe('RankMath Extractor', () => {
  it('has correct metadata', () => {
    expect(rankmathExtractor.slug).toBe('seo-by-rank-math');
    expect(rankmathExtractor.displayName).toBe('RankMath SEO');
    expect(rankmathExtractor.optionPrefixes).toContain('rank_math_');
  });

  it('extracts RankMath options', () => {
    const options = {
      rank_math_options_general: { version: '1.0' },
      rank_math_connect_data: { api: 'xxx' }, // Should be excluded
    };

    const result = rankmathExtractor.extract(options);
    expect(result.rank_math_options_general).toEqual({ version: '1.0' });
    expect(result.rank_math_connect_data).toBeUndefined();
  });
});

describe('Generic Extractor', () => {
  it('creates extractor with default prefix from slug', () => {
    const extractor = createGenericExtractor('my-plugin', 'My Plugin');
    expect(extractor.slug).toBe('my-plugin');
    expect(extractor.optionPrefixes).toContain('my_plugin_');
  });

  it('creates extractor with custom prefixes', () => {
    const extractor = createGenericExtractor('custom', 'Custom', ['custom_', 'cust_']);
    expect(extractor.optionPrefixes).toContain('custom_');
    expect(extractor.optionPrefixes).toContain('cust_');
  });

  it('extracts options matching prefix', () => {
    const extractor = createGenericExtractor('test', 'Test');
    const options = {
      test_setting_1: 'value1',
      test_setting_2: 'value2',
      other_setting: 'other', // Should not be included
    };

    const result = extractor.extract(options);
    expect(result.test_setting_1).toBe('value1');
    expect(result.test_setting_2).toBe('value2');
    expect(result.other_setting).toBeUndefined();
  });

  it('excludes sensitive options', () => {
    const extractor = createGenericExtractor('test', 'Test');
    const options = {
      test_api_key: 'secret',
      test_secret_key: 'secret',
      test_password: 'secret',
      test_license: 'secret',
      test_normal: 'value',
    };

    const result = extractor.extract(options);
    expect(result.test_api_key).toBeUndefined();
    expect(result.test_secret_key).toBeUndefined();
    expect(result.test_password).toBeUndefined();
    expect(result.test_license).toBeUndefined();
    expect(result.test_normal).toBe('value');
  });
});
