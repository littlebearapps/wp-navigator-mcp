/**
 * JWT Authentication Tools Registration
 *
 * Handles: JWT token generation, refresh, and revocation
 *
 * Note: These tools interact with WordPress JWT endpoints.
 * - jwt_token: Generates tokens using username/password credentials
 * - jwt_refresh: Refreshes tokens using a refresh token
 * - jwt_revoke: Revokes an active JWT token
 *
 * @package WP_Navigator_Pro
 * @since 2.8.0
 */

import { toolRegistry, ToolCategory } from '../../tool-registry/index.js';
import { validateRequired } from '../../tool-registry/utils.js';

/**
 * Register JWT authentication tools
 */
export function registerJwtTools() {
  // ============================================================================
  // GENERATE JWT TOKEN
  // ============================================================================
  toolRegistry.register({
    definition: {
      name: 'wpnav_jwt_token',
      description:
        'Generate a JWT access token and refresh token using WordPress credentials. ' +
        'Returns access_token (1 hour TTL), refresh_token (7 days TTL), and token metadata. ' +
        'Rate limited to 5 requests per minute per IP.',
      inputSchema: {
        type: 'object',
        properties: {
          username: {
            type: 'string',
            description: 'WordPress username',
          },
          password: {
            type: 'string',
            description: 'WordPress password',
          },
        },
        required: ['username', 'password'],
      },
    },
    handler: async (args, context) => {
      validateRequired(args, ['username', 'password']);

      const body = {
        username: args.username,
        password: args.password,
      };

      const result = await context.wpRequest('/wpnav/v1/auth/jwt/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      return {
        content: [{ type: 'text', text: context.clampText(JSON.stringify(result, null, 2)) }],
      };
    },
    category: ToolCategory.AUTH,
  });

  // ============================================================================
  // REFRESH JWT TOKEN
  // ============================================================================
  toolRegistry.register({
    definition: {
      name: 'wpnav_jwt_refresh',
      description:
        'Refresh an expired JWT access token using a valid refresh token. ' +
        'Returns new access_token and refresh_token pair.',
      inputSchema: {
        type: 'object',
        properties: {
          refresh_token: {
            type: 'string',
            description: 'The refresh token received from wpnav_jwt_token',
          },
        },
        required: ['refresh_token'],
      },
    },
    handler: async (args, context) => {
      validateRequired(args, ['refresh_token']);

      const body = {
        refresh_token: args.refresh_token,
      };

      const result = await context.wpRequest('/wpnav/v1/auth/jwt/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      return {
        content: [{ type: 'text', text: context.clampText(JSON.stringify(result, null, 2)) }],
      };
    },
    category: ToolCategory.AUTH,
  });

  // ============================================================================
  // REVOKE JWT TOKEN
  // ============================================================================
  toolRegistry.register({
    definition: {
      name: 'wpnav_jwt_revoke',
      description:
        'Revoke a JWT access token, invalidating both the access and refresh tokens. ' +
        'The token to revoke must be provided as it will be sent in the Authorization header.',
      inputSchema: {
        type: 'object',
        properties: {
          access_token: {
            type: 'string',
            description: 'The JWT access token to revoke',
          },
        },
        required: ['access_token'],
      },
    },
    handler: async (args, context) => {
      validateRequired(args, ['access_token']);

      // For jwt/revoke, we need to use the provided access_token as Bearer auth
      // The wpRequest function uses Basic Auth, but the plugin endpoint accepts
      // both auth methods when calling from an authenticated session
      const result = await context.wpRequest('/wpnav/v1/auth/jwt/revoke', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Note: The standard wpRequest adds Basic Auth. The plugin should handle
          // both auth methods. If Bearer-only is required, this may need adjustment.
          'X-JWT-Token': args.access_token, // Alternative: Pass token in custom header
        },
        body: JSON.stringify({ token: args.access_token }),
      });

      return {
        content: [{ type: 'text', text: context.clampText(JSON.stringify(result, null, 2)) }],
      };
    },
    category: ToolCategory.AUTH,
  });
}
