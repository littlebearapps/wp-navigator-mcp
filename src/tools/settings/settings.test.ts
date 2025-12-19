import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the tool registry before importing
vi.mock('../../tool-registry/index.js', () => ({
  toolRegistry: {
    register: vi.fn(),
  },
  ToolCategory: {
    SETTINGS: 'settings',
  },
}));

vi.mock('../../tool-registry/utils.js', () => ({
  validateRequired: vi.fn((args, fields) => {
    for (const field of fields) {
      if (args[field] === undefined) {
        throw new Error(`Missing required field: ${field}`);
      }
    }
  }),
}));

import { registerSettingsTools } from './settings.js';
import { toolRegistry } from '../../tool-registry/index.js';

describe('Settings Tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('registerSettingsTools', () => {
    it('registers wpnav_site_settings tool', () => {
      registerSettingsTools();

      const calls = vi.mocked(toolRegistry.register).mock.calls;
      const siteSettings = calls.find((c) => c[0].definition.name === 'wpnav_site_settings');

      expect(siteSettings).toBeDefined();
      expect(siteSettings![0].category).toBe('settings');
    });

    it('registers wpnav_update_settings tool', () => {
      registerSettingsTools();

      const calls = vi.mocked(toolRegistry.register).mock.calls;
      const updateSettings = calls.find((c) => c[0].definition.name === 'wpnav_update_settings');

      expect(updateSettings).toBeDefined();
      expect(updateSettings![0].category).toBe('settings');
    });
  });

  describe('wpnav_site_settings handler', () => {
    it('calls wpRequest with base endpoint when no keys provided', async () => {
      registerSettingsTools();

      const calls = vi.mocked(toolRegistry.register).mock.calls;
      const siteSettings = calls.find((c) => c[0].definition.name === 'wpnav_site_settings');
      const handler = siteSettings![0].handler;

      const mockContext = {
        wpRequest: vi.fn().mockResolvedValue({
          settings: { blogname: 'My Site' },
          grouped: { general: ['blogname'] },
        }),
        clampText: (t: string) => t,
        config: {},
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
      };

      await handler({}, mockContext as any);

      expect(mockContext.wpRequest).toHaveBeenCalledWith('/wpnav/v1/settings');
    });

    it('adds keys filter when provided', async () => {
      registerSettingsTools();

      const calls = vi.mocked(toolRegistry.register).mock.calls;
      const siteSettings = calls.find((c) => c[0].definition.name === 'wpnav_site_settings');
      const handler = siteSettings![0].handler;

      const mockContext = {
        wpRequest: vi.fn().mockResolvedValue({ settings: { blogname: 'My Site' } }),
        clampText: (t: string) => t,
        config: {},
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
      };

      await handler({ keys: ['blogname', 'timezone_string'] }, mockContext as any);

      expect(mockContext.wpRequest).toHaveBeenCalledWith(
        expect.stringContaining('keys%5B%5D=blogname')
      );
      expect(mockContext.wpRequest).toHaveBeenCalledWith(
        expect.stringContaining('keys%5B%5D=timezone_string')
      );
    });

    it('returns formatted JSON result', async () => {
      registerSettingsTools();

      const calls = vi.mocked(toolRegistry.register).mock.calls;
      const siteSettings = calls.find((c) => c[0].definition.name === 'wpnav_site_settings');
      const handler = siteSettings![0].handler;

      const mockResponse = {
        settings: { blogname: 'My Site', blogdescription: 'A great site' },
        grouped: { general: ['blogname', 'blogdescription'] },
        read_only: ['siteurl', 'home'],
      };

      const mockContext = {
        wpRequest: vi.fn().mockResolvedValue(mockResponse),
        clampText: (t: string) => t,
        config: {},
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
      };

      const result = await handler({}, mockContext as any);

      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
      expect(JSON.parse(result.content[0].text!)).toEqual(mockResponse);
    });
  });

  describe('wpnav_update_settings handler', () => {
    it('calls wpRequest with POST and settings body', async () => {
      registerSettingsTools();

      const calls = vi.mocked(toolRegistry.register).mock.calls;
      const updateSettings = calls.find((c) => c[0].definition.name === 'wpnav_update_settings');
      const handler = updateSettings![0].handler;

      const mockContext = {
        wpRequest: vi.fn().mockResolvedValue({
          success: true,
          updated: { blogname: { old_value: 'Old', new_value: 'New' } },
        }),
        clampText: (t: string) => t,
        config: {},
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
      };

      await handler({ settings: { blogname: 'New Name' } }, mockContext as any);

      expect(mockContext.wpRequest).toHaveBeenCalledWith('/wpnav/v1/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: { blogname: 'New Name' } }),
      });
    });

    it('returns error when settings is not an object', async () => {
      registerSettingsTools();

      const calls = vi.mocked(toolRegistry.register).mock.calls;
      const updateSettings = calls.find((c) => c[0].definition.name === 'wpnav_update_settings');
      const handler = updateSettings![0].handler;

      const mockContext = {
        wpRequest: vi.fn(),
        clampText: (t: string) => t,
        config: {},
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
      };

      const result = await handler({ settings: 'not an object' }, mockContext as any);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('INVALID_SETTINGS');
    });

    it('returns error when settings is null', async () => {
      registerSettingsTools();

      const calls = vi.mocked(toolRegistry.register).mock.calls;
      const updateSettings = calls.find((c) => c[0].definition.name === 'wpnav_update_settings');
      const handler = updateSettings![0].handler;

      const mockContext = {
        wpRequest: vi.fn(),
        clampText: (t: string) => t,
        config: {},
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
      };

      const result = await handler({ settings: null }, mockContext as any);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('INVALID_SETTINGS');
    });

    it('returns successful update response', async () => {
      registerSettingsTools();

      const calls = vi.mocked(toolRegistry.register).mock.calls;
      const updateSettings = calls.find((c) => c[0].definition.name === 'wpnav_update_settings');
      const handler = updateSettings![0].handler;

      const mockResponse = {
        success: true,
        updated: {
          blogname: { old_value: 'My Site', new_value: 'New Site Name' },
        },
        rejected: {},
      };

      const mockContext = {
        wpRequest: vi.fn().mockResolvedValue(mockResponse),
        clampText: (t: string) => t,
        config: {},
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
      };

      const result = await handler({ settings: { blogname: 'New Site Name' } }, mockContext as any);

      expect(result.content).toHaveLength(1);
      expect(JSON.parse(result.content[0].text!)).toEqual(mockResponse);
    });
  });
});
