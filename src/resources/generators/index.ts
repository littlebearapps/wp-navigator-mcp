/**
 * Resource Generators Module Exports
 *
 * @package WP_Navigator_MCP
 * @since 2.6.0
 */

// Tools
export { generateToolsOverview } from './tools.js';

// Site
export { generateSiteContext } from './site.js';

// Guides
export { generateGuide, getGuideResourceMeta, AVAILABLE_GUIDES, type GuideName } from './guides.js';

// Roles
export {
  generateRolesList,
  generateRoleContent,
  listRoleUris,
  getRoleResourceMeta,
} from './roles.js';

// Cookbooks
export {
  generateCookbooksList,
  generateCookbookContent,
  listCookbookUris,
  getCookbookResourceMeta,
} from './cookbooks.js';
