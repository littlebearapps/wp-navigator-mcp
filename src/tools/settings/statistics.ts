/**
 * Site Statistics Tool Registration
 *
 * Handles: WordPress site statistics (posts, pages, users, comments, media, terms)
 *
 * @package WP_Navigator_Pro
 * @since 2.8.0
 */

import { toolRegistry, ToolCategory } from '../../tool-registry/index.js';

/**
 * Register site statistics tool
 */
export function registerStatisticsTools() {
  // ============================================================================
  // SITE STATISTICS
  // ============================================================================
  toolRegistry.register({
    definition: {
      name: 'wpnav_site_statistics',
      description:
        'Get WordPress site statistics including counts for posts, pages, users, comments, media, and taxonomy terms. ' +
        'Provides quick overview of site content and activity.',
      inputSchema: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
    handler: async (_args, context) => {
      const result = await context.wpRequest('/wpnav/v1/statistics');

      return {
        content: [{ type: 'text', text: context.clampText(JSON.stringify(result, null, 2)) }],
      };
    },
    category: ToolCategory.ANALYTICS,
  });
}
