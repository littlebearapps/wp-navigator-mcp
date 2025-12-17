/**
 * Windows Credential Manager Provider
 *
 * Stores credentials in Windows Credential Manager using cmdkey and PowerShell.
 * No external dependencies required - uses built-in Windows tools.
 *
 * Storage scheme:
 * - Target: 'wpnav-example.com' (prefix + site domain)
 * - Username: 'wpnav' (constant)
 * - Password: the Application Password
 *
 * @package WP_Navigator_MCP
 * @since 2.7.0
 */

import { execFileSync } from 'child_process';
import { BaseKeychainProvider } from './keychain.js';
import type { StoredCredential } from './types.js';
import { KEYCHAIN_SERVICE } from './types.js';

/** Prefix for Windows credential targets */
const WINDOWS_TARGET_PREFIX = 'wpnav-';

/**
 * Windows Credential Manager implementation
 *
 * Uses:
 * - `cmdkey` for store/delete/list (built into Windows)
 * - PowerShell for retrieve (cmdkey can't output passwords)
 *
 * All commands use execFileSync (not exec) to prevent shell injection.
 */
export class WindowsCredentialProvider extends BaseKeychainProvider {
  readonly name = 'Windows Credential Manager';

  /**
   * Check if Windows Credential Manager is available
   */
  get available(): boolean {
    // Only available on Windows
    if (process.platform !== 'win32') {
      return false;
    }

    // Check if cmdkey exists
    try {
      execFileSync('cmdkey.exe', ['/?'], {
        stdio: 'pipe',
        timeout: 5000,
        windowsHide: true,
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Store a credential in Windows Credential Manager
   *
   * Uses: cmdkey /generic:wpnav-example.com /user:wpnav /pass:xxx
   */
  async store(credential: StoredCredential): Promise<void> {
    this.validateAccount(credential.account);
    this.validatePassword(credential.password);

    const target = WINDOWS_TARGET_PREFIX + credential.account;

    try {
      // First delete any existing credential to avoid duplicates
      try {
        execFileSync('cmdkey.exe', ['/delete:' + target], {
          stdio: 'pipe',
          timeout: 10000,
          windowsHide: true,
        });
      } catch {
        // Ignore - credential may not exist
      }

      // Store the new credential
      execFileSync(
        'cmdkey.exe',
        ['/generic:' + target, '/user:' + KEYCHAIN_SERVICE, '/pass:' + credential.password],
        {
          stdio: 'pipe',
          timeout: 10000,
          windowsHide: true,
        }
      );
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to store credential in Windows Credential Manager: ${errMsg}`);
    }
  }

  /**
   * Retrieve a password from Windows Credential Manager
   *
   * Uses PowerShell with .NET CredentialManager API since cmdkey
   * cannot output passwords directly.
   *
   * Uses execFileSync with PowerShell to prevent shell injection.
   *
   * @returns The password or null if not found
   */
  async retrieve(account: string): Promise<string | null> {
    this.validateAccount(account);

    const target = WINDOWS_TARGET_PREFIX + account;

    // PowerShell script to read credential using .NET Windows API
    // Uses P/Invoke to call CredReadW directly - no external modules needed
    const script = `
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;

public class WpnavCredManager {
  [DllImport("advapi32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
  public static extern bool CredReadW(string target, int type, int flags, out IntPtr credential);

  [DllImport("advapi32.dll", SetLastError = true)]
  public static extern bool CredFree(IntPtr credential);

  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public struct CREDENTIAL {
    public int Flags;
    public int Type;
    public string TargetName;
    public string Comment;
    public long LastWritten;
    public int CredentialBlobSize;
    public IntPtr CredentialBlob;
    public int Persist;
    public int AttributeCount;
    public IntPtr Attributes;
    public string TargetAlias;
    public string UserName;
  }

  public static string GetPassword(string target) {
    IntPtr credPtr;
    if (CredReadW(target, 1, 0, out credPtr)) {
      try {
        CREDENTIAL cred = (CREDENTIAL)Marshal.PtrToStructure(credPtr, typeof(CREDENTIAL));
        if (cred.CredentialBlobSize > 0) {
          return Marshal.PtrToStringUni(cred.CredentialBlob, cred.CredentialBlobSize / 2);
        }
      } finally {
        CredFree(credPtr);
      }
    }
    return null;
  }
}
'@
$result = [WpnavCredManager]::GetPassword('${target}')
if ($result) { Write-Output $result }
`;

    try {
      // Use execFileSync with PowerShell - pass script via -Command argument
      // This is safe because we validated the account name and use single quotes in the script
      const result = execFileSync(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-Command', script],
        {
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'pipe'],
          timeout: 15000,
          windowsHide: true,
        }
      );

      const password = (result as string).trim();
      return password || null;
    } catch {
      // Not found or access denied
      return null;
    }
  }

  /**
   * Delete a credential from Windows Credential Manager
   *
   * Uses: cmdkey /delete:wpnav-example.com
   *
   * @returns true if deleted, false if not found
   */
  async delete(account: string): Promise<boolean> {
    this.validateAccount(account);

    const target = WINDOWS_TARGET_PREFIX + account;

    try {
      execFileSync('cmdkey.exe', ['/delete:' + target], {
        stdio: 'pipe',
        timeout: 10000,
        windowsHide: true,
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
   * Parses output of: cmdkey /list
   * Filters entries with target starting with 'wpnav-'
   *
   * @returns Array of account names (site domains)
   */
  async list(): Promise<string[]> {
    try {
      const result = execFileSync('cmdkey.exe', ['/list'], {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 10000,
        windowsHide: true,
      });

      const accounts: string[] = [];
      const lines = (result as string).split('\n');

      // Parse output format:
      //     Target: LegacyGeneric:target=wpnav-example.com
      // or  Target: wpnav-example.com
      for (const line of lines) {
        const trimmed = line.trim();

        // Look for Target: lines
        if (trimmed.toLowerCase().startsWith('target:')) {
          const targetPart = trimmed.substring(7).trim();

          // Extract the actual target name
          // Format can be: "LegacyGeneric:target=wpnav-xxx" or just "wpnav-xxx"
          let targetName = targetPart;

          const legacyMatch = targetPart.match(/LegacyGeneric:target=(.+)/i);
          if (legacyMatch) {
            targetName = legacyMatch[1];
          }

          // Check if it's a wpnav credential
          if (targetName.startsWith(WINDOWS_TARGET_PREFIX)) {
            const account = targetName.substring(WINDOWS_TARGET_PREFIX.length);
            if (account.length >= 3) {
              accounts.push(account);
            }
          }
        }
      }

      // Dedupe and sort
      return [...new Set(accounts)].sort();
    } catch {
      // If cmdkey fails, return empty list
      return [];
    }
  }
}
