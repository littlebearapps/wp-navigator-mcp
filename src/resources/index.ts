/**
 * WP Navigator MCP Resources Module
 *
 * Entry point for the MCP Resources system.
 * Provides read-only context resources for AI clients.
 *
 * @package WP_Navigator_MCP
 * @since 2.6.0
 */

// Re-export core components
export { resourceRegistry, ResourceRegistry } from './registry.js';
export { handleListResources, handleReadResource } from './handlers.js';
export * from './types.js';

// Import generators
import {
  generateToolsOverview,
  generateSiteContext,
  generateGuide,
  getGuideResourceMeta,
  AVAILABLE_GUIDES,
  generateRolesList,
  generateRoleContent,
  listRoleUris,
  getRoleResourceMeta,
  generateCookbooksList,
  generateCookbookContent,
  listCookbookUris,
  getCookbookResourceMeta,
} from './generators/index.js';

import { resourceRegistry } from './registry.js';
import { ResourceCategory } from './types.js';
import type { ResourceContent, ResourceGeneratorContext } from './types.js';

/**
 * Register all WP Navigator resources
 *
 * Called at server startup to populate the resource registry.
 */
export function registerAllResources(): void {
  // Clear any existing registrations (for testing)
  resourceRegistry.clear();

  // =========================================================================
  // STATIC: Tools Overview
  // =========================================================================
  resourceRegistry.registerStatic(
    {
      uri: 'wpnav://tools/overview',
      name: 'Tools Overview',
      description: 'Categorized list of all available WP Navigator tools with use cases',
      mimeType: 'text/markdown',
      category: ResourceCategory.TOOLS,
    },
    generateToolsOverview
  );

  // =========================================================================
  // STATIC: Site Context
  // =========================================================================
  resourceRegistry.registerStatic(
    {
      uri: 'wpnav://site/context',
      name: 'Site Context',
      description: 'Current WordPress site information including theme, plugins, and configuration',
      mimeType: 'text/markdown',
      category: ResourceCategory.SITE,
    },
    generateSiteContext
  );

  // =========================================================================
  // STATIC: Guides
  // =========================================================================
  for (const guideName of AVAILABLE_GUIDES) {
    const meta = getGuideResourceMeta(guideName);
    if (meta) {
      resourceRegistry.registerStatic(
        {
          uri: `wpnav://guides/${guideName}`,
          name: meta.name,
          description: meta.description,
          mimeType: 'text/markdown',
          category: ResourceCategory.GUIDES,
        },
        async (ctx: ResourceGeneratorContext): Promise<ResourceContent> => {
          const result = await generateGuide(`wpnav://guides/${guideName}`, ctx);
          if (!result) {
            throw new Error(`Guide not found: ${guideName}`);
          }
          return result;
        }
      );
    }
  }

  // =========================================================================
  // STATIC: Roles List
  // =========================================================================
  resourceRegistry.registerStatic(
    {
      uri: 'wpnav://roles/list',
      name: 'Roles List',
      description: 'List of all available AI roles with metadata',
      mimeType: 'text/markdown',
      category: ResourceCategory.ROLES,
    },
    generateRolesList
  );

  // =========================================================================
  // DYNAMIC: Individual Roles
  // =========================================================================
  resourceRegistry.registerDynamic(
    {
      uriPattern: /^wpnav:\/\/roles\/([^/]+)$/,
      namePrefix: 'Role:',
      description: 'AI role definition with context and tool access',
      mimeType: 'text/markdown',
      category: ResourceCategory.ROLES,
      listUris: listRoleUris,
      getResourceMeta: getRoleResourceMeta,
    },
    generateRoleContent
  );

  // =========================================================================
  // STATIC: Cookbooks List
  // =========================================================================
  resourceRegistry.registerStatic(
    {
      uri: 'wpnav://cookbooks/list',
      name: 'Cookbooks List',
      description: 'List of all available plugin cookbooks with metadata',
      mimeType: 'text/markdown',
      category: ResourceCategory.COOKBOOKS,
    },
    generateCookbooksList
  );

  // =========================================================================
  // DYNAMIC: Individual Cookbooks
  // =========================================================================
  resourceRegistry.registerDynamic(
    {
      uriPattern: /^wpnav:\/\/cookbooks\/([^/]+)$/,
      namePrefix: 'Cookbook:',
      description: 'Plugin-specific AI guidance cookbook',
      mimeType: 'text/markdown',
      category: ResourceCategory.COOKBOOKS,
      listUris: listCookbookUris,
      getResourceMeta: getCookbookResourceMeta,
    },
    generateCookbookContent
  );
}
