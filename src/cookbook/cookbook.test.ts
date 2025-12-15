/**
 * Cookbook Module Tests
 *
 * Tests for cookbook schema validation and loading.
 *
 * @package WP_Navigator_MCP
 * @since 2.1.0
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  COOKBOOK_SCHEMA_VERSION,
  validateCookbook,
  CookbookValidationError,
  CookbookSchemaVersionError,
  loadCookbook,
  loadCookbooksFromDirectory,
  discoverCookbooks,
  listAvailableCookbooks,
  getCookbook,
  hasCookbook,
  listBundledFromRegistry,
  getRegistryEntry,
  getBundledRegistry,
  type Cookbook,
} from './index.js';

// =============================================================================
// Test Fixtures
// =============================================================================

const validCookbook: Cookbook = {
  schema_version: 1,
  cookbook_version: '1.0.0',
  plugin: {
    slug: 'woocommerce',
    name: 'WooCommerce',
    min_version: '8.0',
  },
  capabilities: {
    settings_pages: [
      {
        path: '/wp-admin/admin.php?page=wc-settings',
        title: 'General Settings',
        description: 'Basic WooCommerce configuration',
        sections: [
          {
            id: 'store-address',
            title: 'Store Address',
            fields: [
              { id: 'store_country', label: 'Country', type: 'select' },
              { id: 'store_city', label: 'City', type: 'text' },
            ],
          },
        ],
      },
    ],
    shortcodes: [
      {
        tag: 'products',
        description: 'Display a grid of products',
        params: [
          {
            name: 'limit',
            type: 'number',
            default: '10',
            description: 'Number of products to display',
          },
          { name: 'category', type: 'string', description: 'Product category slug' },
        ],
        example: '[products limit="12" category="clothing"]',
      },
    ],
    blocks: [
      {
        name: 'woocommerce/product-grid',
        title: 'Product Grid',
        description: 'Display products in a grid layout',
        category: 'woocommerce',
        supports: ['align', 'spacing'],
        keywords: ['products', 'shop', 'store'],
      },
    ],
    rest_endpoints: [
      {
        route: '/wc/v3/products',
        description: 'Manage products',
        methods: ['GET', 'POST'],
        permission: 'edit_products',
      },
    ],
    post_types: [{ slug: 'product', label: 'Products' }],
    taxonomies: [{ slug: 'product_cat', label: 'Product Categories', object_types: ['product'] }],
  },
  common_tasks: [
    {
      id: 'add-product-grid',
      title: 'Add a product grid to a page',
      description: 'Display WooCommerce products on any page',
      steps: [
        'Navigate to the page editor',
        'Add a new block',
        'Search for "Product Grid"',
        'Configure the block settings',
      ],
      related_tools: ['wpnav_update_page', 'wpnav_gutenberg_insert_block'],
      difficulty: 'beginner',
    },
  ],
  documentation_url: 'https://woocommerce.com/documentation/',
  last_updated: '2024-01-15',
  author: 'WooCommerce',
};

const minimalCookbook: Cookbook = {
  schema_version: 1,
  cookbook_version: '1.0.0',
  plugin: {
    slug: 'hello-dolly',
    name: 'Hello Dolly',
  },
  capabilities: {},
};

// =============================================================================
// Validation Tests
// =============================================================================

describe('validateCookbook', () => {
  describe('valid cookbooks', () => {
    it('validates a full cookbook with all fields', () => {
      const result = validateCookbook(validCookbook, '/test/cookbook.yaml');
      expect(result).toEqual(validCookbook);
    });

    it('validates a minimal cookbook', () => {
      const result = validateCookbook(minimalCookbook, '/test/cookbook.yaml');
      expect(result).toEqual(minimalCookbook);
    });

    it('accepts valid plugin version bounds', () => {
      const cookbook = {
        ...minimalCookbook,
        plugin: {
          slug: 'test-plugin',
          name: 'Test Plugin',
          min_version: '1.0',
          max_version: '2.0.0',
        },
      };
      const result = validateCookbook(cookbook, '/test/cookbook.yaml');
      expect(result.plugin.min_version).toBe('1.0');
      expect(result.plugin.max_version).toBe('2.0.0');
    });
  });

  describe('schema_version validation', () => {
    it('rejects missing schema_version', () => {
      const cookbook = { ...minimalCookbook, schema_version: undefined };
      expect(() => validateCookbook(cookbook, '/test/cookbook.yaml')).toThrow(
        CookbookValidationError
      );
    });

    it('rejects non-integer schema_version', () => {
      const cookbook = { ...minimalCookbook, schema_version: '1' };
      expect(() => validateCookbook(cookbook, '/test/cookbook.yaml')).toThrow(
        CookbookSchemaVersionError
      );
    });

    it('rejects future schema_version', () => {
      const cookbook = { ...minimalCookbook, schema_version: COOKBOOK_SCHEMA_VERSION + 1 };
      expect(() => validateCookbook(cookbook, '/test/cookbook.yaml')).toThrow(
        CookbookSchemaVersionError
      );
    });
  });

  describe('plugin validation', () => {
    it('rejects missing plugin', () => {
      const cookbook = { ...minimalCookbook, plugin: undefined };
      expect(() => validateCookbook(cookbook, '/test/cookbook.yaml')).toThrow(
        CookbookValidationError
      );
    });

    it('rejects missing plugin.slug', () => {
      const cookbook = { ...minimalCookbook, plugin: { name: 'Test' } };
      expect(() => validateCookbook(cookbook, '/test/cookbook.yaml')).toThrow(
        CookbookValidationError
      );
    });

    it('rejects missing plugin.name', () => {
      const cookbook = { ...minimalCookbook, plugin: { slug: 'test' } };
      expect(() => validateCookbook(cookbook, '/test/cookbook.yaml')).toThrow(
        CookbookValidationError
      );
    });

    it('rejects invalid plugin slug format', () => {
      const cookbook = {
        ...minimalCookbook,
        plugin: { slug: 'Invalid Slug!', name: 'Test' },
      };
      expect(() => validateCookbook(cookbook, '/test/cookbook.yaml')).toThrow(
        CookbookValidationError
      );
    });

    it('accepts valid slug formats', () => {
      const slugs = ['a', 'ab', 'my-plugin', 'plugin123', 'a-b-c-1'];
      for (const slug of slugs) {
        const cookbook = {
          ...minimalCookbook,
          plugin: { slug, name: 'Test' },
        };
        expect(() => validateCookbook(cookbook, '/test/cookbook.yaml')).not.toThrow();
      }
    });
  });

  describe('capabilities validation', () => {
    it('rejects missing capabilities', () => {
      const cookbook = { ...minimalCookbook, capabilities: undefined };
      expect(() => validateCookbook(cookbook, '/test/cookbook.yaml')).toThrow(
        CookbookValidationError
      );
    });

    it('rejects invalid settings_pages', () => {
      const cookbook = {
        ...minimalCookbook,
        capabilities: {
          settings_pages: [{ title: 'Missing path' }],
        },
      };
      expect(() => validateCookbook(cookbook, '/test/cookbook.yaml')).toThrow(
        CookbookValidationError
      );
    });

    it('rejects invalid shortcodes', () => {
      const cookbook = {
        ...minimalCookbook,
        capabilities: {
          shortcodes: [{ tag: 'test' }], // missing description
        },
      };
      expect(() => validateCookbook(cookbook, '/test/cookbook.yaml')).toThrow(
        CookbookValidationError
      );
    });

    it('rejects invalid blocks', () => {
      const cookbook = {
        ...minimalCookbook,
        capabilities: {
          blocks: [{ name: 'test/block' }], // missing title
        },
      };
      expect(() => validateCookbook(cookbook, '/test/cookbook.yaml')).toThrow(
        CookbookValidationError
      );
    });

    it('rejects invalid rest_endpoints', () => {
      const cookbook = {
        ...minimalCookbook,
        capabilities: {
          rest_endpoints: [{ route: '/api/test' }], // missing description and methods
        },
      };
      expect(() => validateCookbook(cookbook, '/test/cookbook.yaml')).toThrow(
        CookbookValidationError
      );
    });

    it('rejects invalid HTTP methods', () => {
      const cookbook = {
        ...minimalCookbook,
        capabilities: {
          rest_endpoints: [{ route: '/api/test', description: 'Test', methods: ['INVALID'] }],
        },
      };
      expect(() => validateCookbook(cookbook, '/test/cookbook.yaml')).toThrow(
        CookbookValidationError
      );
    });
  });

  describe('common_tasks validation', () => {
    it('rejects invalid common_tasks', () => {
      const cookbook = {
        ...minimalCookbook,
        common_tasks: [{ id: 'task1' }], // missing title and steps
      };
      expect(() => validateCookbook(cookbook, '/test/cookbook.yaml')).toThrow(
        CookbookValidationError
      );
    });

    it('rejects empty steps array', () => {
      const cookbook = {
        ...minimalCookbook,
        common_tasks: [{ id: 'task1', title: 'Task', steps: [] }],
      };
      // Empty steps is technically valid (array), but useless
      const result = validateCookbook(cookbook, '/test/cookbook.yaml');
      expect(result.common_tasks?.[0].steps).toEqual([]);
    });

    it('rejects invalid difficulty', () => {
      const cookbook = {
        ...minimalCookbook,
        common_tasks: [{ id: 'task1', title: 'Task', steps: ['Step 1'], difficulty: 'expert' }],
      };
      expect(() => validateCookbook(cookbook, '/test/cookbook.yaml')).toThrow(
        CookbookValidationError
      );
    });

    it('accepts valid difficulties', () => {
      const difficulties = ['beginner', 'intermediate', 'advanced'];
      for (const difficulty of difficulties) {
        const cookbook = {
          ...minimalCookbook,
          common_tasks: [{ id: 'task1', title: 'Task', steps: ['Step 1'], difficulty }],
        };
        expect(() => validateCookbook(cookbook, '/test/cookbook.yaml')).not.toThrow();
      }
    });
  });

  describe('settings field type validation', () => {
    it('rejects invalid field type', () => {
      const cookbook = {
        ...minimalCookbook,
        capabilities: {
          settings_pages: [
            {
              path: '/test',
              title: 'Test',
              sections: [
                {
                  id: 'section1',
                  title: 'Section',
                  fields: [{ id: 'field1', label: 'Field', type: 'invalid' }],
                },
              ],
            },
          ],
        },
      };
      expect(() => validateCookbook(cookbook, '/test/cookbook.yaml')).toThrow(
        CookbookValidationError
      );
    });

    it('accepts all valid field types', () => {
      const types = ['text', 'select', 'checkbox', 'textarea', 'number', 'color', 'radio', 'other'];
      for (const type of types) {
        const cookbook = {
          ...minimalCookbook,
          capabilities: {
            settings_pages: [
              {
                path: '/test',
                title: 'Test',
                sections: [
                  {
                    id: 'section1',
                    title: 'Section',
                    fields: [{ id: 'field1', label: 'Field', type }],
                  },
                ],
              },
            ],
          },
        };
        expect(() => validateCookbook(cookbook, '/test/cookbook.yaml')).not.toThrow();
      }
    });
  });

  describe('shortcode param type validation', () => {
    it('rejects invalid param type', () => {
      const cookbook = {
        ...minimalCookbook,
        capabilities: {
          shortcodes: [
            {
              tag: 'test',
              description: 'Test shortcode',
              params: [{ name: 'param1', type: 'invalid' }],
            },
          ],
        },
      };
      expect(() => validateCookbook(cookbook, '/test/cookbook.yaml')).toThrow(
        CookbookValidationError
      );
    });

    it('accepts all valid param types', () => {
      const types = ['string', 'number', 'boolean', 'array'];
      for (const type of types) {
        const cookbook = {
          ...minimalCookbook,
          capabilities: {
            shortcodes: [
              {
                tag: 'test',
                description: 'Test shortcode',
                params: [{ name: 'param1', type }],
              },
            ],
          },
        };
        expect(() => validateCookbook(cookbook, '/test/cookbook.yaml')).not.toThrow();
      }
    });
  });
});

// =============================================================================
// Error Class Tests
// =============================================================================

describe('CookbookValidationError', () => {
  it('includes file path in error', () => {
    const err = new CookbookValidationError('Test error', '/path/to/file.yaml', 'field');
    expect(err.filePath).toBe('/path/to/file.yaml');
    expect(err.field).toBe('field');
    expect(err.name).toBe('CookbookValidationError');
  });

  it('works without field', () => {
    const err = new CookbookValidationError('Test error', '/path/to/file.yaml');
    expect(err.field).toBeUndefined();
  });
});

describe('CookbookSchemaVersionError', () => {
  it('includes suggestion in error', () => {
    const err = new CookbookSchemaVersionError(
      'Version error',
      '/path/to/file.yaml',
      'Upgrade wpnav'
    );
    expect(err.filePath).toBe('/path/to/file.yaml');
    expect(err.suggestion).toBe('Upgrade wpnav');
    expect(err.name).toBe('CookbookSchemaVersionError');
  });
});

// =============================================================================
// Loader Tests
// =============================================================================

describe('loadCookbook', () => {
  const tempDir = path.join(process.cwd(), '.test-cookbooks-temp');

  beforeEach(() => {
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
  });

  it('loads valid YAML cookbook', () => {
    const filePath = path.join(tempDir, 'test.yaml');
    const yamlContent = `
schema_version: 1
cookbook_version: "1.0.0"
plugin:
  slug: test-plugin
  name: Test Plugin
capabilities: {}
`;
    fs.writeFileSync(filePath, yamlContent);

    const result = loadCookbook(filePath, 'project');
    expect(result.success).toBe(true);
    expect(result.cookbook?.plugin.slug).toBe('test-plugin');
    expect(result.cookbook?.source).toBe('project');
  });

  it('loads valid JSON cookbook', () => {
    const filePath = path.join(tempDir, 'test.json');
    fs.writeFileSync(filePath, JSON.stringify(minimalCookbook));

    const result = loadCookbook(filePath, 'bundled');
    expect(result.success).toBe(true);
    expect(result.cookbook?.plugin.slug).toBe('hello-dolly');
    expect(result.cookbook?.source).toBe('bundled');
  });

  it('handles file read errors', () => {
    const result = loadCookbook('/nonexistent/file.yaml', 'project');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Failed to read file');
  });

  it('handles invalid YAML', () => {
    const filePath = path.join(tempDir, 'invalid.yaml');
    fs.writeFileSync(filePath, 'invalid: yaml: content:');

    const result = loadCookbook(filePath, 'project');
    expect(result.success).toBe(false);
    expect(result.error).toContain('parse');
  });

  it('rejects unsupported extensions', () => {
    const filePath = path.join(tempDir, 'test.txt');
    fs.writeFileSync(filePath, 'content');

    const result = loadCookbook(filePath, 'project');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Unsupported file extension');
  });
});

describe('loadCookbooksFromDirectory', () => {
  const tempDir = path.join(process.cwd(), '.test-cookbooks-dir');

  beforeEach(() => {
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
  });

  it('returns empty array for nonexistent directory', () => {
    const result = loadCookbooksFromDirectory('/nonexistent/dir', 'project');
    expect(result).toEqual([]);
  });

  it('loads all cookbook files from directory', () => {
    // Create two valid cookbooks
    fs.writeFileSync(
      path.join(tempDir, 'plugin-a.yaml'),
      `
schema_version: 1
cookbook_version: "1.0.0"
plugin:
  slug: plugin-a
  name: Plugin A
capabilities: {}
`
    );
    fs.writeFileSync(
      path.join(tempDir, 'plugin-b.json'),
      JSON.stringify({
        schema_version: 1,
        cookbook_version: '1.0.0',
        plugin: { slug: 'plugin-b', name: 'Plugin B' },
        capabilities: {},
      })
    );

    const results = loadCookbooksFromDirectory(tempDir, 'project');
    expect(results).toHaveLength(2);
    expect(results.every((r) => r.success)).toBe(true);
  });

  it('ignores non-cookbook files', () => {
    // Note: .md files are now treated as SKILL.md cookbooks
    // Use extensions that are NOT cookbook formats
    fs.writeFileSync(path.join(tempDir, 'readme.txt'), 'Readme text');
    fs.writeFileSync(path.join(tempDir, 'config.ini'), 'config');

    const results = loadCookbooksFromDirectory(tempDir, 'project');
    expect(results).toHaveLength(0);
  });
});

describe('discoverCookbooks', () => {
  const tempDir = path.join(process.cwd(), '.test-cookbooks-discover');
  const projectCookbooksDir = path.join(tempDir, 'cookbooks');

  beforeEach(() => {
    if (!fs.existsSync(projectCookbooksDir)) {
      fs.mkdirSync(projectCookbooksDir, { recursive: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
  });

  it('discovers project cookbooks', () => {
    fs.writeFileSync(
      path.join(projectCookbooksDir, 'my-plugin.yaml'),
      `
schema_version: 1
cookbook_version: "1.0.0"
plugin:
  slug: my-plugin
  name: My Plugin
capabilities: {}
`
    );

    const result = discoverCookbooks({ projectDir: tempDir, includeBundled: false });
    expect(result.cookbooks.size).toBe(1);
    expect(result.cookbooks.has('my-plugin')).toBe(true);
    expect(result.sources.project).toContain('my-plugin');
  });

  it('tracks errors separately', () => {
    fs.writeFileSync(path.join(projectCookbooksDir, 'invalid.yaml'), 'invalid yaml content');

    const result = discoverCookbooks({ projectDir: tempDir, includeBundled: false });
    expect(result.errors).toHaveLength(1);
    expect(result.cookbooks.size).toBe(0);
  });
});

describe('convenience functions', () => {
  const tempDir = path.join(process.cwd(), '.test-cookbooks-convenience');
  const projectCookbooksDir = path.join(tempDir, 'cookbooks');

  beforeEach(() => {
    if (!fs.existsSync(projectCookbooksDir)) {
      fs.mkdirSync(projectCookbooksDir, { recursive: true });
    }
    fs.writeFileSync(
      path.join(projectCookbooksDir, 'test-plugin.yaml'),
      `
schema_version: 1
cookbook_version: "1.0.0"
plugin:
  slug: test-plugin
  name: Test Plugin
capabilities: {}
`
    );
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
  });

  describe('listAvailableCookbooks', () => {
    it('returns sorted list of plugin slugs', () => {
      fs.writeFileSync(
        path.join(projectCookbooksDir, 'z-plugin.yaml'),
        `
schema_version: 1
cookbook_version: "1.0.0"
plugin:
  slug: z-plugin
  name: Z Plugin
capabilities: {}
`
      );
      fs.writeFileSync(
        path.join(projectCookbooksDir, 'a-plugin.yaml'),
        `
schema_version: 1
cookbook_version: "1.0.0"
plugin:
  slug: a-plugin
  name: A Plugin
capabilities: {}
`
      );

      const result = listAvailableCookbooks({ projectDir: tempDir, includeBundled: false });
      expect(result).toEqual(['a-plugin', 'test-plugin', 'z-plugin']);
    });
  });

  describe('getCookbook', () => {
    it('returns cookbook for valid slug', () => {
      const result = getCookbook('test-plugin', { projectDir: tempDir, includeBundled: false });
      expect(result).not.toBeNull();
      expect(result?.plugin.slug).toBe('test-plugin');
    });

    it('returns null for invalid slug', () => {
      const result = getCookbook('nonexistent', { projectDir: tempDir, includeBundled: false });
      expect(result).toBeNull();
    });
  });

  describe('hasCookbook', () => {
    it('returns true for existing cookbook', () => {
      const result = hasCookbook('test-plugin', { projectDir: tempDir, includeBundled: false });
      expect(result).toBe(true);
    });

    it('returns false for nonexistent cookbook', () => {
      const result = hasCookbook('nonexistent', { projectDir: tempDir, includeBundled: false });
      expect(result).toBe(false);
    });
  });
});

// =============================================================================
// Constants Test
// =============================================================================

describe('COOKBOOK_SCHEMA_VERSION', () => {
  it('is defined and is a number', () => {
    expect(typeof COOKBOOK_SCHEMA_VERSION).toBe('number');
    expect(COOKBOOK_SCHEMA_VERSION).toBe(1);
  });
});

// =============================================================================
// Registry Tests
// =============================================================================

describe('Cookbook Registry', () => {
  describe('getBundledRegistry', () => {
    it('loads registry.json from bundled directory', () => {
      const registry = getBundledRegistry();
      expect(registry).not.toBeNull();
      expect(registry?.registry_version).toBe(1);
      expect(registry?.cookbooks.length).toBeGreaterThanOrEqual(2);
    });

    it('has valid generated timestamp', () => {
      const registry = getBundledRegistry();
      expect(registry?.generated).toBeDefined();
      expect(typeof registry?.generated).toBe('string');
    });
  });

  describe('listBundledFromRegistry', () => {
    it('returns array of bundled cookbook slugs', () => {
      const slugs = listBundledFromRegistry();
      expect(slugs).not.toBeNull();
      expect(Array.isArray(slugs)).toBe(true);
      expect(slugs).toContain('gutenberg');
      expect(slugs).toContain('elementor');
    });
  });

  describe('getRegistryEntry', () => {
    it('returns entry for valid slug', () => {
      const entry = getRegistryEntry('gutenberg');
      expect(entry).not.toBeNull();
      expect(entry?.slug).toBe('gutenberg');
      expect(entry?.file).toBe('gutenberg.md');
      expect(entry?.name).toBe('Gutenberg');
      expect(entry?.version).toBe('1.0.0');
    });

    it('includes allowed_tools for gutenberg', () => {
      const entry = getRegistryEntry('gutenberg');
      expect(entry?.allowed_tools).toBeDefined();
      expect(Array.isArray(entry?.allowed_tools)).toBe(true);
      expect(entry?.allowed_tools).toContain('wpnav_list_posts');
      expect(entry?.allowed_tools).toContain('wpnav_gutenberg_insert_block');
    });

    it('includes allowed_tools for elementor', () => {
      const entry = getRegistryEntry('elementor');
      expect(entry?.allowed_tools).toBeDefined();
      expect(entry?.allowed_tools).toContain('wpnav_elementor_list_elements');
    });

    it('returns null for unknown slug', () => {
      const entry = getRegistryEntry('nonexistent-plugin');
      expect(entry).toBeNull();
    });

    it('includes min_plugin_version', () => {
      const gutenberg = getRegistryEntry('gutenberg');
      expect(gutenberg?.min_plugin_version).toBe('6.0');

      const elementor = getRegistryEntry('elementor');
      expect(elementor?.min_plugin_version).toBe('3.20.0');
    });
  });

  describe('discoverCookbooks with registry', () => {
    it('discovers bundled cookbooks using registry', () => {
      const { cookbooks, sources } = discoverCookbooks({ includeBundled: true });
      expect(sources.bundled).toContain('gutenberg');
      expect(sources.bundled).toContain('elementor');
      expect(cookbooks.has('gutenberg')).toBe(true);
      expect(cookbooks.has('elementor')).toBe(true);
    });

    it('loaded cookbooks have correct source', () => {
      const { cookbooks } = discoverCookbooks({ includeBundled: true });
      const gutenberg = cookbooks.get('gutenberg');
      expect(gutenberg?.source).toBe('bundled');
    });
  });
});
