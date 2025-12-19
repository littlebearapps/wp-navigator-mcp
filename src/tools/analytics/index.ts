/**
 * Analytics Tools Module
 *
 * Exports analytics tool registration functions.
 *
 * @package WP_Navigator_Pro
 * @since 2.8.0
 */

import { registerHealthTools } from './health.js';

// Re-export for external use
export { registerHealthTools } from './health.js';

/**
 * Register all analytics tools
 */
export function registerAnalyticsTools() {
  registerHealthTools();
}
