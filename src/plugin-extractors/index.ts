/**
 * Plugin Settings Extractors Module
 *
 * Registry and extractors for plugin-specific settings extraction.
 *
 * @package WP_Navigator_Pro
 * @since 2.1.0
 */

export * from './types.js';
export { woocommerceExtractor } from './woocommerce.js';
export { yoastExtractor } from './yoast.js';
export { rankmathExtractor } from './rankmath.js';
export { createGenericExtractor } from './generic.js';

import type { PluginSettingsExtractor, ExtractorLookup } from './types.js';
import { woocommerceExtractor } from './woocommerce.js';
import { yoastExtractor } from './yoast.js';
import { rankmathExtractor } from './rankmath.js';
import { createGenericExtractor } from './generic.js';

/**
 * Registry of known plugin extractors
 */
const extractorRegistry: Map<string, PluginSettingsExtractor> = new Map([
  [woocommerceExtractor.slug, woocommerceExtractor],
  [yoastExtractor.slug, yoastExtractor],
  [rankmathExtractor.slug, rankmathExtractor],
]);

/**
 * Slug aliases for common variations
 */
const slugAliases: Record<string, string> = {
  'yoast-seo': 'wordpress-seo',
  yoast: 'wordpress-seo',
  rankmath: 'seo-by-rank-math',
  'rank-math': 'seo-by-rank-math',
};

/**
 * Get extractor for a plugin slug
 * Returns specific extractor if available, otherwise creates generic one
 */
export function getExtractor(slug: string, displayName?: string): ExtractorLookup {
  // Normalize slug
  const normalizedSlug = slug.toLowerCase().replace(/\s+/g, '-');

  // Check for alias
  const resolvedSlug = slugAliases[normalizedSlug] || normalizedSlug;

  // Check registry
  const extractor = extractorRegistry.get(resolvedSlug);
  if (extractor) {
    return { extractor, isGeneric: false };
  }

  // Create generic extractor
  return {
    extractor: createGenericExtractor(normalizedSlug, displayName || slug),
    isGeneric: true,
  };
}

/**
 * Get all registered extractors
 */
export function getAllExtractors(): PluginSettingsExtractor[] {
  return Array.from(extractorRegistry.values());
}

/**
 * Check if a plugin has a specific (non-generic) extractor
 */
export function hasSpecificExtractor(slug: string): boolean {
  const normalizedSlug = slug.toLowerCase().replace(/\s+/g, '-');
  const resolvedSlug = slugAliases[normalizedSlug] || normalizedSlug;
  return extractorRegistry.has(resolvedSlug);
}

/**
 * Get list of supported plugin slugs (with specific extractors)
 */
export function getSupportedPlugins(): string[] {
  return Array.from(extractorRegistry.keys());
}
