/**
 * Yoast SEO Settings Extractor
 *
 * Extracts Yoast SEO settings from wp_options.
 *
 * @package WP_Navigator_Pro
 * @since 2.1.0
 */

import type { PluginSettingsExtractor } from './types.js';

/**
 * Core Yoast SEO options to extract
 */
const CORE_OPTIONS = ['wpseo', 'wpseo_titles', 'wpseo_social', 'wpseo_ms'];

/**
 * Option keys to exclude (sensitive or not useful for sync)
 */
const EXCLUDED_KEYS = [
  'wpseo_license',
  'wpseo_premium',
  'wpseo_notification',
  'wpseo_indexation',
  'wpseo_wincher',
];

export const yoastExtractor: PluginSettingsExtractor = {
  slug: 'wordpress-seo',
  displayName: 'Yoast SEO',
  optionPrefixes: ['wpseo_', 'wpseo-'],

  shouldInclude(optionName: string): boolean {
    // Include core options and any starting with wpseo_ but not excluded
    if (CORE_OPTIONS.includes(optionName)) return true;
    if (EXCLUDED_KEYS.some((ex) => optionName.startsWith(ex))) return false;
    return optionName.startsWith('wpseo_') || optionName.startsWith('wpseo-');
  },

  extract(options: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(options)) {
      // Skip excluded keys
      if (EXCLUDED_KEYS.some((ex) => key.startsWith(ex))) continue;

      // Include core options and relevant wpseo_ options
      if (CORE_OPTIONS.includes(key) || key.startsWith('wpseo_') || key.startsWith('wpseo-')) {
        result[key] = value;
      }
    }

    return result;
  },
};
