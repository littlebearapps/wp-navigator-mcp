import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the tool registry before importing
vi.mock('../../tool-registry/index.js', () => ({
  toolRegistry: {
    register: vi.fn(),
  },
  ToolCategory: {
    MAINTENANCE: 'maintenance',
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

import { registerMaintenanceModeTools } from './maintenance.js';
import { toolRegistry } from '../../tool-registry/index.js';

describe('Maintenance Mode Tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('registerMaintenanceModeTools', () => {
    it('registers wpnav_get_maintenance tool', () => {
      registerMaintenanceModeTools();

      const calls = vi.mocked(toolRegistry.register).mock.calls;
      const getMaintenance = calls.find((c) => c[0].definition.name === 'wpnav_get_maintenance');

      expect(getMaintenance).toBeDefined();
      expect(getMaintenance![0].category).toBe('maintenance');
    });

    it('registers wpnav_set_maintenance tool', () => {
      registerMaintenanceModeTools();

      const calls = vi.mocked(toolRegistry.register).mock.calls;
      const setMaintenance = calls.find((c) => c[0].definition.name === 'wpnav_set_maintenance');

      expect(setMaintenance).toBeDefined();
      expect(setMaintenance![0].category).toBe('maintenance');
    });
  });

  describe('wpnav_get_maintenance handler', () => {
    it('calls wpRequest with correct endpoint', async () => {
      registerMaintenanceModeTools();

      const calls = vi.mocked(toolRegistry.register).mock.calls;
      const getMaintenance = calls.find((c) => c[0].definition.name === 'wpnav_get_maintenance');
      const handler = getMaintenance![0].handler;

      const mockContext = {
        wpRequest: vi.fn().mockResolvedValue({ enabled: false }),
        clampText: (t: string) => t,
        config: {},
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
      };

      await handler({}, mockContext as any);

      expect(mockContext.wpRequest).toHaveBeenCalledWith('/wpnav/v1/maintenance');
    });

    it('returns maintenance status', async () => {
      registerMaintenanceModeTools();

      const calls = vi.mocked(toolRegistry.register).mock.calls;
      const getMaintenance = calls.find((c) => c[0].definition.name === 'wpnav_get_maintenance');
      const handler = getMaintenance![0].handler;

      const mockResponse = { enabled: true, message: 'Under maintenance' };

      const mockContext = {
        wpRequest: vi.fn().mockResolvedValue(mockResponse),
        clampText: (t: string) => t,
        config: {},
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
      };

      const result = await handler({}, mockContext as any);

      expect(result.content).toHaveLength(1);
      expect(JSON.parse(result.content[0].text!)).toEqual(mockResponse);
    });
  });

  describe('wpnav_set_maintenance handler', () => {
    it('calls wpRequest with POST and enabled in body', async () => {
      registerMaintenanceModeTools();

      const calls = vi.mocked(toolRegistry.register).mock.calls;
      const setMaintenance = calls.find((c) => c[0].definition.name === 'wpnav_set_maintenance');
      const handler = setMaintenance![0].handler;

      const mockContext = {
        wpRequest: vi.fn().mockResolvedValue({ success: true }),
        clampText: (t: string) => t,
        config: {},
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
      };

      await handler({ enabled: true }, mockContext as any);

      expect(mockContext.wpRequest).toHaveBeenCalledWith('/wpnav/v1/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: true }),
      });
    });

    it('includes optional message parameter', async () => {
      registerMaintenanceModeTools();

      const calls = vi.mocked(toolRegistry.register).mock.calls;
      const setMaintenance = calls.find((c) => c[0].definition.name === 'wpnav_set_maintenance');
      const handler = setMaintenance![0].handler;

      const mockContext = {
        wpRequest: vi.fn().mockResolvedValue({ success: true }),
        clampText: (t: string) => t,
        config: {},
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
      };

      await handler({ enabled: true, message: 'Site is under maintenance' }, mockContext as any);

      expect(mockContext.wpRequest).toHaveBeenCalledWith('/wpnav/v1/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: true, message: 'Site is under maintenance' }),
      });
    });

    it('includes optional timeout parameter', async () => {
      registerMaintenanceModeTools();

      const calls = vi.mocked(toolRegistry.register).mock.calls;
      const setMaintenance = calls.find((c) => c[0].definition.name === 'wpnav_set_maintenance');
      const handler = setMaintenance![0].handler;

      const mockContext = {
        wpRequest: vi.fn().mockResolvedValue({ success: true }),
        clampText: (t: string) => t,
        config: {},
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
      };

      await handler({ enabled: true, timeout: 3600 }, mockContext as any);

      expect(mockContext.wpRequest).toHaveBeenCalledWith('/wpnav/v1/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: true, timeout: 3600 }),
      });
    });

    it('includes optional allow_admins parameter', async () => {
      registerMaintenanceModeTools();

      const calls = vi.mocked(toolRegistry.register).mock.calls;
      const setMaintenance = calls.find((c) => c[0].definition.name === 'wpnav_set_maintenance');
      const handler = setMaintenance![0].handler;

      const mockContext = {
        wpRequest: vi.fn().mockResolvedValue({ success: true }),
        clampText: (t: string) => t,
        config: {},
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
      };

      await handler({ enabled: true, allow_admins: false }, mockContext as any);

      expect(mockContext.wpRequest).toHaveBeenCalledWith('/wpnav/v1/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: true, allow_admins: false }),
      });
    });

    it('returns error for invalid timeout (too low)', async () => {
      registerMaintenanceModeTools();

      const calls = vi.mocked(toolRegistry.register).mock.calls;
      const setMaintenance = calls.find((c) => c[0].definition.name === 'wpnav_set_maintenance');
      const handler = setMaintenance![0].handler;

      const mockContext = {
        wpRequest: vi.fn(),
        clampText: (t: string) => t,
        config: {},
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
      };

      const result = await handler({ enabled: true, timeout: 30 }, mockContext as any);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('INVALID_TIMEOUT');
    });

    it('returns error for invalid timeout (too high)', async () => {
      registerMaintenanceModeTools();

      const calls = vi.mocked(toolRegistry.register).mock.calls;
      const setMaintenance = calls.find((c) => c[0].definition.name === 'wpnav_set_maintenance');
      const handler = setMaintenance![0].handler;

      const mockContext = {
        wpRequest: vi.fn(),
        clampText: (t: string) => t,
        config: {},
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
      };

      const result = await handler({ enabled: true, timeout: 100000 }, mockContext as any);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('INVALID_TIMEOUT');
    });

    it('accepts valid timeout at minimum boundary (60)', async () => {
      registerMaintenanceModeTools();

      const calls = vi.mocked(toolRegistry.register).mock.calls;
      const setMaintenance = calls.find((c) => c[0].definition.name === 'wpnav_set_maintenance');
      const handler = setMaintenance![0].handler;

      const mockContext = {
        wpRequest: vi.fn().mockResolvedValue({ success: true }),
        clampText: (t: string) => t,
        config: {},
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
      };

      await handler({ enabled: true, timeout: 60 }, mockContext as any);

      expect(mockContext.wpRequest).toHaveBeenCalled();
    });

    it('accepts valid timeout at maximum boundary (86400)', async () => {
      registerMaintenanceModeTools();

      const calls = vi.mocked(toolRegistry.register).mock.calls;
      const setMaintenance = calls.find((c) => c[0].definition.name === 'wpnav_set_maintenance');
      const handler = setMaintenance![0].handler;

      const mockContext = {
        wpRequest: vi.fn().mockResolvedValue({ success: true }),
        clampText: (t: string) => t,
        config: {},
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
      };

      await handler({ enabled: true, timeout: 86400 }, mockContext as any);

      expect(mockContext.wpRequest).toHaveBeenCalled();
    });
  });
});
