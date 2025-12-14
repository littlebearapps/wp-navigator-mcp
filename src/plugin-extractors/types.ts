/**
 * Plugin Settings Extractor Types
 *
 * Defines interfaces for plugin-specific settings extraction.
 *
 * @package WP_Navigator_Pro
 * @since 2.1.0
 */

/**
 * Plugin settings extractor interface
 * Implement this for plugin-specific option extraction
 */
export interface PluginSettingsExtractor {
  /** Plugin slug (e.g., "woocommerce", "wordpress-seo") */
  slug: string;

  /** Display name for CLI output */
  displayName: string;

  /** Option prefixes to scan (e.g., ["woocommerce_"]) */
  optionPrefixes: string[];

  /**
   * Extract and transform settings from raw options
   * @param options - Raw options fetched from WordPress
   * @returns Cleaned/transformed settings object
   */
  extract(options: Record<string, unknown>): Record<string, unknown>;

  /**
   * Optional: Filter specific options to extract (subset of prefix match)
   * @param optionName - The option key
   * @returns true if option should be included
   */
  shouldInclude?(optionName: string): boolean;
}

/**
 * Extractor registry lookup result
 */
export interface ExtractorLookup {
  /** The extractor if found, or generic fallback */
  extractor: PluginSettingsExtractor;
  /** Whether this is the generic fallback */
  isGeneric: boolean;
}
