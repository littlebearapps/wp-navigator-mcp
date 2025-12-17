/**
 * Credential Management - Public API
 *
 * Factory and utilities for OS keychain credential storage.
 * Automatically selects the appropriate provider for the current platform.
 *
 * Usage:
 *   import { getKeychainProvider, resolvePassword } from './cli/credentials/index.js';
 *
 *   // Store a credential
 *   const provider = getKeychainProvider();
 *   if (provider.available) {
 *     await provider.store({ service: 'wpnav', account: 'example.com', password: 'xxx' });
 *   }
 *
 *   // Resolve a password (handles keychain references)
 *   const result = await resolvePassword('keychain:wpnav:example.com');
 *   if (result.password) {
 *     // Use the password
 *   }
 *
 * @package WP_Navigator_MCP
 * @since 2.7.0
 */

import { execFileSync } from 'child_process';
import type { KeychainProvider, CredentialResult, CredentialSource } from './types.js';
import { KEYCHAIN_PREFIX, KEYCHAIN_SERVICE } from './types.js';
import { MacOSKeychainProvider } from './macos.js';
import { LinuxSecretServiceProvider } from './linux.js';
import { WindowsCredentialProvider } from './windows.js';
import { FallbackProvider } from './fallback.js';

// Re-export types for convenience
export * from './types.js';
export { BaseKeychainProvider } from './keychain.js';

// Singleton provider instance
let _provider: KeychainProvider | null = null;

/**
 * Get the appropriate keychain provider for the current platform
 *
 * Selection order:
 * 1. macOS Keychain (if on macOS)
 * 2. Linux Secret Service (if on Linux with secret-tool)
 * 3. Windows Credential Manager (if on Windows with cmdkey)
 * 4. Fallback (always unavailable)
 *
 * The provider is cached for the lifetime of the process.
 */
export function getKeychainProvider(): KeychainProvider {
  if (_provider) {
    return _provider;
  }

  // Try macOS first
  const macOS = new MacOSKeychainProvider();
  if (macOS.available) {
    _provider = macOS;
    return _provider;
  }

  // Try Linux
  const linux = new LinuxSecretServiceProvider();
  if (linux.available) {
    _provider = linux;
    return _provider;
  }

  // Try Windows
  const windows = new WindowsCredentialProvider();
  if (windows.available) {
    _provider = windows;
    return _provider;
  }

  // Fallback - always available but always fails
  _provider = new FallbackProvider();
  return _provider;
}

/**
 * Check if keychain storage is available on this platform
 */
export function isKeychainAvailable(): boolean {
  return getKeychainProvider().available;
}

/**
 * Get the name of the current keychain provider
 */
export function getKeychainProviderName(): string {
  return getKeychainProvider().name;
}

/**
 * Parse a keychain reference from a config password field
 *
 * Format: "keychain:wpnav:example.com"
 *
 * @param value - The password field value
 * @returns Parsed reference or null if not a keychain reference
 */
export function parseKeychainReference(value: string): { account: string } | null {
  if (!value || typeof value !== 'string') {
    return null;
  }

  if (!value.startsWith(KEYCHAIN_PREFIX)) {
    return null;
  }

  // Parse: keychain:wpnav:example.com
  const rest = value.slice(KEYCHAIN_PREFIX.length);
  const parts = rest.split(':');

  if (parts.length !== 2) {
    return null;
  }

  const [service, account] = parts;

  // Validate service name
  if (service !== KEYCHAIN_SERVICE) {
    return null;
  }

  // Validate account exists
  if (!account || account.length < 3) {
    return null;
  }

  return { account };
}

/**
 * Create a keychain reference string for a site
 *
 * @param account - Site domain (e.g., 'example.com')
 * @returns Keychain reference string (e.g., 'keychain:wpnav:example.com')
 */
export function createKeychainReference(account: string): string {
  return `${KEYCHAIN_PREFIX}${KEYCHAIN_SERVICE}:${account}`;
}

/**
 * Resolve a password value - handles both literal values and keychain references
 *
 * This is the main entry point for config loading.
 *
 * @param value - Password field value (literal or keychain reference)
 * @returns Resolved credential with source information
 */
export async function resolvePassword(value: string): Promise<CredentialResult> {
  // Check for keychain reference
  const ref = parseKeychainReference(value);

  if (!ref) {
    // Not a keychain reference, return as literal value
    return {
      source: 'config' as CredentialSource,
      password: value,
    };
  }

  // It's a keychain reference - try to retrieve
  const provider = getKeychainProvider();

  if (!provider.available) {
    return {
      source: 'none' as CredentialSource,
      password: null,
      error: `Keychain not available (${provider.name}). Install keychain tools or use plaintext password.`,
    };
  }

  try {
    const password = await provider.retrieve(ref.account);

    if (!password) {
      return {
        source: 'none' as CredentialSource,
        password: null,
        error: `Credential not found in keychain for account: ${ref.account}`,
      };
    }

    return {
      source: 'keychain' as CredentialSource,
      password,
    };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return {
      source: 'none' as CredentialSource,
      password: null,
      error: `Failed to retrieve from keychain: ${errMsg}`,
    };
  }
}

/**
 * Check if a password value is a keychain reference
 *
 * @param value - Password field value
 * @returns true if it's a keychain reference
 */
export function isKeychainReference(value: string): boolean {
  return parseKeychainReference(value) !== null;
}

/**
 * Resolve a password value synchronously - for config loading
 *
 * Uses synchronous system calls (execFileSync) under the hood.
 * Falls back gracefully if keychain is unavailable.
 *
 * @param value - Password field value (literal or keychain reference)
 * @returns Resolved password or throws an error
 */
export function resolvePasswordSync(value: string): string {
  // Check for keychain reference
  const ref = parseKeychainReference(value);

  if (!ref) {
    // Not a keychain reference, return as-is
    return value;
  }

  // It's a keychain reference - try to retrieve
  const provider = getKeychainProvider();

  if (!provider.available) {
    throw new Error(
      `Keychain reference found but keychain not available (${provider.name}). ` +
        `Install keychain tools or use plaintext password.`
    );
  }

  // Use execFileSync directly for synchronous operation (imported at top of file)

  if (process.platform === 'darwin') {
    // macOS Keychain
    try {
      const result = execFileSync(
        'security',
        ['find-generic-password', '-a', KEYCHAIN_SERVICE, '-s', ref.account, '-w'],
        {
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'pipe'],
          timeout: 10000,
        }
      );
      const password = (result as string).trim();
      if (!password) {
        throw new Error(`Credential not found in keychain for account: ${ref.account}`);
      }
      return password;
    } catch (err) {
      if (err instanceof Error && err.message.includes('Credential not found')) {
        throw err;
      }
      throw new Error(`Failed to retrieve credential from keychain: ${ref.account}`);
    }
  } else if (process.platform === 'linux') {
    // Linux Secret Service
    try {
      const result = execFileSync(
        'secret-tool',
        ['lookup', 'service', KEYCHAIN_SERVICE, 'account', ref.account],
        {
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'pipe'],
          timeout: 10000,
        }
      );
      const password = (result as string).trim();
      if (!password) {
        throw new Error(`Credential not found in keychain for account: ${ref.account}`);
      }
      return password;
    } catch {
      throw new Error(`Failed to retrieve credential from keychain: ${ref.account}`);
    }
  } else if (process.platform === 'win32') {
    // Windows Credential Manager via PowerShell P/Invoke
    const target = 'wpnav-' + ref.account;
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
      if (!password) {
        throw new Error(`Credential not found in keychain for account: ${ref.account}`);
      }
      return password;
    } catch (err) {
      if (err instanceof Error && err.message.includes('Credential not found')) {
        throw err;
      }
      throw new Error(`Failed to retrieve credential from keychain: ${ref.account}`);
    }
  } else {
    throw new Error(`Keychain not supported on platform: ${process.platform}`);
  }
}

/**
 * Reset the cached provider (useful for testing)
 */
export function resetKeychainProvider(): void {
  _provider = null;
}
