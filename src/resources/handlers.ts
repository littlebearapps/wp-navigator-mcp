/**
 * WP Navigator MCP Resource Handlers
 *
 * Implements ListResources and ReadResource protocol handlers.
 *
 * @package WP_Navigator_MCP
 * @since 2.6.0
 */

import { resourceRegistry } from './registry.js';
import type { ResourceGeneratorContext } from './types.js';

/**
 * Handle ListResources request
 *
 * Returns all available resources (static + expanded dynamic).
 */
export async function handleListResources(): Promise<{
  resources: Array<{
    uri: string;
    name: string;
    description?: string;
    mimeType?: string;
  }>;
}> {
  const resources = resourceRegistry.listResources();
  return { resources };
}

/**
 * Handle ReadResource request
 *
 * Returns content for a specific resource URI.
 * Throws error if resource not found.
 */
export async function handleReadResource(
  uri: string,
  context: ResourceGeneratorContext
): Promise<{
  contents: Array<{ uri: string; mimeType: string; text: string }>;
}> {
  const content = await resourceRegistry.readResource(uri, context);

  if (!content) {
    throw new Error(`Resource not found: ${uri}`);
  }

  return {
    contents: [content],
  };
}
