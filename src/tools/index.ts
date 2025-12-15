/**
 * Tool Registration - Main Entry Point
 *
 * Imports and registers all tool categories.
 *
 * @package WP_Navigator_Pro
 * @since 1.3.0
 */

import { registerCoreTools } from './core/index.js';
import { registerContentTools } from './content/index.js';
import { registerTaxonomyTools } from './taxonomy/index.js';
import { registerUserTools } from './users/index.js';
import { registerPluginTools } from './plugins/index.js';
import { registerThemeTools } from './themes/index.js';
import { registerTestingTools } from './testing/index.js';
import { registerGutenbergTools } from './gutenberg/index.js';
import { registerCookbookTools } from './cookbook/index.js';
import { registerRoleTools } from './roles/index.js';
import { registerBatchTools } from './batch/index.js';

/**
 * Register all tools with the tool registry
 *
 * Call this once during server initialization before handling requests
 */
export function registerAllTools() {
  registerCoreTools();
  registerContentTools();
  registerTaxonomyTools();
  registerUserTools();
  registerPluginTools();
  registerThemeTools();
  registerTestingTools();
  registerGutenbergTools();
  registerCookbookTools();
  registerRoleTools();
  registerBatchTools();
}
