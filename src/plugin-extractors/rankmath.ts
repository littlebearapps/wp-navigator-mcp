/**
 * RankMath SEO Settings Extractor
 *
 * Extracts RankMath SEO settings from wp_options.
 *
 * @package WP_Navigator_Pro
 * @since 2.1.0
 */

import type { PluginSettingsExtractor } from './types.js';

/**
 * Core RankMath options to extract
 */
const CORE_OPTIONS = [
  'rank_math_options_general',
  'rank_math_options_titles',
  'rank_math_options_sitemap',
  'rank_math_options_instant_indexing',
];

/**
 * Option keys to exclude (sensitive or not useful for sync)
 */
const EXCLUDED_KEYS = [
  'rank_math_registration',
  'rank_math_connect_data',
  'rank_math_keyword_data',
  'rank_math_analytics',
];

export const rankmathExtractor: PluginSettingsExtractor = {
  slug: 'seo-by-rank-math',
  displayName: 'RankMath SEO',
  optionPrefixes: ['rank_math_', 'rank-math-'],

  shouldInclude(optionName: string): boolean {
    if (CORE_OPTIONS.includes(optionName)) return true;
    if (EXCLUDED_KEYS.some((ex) => optionName.startsWith(ex))) return false;
    return optionName.startsWith('rank_math_') || optionName.startsWith('rank-math-');
  },

  extract(options: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(options)) {
      // Skip excluded keys
      if (EXCLUDED_KEYS.some((ex) => key.startsWith(ex))) continue;

      // Include core options and relevant rank_math_ options
      if (
        CORE_OPTIONS.includes(key) ||
        key.startsWith('rank_math_') ||
        key.startsWith('rank-math-')
      ) {
        result[key] = value;
      }
    }

    return result;
  },
};
