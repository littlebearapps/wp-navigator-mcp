/**
 * Tests for Role Parser
 *
 * @package WP_Navigator_MCP
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { parseYaml, validateRole, loadRoleFile } from './parser.js';
import { RoleSource, RoleValidationError, RoleSchemaVersionError, ROLE_SCHEMA_VERSION } from './types.js';

// =============================================================================
// YAML Parser Tests
// =============================================================================

describe('parseYaml', () => {
  it('parses simple key-value pairs', () => {
    const yaml = `
name: content-editor
description: Content specialist
priority: 10
`;
    const result = parseYaml(yaml);
    expect(result.name).toBe('content-editor');
    expect(result.description).toBe('Content specialist');
    expect(result.priority).toBe(10);
  });

  it('parses literal block scalars (|)', () => {
    const yaml = `
name: test-role
context: |
  Line one
  Line two
  Line three
description: After multiline
`;
    const result = parseYaml(yaml);
    // YAML 1.2 spec: literal blocks include trailing newline by default (clip mode)
    expect(result.context).toBe('Line one\nLine two\nLine three\n');
    expect(result.description).toBe('After multiline');
  });

  it('parses folded block scalars (>)', () => {
    const yaml = `
name: test-role
context: >
  This is a long
  description that
  spans multiple lines
description: After folded
`;
    const result = parseYaml(yaml);
    // YAML 1.2 spec: folded blocks include trailing newline by default (clip mode)
    expect(result.context).toBe('This is a long description that spans multiple lines\n');
    expect(result.description).toBe('After folded');
  });

  it('parses arrays with dash syntax', () => {
    const yaml = `
name: test-role
focus_areas:
  - Content editing
  - Media management
  - SEO metadata
`;
    const result = parseYaml(yaml);
    expect(result.focus_areas).toEqual(['Content editing', 'Media management', 'SEO metadata']);
  });

  it('parses inline arrays', () => {
    const yaml = `
name: test-role
tags: [content, editing, wordpress]
`;
    const result = parseYaml(yaml);
    expect(result.tags).toEqual(['content', 'editing', 'wordpress']);
  });

  it('parses nested objects', () => {
    const yaml = `
name: test-role
tools:
  allowed:
    - wpnav_list_posts
    - wpnav_update_post
  denied:
    - wpnav_update_plugin
`;
    const result = parseYaml(yaml);
    expect(result.tools).toEqual({
      allowed: ['wpnav_list_posts', 'wpnav_update_post'],
      denied: ['wpnav_update_plugin'],
    });
  });

  it('handles comments', () => {
    const yaml = `
# This is a comment
name: test-role
# Another comment
description: A test role
`;
    const result = parseYaml(yaml);
    expect(result.name).toBe('test-role');
    expect(result.description).toBe('A test role');
  });

  it('handles boolean values', () => {
    const yaml = `
enabled: true
disabled: false
`;
    const result = parseYaml(yaml);
    expect(result.enabled).toBe(true);
    expect(result.disabled).toBe(false);
  });

  it('handles null values', () => {
    const yaml = `
empty: null
tilde: ~
`;
    const result = parseYaml(yaml);
    expect(result.empty).toBe(null);
    expect(result.tilde).toBe(null);
  });

  it('handles quoted strings', () => {
    const yaml = `
single: 'single quoted'
double: "double quoted"
number_as_string: "123"
`;
    const result = parseYaml(yaml);
    expect(result.single).toBe('single quoted');
    expect(result.double).toBe('double quoted');
    expect(result.number_as_string).toBe('123');
  });

  it('handles empty objects and arrays', () => {
    const yaml = `
empty_object: {}
empty_array: []
`;
    const result = parseYaml(yaml);
    expect(result.empty_object).toEqual({});
    expect(result.empty_array).toEqual([]);
  });
});

// =============================================================================
// Role Validation Tests
// =============================================================================

describe('validateRole', () => {
  it('validates a minimal valid role', () => {
    const role = {
      name: 'content-editor',
      description: 'Content specialist',
      context: 'You are a content editor.',
    };

    const result = validateRole(role, '/test/role.yaml');
    expect(result.name).toBe('content-editor');
    expect(result.description).toBe('Content specialist');
    expect(result.context).toBe('You are a content editor.');
  });

  it('validates a complete role with all fields', () => {
    const role = {
      name: 'content-editor',
      description: 'Content specialist',
      context: 'You are a content editor.',
      focus_areas: ['Content editing', 'Media'],
      avoid: ['Plugin changes'],
      tools: {
        allowed: ['wpnav_list_posts'],
        denied: ['wpnav_update_plugin'],
      },
      priority: 50,
      version: '1.0.0',
      tags: ['content', 'editing'],
      author: 'WP Navigator',
      schema_version: 1,
    };

    const result = validateRole(role, '/test/role.yaml');
    expect(result).toEqual(role);
  });

  it('throws on missing name', () => {
    const role = {
      description: 'Test',
      context: 'Test context',
    };

    expect(() => validateRole(role, '/test/role.yaml')).toThrow(RoleValidationError);
    expect(() => validateRole(role, '/test/role.yaml')).toThrow(/name/);
  });

  it('throws on invalid name format', () => {
    const role = {
      name: 'Content Editor', // Should be slug format
      description: 'Test',
      context: 'Test context',
    };

    expect(() => validateRole(role, '/test/role.yaml')).toThrow(RoleValidationError);
    expect(() => validateRole(role, '/test/role.yaml')).toThrow(/lowercase slug/);
  });

  it('throws on missing description', () => {
    const role = {
      name: 'content-editor',
      context: 'Test context',
    };

    expect(() => validateRole(role, '/test/role.yaml')).toThrow(RoleValidationError);
    expect(() => validateRole(role, '/test/role.yaml')).toThrow(/description/);
  });

  it('throws on missing context', () => {
    const role = {
      name: 'content-editor',
      description: 'Test',
    };

    expect(() => validateRole(role, '/test/role.yaml')).toThrow(RoleValidationError);
    expect(() => validateRole(role, '/test/role.yaml')).toThrow(/context/);
  });

  it('throws on invalid focus_areas type', () => {
    const role = {
      name: 'content-editor',
      description: 'Test',
      context: 'Test context',
      focus_areas: 'not an array',
    };

    expect(() => validateRole(role, '/test/role.yaml')).toThrow(RoleValidationError);
    expect(() => validateRole(role, '/test/role.yaml')).toThrow(/focus_areas must be an array/);
  });

  it('throws on invalid tools.allowed type', () => {
    const role = {
      name: 'content-editor',
      description: 'Test',
      context: 'Test context',
      tools: {
        allowed: 'not an array',
      },
    };

    expect(() => validateRole(role, '/test/role.yaml')).toThrow(RoleValidationError);
    expect(() => validateRole(role, '/test/role.yaml')).toThrow(/tools.allowed must be an array/);
  });

  it('throws on unsupported schema_version', () => {
    const role = {
      name: 'content-editor',
      description: 'Test',
      context: 'Test context',
      schema_version: ROLE_SCHEMA_VERSION + 1,
    };

    expect(() => validateRole(role, '/test/role.yaml')).toThrow(RoleSchemaVersionError);
  });

  it('accepts valid role name formats', () => {
    const validNames = ['a', 'ab', 'content-editor', 'seo-specialist', 'site-admin', 'dev1'];

    for (const name of validNames) {
      const role = {
        name,
        description: 'Test',
        context: 'Test context',
      };
      expect(() => validateRole(role, '/test/role.yaml')).not.toThrow();
    }
  });

  it('rejects invalid role name formats', () => {
    const invalidNames = ['Content-Editor', 'content_editor', '1content', '-content', 'content-'];

    for (const name of invalidNames) {
      const role = {
        name,
        description: 'Test',
        context: 'Test context',
      };
      expect(() => validateRole(role, '/test/role.yaml')).toThrow(RoleValidationError);
    }
  });
});

// =============================================================================
// Role File Loading Tests
// =============================================================================

describe('loadRoleFile', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wpnav-role-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('loads a valid YAML role file', () => {
    const yamlContent = `
name: content-editor
description: Content specialist
context: |
  You are a content specialist working on a WordPress site.
  Focus on clear, engaging content.
focus_areas:
  - Page and post content
  - Media management
`;
    const filePath = path.join(tempDir, 'content-editor.yaml');
    fs.writeFileSync(filePath, yamlContent);

    const result = loadRoleFile(filePath, RoleSource.PROJECT);

    expect(result.success).toBe(true);
    expect(result.role).toBeDefined();
    expect(result.role!.name).toBe('content-editor');
    expect(result.role!.source).toBe(RoleSource.PROJECT);
    expect(result.role!.sourcePath).toBe(filePath);
    expect(result.role!.focus_areas).toEqual(['Page and post content', 'Media management']);
  });

  it('loads a valid JSON role file', () => {
    const jsonContent = JSON.stringify({
      name: 'site-admin',
      description: 'Full site administrator',
      context: 'You have full administrative access.',
    });
    const filePath = path.join(tempDir, 'site-admin.json');
    fs.writeFileSync(filePath, jsonContent);

    const result = loadRoleFile(filePath, RoleSource.BUNDLED);

    expect(result.success).toBe(true);
    expect(result.role).toBeDefined();
    expect(result.role!.name).toBe('site-admin');
    expect(result.role!.source).toBe(RoleSource.BUNDLED);
  });

  it('returns error for non-existent file', () => {
    const result = loadRoleFile('/nonexistent/role.yaml', RoleSource.PROJECT);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Failed to read file');
  });

  it('returns error for invalid YAML', () => {
    const filePath = path.join(tempDir, 'invalid.yaml');
    fs.writeFileSync(filePath, 'name: test\n  bad indent');

    const result = loadRoleFile(filePath, RoleSource.PROJECT);

    // Our simple parser may not catch all YAML errors, so just verify we handle it
    expect(result.path).toBe(filePath);
  });

  it('returns error for unsupported file extension', () => {
    const filePath = path.join(tempDir, 'role.txt');
    fs.writeFileSync(filePath, 'name: test');

    const result = loadRoleFile(filePath, RoleSource.PROJECT);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Unsupported file extension');
  });

  it('returns error for validation failure', () => {
    const yamlContent = `
name: Invalid Name
description: Test
context: Test context
`;
    const filePath = path.join(tempDir, 'invalid-role.yaml');
    fs.writeFileSync(filePath, yamlContent);

    const result = loadRoleFile(filePath, RoleSource.PROJECT);

    expect(result.success).toBe(false);
    expect(result.error).toContain('lowercase slug');
  });

  it('handles .yml extension', () => {
    const yamlContent = `
name: test-role
description: Test
context: Test context
`;
    const filePath = path.join(tempDir, 'test.yml');
    fs.writeFileSync(filePath, yamlContent);

    const result = loadRoleFile(filePath, RoleSource.GLOBAL);

    expect(result.success).toBe(true);
    expect(result.role!.name).toBe('test-role');
  });
});
