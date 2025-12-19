/**
 * Authentication Tools Registration
 *
 * Exports registration functions for authentication-related tools:
 * - JWT token management (generate, refresh, revoke)
 *
 * @package WP_Navigator_Pro
 * @since 2.8.0
 */

import { registerJwtTools } from './jwt.js';

/**
 * Register all authentication tools
 */
export function registerAuthTools() {
  registerJwtTools();
}
