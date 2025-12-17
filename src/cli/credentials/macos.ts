/**
 * macOS Keychain Provider
 *
 * Stores credentials in macOS Keychain using the built-in `security` command.
 * No external dependencies required.
 *
 * Storage scheme:
 * - Account: 'wpnav' (constant for all entries)
 * - Service: site domain (e.g., 'example.com')
 * - Password: the Application Password
 *
 * @package WP_Navigator_MCP
 * @since 2.7.0
 */

import { execFileSync } from 'child_process';
import { BaseKeychainProvider } from './keychain.js';
import type { StoredCredential } from './types.js';
import { KEYCHAIN_SERVICE } from './types.js';

/**
 * macOS Keychain implementation
 *
 * Uses the `security` command-line tool (built into macOS).
 * Stores credentials in the user's login keychain.
 */
export class MacOSKeychainProvider extends BaseKeychainProvider {
  readonly name = 'macOS Keychain';

  /**
   * Check if macOS Keychain is available
   */
  get available(): boolean {
    // Only available on macOS
    if (process.platform !== 'darwin') {
      return false;
    }

    // Check if security command exists
    try {
      execFileSync('security', ['help'], {
        stdio: 'pipe',
        timeout: 5000,
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Store a credential in macOS Keychain
   *
   * Uses: security add-generic-password -a wpnav -s <site> -w <password> -U
   *
   * The -U flag updates if exists, creates if not.
   */
  async store(credential: StoredCredential): Promise<void> {
    this.validateAccount(credential.account);
    this.validatePassword(credential.password);

    try {
      // -a: account name (we use 'wpnav' as constant)
      // -s: service name (we use site domain)
      // -w: password
      // -U: update if exists, create if not
      execFileSync(
        'security',
        [
          'add-generic-password',
          '-a',
          KEYCHAIN_SERVICE,
          '-s',
          credential.account,
          '-w',
          credential.password,
          '-U',
        ],
        {
          stdio: 'pipe',
          timeout: 10000,
        }
      );
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      // Check for common errors
      if (errMsg.includes('User canceled')) {
        throw new Error('Keychain access was denied by user');
      }
      throw new Error(`Failed to store credential in keychain: ${errMsg}`);
    }
  }

  /**
   * Retrieve a password from macOS Keychain
   *
   * Uses: security find-generic-password -a wpnav -s <site> -w
   *
   * @returns The password or null if not found
   */
  async retrieve(account: string): Promise<string | null> {
    this.validateAccount(account);

    try {
      // -a: account name
      // -s: service name
      // -w: output password only (not full keychain entry)
      const result = execFileSync(
        'security',
        ['find-generic-password', '-a', KEYCHAIN_SERVICE, '-s', account, '-w'],
        {
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'pipe'],
          timeout: 10000,
        }
      );
      return result.trim();
    } catch {
      // Not found or access denied - return null
      return null;
    }
  }

  /**
   * Delete a credential from macOS Keychain
   *
   * Uses: security delete-generic-password -a wpnav -s <site>
   *
   * @returns true if deleted, false if not found
   */
  async delete(account: string): Promise<boolean> {
    this.validateAccount(account);

    try {
      execFileSync('security', ['delete-generic-password', '-a', KEYCHAIN_SERVICE, '-s', account], {
        stdio: 'pipe',
        timeout: 10000,
      });
      return true;
    } catch {
      // Not found or access denied
      return false;
    }
  }

  /**
   * List all stored wpnav credentials
   *
   * Parses output of: security dump-keychain
   *
   * This is more complex as we need to filter entries.
   * Returns empty array if parsing fails.
   */
  async list(): Promise<string[]> {
    try {
      // dump-keychain outputs all keychain entries
      // We filter for entries with acct="wpnav"
      const result = execFileSync('security', ['dump-keychain'], {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 30000,
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large keychains
      });

      const accounts: string[] = [];
      const lines = result.split('\n');

      // Track current entry's service name
      let currentService: string | null = null;
      let isGenericPassword = false;

      for (const line of lines) {
        // New entry starts with "keychain:"
        if (line.startsWith('keychain:')) {
          currentService = null;
          isGenericPassword = false;
        }

        // Check if this is a generic password entry
        if (line.includes('"genp"') || line.includes('class: "genp"')) {
          isGenericPassword = true;
        }

        // Parse service name: "svce"<blob>="example.com"
        const svceMatch = line.match(/"svce"<blob>="([^"]+)"/);
        if (svceMatch) {
          currentService = svceMatch[1];
        }

        // Parse account name: "acct"<blob>="wpnav"
        const acctMatch = line.match(/"acct"<blob>="([^"]+)"/);
        if (acctMatch && acctMatch[1] === KEYCHAIN_SERVICE && currentService && isGenericPassword) {
          accounts.push(currentService);
          currentService = null;
        }
      }

      // Dedupe and sort
      return [...new Set(accounts)].sort();
    } catch {
      // If dump-keychain fails, return empty list
      return [];
    }
  }
}
