import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the tool registry before importing
vi.mock('../../tool-registry/index.js', () => ({
  toolRegistry: {
    register: vi.fn(),
  },
  ToolCategory: {
    AUTH: 'auth',
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

import { registerJwtTools } from './jwt.js';
import { toolRegistry } from '../../tool-registry/index.js';

describe('JWT Authentication Tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('registerJwtTools', () => {
    it('registers wpnav_jwt_token tool', () => {
      registerJwtTools();

      const calls = vi.mocked(toolRegistry.register).mock.calls;
      const jwtToken = calls.find((c) => c[0].definition.name === 'wpnav_jwt_token');

      expect(jwtToken).toBeDefined();
      expect(jwtToken![0].category).toBe('auth');
    });

    it('registers wpnav_jwt_refresh tool', () => {
      registerJwtTools();

      const calls = vi.mocked(toolRegistry.register).mock.calls;
      const jwtRefresh = calls.find((c) => c[0].definition.name === 'wpnav_jwt_refresh');

      expect(jwtRefresh).toBeDefined();
      expect(jwtRefresh![0].category).toBe('auth');
    });

    it('registers wpnav_jwt_revoke tool', () => {
      registerJwtTools();

      const calls = vi.mocked(toolRegistry.register).mock.calls;
      const jwtRevoke = calls.find((c) => c[0].definition.name === 'wpnav_jwt_revoke');

      expect(jwtRevoke).toBeDefined();
      expect(jwtRevoke![0].category).toBe('auth');
    });
  });

  describe('wpnav_jwt_token handler', () => {
    it('calls wpRequest with POST and credentials in body', async () => {
      registerJwtTools();

      const calls = vi.mocked(toolRegistry.register).mock.calls;
      const jwtToken = calls.find((c) => c[0].definition.name === 'wpnav_jwt_token');
      const handler = jwtToken![0].handler;

      const mockContext = {
        wpRequest: vi.fn().mockResolvedValue({
          access_token: 'eyJ...',
          refresh_token: 'eyJ...',
          expires_in: 3600,
          token_type: 'Bearer',
        }),
        clampText: (t: string) => t,
        config: {},
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
      };

      await handler({ username: 'admin', password: 'secret' }, mockContext as any);

      expect(mockContext.wpRequest).toHaveBeenCalledWith('/wpnav/v1/auth/jwt/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'secret' }),
      });
    });

    it('returns token response', async () => {
      registerJwtTools();

      const calls = vi.mocked(toolRegistry.register).mock.calls;
      const jwtToken = calls.find((c) => c[0].definition.name === 'wpnav_jwt_token');
      const handler = jwtToken![0].handler;

      const mockResponse = {
        access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        refresh_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        expires_in: 3600,
        token_type: 'Bearer',
      };

      const mockContext = {
        wpRequest: vi.fn().mockResolvedValue(mockResponse),
        clampText: (t: string) => t,
        config: {},
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
      };

      const result = await handler({ username: 'admin', password: 'secret' }, mockContext as any);

      expect(result.content).toHaveLength(1);
      expect(JSON.parse(result.content[0].text!)).toEqual(mockResponse);
    });

    it('has correct input schema with required fields', () => {
      registerJwtTools();

      const calls = vi.mocked(toolRegistry.register).mock.calls;
      const jwtToken = calls.find((c) => c[0].definition.name === 'wpnav_jwt_token');

      const schema = jwtToken![0].definition.inputSchema;
      expect(schema.required).toContain('username');
      expect(schema.required).toContain('password');
    });
  });

  describe('wpnav_jwt_refresh handler', () => {
    it('calls wpRequest with POST and refresh_token in body', async () => {
      registerJwtTools();

      const calls = vi.mocked(toolRegistry.register).mock.calls;
      const jwtRefresh = calls.find((c) => c[0].definition.name === 'wpnav_jwt_refresh');
      const handler = jwtRefresh![0].handler;

      const mockContext = {
        wpRequest: vi.fn().mockResolvedValue({
          access_token: 'new_eyJ...',
          refresh_token: 'new_eyJ...',
          expires_in: 3600,
          token_type: 'Bearer',
        }),
        clampText: (t: string) => t,
        config: {},
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
      };

      await handler({ refresh_token: 'old_refresh_token' }, mockContext as any);

      expect(mockContext.wpRequest).toHaveBeenCalledWith('/wpnav/v1/auth/jwt/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: 'old_refresh_token' }),
      });
    });

    it('returns new token pair', async () => {
      registerJwtTools();

      const calls = vi.mocked(toolRegistry.register).mock.calls;
      const jwtRefresh = calls.find((c) => c[0].definition.name === 'wpnav_jwt_refresh');
      const handler = jwtRefresh![0].handler;

      const mockResponse = {
        access_token: 'new_access_token',
        refresh_token: 'new_refresh_token',
        expires_in: 3600,
        token_type: 'Bearer',
      };

      const mockContext = {
        wpRequest: vi.fn().mockResolvedValue(mockResponse),
        clampText: (t: string) => t,
        config: {},
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
      };

      const result = await handler({ refresh_token: 'old_token' }, mockContext as any);

      expect(result.content).toHaveLength(1);
      expect(JSON.parse(result.content[0].text!)).toEqual(mockResponse);
    });

    it('has correct input schema with required refresh_token', () => {
      registerJwtTools();

      const calls = vi.mocked(toolRegistry.register).mock.calls;
      const jwtRefresh = calls.find((c) => c[0].definition.name === 'wpnav_jwt_refresh');

      const schema = jwtRefresh![0].definition.inputSchema;
      expect(schema.required).toContain('refresh_token');
    });
  });

  describe('wpnav_jwt_revoke handler', () => {
    it('calls wpRequest with POST and token in body/header', async () => {
      registerJwtTools();

      const calls = vi.mocked(toolRegistry.register).mock.calls;
      const jwtRevoke = calls.find((c) => c[0].definition.name === 'wpnav_jwt_revoke');
      const handler = jwtRevoke![0].handler;

      const mockContext = {
        wpRequest: vi.fn().mockResolvedValue({
          success: true,
          message: 'Token revoked successfully',
        }),
        clampText: (t: string) => t,
        config: {},
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
      };

      await handler({ access_token: 'token_to_revoke' }, mockContext as any);

      expect(mockContext.wpRequest).toHaveBeenCalledWith('/wpnav/v1/auth/jwt/revoke', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-JWT-Token': 'token_to_revoke',
        },
        body: JSON.stringify({ token: 'token_to_revoke' }),
      });
    });

    it('returns revoke confirmation', async () => {
      registerJwtTools();

      const calls = vi.mocked(toolRegistry.register).mock.calls;
      const jwtRevoke = calls.find((c) => c[0].definition.name === 'wpnav_jwt_revoke');
      const handler = jwtRevoke![0].handler;

      const mockResponse = {
        success: true,
        message: 'Token revoked successfully',
      };

      const mockContext = {
        wpRequest: vi.fn().mockResolvedValue(mockResponse),
        clampText: (t: string) => t,
        config: {},
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
      };

      const result = await handler({ access_token: 'token' }, mockContext as any);

      expect(result.content).toHaveLength(1);
      expect(JSON.parse(result.content[0].text!)).toEqual(mockResponse);
    });

    it('has correct input schema with required access_token', () => {
      registerJwtTools();

      const calls = vi.mocked(toolRegistry.register).mock.calls;
      const jwtRevoke = calls.find((c) => c[0].definition.name === 'wpnav_jwt_revoke');

      const schema = jwtRevoke![0].definition.inputSchema;
      expect(schema.required).toContain('access_token');
    });
  });
});
