/**
 * Generic Plugin Settings Extractor
 *
 * Fallback extractor for plugins without a specific implementation.
 * Uses prefix-based option scanning.
 *
 * @package WP_Navigator_Pro
 * @since 2.1.0
 */

import type { PluginSettingsExtractor } from './types.js';

/**
 * Options to always exclude (sensitive data)
 */
const GLOBAL_EXCLUDED_PATTERNS = [
  /_key$/i,
  /_secret$/i,
  /_password$/i,
  /_token$/i,
  /_license/i,
  /api_key/i,
  /secret_key/i,
  /access_token/i,
];

/**
 * Create a generic extractor for a plugin
 * @param slug - Plugin slug
 * @param displayName - Display name
 * @param prefixes - Option prefixes to scan (defaults to slug + underscore)
 */
export function createGenericExtractor(
  slug: string,
  displayName: string,
  prefixes?: string[]
): PluginSettingsExtractor {
  const optionPrefixes = prefixes || [slug.replace(/-/g, '_') + '_'];

  return {
    slug,
    displayName,
    optionPrefixes,

    shouldInclude(optionName: string): boolean {
      // Exclude sensitive options
      if (GLOBAL_EXCLUDED_PATTERNS.some((pattern) => pattern.test(optionName))) {
        return false;
      }
      return optionPrefixes.some((prefix) => optionName.startsWith(prefix));
    },

    extract(options: Record<string, unknown>): Record<string, unknown> {
      const result: Record<string, unknown> = {};

      for (const [key, value] of Object.entries(options)) {
        // Skip sensitive options
        if (GLOBAL_EXCLUDED_PATTERNS.some((pattern) => pattern.test(key))) {
          continue;
        }

        // Include if matches any prefix
        if (optionPrefixes.some((prefix) => key.startsWith(prefix))) {
          result[key] = value;
        }
      }

      return result;
    },
  };
}
