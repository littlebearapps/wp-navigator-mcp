/**
 * Linux Secret Service Provider
 *
 * Stores credentials using the Secret Service API via `secret-tool`.
 * Requires libsecret-tools package (secret-tool command).
 *
 * Works with:
 * - GNOME Keyring
 * - KDE Wallet (via Secret Service bridge)
 * - Any Secret Service compatible backend
 *
 * Storage scheme:
 * - Attribute 'service': 'wpnav'
 * - Attribute 'account': site domain (e.g., 'example.com')
 * - Label: 'wpnav: example.com'
 *
 * @package WP_Navigator_MCP
 * @since 2.7.0
 */

import { execFileSync, spawn } from 'child_process';
import { BaseKeychainProvider } from './keychain.js';
import type { StoredCredential } from './types.js';
import { KEYCHAIN_SERVICE } from './types.js';

/**
 * Linux Secret Service implementation
 *
 * Uses the `secret-tool` command from libsecret-tools.
 * Install: apt install libsecret-tools (Debian/Ubuntu)
 *          dnf install libsecret (Fedora)
 */
export class LinuxSecretServiceProvider extends BaseKeychainProvider {
  readonly name = 'Linux Secret Service';

  /**
   * Check if Secret Service is available
   */
  get available(): boolean {
    // Only available on Linux
    if (process.platform !== 'linux') {
      return false;
    }

    // Check if secret-tool exists
    try {
      execFileSync('which', ['secret-tool'], {
        stdio: 'pipe',
        timeout: 5000,
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Store a credential in Secret Service
   *
   * Uses: secret-tool store --label="wpnav: site" service wpnav account site
   *
   * Password is read from stdin for security.
   */
  async store(credential: StoredCredential): Promise<void> {
    this.validateAccount(credential.account);
    this.validatePassword(credential.password);

    return new Promise((resolve, reject) => {
      const proc = spawn(
        'secret-tool',
        [
          'store',
          '--label',
          `${KEYCHAIN_SERVICE}: ${credential.account}`,
          'service',
          KEYCHAIN_SERVICE,
          'account',
          credential.account,
        ],
        {
          stdio: ['pipe', 'ignore', 'pipe'],
        }
      );

      let stderr = '';
      proc.stderr.on('data', (data) => {
        stderr += data;
      });

      proc.on('error', (err) => {
        reject(new Error(`Failed to spawn secret-tool: ${err.message}`));
      });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(
            new Error(
              `Failed to store credential in Secret Service: ${stderr.trim() || `exit code ${code}`}`
            )
          );
        }
      });

      // Write password to stdin
      proc.stdin.write(credential.password);
      proc.stdin.end();
    });
  }

  /**
   * Retrieve a password from Secret Service
   *
   * Uses: secret-tool lookup service wpnav account <site>
   *
   * @returns The password or null if not found
   */
  async retrieve(account: string): Promise<string | null> {
    this.validateAccount(account);

    try {
      const result = execFileSync(
        'secret-tool',
        ['lookup', 'service', KEYCHAIN_SERVICE, 'account', account],
        {
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'pipe'],
          timeout: 10000,
        }
      );
      const password = result.trim();
      // secret-tool returns empty string if not found
      return password || null;
    } catch {
      return null;
    }
  }

  /**
   * Delete a credential from Secret Service
   *
   * Uses: secret-tool clear service wpnav account <site>
   *
   * @returns true if deleted, false if not found
   */
  async delete(account: string): Promise<boolean> {
    this.validateAccount(account);

    try {
      execFileSync('secret-tool', ['clear', 'service', KEYCHAIN_SERVICE, 'account', account], {
        stdio: 'pipe',
        timeout: 10000,
      });
      // secret-tool clear exits 0 even if item doesn't exist
      // We can't easily distinguish, so return true
      return true;
    } catch {
      return false;
    }
  }

  /**
   * List all stored wpnav credentials
   *
   * Note: secret-tool doesn't have a native list command.
   * We use secret-tool search which lists matching items.
   *
   * @returns Array of account names (site domains)
   */
  async list(): Promise<string[]> {
    try {
      // secret-tool search outputs matching items
      const result = execFileSync('secret-tool', ['search', '--all', 'service', KEYCHAIN_SERVICE], {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 30000,
      });

      const accounts: string[] = [];

      // Parse output - each item has "attribute.account = value"
      const lines = result.split('\n');
      for (const line of lines) {
        // Match: attribute.account = example.com
        const match = line.match(/attribute\.account\s*=\s*(.+)/);
        if (match) {
          accounts.push(match[1].trim());
        }
      }

      // Dedupe and sort
      return [...new Set(accounts)].sort();
    } catch {
      // If search fails, return empty list
      return [];
    }
  }
}
