/**
 * WP Navigator MCP Resource Registry
 *
 * Central registry for managing MCP resources.
 * Supports static resources (fixed URIs) and dynamic resources (pattern-based).
 *
 * @package WP_Navigator_MCP
 * @since 2.6.0
 */

import type {
  StaticResource,
  DynamicResourceTemplate,
  ResourceContent,
  ResourceGeneratorContext,
  StaticResourceGenerator,
  DynamicResourceGenerator,
} from './types.js';

/**
 * Resource Registry
 *
 * Manages registration and lookup of MCP resources.
 * Similar pattern to ToolRegistry but for read-only resources.
 */
export class ResourceRegistry {
  private staticResources: Map<string, StaticResource> = new Map();
  private staticGenerators: Map<string, StaticResourceGenerator> = new Map();
  private dynamicTemplates: DynamicResourceTemplate[] = [];
  private dynamicGenerators: Map<string, DynamicResourceGenerator> = new Map();

  /**
   * Register a static resource with its content generator
   */
  registerStatic(resource: StaticResource, generator: StaticResourceGenerator): void {
    this.staticResources.set(resource.uri, resource);
    this.staticGenerators.set(resource.uri, generator);
  }

  /**
   * Register a dynamic resource template with its content generator
   *
   * Dynamic resources are pattern-based and expand to multiple URIs at runtime.
   * The generator receives the full URI and must parse the slug from it.
   */
  registerDynamic(template: DynamicResourceTemplate, generator: DynamicResourceGenerator): void {
    this.dynamicTemplates.push(template);
    // Use pattern source as key for generator lookup
    this.dynamicGenerators.set(template.uriPattern.source, generator);
  }

  /**
   * List all available resources (for ListResources response)
   *
   * Returns both static resources and expanded dynamic resources.
   */
  listResources(): Array<{ uri: string; name: string; description?: string; mimeType?: string }> {
    const resources: Array<{
      uri: string;
      name: string;
      description?: string;
      mimeType?: string;
    }> = [];

    // Add static resources
    for (const resource of this.staticResources.values()) {
      resources.push({
        uri: resource.uri,
        name: resource.name,
        description: resource.description,
        mimeType: resource.mimeType,
      });
    }

    // Add dynamic resources by calling listUris for each template
    for (const template of this.dynamicTemplates) {
      try {
        const uris = template.listUris();
        for (const uri of uris) {
          const slug = this.extractSlug(uri, template.uriPattern);
          if (slug) {
            const meta = template.getResourceMeta(slug);
            if (meta) {
              resources.push({
                uri,
                name: meta.name,
                description: meta.description,
                mimeType: template.mimeType,
              });
            }
          }
        }
      } catch {
        // Skip templates that fail to list URIs
        continue;
      }
    }

    return resources;
  }

  /**
   * Read a specific resource by URI
   *
   * Tries static resources first, then dynamic templates.
   */
  async readResource(
    uri: string,
    context: ResourceGeneratorContext
  ): Promise<ResourceContent | null> {
    // Try static resource first
    const staticGenerator = this.staticGenerators.get(uri);
    if (staticGenerator) {
      return staticGenerator(context);
    }

    // Try dynamic templates
    for (const template of this.dynamicTemplates) {
      if (template.uriPattern.test(uri)) {
        const dynamicGenerator = this.dynamicGenerators.get(template.uriPattern.source);
        if (dynamicGenerator) {
          return dynamicGenerator(uri, context);
        }
      }
    }

    return null;
  }

  /**
   * Check if a resource exists
   */
  hasResource(uri: string): boolean {
    // Check static
    if (this.staticResources.has(uri)) {
      return true;
    }

    // Check dynamic
    for (const template of this.dynamicTemplates) {
      if (template.uriPattern.test(uri)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get the count of registered resources
   */
  getResourceCount(): { static: number; dynamicTemplates: number } {
    return {
      static: this.staticResources.size,
      dynamicTemplates: this.dynamicTemplates.length,
    };
  }

  /**
   * Clear all registered resources (useful for testing)
   */
  clear(): void {
    this.staticResources.clear();
    this.staticGenerators.clear();
    this.dynamicTemplates = [];
    this.dynamicGenerators.clear();
  }

  /**
   * Extract slug from URI using pattern
   */
  private extractSlug(uri: string, pattern: RegExp): string | null {
    const match = uri.match(pattern);
    return match?.[1] || null;
  }
}

/**
 * Singleton resource registry instance
 */
export const resourceRegistry = new ResourceRegistry();
