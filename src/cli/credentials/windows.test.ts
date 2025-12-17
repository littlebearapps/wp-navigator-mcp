/**
 * Tests for Windows Credential Manager Provider
 *
 * Tests are designed to run on any platform using mocks.
 * The actual Windows implementation is tested via integration on Windows CI.
 *
 * @package WP_Navigator_MCP
 * @since 2.7.0
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as childProcess from 'child_process';
import { WindowsCredentialProvider } from './windows.js';

// Mock child_process for cross-platform testing
vi.mock('child_process', async () => {
  const actual = await vi.importActual<typeof import('child_process')>('child_process');
  return {
    ...actual,
    execFileSync: vi.fn(),
  };
});

const mockExecFileSync = vi.mocked(childProcess.execFileSync);

// =============================================================================
// Test Setup
// =============================================================================

describe('WindowsCredentialProvider', () => {
  let provider: WindowsCredentialProvider;
  let originalPlatform: PropertyDescriptor | undefined;

  beforeEach(() => {
    provider = new WindowsCredentialProvider();
    vi.clearAllMocks();

    // Save original platform descriptor
    originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
  });

  afterEach(() => {
    // Restore original platform
    if (originalPlatform) {
      Object.defineProperty(process, 'platform', originalPlatform);
    }
  });

  // Helper to mock Windows platform
  function mockWindows(): void {
    Object.defineProperty(process, 'platform', {
      value: 'win32',
      writable: true,
      enumerable: true,
      configurable: true,
    });
  }

  // Helper to mock non-Windows platform
  function mockDarwin(): void {
    Object.defineProperty(process, 'platform', {
      value: 'darwin',
      writable: true,
      enumerable: true,
      configurable: true,
    });
  }

  // =============================================================================
  // Provider Properties
  // =============================================================================

  describe('name', () => {
    it('should return "Windows Credential Manager"', () => {
      expect(provider.name).toBe('Windows Credential Manager');
    });
  });

  describe('available', () => {
    it('should return false on non-Windows platforms', () => {
      mockDarwin();
      provider = new WindowsCredentialProvider();
      expect(provider.available).toBe(false);
    });

    it('should return true on Windows when cmdkey exists', () => {
      mockWindows();
      mockExecFileSync.mockReturnValueOnce(Buffer.from('cmdkey help'));
      provider = new WindowsCredentialProvider();
      expect(provider.available).toBe(true);
    });

    it('should return false on Windows when cmdkey is not available', () => {
      mockWindows();
      mockExecFileSync.mockImplementationOnce(() => {
        throw new Error('cmdkey not found');
      });
      provider = new WindowsCredentialProvider();
      expect(provider.available).toBe(false);
    });
  });

  // =============================================================================
  // Store
  // =============================================================================

  describe('store', () => {
    beforeEach(() => {
      mockWindows();
    });

    it('should store credential using cmdkey', async () => {
      // First call deletes existing (may fail)
      mockExecFileSync.mockImplementationOnce(() => {
        throw new Error('not found');
      });
      // Second call stores new credential
      mockExecFileSync.mockReturnValueOnce(Buffer.from(''));

      await provider.store({
        service: 'wpnav',
        account: 'example.com',
        password: 'test-password',
      });

      // Should have tried delete first, then store
      expect(mockExecFileSync).toHaveBeenCalledTimes(2);
      expect(mockExecFileSync).toHaveBeenLastCalledWith(
        'cmdkey.exe',
        ['/generic:wpnav-example.com', '/user:wpnav', '/pass:test-password'],
        expect.objectContaining({ timeout: 10000 })
      );
    });

    it('should delete existing credential before storing new one', async () => {
      mockExecFileSync.mockReturnValue(Buffer.from(''));

      await provider.store({
        service: 'wpnav',
        account: 'site.com',
        password: 'new-pass',
      });

      // First call should be delete
      expect(mockExecFileSync).toHaveBeenNthCalledWith(
        1,
        'cmdkey.exe',
        ['/delete:wpnav-site.com'],
        expect.any(Object)
      );
    });

    it('should throw on invalid account', async () => {
      await expect(
        provider.store({
          service: 'wpnav',
          account: '',
          password: 'test',
        })
      ).rejects.toThrow('Invalid account');
    });

    it('should throw on invalid password', async () => {
      await expect(
        provider.store({
          service: 'wpnav',
          account: 'example.com',
          password: '',
        })
      ).rejects.toThrow('Invalid password: cannot be empty');
    });

    it('should throw on cmdkey failure', async () => {
      // Delete succeeds
      mockExecFileSync.mockReturnValueOnce(Buffer.from(''));
      // Store fails
      mockExecFileSync.mockImplementationOnce(() => {
        throw new Error('Access denied');
      });

      await expect(
        provider.store({
          service: 'wpnav',
          account: 'example.com',
          password: 'test',
        })
      ).rejects.toThrow('Failed to store credential in Windows Credential Manager');
    });
  });

  // =============================================================================
  // Retrieve
  // =============================================================================

  describe('retrieve', () => {
    beforeEach(() => {
      mockWindows();
    });

    it('should retrieve password via PowerShell', async () => {
      mockExecFileSync.mockReturnValueOnce('my-secret-password\n');

      const password = await provider.retrieve('example.com');

      expect(password).toBe('my-secret-password');
      expect(mockExecFileSync).toHaveBeenCalledWith(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-Command', expect.stringContaining('WpnavCredManager')],
        expect.objectContaining({ timeout: 15000 })
      );
    });

    it('should return null when credential not found', async () => {
      mockExecFileSync.mockReturnValueOnce('');

      const password = await provider.retrieve('nonexistent.com');

      expect(password).toBeNull();
    });

    it('should return null on PowerShell error', async () => {
      mockExecFileSync.mockImplementationOnce(() => {
        throw new Error('PowerShell error');
      });

      const password = await provider.retrieve('example.com');

      expect(password).toBeNull();
    });

    it('should throw on invalid account', async () => {
      await expect(provider.retrieve('')).rejects.toThrow('Invalid account');
    });

    it('should use correct target format', async () => {
      mockExecFileSync.mockReturnValueOnce('pass');

      await provider.retrieve('blog.example.org');

      expect(mockExecFileSync).toHaveBeenCalled();
      const call = mockExecFileSync.mock.calls[0];
      expect(call).toBeDefined();
      const scriptArg = call?.[1]?.[3] as string | undefined;
      expect(scriptArg).toContain("GetPassword('wpnav-blog.example.org')");
    });
  });

  // =============================================================================
  // Delete
  // =============================================================================

  describe('delete', () => {
    beforeEach(() => {
      mockWindows();
    });

    it('should delete credential using cmdkey', async () => {
      mockExecFileSync.mockReturnValueOnce(Buffer.from(''));

      const result = await provider.delete('example.com');

      expect(result).toBe(true);
      expect(mockExecFileSync).toHaveBeenCalledWith(
        'cmdkey.exe',
        ['/delete:wpnav-example.com'],
        expect.objectContaining({ timeout: 10000 })
      );
    });

    it('should return false when credential not found', async () => {
      mockExecFileSync.mockImplementationOnce(() => {
        throw new Error('not found');
      });

      const result = await provider.delete('nonexistent.com');

      expect(result).toBe(false);
    });

    it('should throw on invalid account', async () => {
      await expect(provider.delete('')).rejects.toThrow('Invalid account');
    });
  });

  // =============================================================================
  // List
  // =============================================================================

  describe('list', () => {
    beforeEach(() => {
      mockWindows();
    });

    it('should parse cmdkey /list output', async () => {
      const cmdkeyOutput = `
Currently stored credentials:

    Target: LegacyGeneric:target=wpnav-example.com
    Type: Generic
    User: wpnav

    Target: LegacyGeneric:target=wpnav-another-site.org
    Type: Generic
    User: wpnav

    Target: SomeOtherCredential
    Type: Generic
    User: other
`;
      mockExecFileSync.mockReturnValueOnce(cmdkeyOutput);

      const accounts = await provider.list();

      expect(accounts).toEqual(['another-site.org', 'example.com']);
    });

    it('should handle direct target format', async () => {
      const cmdkeyOutput = `
Currently stored credentials:

    Target: wpnav-simple.com
    Type: Generic
    User: wpnav
`;
      mockExecFileSync.mockReturnValueOnce(cmdkeyOutput);

      const accounts = await provider.list();

      expect(accounts).toEqual(['simple.com']);
    });

    it('should filter out non-wpnav credentials', async () => {
      const cmdkeyOutput = `
Currently stored credentials:

    Target: other-credential
    Type: Generic
    User: other

    Target: wpnav-my-site.com
    Type: Generic
    User: wpnav
`;
      mockExecFileSync.mockReturnValueOnce(cmdkeyOutput);

      const accounts = await provider.list();

      expect(accounts).toEqual(['my-site.com']);
    });

    it('should filter out accounts that are too short', async () => {
      const cmdkeyOutput = `
    Target: wpnav-ab
    Type: Generic
`;
      mockExecFileSync.mockReturnValueOnce(cmdkeyOutput);

      const accounts = await provider.list();

      expect(accounts).toEqual([]);
    });

    it('should return empty array on cmdkey error', async () => {
      mockExecFileSync.mockImplementationOnce(() => {
        throw new Error('cmdkey error');
      });

      const accounts = await provider.list();

      expect(accounts).toEqual([]);
    });

    it('should deduplicate accounts', async () => {
      const cmdkeyOutput = `
    Target: wpnav-duplicate.com
    Target: wpnav-duplicate.com
`;
      mockExecFileSync.mockReturnValueOnce(cmdkeyOutput);

      const accounts = await provider.list();

      expect(accounts).toEqual(['duplicate.com']);
    });

    it('should sort accounts alphabetically', async () => {
      const cmdkeyOutput = `
    Target: wpnav-zebra.com
    Target: wpnav-alpha.com
    Target: wpnav-middle.com
`;
      mockExecFileSync.mockReturnValueOnce(cmdkeyOutput);

      const accounts = await provider.list();

      expect(accounts).toEqual(['alpha.com', 'middle.com', 'zebra.com']);
    });
  });
});
