/**
 * WP Navigator MCP Resources Types
 *
 * Type definitions for the MCP Resources system.
 *
 * @package WP_Navigator_MCP
 * @since 2.6.0
 */

/**
 * Resource category for organization
 */
export enum ResourceCategory {
  TOOLS = 'tools',
  SITE = 'site',
  GUIDES = 'guides',
  ROLES = 'roles',
  COOKBOOKS = 'cookbooks',
}

/**
 * Static resource definition (known at registration time)
 */
export interface StaticResource {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
  category: ResourceCategory;
}

/**
 * Dynamic resource template (generates resources at runtime)
 */
export interface DynamicResourceTemplate {
  /** Regex pattern to match URIs (must have one capture group for the slug) */
  uriPattern: RegExp;
  /** Prefix for resource names */
  namePrefix: string;
  /** Default description for resources of this type */
  description: string;
  /** MIME type for all resources of this type */
  mimeType: string;
  /** Category for organization */
  category: ResourceCategory;
  /** Function to list all valid URIs for this template */
  listUris: () => string[];
  /** Function to generate resource metadata for a specific slug */
  getResourceMeta: (slug: string) => { name: string; description: string } | null;
}

/**
 * Resource content result
 */
export interface ResourceContent {
  uri: string;
  mimeType: string;
  text: string;
}

/**
 * Resource generator context (provided to generators)
 */
export interface ResourceGeneratorContext {
  wpRequest: (endpoint: string, options?: RequestInit) => Promise<any>;
  config: {
    baseUrl: string;
    restApi: string;
    toggles?: {
      enableWrites?: boolean;
    };
    [key: string]: unknown;
  };
}

/**
 * Resource generator function signature for static resources
 */
export type StaticResourceGenerator = (
  context: ResourceGeneratorContext
) => Promise<ResourceContent>;

/**
 * Resource generator function signature for dynamic resources
 */
export type DynamicResourceGenerator = (
  uri: string,
  context: ResourceGeneratorContext
) => Promise<ResourceContent | null>;
