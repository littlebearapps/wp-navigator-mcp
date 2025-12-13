/**
 * Adapters Module
 *
 * Exports builder adapter types, registry, and implementations.
 *
 * @package WP_Navigator_Pro
 * @since 1.2.0
 */

// Types
export type {
  PageData,
  BuilderDetectionResult,
  ConversionOptions,
  ConversionResult,
  ConversionWarning,
  AdapterVersion,
  AdapterCapabilities,
  BuilderAdapter,
  AdapterRegistration,
  AdapterLookupResult,
} from './types.js';

// Registry
export { AdapterRegistry, adapterRegistry } from './registry.js';

// Adapters
export { GutenbergAdapter, gutenbergAdapter } from './gutenberg.js';
export { ElementorAdapter, elementorAdapter } from './elementor.js';
export { WPBakeryAdapter, wpbakeryAdapter } from './wpbakery.js';
