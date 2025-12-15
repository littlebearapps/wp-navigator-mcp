/**
 * MCP Resources Tests
 *
 * Tests for the MCP Resources system.
 *
 * @package WP_Navigator_MCP
 * @since 2.6.0
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  resourceRegistry,
  registerAllResources,
  handleListResources,
  handleReadResource,
} from './index.js';
import type { ResourceGeneratorContext } from './types.js';

describe('MCP Resources', () => {
  // Mock context for resource generators
  const mockContext: ResourceGeneratorContext = {
    wpRequest: vi.fn().mockResolvedValue({}),
    config: {
      baseUrl: 'https://example.com',
      restApi: 'https://example.com/wp-json',
      toggles: { enableWrites: false },
    },
  };

  beforeEach(() => {
    // Re-register resources before each test
    registerAllResources();
    vi.clearAllMocks();
  });

  describe('registerAllResources', () => {
    it('registers static and dynamic resources', () => {
      const count = resourceRegistry.getResourceCount();

      // Should have static resources (tools, site, guides x2, roles list, cookbooks list)
      expect(count.static).toBeGreaterThanOrEqual(6);

      // Should have dynamic templates (roles, cookbooks)
      expect(count.dynamicTemplates).toBe(2);
    });
  });

  describe('handleListResources', () => {
    it('returns all static resources', async () => {
      const result = await handleListResources();

      // Check for expected static resources
      const uris = result.resources.map((r) => r.uri);

      expect(uris).toContain('wpnav://tools/overview');
      expect(uris).toContain('wpnav://site/context');
      expect(uris).toContain('wpnav://guides/gutenberg');
      expect(uris).toContain('wpnav://guides/workflows');
      expect(uris).toContain('wpnav://roles/list');
      expect(uris).toContain('wpnav://cookbooks/list');
    });

    it('returns dynamic role resources', async () => {
      const result = await handleListResources();

      // Should include individual role URIs from bundled roles
      const roleUris = result.resources.filter(
        (r) => r.uri.startsWith('wpnav://roles/') && r.uri !== 'wpnav://roles/list'
      );

      // We have 4 bundled roles
      expect(roleUris.length).toBeGreaterThanOrEqual(4);

      // Check for known bundled roles
      const uris = roleUris.map((r) => r.uri);
      expect(uris).toContain('wpnav://roles/content-editor');
      expect(uris).toContain('wpnav://roles/developer');
      expect(uris).toContain('wpnav://roles/seo-specialist');
      expect(uris).toContain('wpnav://roles/site-admin');
    });

    it('returns dynamic cookbook resources', async () => {
      const result = await handleListResources();

      // Should include individual cookbook URIs from bundled cookbooks
      const cookbookUris = result.resources.filter(
        (r) => r.uri.startsWith('wpnav://cookbooks/') && r.uri !== 'wpnav://cookbooks/list'
      );

      // We have 2 bundled cookbooks
      expect(cookbookUris.length).toBeGreaterThanOrEqual(2);

      // Check for known bundled cookbooks
      const uris = cookbookUris.map((r) => r.uri);
      expect(uris).toContain('wpnav://cookbooks/gutenberg');
      expect(uris).toContain('wpnav://cookbooks/elementor');
    });

    it('returns resources with required fields', async () => {
      const result = await handleListResources();

      for (const resource of result.resources) {
        expect(resource.uri).toBeDefined();
        expect(resource.name).toBeDefined();
        expect(typeof resource.uri).toBe('string');
        expect(typeof resource.name).toBe('string');
      }
    });
  });

  describe('handleReadResource', () => {
    describe('wpnav://tools/overview', () => {
      it('returns content for tools overview', async () => {
        const result = await handleReadResource('wpnav://tools/overview', mockContext);

        expect(result.contents).toHaveLength(1);
        expect(result.contents[0].uri).toBe('wpnav://tools/overview');
        expect(result.contents[0].mimeType).toBe('text/markdown');
        expect(result.contents[0].text).toContain('WP Navigator Tools');
        expect(result.contents[0].text).toContain('Categories');
      });
    });

    describe('wpnav://site/context', () => {
      it('returns content for site context', async () => {
        (mockContext.wpRequest as any).mockResolvedValue({ title: 'Test Site' });

        const result = await handleReadResource('wpnav://site/context', mockContext);

        expect(result.contents).toHaveLength(1);
        expect(result.contents[0].uri).toBe('wpnav://site/context');
        expect(result.contents[0].mimeType).toBe('text/markdown');
        expect(result.contents[0].text).toContain('Site Context');
      });

      it('handles WordPress API errors gracefully', async () => {
        (mockContext.wpRequest as any).mockRejectedValue(new Error('API Error'));

        const result = await handleReadResource('wpnav://site/context', mockContext);

        expect(result.contents).toHaveLength(1);
        expect(result.contents[0].uri).toBe('wpnav://site/context');
        // Should still return content, even with failed API calls
        expect(result.contents[0].text).toContain('Site Context');
      });
    });

    describe('wpnav://guides/*', () => {
      it('returns content for gutenberg guide', async () => {
        const result = await handleReadResource('wpnav://guides/gutenberg', mockContext);

        expect(result.contents).toHaveLength(1);
        expect(result.contents[0].uri).toBe('wpnav://guides/gutenberg');
        expect(result.contents[0].mimeType).toBe('text/markdown');
        expect(result.contents[0].text).toContain('Gutenberg');
        expect(result.contents[0].text).toContain('core/paragraph');
      });

      it('returns content for workflows guide', async () => {
        const result = await handleReadResource('wpnav://guides/workflows', mockContext);

        expect(result.contents).toHaveLength(1);
        expect(result.contents[0].uri).toBe('wpnav://guides/workflows');
        expect(result.contents[0].mimeType).toBe('text/markdown');
        expect(result.contents[0].text).toContain('Workflows');
      });
    });

    describe('wpnav://roles/list', () => {
      it('returns roles list', async () => {
        const result = await handleReadResource('wpnav://roles/list', mockContext);

        expect(result.contents).toHaveLength(1);
        expect(result.contents[0].uri).toBe('wpnav://roles/list');
        expect(result.contents[0].mimeType).toBe('text/markdown');
        expect(result.contents[0].text).toContain('Available Roles');
        expect(result.contents[0].text).toContain('content-editor');
      });
    });

    describe('wpnav://roles/{slug}', () => {
      it('returns content for specific role', async () => {
        const result = await handleReadResource('wpnav://roles/content-editor', mockContext);

        expect(result.contents).toHaveLength(1);
        expect(result.contents[0].uri).toBe('wpnav://roles/content-editor');
        expect(result.contents[0].mimeType).toBe('text/markdown');
        expect(result.contents[0].text).toContain('Role:');
        expect(result.contents[0].text).toContain('Context');
      });

      it('throws error for unknown role', async () => {
        await expect(
          handleReadResource('wpnav://roles/nonexistent-role', mockContext)
        ).rejects.toThrow('Resource not found');
      });
    });

    describe('wpnav://cookbooks/list', () => {
      it('returns cookbooks list', async () => {
        const result = await handleReadResource('wpnav://cookbooks/list', mockContext);

        expect(result.contents).toHaveLength(1);
        expect(result.contents[0].uri).toBe('wpnav://cookbooks/list');
        expect(result.contents[0].mimeType).toBe('text/markdown');
        expect(result.contents[0].text).toContain('Available Cookbooks');
        expect(result.contents[0].text).toContain('gutenberg');
      });
    });

    describe('wpnav://cookbooks/{slug}', () => {
      it('returns content for specific cookbook', async () => {
        const result = await handleReadResource('wpnav://cookbooks/gutenberg', mockContext);

        expect(result.contents).toHaveLength(1);
        expect(result.contents[0].uri).toBe('wpnav://cookbooks/gutenberg');
        expect(result.contents[0].mimeType).toBe('text/markdown');
        expect(result.contents[0].text).toContain('Cookbook:');
      });

      it('throws error for unknown cookbook', async () => {
        await expect(
          handleReadResource('wpnav://cookbooks/nonexistent-plugin', mockContext)
        ).rejects.toThrow('Resource not found');
      });
    });

    describe('error handling', () => {
      it('throws error for unknown resource URI', async () => {
        await expect(handleReadResource('wpnav://unknown/resource', mockContext)).rejects.toThrow(
          'Resource not found'
        );
      });

      it('throws error for invalid URI scheme', async () => {
        await expect(handleReadResource('invalid://tools/overview', mockContext)).rejects.toThrow(
          'Resource not found'
        );
      });
    });
  });

  describe('ResourceRegistry', () => {
    describe('hasResource', () => {
      it('returns true for static resources', () => {
        expect(resourceRegistry.hasResource('wpnav://tools/overview')).toBe(true);
        expect(resourceRegistry.hasResource('wpnav://site/context')).toBe(true);
      });

      it('returns true for dynamic resources matching patterns', () => {
        expect(resourceRegistry.hasResource('wpnav://roles/content-editor')).toBe(true);
        expect(resourceRegistry.hasResource('wpnav://cookbooks/gutenberg')).toBe(true);
      });

      it('returns false for unknown resources', () => {
        expect(resourceRegistry.hasResource('wpnav://unknown/resource')).toBe(false);
      });
    });

    describe('clear', () => {
      it('clears all registered resources', () => {
        resourceRegistry.clear();
        const count = resourceRegistry.getResourceCount();

        expect(count.static).toBe(0);
        expect(count.dynamicTemplates).toBe(0);

        // Re-register for other tests
        registerAllResources();
      });
    });
  });
});
