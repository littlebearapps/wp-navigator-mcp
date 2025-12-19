/**
 * Site Health Tools Registration
 *
 * Handles: WordPress Site Health integration for diagnostics and recommendations
 *
 * @package WP_Navigator_Pro
 * @since 2.8.0
 */

import { toolRegistry, ToolCategory } from '../../tool-registry/index.js';

/**
 * Valid test categories for filtering
 */
const VALID_TEST_CATEGORIES = ['security', 'performance', 'database', 'plugins', 'themes'] as const;
type TestCategory = (typeof VALID_TEST_CATEGORIES)[number];

/**
 * Register site health tools
 */
export function registerHealthTools() {
  // ============================================================================
  // SITE HEALTH
  // ============================================================================
  toolRegistry.register({
    definition: {
      name: 'wpnav_site_health',
      description:
        'Get WordPress Site Health diagnostics including tests, system info, and recommendations. ' +
        'Leverages WordPress core Site Health API for comprehensive site analysis.',
      inputSchema: {
        type: 'object',
        properties: {
          include_tests: {
            type: 'boolean',
            description: 'Include health test results (default: true)',
          },
          include_info: {
            type: 'boolean',
            description: 'Include system information (default: true)',
          },
          include_recommendations: {
            type: 'boolean',
            description: 'Include improvement recommendations (default: true)',
          },
          test_categories: {
            type: 'array',
            items: {
              type: 'string',
              enum: ['security', 'performance', 'database', 'plugins', 'themes'],
            },
            description: 'Filter tests by specific categories (optional)',
          },
        },
        required: [],
      },
    },
    handler: async (args, context) => {
      // Build query parameters
      const params = new URLSearchParams();

      // Default all include options to true if not specified
      const includeTests = args.include_tests !== false;
      const includeInfo = args.include_info !== false;
      const includeRecommendations = args.include_recommendations !== false;

      params.append('include_tests', String(includeTests));
      params.append('include_info', String(includeInfo));
      params.append('include_recommendations', String(includeRecommendations));

      // Validate and add test categories filter
      if (args.test_categories && Array.isArray(args.test_categories)) {
        const validCategories = args.test_categories.filter((cat: string) =>
          VALID_TEST_CATEGORIES.includes(cat as TestCategory)
        );
        if (validCategories.length > 0) {
          params.append('test_categories', validCategories.join(','));
        }
      }

      const result = await context.wpRequest(`/wpnav/v1/health?${params.toString()}`);

      return {
        content: [{ type: 'text', text: context.clampText(JSON.stringify(result, null, 2)) }],
      };
    },
    category: ToolCategory.ANALYTICS,
  });
}
