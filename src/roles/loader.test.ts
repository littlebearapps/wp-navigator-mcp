/**
 * Tests for Role Loader
 *
 * Tests role discovery, loading, and merging from multiple sources.
 *
 * @package WP_Navigator_MCP
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  loadRole,
  loadRolesFromDirectory,
  mergeRoles,
  discoverRoles,
  listAvailableRoles,
  getRole,
  getBundledPath,
} from './loader.js';
import type { LoadedRole } from './types.js';

// =============================================================================
// Test Utilities
// =============================================================================

let tempDir: string;

function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'wpnav-roles-test-'));
}

function createRoleFile(dir: string, filename: string, content: string): string {
  const filePath = path.join(dir, filename);
  fs.writeFileSync(filePath, content, 'utf8');
  return filePath;
}

function createMinimalRole(name: string, overrides: Record<string, unknown> = {}): string {
  const base = {
    name,
    description: `${name} description`,
    context: `${name} context`,
    ...overrides,
  };
  return Object.entries(base)
    .map(([k, v]) => {
      if (Array.isArray(v)) {
        return `${k}:\n${v.map((item) => `  - ${item}`).join('\n')}`;
      }
      if (typeof v === 'object' && v !== null) {
        return `${k}:\n${Object.entries(v)
          .map(([sk, sv]) => {
            if (Array.isArray(sv)) {
              return `  ${sk}:\n${(sv as string[]).map((item) => `    - ${item}`).join('\n')}`;
            }
            return `  ${sk}: ${sv}`;
          })
          .join('\n')}`;
      }
      return `${k}: ${v}`;
    })
    .join('\n');
}

beforeEach(() => {
  tempDir = createTempDir();
});

afterEach(() => {
  if (tempDir && fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

// =============================================================================
// loadRole Tests
// =============================================================================

describe('loadRole', () => {
  it('loads a valid YAML role file', () => {
    const content = createMinimalRole('test-role');
    const filePath = createRoleFile(tempDir, 'test-role.yaml', content);

    const result = loadRole(filePath, 'project');

    expect(result.success).toBe(true);
    expect(result.role).toBeDefined();
    expect(result.role!.name).toBe('test-role');
    expect(result.role!.source).toBe('project');
    expect(result.role!.sourcePath).toBe(filePath);
  });

  it('loads a valid JSON role file', () => {
    const content = JSON.stringify({
      name: 'json-role',
      description: 'JSON role',
      context: 'JSON context',
    });
    const filePath = createRoleFile(tempDir, 'json-role.json', content);

    const result = loadRole(filePath, 'project');

    expect(result.success).toBe(true);
    expect(result.role!.name).toBe('json-role');
  });

  it('returns error for non-existent file', () => {
    const result = loadRole('/nonexistent/path/role.yaml', 'project');

    expect(result.success).toBe(false);
    expect(result.error).toContain('Failed to read file');
  });

  it('returns error for invalid YAML', () => {
    const filePath = createRoleFile(tempDir, 'invalid.yaml', 'name: [invalid yaml');

    const result = loadRole(filePath, 'project');

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('returns error for missing required fields', () => {
    const filePath = createRoleFile(tempDir, 'incomplete.yaml', 'name: incomplete');

    const result = loadRole(filePath, 'project');

    expect(result.success).toBe(false);
    expect(result.error).toContain('description');
  });

  it('defaults to project source if not specified', () => {
    const content = createMinimalRole('default-source');
    const filePath = createRoleFile(tempDir, 'role.yaml', content);

    const result = loadRole(filePath);

    expect(result.role!.source).toBe('project');
  });
});

// =============================================================================
// loadRolesFromDirectory Tests
// =============================================================================

describe('loadRolesFromDirectory', () => {
  it('loads all YAML files from directory', () => {
    createRoleFile(tempDir, 'role1.yaml', createMinimalRole('role-one'));
    createRoleFile(tempDir, 'role2.yml', createMinimalRole('role-two'));
    createRoleFile(tempDir, 'role3.yaml', createMinimalRole('role-three'));

    const results = loadRolesFromDirectory(tempDir, 'project');

    expect(results).toHaveLength(3);
    expect(results.every((r) => r.success)).toBe(true);
  });

  it('loads JSON files alongside YAML', () => {
    createRoleFile(tempDir, 'yaml-role.yaml', createMinimalRole('yaml-role'));
    createRoleFile(
      tempDir,
      'json-role.json',
      JSON.stringify({
        name: 'json-role',
        description: 'JSON',
        context: 'Context',
      })
    );

    const results = loadRolesFromDirectory(tempDir, 'project');

    expect(results).toHaveLength(2);
    const names = results.map((r) => r.role?.name).sort();
    expect(names).toEqual(['json-role', 'yaml-role']);
  });

  it('returns empty array for non-existent directory', () => {
    const results = loadRolesFromDirectory('/nonexistent/dir', 'project');

    expect(results).toEqual([]);
  });

  it('ignores non-role files', () => {
    createRoleFile(tempDir, 'role.yaml', createMinimalRole('valid-role'));
    createRoleFile(tempDir, 'readme.txt', 'Not a role');
    createRoleFile(tempDir, 'notes.md', '# Notes');

    const results = loadRolesFromDirectory(tempDir, 'project');

    expect(results).toHaveLength(1);
    expect(results[0].role!.name).toBe('valid-role');
  });

  it('includes failed loads in results', () => {
    createRoleFile(tempDir, 'valid.yaml', createMinimalRole('valid'));
    createRoleFile(tempDir, 'invalid.yaml', 'name: incomplete'); // Missing fields

    const results = loadRolesFromDirectory(tempDir, 'project');

    expect(results).toHaveLength(2);
    expect(results.filter((r) => r.success)).toHaveLength(1);
    expect(results.filter((r) => !r.success)).toHaveLength(1);
  });
});

// =============================================================================
// mergeRoles Tests
// =============================================================================

describe('mergeRoles', () => {
  const createTestRole = (overrides: Partial<LoadedRole> = {}): LoadedRole => ({
    name: 'test-role',
    description: 'Parent description',
    context: 'Parent context',
    source: 'bundled',
    sourcePath: '/bundled/test-role.yaml',
    schema_version: 1,
    priority: 0,
    version: '1.0.0',
    author: 'Parent Author',
    focus_areas: ['area1', 'area2'],
    avoid: ['avoid1'],
    tags: ['tag1'],
    tools: {
      allowed: ['tool1', 'tool2'],
      denied: ['denied1'],
    },
    ...overrides,
  });

  it('child identity fields always win', () => {
    const parent = createTestRole();
    const child = createTestRole({
      name: 'test-role',
      source: 'project',
      sourcePath: '/project/test-role.yaml',
    });

    const merged = mergeRoles(parent, child);

    expect(merged.name).toBe('test-role');
    expect(merged.source).toBe('project');
    expect(merged.sourcePath).toBe('/project/test-role.yaml');
  });

  it('child scalar fields override parent when specified', () => {
    const parent = createTestRole();
    const child = createTestRole({
      description: 'Child description',
      context: 'Child context',
      source: 'project',
      sourcePath: '/project/role.yaml',
    });

    const merged = mergeRoles(parent, child);

    expect(merged.description).toBe('Child description');
    expect(merged.context).toBe('Child context');
  });

  it('child inherits parent scalars when not specified', () => {
    const parent = createTestRole();
    const child: LoadedRole = {
      name: 'test-role',
      description: '', // Empty string is falsy
      context: '', // Empty string is falsy
      source: 'project',
      sourcePath: '/project/role.yaml',
    };

    const merged = mergeRoles(parent, child);

    expect(merged.description).toBe('Parent description');
    expect(merged.context).toBe('Parent context');
    expect(merged.author).toBe('Parent Author');
    expect(merged.version).toBe('1.0.0');
  });

  it('arrays are concatenated and deduped', () => {
    const parent = createTestRole({
      focus_areas: ['area1', 'area2'],
      avoid: ['avoid1'],
      tags: ['tag1', 'common'],
    });
    const child: LoadedRole = {
      name: 'test-role',
      description: 'Child',
      context: 'Child',
      source: 'project',
      sourcePath: '/project/role.yaml',
      focus_areas: ['area3', 'area1'], // area1 is duplicate
      avoid: ['avoid2'],
      tags: ['tag2', 'common'], // common is duplicate
    };

    const merged = mergeRoles(parent, child);

    expect(merged.focus_areas).toContain('area1');
    expect(merged.focus_areas).toContain('area2');
    expect(merged.focus_areas).toContain('area3');
    expect(merged.focus_areas!.filter((a) => a === 'area1')).toHaveLength(1); // Deduped

    expect(merged.avoid).toContain('avoid1');
    expect(merged.avoid).toContain('avoid2');

    expect(merged.tags).toContain('tag1');
    expect(merged.tags).toContain('tag2');
    expect(merged.tags).toContain('common');
    expect(merged.tags!.filter((t) => t === 'common')).toHaveLength(1); // Deduped
  });

  it('tools.allowed is replaced entirely by child', () => {
    const parent = createTestRole({
      tools: {
        allowed: ['tool1', 'tool2', 'tool3'],
        denied: ['denied1'],
      },
    });
    const child: LoadedRole = {
      name: 'test-role',
      description: 'Child',
      context: 'Child',
      source: 'project',
      sourcePath: '/project/role.yaml',
      tools: {
        allowed: ['tool4', 'tool5'], // Completely replaces parent
        denied: ['denied2'],
      },
    };

    const merged = mergeRoles(parent, child);

    expect(merged.tools!.allowed).toEqual(['tool4', 'tool5']);
    expect(merged.tools!.allowed).not.toContain('tool1');
  });

  it('tools.denied is concatenated and deduped', () => {
    const parent = createTestRole({
      tools: {
        allowed: ['tool1'],
        denied: ['denied1', 'common-denied'],
      },
    });
    const child: LoadedRole = {
      name: 'test-role',
      description: 'Child',
      context: 'Child',
      source: 'project',
      sourcePath: '/project/role.yaml',
      tools: {
        denied: ['denied2', 'common-denied'], // common-denied is duplicate
      },
    };

    const merged = mergeRoles(parent, child);

    expect(merged.tools!.denied).toContain('denied1');
    expect(merged.tools!.denied).toContain('denied2');
    expect(merged.tools!.denied).toContain('common-denied');
    expect(merged.tools!.denied!.filter((d) => d === 'common-denied')).toHaveLength(1);
  });

  it('child inherits tools.allowed when not specified', () => {
    const parent = createTestRole({
      tools: {
        allowed: ['tool1', 'tool2'],
        denied: ['denied1'],
      },
    });
    const child: LoadedRole = {
      name: 'test-role',
      description: 'Child',
      context: 'Child',
      source: 'project',
      sourcePath: '/project/role.yaml',
      tools: {
        denied: ['denied2'], // Only specifying denied, not allowed
      },
    };

    const merged = mergeRoles(parent, child);

    expect(merged.tools!.allowed).toEqual(['tool1', 'tool2']); // Inherited
    expect(merged.tools!.denied).toContain('denied1');
    expect(merged.tools!.denied).toContain('denied2');
  });

  it('handles undefined arrays gracefully', () => {
    const parent: LoadedRole = {
      name: 'test-role',
      description: 'Parent',
      context: 'Parent',
      source: 'bundled',
      sourcePath: '/bundled/role.yaml',
      // No arrays defined
    };
    const child: LoadedRole = {
      name: 'test-role',
      description: 'Child',
      context: 'Child',
      source: 'project',
      sourcePath: '/project/role.yaml',
      focus_areas: ['new-area'],
    };

    const merged = mergeRoles(parent, child);

    expect(merged.focus_areas).toEqual(['new-area']);
    expect(merged.avoid).toEqual([]);
    expect(merged.tags).toEqual([]);
  });
});

// =============================================================================
// discoverRoles Tests
// =============================================================================

describe('discoverRoles', () => {
  it('discovers bundled roles', () => {
    const result = discoverRoles({ includeGlobal: false, projectDir: tempDir });

    expect(result.roles.size).toBeGreaterThan(0);
    expect(result.sources.bundled.length).toBeGreaterThan(0);

    // Check for known bundled roles
    const roleNames = Array.from(result.roles.keys());
    expect(roleNames).toContain('content-editor');
    expect(roleNames).toContain('site-admin');
    expect(roleNames).toContain('developer');
    expect(roleNames).toContain('seo-specialist');
  });

  it('discovers project roles', () => {
    const projectRolesDir = path.join(tempDir, 'roles');
    fs.mkdirSync(projectRolesDir);
    createRoleFile(projectRolesDir, 'custom-role.yaml', createMinimalRole('custom-role'));

    const result = discoverRoles({
      projectDir: tempDir,
      includeGlobal: false,
      includeBundled: false,
    });

    expect(result.roles.size).toBe(1);
    expect(result.sources.project).toContain('custom-role');
    expect(result.roles.get('custom-role')!.source).toBe('project');
  });

  it('merges project role with bundled role of same name', () => {
    const projectRolesDir = path.join(tempDir, 'roles');
    fs.mkdirSync(projectRolesDir);

    // Create project role that extends content-editor
    const projectRole = `
name: content-editor
description: Extended content editor
context: Custom context for this project
focus_areas:
  - Custom focus area
avoid:
  - Custom avoidance
tools:
  denied:
    - custom_denied_tool
`;
    createRoleFile(projectRolesDir, 'content-editor.yaml', projectRole);

    const result = discoverRoles({
      projectDir: tempDir,
      includeGlobal: false,
      includeBundled: true,
    });

    const contentEditor = result.roles.get('content-editor')!;

    // Source should be project (highest priority)
    expect(contentEditor.source).toBe('project');

    // Description/context should be from project
    expect(contentEditor.description).toBe('Extended content editor');
    expect(contentEditor.context).toBe('Custom context for this project');

    // focus_areas should be merged (bundled + project)
    expect(contentEditor.focus_areas).toContain('Custom focus area');
    // Should also contain bundled focus areas
    expect(contentEditor.focus_areas!.length).toBeGreaterThan(1);

    // tools.denied should be merged
    expect(contentEditor.tools!.denied).toContain('custom_denied_tool');
  });

  it('tracks errors for invalid role files', () => {
    const projectRolesDir = path.join(tempDir, 'roles');
    fs.mkdirSync(projectRolesDir);
    createRoleFile(projectRolesDir, 'valid.yaml', createMinimalRole('valid'));
    createRoleFile(projectRolesDir, 'invalid.yaml', 'name: incomplete'); // Missing fields

    const result = discoverRoles({
      projectDir: tempDir,
      includeGlobal: false,
      includeBundled: false,
    });

    expect(result.roles.size).toBe(1);
    expect(result.errors.length).toBe(1);
    expect(result.errors[0].success).toBe(false);
  });

  it('returns empty project/global sources when directories do not exist', () => {
    const result = discoverRoles({
      projectDir: '/nonexistent/project',
      includeGlobal: false,
      includeBundled: false,
    });

    expect(result.roles.size).toBe(0);
    expect(result.sources.project).toEqual([]);
  });

  it('respects includeBundled option', () => {
    const result = discoverRoles({
      projectDir: tempDir,
      includeGlobal: false,
      includeBundled: false,
    });

    expect(result.sources.bundled).toEqual([]);
  });
});

// =============================================================================
// listAvailableRoles Tests
// =============================================================================

describe('listAvailableRoles', () => {
  it('returns sorted list of role names', () => {
    const roles = listAvailableRoles({ includeGlobal: false, projectDir: tempDir });

    expect(Array.isArray(roles)).toBe(true);
    expect(roles.length).toBeGreaterThan(0);

    // Check alphabetical order
    const sorted = [...roles].sort();
    expect(roles).toEqual(sorted);
  });

  it('includes bundled roles by default', () => {
    const roles = listAvailableRoles({ includeGlobal: false, projectDir: tempDir });

    expect(roles).toContain('content-editor');
    expect(roles).toContain('developer');
  });

  it('includes project roles', () => {
    const projectRolesDir = path.join(tempDir, 'roles');
    fs.mkdirSync(projectRolesDir);
    createRoleFile(projectRolesDir, 'my-custom-role.yaml', createMinimalRole('my-custom-role'));

    const roles = listAvailableRoles({
      projectDir: tempDir,
      includeGlobal: false,
      includeBundled: true,
    });

    expect(roles).toContain('my-custom-role');
  });
});

// =============================================================================
// getRole Tests
// =============================================================================

describe('getRole', () => {
  it('returns bundled role by name', () => {
    const role = getRole('content-editor', { includeGlobal: false, projectDir: tempDir });

    expect(role).not.toBeNull();
    expect(role!.name).toBe('content-editor');
    expect(role!.description).toBeDefined();
    expect(role!.context).toBeDefined();
  });

  it('returns null for non-existent role', () => {
    const role = getRole('nonexistent-role', { includeGlobal: false, projectDir: tempDir });

    expect(role).toBeNull();
  });

  it('returns merged role when project overrides bundled', () => {
    const projectRolesDir = path.join(tempDir, 'roles');
    fs.mkdirSync(projectRolesDir);
    createRoleFile(
      projectRolesDir,
      'content-editor.yaml',
      createMinimalRole('content-editor', {
        description: 'Project-specific content editor',
      })
    );

    const role = getRole('content-editor', {
      projectDir: tempDir,
      includeGlobal: false,
      includeBundled: true,
    });

    expect(role).not.toBeNull();
    expect(role!.description).toBe('Project-specific content editor');
    expect(role!.source).toBe('project');
  });

  it('returns project-only role', () => {
    const projectRolesDir = path.join(tempDir, 'roles');
    fs.mkdirSync(projectRolesDir);
    createRoleFile(projectRolesDir, 'unique-role.yaml', createMinimalRole('unique-role'));

    const role = getRole('unique-role', {
      projectDir: tempDir,
      includeGlobal: false,
      includeBundled: true,
    });

    expect(role).not.toBeNull();
    expect(role!.name).toBe('unique-role');
    expect(role!.source).toBe('project');
  });
});

// =============================================================================
// getBundledPath Tests
// =============================================================================

describe('getBundledPath', () => {
  it('returns valid path to bundled roles', () => {
    const bundledPath = getBundledPath();

    expect(bundledPath).toBeDefined();
    expect(fs.existsSync(bundledPath)).toBe(true);
  });

  it('bundled path contains role files', () => {
    const bundledPath = getBundledPath();
    const files = fs.readdirSync(bundledPath);
    const roleFiles = files.filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'));

    expect(roleFiles.length).toBeGreaterThan(0);
  });
});
