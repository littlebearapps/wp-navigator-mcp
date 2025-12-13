/**
 * Builder Adapter Registry
 *
 * Central registry for managing builder adapters. Provides auto-detection
 * and lookup functionality for page builder content.
 *
 * @package WP_Navigator_Pro
 * @since 1.2.0
 */

import type {
  BuilderAdapter,
  AdapterRegistration,
  AdapterLookupResult,
  PageData,
  BuilderDetectionResult,
} from './types.js';

/**
 * Builder Adapter Registry
 *
 * Manages registration, lookup, and auto-detection of page builder adapters.
 *
 * @example
 * ```typescript
 * const registry = new AdapterRegistry();
 * registry.register(new GutenbergAdapter(), { priority: 100 });
 * registry.register(new ElementorAdapter(), { priority: 90 });
 *
 * const result = registry.detectBuilder(pageData);
 * if (result) {
 *   const layout = result.adapter.extractLayout(pageData);
 * }
 * ```
 */
export class AdapterRegistry {
  /** Registered adapters by name */
  private adapters: Map<string, AdapterRegistration> = new Map();

  /**
   * Register a builder adapter
   *
   * @param adapter - Adapter instance to register
   * @param options - Registration options
   */
  register(
    adapter: BuilderAdapter,
    options: { priority?: number; enabled?: boolean } = {}
  ): void {
    const { priority = 50, enabled = true } = options;

    if (this.adapters.has(adapter.name)) {
      throw new Error(`Adapter '${adapter.name}' is already registered`);
    }

    this.adapters.set(adapter.name, {
      adapter,
      priority,
      enabled,
    });
  }

  /**
   * Unregister an adapter by name
   *
   * @param name - Adapter name to unregister
   * @returns True if adapter was removed
   */
  unregister(name: string): boolean {
    return this.adapters.delete(name);
  }

  /**
   * Get an adapter by name
   *
   * @param name - Adapter name
   * @returns Adapter instance or undefined
   */
  get(name: string): BuilderAdapter | undefined {
    const registration = this.adapters.get(name);
    return registration?.adapter;
  }

  /**
   * Check if an adapter is registered
   *
   * @param name - Adapter name
   * @returns True if registered
   */
  has(name: string): boolean {
    return this.adapters.has(name);
  }

  /**
   * Enable or disable an adapter
   *
   * @param name - Adapter name
   * @param enabled - Whether to enable
   */
  setEnabled(name: string, enabled: boolean): void {
    const registration = this.adapters.get(name);
    if (registration) {
      registration.enabled = enabled;
    }
  }

  /**
   * Get all registered adapters
   *
   * @returns Array of registered adapters
   */
  getAll(): BuilderAdapter[] {
    return Array.from(this.adapters.values())
      .filter((reg) => reg.enabled)
      .sort((a, b) => b.priority - a.priority)
      .map((reg) => reg.adapter);
  }

  /**
   * Get all enabled and supported adapters
   *
   * @returns Array of supported adapters
   */
  getSupported(): BuilderAdapter[] {
    return this.getAll().filter((adapter) => adapter.supported);
  }

  /**
   * Get adapter names
   *
   * @returns Array of registered adapter names
   */
  getNames(): string[] {
    return Array.from(this.adapters.keys());
  }

  /**
   * Detect which builder was used for a page
   *
   * Iterates through registered adapters (by priority) and returns
   * the first one that confidently detects its content format.
   *
   * @param page - WordPress page data
   * @param minConfidence - Minimum confidence threshold (0-1)
   * @returns Adapter and detection result, or null if no match
   */
  detectBuilder(page: PageData, minConfidence: number = 0.5): AdapterLookupResult | null {
    const adapters = this.getSupported();

    // Collect all detection results
    const results: { adapter: BuilderAdapter; detection: BuilderDetectionResult }[] = [];

    for (const adapter of adapters) {
      try {
        const detection = adapter.detect(page);
        if (detection.detected && detection.confidence >= minConfidence) {
          results.push({ adapter, detection });
        }
      } catch {
        // Skip adapters that throw during detection
        continue;
      }
    }

    // Return highest confidence match
    if (results.length === 0) {
      return null;
    }

    results.sort((a, b) => b.detection.confidence - a.detection.confidence);
    return results[0];
  }

  /**
   * Detect all builders that match a page
   *
   * @param page - WordPress page data
   * @param minConfidence - Minimum confidence threshold (0-1)
   * @returns All matching adapters with detection results
   */
  detectAllBuilders(page: PageData, minConfidence: number = 0.3): AdapterLookupResult[] {
    const adapters = this.getSupported();
    const results: AdapterLookupResult[] = [];

    for (const adapter of adapters) {
      try {
        const detection = adapter.detect(page);
        if (detection.detected && detection.confidence >= minConfidence) {
          results.push({ adapter, detection });
        }
      } catch {
        continue;
      }
    }

    return results.sort((a, b) => b.detection.confidence - a.detection.confidence);
  }

  /**
   * Clear all registered adapters
   */
  clear(): void {
    this.adapters.clear();
  }

  /**
   * Get registry statistics
   */
  getStats(): {
    total: number;
    enabled: number;
    supported: number;
  } {
    const all = Array.from(this.adapters.values());
    return {
      total: all.length,
      enabled: all.filter((r) => r.enabled).length,
      supported: all.filter((r) => r.enabled && r.adapter.supported).length,
    };
  }
}

/**
 * Global adapter registry instance
 *
 * Use this singleton for most cases. Create separate instances
 * only for testing or isolation.
 */
export const adapterRegistry = new AdapterRegistry();
