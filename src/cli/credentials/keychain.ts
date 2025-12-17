/**
 * Base Keychain Provider
 *
 * Abstract base class for platform-specific keychain implementations.
 * Provides common validation and utility methods.
 *
 * @package WP_Navigator_MCP
 * @since 2.7.0
 */

import type { KeychainProvider, StoredCredential } from './types.js';

/**
 * Abstract base class for keychain providers
 *
 * Platform implementations (macOS, Linux) extend this class
 * and implement the abstract methods.
 */
export abstract class BaseKeychainProvider implements KeychainProvider {
  abstract readonly name: string;
  abstract readonly available: boolean;

  abstract store(credential: StoredCredential): Promise<void>;
  abstract retrieve(account: string): Promise<string | null>;
  abstract delete(account: string): Promise<boolean>;
  abstract list(): Promise<string[]>;

  /**
   * Validate an account name (site domain)
   *
   * @param account - The account name to validate
   * @throws Error if account is invalid
   */
  protected validateAccount(account: string): void {
    if (!account || account.length < 3) {
      throw new Error('Invalid account: must be at least 3 characters');
    }

    // Basic hostname validation - allows domains and localhost
    // Accepts: example.com, sub.example.com, localhost, my-site.local
    const hostnamePattern = /^[a-zA-Z0-9]([a-zA-Z0-9.-]*[a-zA-Z0-9])?$/;
    if (!hostnamePattern.test(account)) {
      throw new Error('Invalid account: must be a valid hostname');
    }

    // Reject obvious invalid patterns
    if (account.includes('..') || account.startsWith('.') || account.endsWith('.')) {
      throw new Error('Invalid account: malformed hostname');
    }
  }

  /**
   * Validate a password before storing
   *
   * @param password - The password to validate
   * @throws Error if password is invalid
   */
  protected validatePassword(password: string): void {
    if (!password) {
      throw new Error('Invalid password: cannot be empty');
    }

    // Application Passwords are typically 24 characters (4 groups of 4 + spaces)
    // But we allow shorter for flexibility
    if (password.length < 4) {
      throw new Error('Invalid password: too short');
    }
  }
}
