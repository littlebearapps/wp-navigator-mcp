/**
 * Tests for Keychain Credential Management
 *
 * Tests credential reference parsing, provider detection, and resolution.
 *
 * @package WP_Navigator_MCP
 * @since 2.7.0
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  parseKeychainReference,
  createKeychainReference,
  isKeychainReference,
  isKeychainAvailable,
  getKeychainProviderName,
  resolvePassword,
  resetKeychainProvider,
  KEYCHAIN_PREFIX,
  KEYCHAIN_SERVICE,
} from './index.js';

// =============================================================================
// Test Setup
// =============================================================================

beforeEach(() => {
  // Reset the cached provider before each test
  resetKeychainProvider();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// =============================================================================
// Constants
// =============================================================================

describe('constants', () => {
  it('should export KEYCHAIN_PREFIX', () => {
    expect(KEYCHAIN_PREFIX).toBe('keychain:');
  });

  it('should export KEYCHAIN_SERVICE', () => {
    expect(KEYCHAIN_SERVICE).toBe('wpnav');
  });
});

// =============================================================================
// parseKeychainReference
// =============================================================================

describe('parseKeychainReference', () => {
  it('should parse valid keychain reference', () => {
    const result = parseKeychainReference('keychain:wpnav:example.com');
    expect(result).toEqual({ account: 'example.com' });
  });

  it('should parse reference with subdomain', () => {
    const result = parseKeychainReference('keychain:wpnav:blog.example.com');
    expect(result).toEqual({ account: 'blog.example.com' });
  });

  it('should return null for account with port (current limitation)', () => {
    // Current implementation doesn't support ports in account names
    // because it splits by ':' and expects exactly 2 parts (service:account)
    const result = parseKeychainReference('keychain:wpnav:localhost:8080');
    expect(result).toBeNull();
  });

  it('should return null for empty string', () => {
    expect(parseKeychainReference('')).toBeNull();
  });

  it('should return null for non-string', () => {
    expect(parseKeychainReference(null as unknown as string)).toBeNull();
    expect(parseKeychainReference(undefined as unknown as string)).toBeNull();
    expect(parseKeychainReference(123 as unknown as string)).toBeNull();
  });

  it('should return null for non-keychain prefix', () => {
    expect(parseKeychainReference('plaintext-password')).toBeNull();
    expect(parseKeychainReference('env:MY_VAR')).toBeNull();
    expect(parseKeychainReference('$MY_PASSWORD')).toBeNull();
  });

  it('should return null for wrong service name', () => {
    expect(parseKeychainReference('keychain:other:example.com')).toBeNull();
    expect(parseKeychainReference('keychain:wpnav2:example.com')).toBeNull();
  });

  it('should return null for malformed references', () => {
    expect(parseKeychainReference('keychain:')).toBeNull();
    expect(parseKeychainReference('keychain:wpnav')).toBeNull();
    expect(parseKeychainReference('keychain:wpnav:')).toBeNull();
    expect(parseKeychainReference('keychain:wpnav:ab')).toBeNull(); // too short
  });

  it('should return null for too many colons', () => {
    // Note: With current implementation, 'foo:bar' after service would be account
    // This tests the actual behavior - extra colons in account are allowed
    const result = parseKeychainReference('keychain:wpnav:foo:bar');
    // Current impl splits by ':' and checks parts.length !== 2
    // 'foo:bar'.split(':') = ['foo', 'bar'], length = 2, so it parses
    // But the service check fails because first part is 'foo', not 'wpnav'
    expect(result).toBeNull();
  });
});

// =============================================================================
// createKeychainReference
// =============================================================================

describe('createKeychainReference', () => {
  it('should create valid keychain reference', () => {
    const ref = createKeychainReference('example.com');
    expect(ref).toBe('keychain:wpnav:example.com');
  });

  it('should handle subdomain', () => {
    const ref = createKeychainReference('blog.example.com');
    expect(ref).toBe('keychain:wpnav:blog.example.com');
  });

  it('should handle localhost (without port)', () => {
    // Note: Ports are not supported in account names due to ':' delimiter
    const ref = createKeychainReference('localhost');
    expect(ref).toBe('keychain:wpnav:localhost');
  });

  it('should roundtrip with parseKeychainReference', () => {
    const account = 'my-site.example.org';
    const ref = createKeychainReference(account);
    const parsed = parseKeychainReference(ref);
    expect(parsed).toEqual({ account });
  });
});

// =============================================================================
// isKeychainReference
// =============================================================================

describe('isKeychainReference', () => {
  it('should return true for valid keychain reference', () => {
    expect(isKeychainReference('keychain:wpnav:example.com')).toBe(true);
  });

  it('should return false for plaintext password', () => {
    expect(isKeychainReference('my-secret-password')).toBe(false);
  });

  it('should return false for env var reference', () => {
    expect(isKeychainReference('$MY_PASSWORD')).toBe(false);
    expect(isKeychainReference('${WP_APP_PASS}')).toBe(false);
  });

  it('should return false for empty string', () => {
    expect(isKeychainReference('')).toBe(false);
  });

  it('should return false for malformed reference', () => {
    expect(isKeychainReference('keychain:wpnav:')).toBe(false);
    expect(isKeychainReference('keychain:other:site.com')).toBe(false);
  });
});

// =============================================================================
// Provider Detection
// =============================================================================

describe('provider detection', () => {
  it('should detect provider availability', () => {
    // This test runs on the actual platform
    const available = isKeychainAvailable();
    expect(typeof available).toBe('boolean');
  });

  it('should return provider name', () => {
    const name = getKeychainProviderName();
    expect(typeof name).toBe('string');
    expect(name.length).toBeGreaterThan(0);

    // Should be one of the known providers
    expect([
      'macOS Keychain',
      'Linux Secret Service',
      'Windows Credential Manager',
      'Fallback (unavailable)',
    ]).toContain(name);
  });

  it('should cache provider across calls', () => {
    const name1 = getKeychainProviderName();
    const name2 = getKeychainProviderName();
    expect(name1).toBe(name2);
  });
});

// =============================================================================
// resolvePassword
// =============================================================================

describe('resolvePassword', () => {
  it('should return literal password with config source', async () => {
    const result = await resolvePassword('my-literal-password');
    expect(result.source).toBe('config');
    expect(result.password).toBe('my-literal-password');
    expect(result.error).toBeUndefined();
  });

  it('should return empty string as literal', async () => {
    const result = await resolvePassword('');
    expect(result.source).toBe('config');
    expect(result.password).toBe('');
  });

  it('should return env var reference as literal', async () => {
    // resolvePassword doesn't expand env vars - that's wpnav-config's job
    const result = await resolvePassword('$MY_PASSWORD');
    expect(result.source).toBe('config');
    expect(result.password).toBe('$MY_PASSWORD');
  });

  it('should attempt keychain resolution for keychain reference', async () => {
    // Note: This will actually try to access the keychain
    // On macOS, it might prompt for permission or return not found
    const result = await resolvePassword('keychain:wpnav:nonexistent-test-site-12345.example');

    // Should either succeed (keychain) or return error (not found / unavailable)
    if (result.source === 'keychain') {
      expect(result.password).toBeTruthy();
    } else {
      expect(result.source).toBe('none');
      expect(result.password).toBeNull();
      expect(result.error).toBeTruthy();
    }
  });
});

// =============================================================================
// Platform-specific behavior
// =============================================================================

describe('platform detection', () => {
  it('should detect current platform', () => {
    const name = getKeychainProviderName();

    if (process.platform === 'darwin') {
      expect(name).toBe('macOS Keychain');
    } else if (process.platform === 'linux') {
      // May be Secret Service or Fallback depending on secret-tool availability
      expect(['Linux Secret Service', 'Fallback (unavailable)']).toContain(name);
    } else if (process.platform === 'win32') {
      // May be Windows Credential Manager or Fallback depending on cmdkey availability
      expect(['Windows Credential Manager', 'Fallback (unavailable)']).toContain(name);
    } else {
      expect(name).toBe('Fallback (unavailable)');
    }
  });
});
