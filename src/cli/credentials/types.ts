/**
 * Keychain Credential Types
 *
 * Type definitions for OS keychain credential storage.
 * Supports macOS Keychain and Linux Secret Service.
 *
 * @package WP_Navigator_MCP
 * @since 2.7.0
 */

/**
 * A credential stored in the OS keychain
 */
export interface StoredCredential {
  /** Service name - always 'wpnav' */
  service: string;
  /** Account identifier - site domain (e.g., 'example.com') */
  account: string;
  /** The Application Password */
  password: string;
}

/**
 * Keychain provider interface for platform-specific implementations
 */
export interface KeychainProvider {
  /** Human-readable provider name (e.g., 'macOS Keychain') */
  readonly name: string;
  /** Whether this provider is available on the current platform */
  readonly available: boolean;

  /**
   * Store a credential in the keychain
   * @param credential - The credential to store
   * @throws Error if storage fails
   */
  store(credential: StoredCredential): Promise<void>;

  /**
   * Retrieve a password from the keychain
   * @param account - Site domain (e.g., 'example.com')
   * @returns The password or null if not found
   */
  retrieve(account: string): Promise<string | null>;

  /**
   * Delete a credential from the keychain
   * @param account - Site domain to delete
   * @returns true if deleted, false if not found
   */
  delete(account: string): Promise<boolean>;

  /**
   * List all stored accounts for the wpnav service
   * @returns Array of account names (site domains)
   */
  list(): Promise<string[]>;
}

/**
 * Source of a resolved credential
 */
export type CredentialSource = 'keychain' | 'env' | 'config' | 'none';

/**
 * Result of resolving a credential
 */
export interface CredentialResult {
  /** Where the credential came from */
  source: CredentialSource;
  /** The resolved password, or null if not found */
  password: string | null;
  /** Error message if resolution failed */
  error?: string;
}

/**
 * Keychain reference prefix in config files
 * Format: "keychain:wpnav:example.com"
 */
export const KEYCHAIN_PREFIX = 'keychain:';

/**
 * Service name used for all wpnav keychain entries
 */
export const KEYCHAIN_SERVICE = 'wpnav';
