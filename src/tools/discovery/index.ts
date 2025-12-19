import { registerRestRoutesTools } from './rest-routes.js';
import { registerShortcodesTools } from './shortcodes.js';
import { registerBlockPatternsTools } from './block-patterns.js';
import { registerBlockTemplatesTools } from './block-templates.js';

// Re-export for external use
export { registerRestRoutesTools } from './rest-routes.js';
export { registerShortcodesTools } from './shortcodes.js';
export { registerBlockPatternsTools } from './block-patterns.js';
export { registerBlockTemplatesTools } from './block-templates.js';

/**
 * Register all discovery tools
 */
export function registerDiscoveryTools() {
  registerRestRoutesTools();
  registerShortcodesTools();
  registerBlockPatternsTools();
  registerBlockTemplatesTools();
}
