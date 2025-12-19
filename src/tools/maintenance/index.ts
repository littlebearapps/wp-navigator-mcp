/**
 * Maintenance Tools Registration
 *
 * Exports registration functions for maintenance-related tools:
 * - Maintenance mode (enable/disable)
 * - Rewrite rules (list/flush)
 *
 * @package WP_Navigator_Pro
 * @since 2.8.0
 */

import { registerMaintenanceModeTools } from './maintenance.js';
import { registerRewriteTools } from './rewrite.js';

/**
 * Register all maintenance tools
 */
export function registerMaintenanceTools() {
  registerMaintenanceModeTools();
  registerRewriteTools();
}
