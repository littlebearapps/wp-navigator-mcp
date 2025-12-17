/**
 * Fallback Credential Provider
 *
 * Used when no OS keychain is available (e.g., Windows, unsupported Linux).
 * Always returns unavailable and suggests using .wpnav.env instead.
 *
 * @package WP_Navigator_MCP
 * @since 2.7.0
 */

import { BaseKeychainProvider } from './keychain.js';
import type { StoredCredential } from './types.js';

/**
 * Fallback provider for unsupported platforms
 *
 * All operations fail gracefully with helpful error messages.
 */
export class FallbackProvider extends BaseKeychainProvider {
  readonly name = 'Fallback (unavailable)';
  readonly available = false;

  /**
   * Storage is not available
   */
  async store(_credential: StoredCredential): Promise<void> {
    throw new Error(
      'Keychain not available on this platform. ' +
        'Store credentials in .wpnav.env file or wpnav.config.json instead.'
    );
  }

  /**
   * Retrieval is not available
   */
  async retrieve(_account: string): Promise<string | null> {
    return null;
  }

  /**
   * Deletion is not available
   */
  async delete(_account: string): Promise<boolean> {
    return false;
  }

  /**
   * List is not available
   */
  async list(): Promise<string[]> {
    return [];
  }
}
