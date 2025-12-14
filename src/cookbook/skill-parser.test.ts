/**
 * Tests for SKILL.md parser
 */

import { describe, it, expect } from 'vitest';
import {
  parseSkillMd,
  parseSkillMdOrThrow,
  extractPluginSlug,
  getAllowedTools,
  SkillParseError,
} from './skill-parser.js';

describe('SKILL.md Parser', () => {
  describe('parseSkillMd', () => {
    it('should parse valid SKILL.md with all fields', () => {
      const content = `---
name: elementor-cookbook
description: Best practices for editing Elementor pages via WP Navigator MCP.
allowed-tools: "wpnav_get_page,wpnav_update_page,wpnav_snapshot_page"
version: "1.0.0"
min-plugin-version: "3.20.0"
max-plugin-version: "4.0.0"
requires-wpnav-pro: "1.9.0"
---

# Elementor Cookbook

## Overview
This is the body content.
`;

      const result = parseSkillMd(content);

      expect(result.success).toBe(true);
      expect(result.cookbook).toBeDefined();
      expect(result.cookbook!.frontmatter.name).toBe('elementor-cookbook');
      expect(result.cookbook!.frontmatter.description).toBe(
        'Best practices for editing Elementor pages via WP Navigator MCP.'
      );
      expect(result.cookbook!.frontmatter['allowed-tools']).toBe(
        'wpnav_get_page,wpnav_update_page,wpnav_snapshot_page'
      );
      expect(result.cookbook!.frontmatter.version).toBe('1.0.0');
      expect(result.cookbook!.frontmatter['min-plugin-version']).toBe('3.20.0');
      expect(result.cookbook!.frontmatter['max-plugin-version']).toBe('4.0.0');
      expect(result.cookbook!.frontmatter['requires-wpnav-pro']).toBe('1.9.0');
      expect(result.cookbook!.body).toContain('# Elementor Cookbook');
      expect(result.cookbook!.body).toContain('This is the body content.');
    });

    it('should parse minimal SKILL.md with only required fields', () => {
      const content = `---
name: gutenberg-cookbook
description: Core WordPress block editor guidance.
---

# Gutenberg Cookbook
`;

      const result = parseSkillMd(content);

      expect(result.success).toBe(true);
      expect(result.cookbook!.frontmatter.name).toBe('gutenberg-cookbook');
      expect(result.cookbook!.frontmatter.description).toBe(
        'Core WordPress block editor guidance.'
      );
      expect(result.cookbook!.frontmatter.version).toBeUndefined();
      expect(result.cookbook!.body).toContain('# Gutenberg Cookbook');
    });

    it('should fail when frontmatter delimiters missing', () => {
      const content = `name: test-cookbook
description: Test
`;

      const result = parseSkillMd(content);

      expect(result.success).toBe(false);
      expect(result.error).toContain('must start with ---');
    });

    it('should fail when closing delimiter missing', () => {
      const content = `---
name: test-cookbook
description: Test

# Body without closing delimiter
`;

      const result = parseSkillMd(content);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Missing closing ---');
    });

    it('should fail when name is missing', () => {
      const content = `---
description: Test description
---

# Body
`;

      const result = parseSkillMd(content);

      expect(result.success).toBe(false);
      expect(result.error).toContain('name');
    });

    it('should fail when description is missing', () => {
      const content = `---
name: test-cookbook
---

# Body
`;

      const result = parseSkillMd(content);

      expect(result.success).toBe(false);
      expect(result.error).toContain('description');
    });

    it('should fail when name format is invalid', () => {
      const content = `---
name: Invalid Name With Spaces
description: Test description
---

# Body
`;

      const result = parseSkillMd(content);

      expect(result.success).toBe(false);
      expect(result.error).toContain('lowercase');
    });

    it('should fail when name exceeds max length', () => {
      const longName = 'a'.repeat(65) + '-cookbook';
      const content = `---
name: ${longName}
description: Test description
---

# Body
`;

      const result = parseSkillMd(content);

      expect(result.success).toBe(false);
      expect(result.error).toContain('64 characters');
    });

    it('should fail when version format is invalid', () => {
      const content = `---
name: test-cookbook
description: Test description
version: "v1.0.0"
---

# Body
`;

      const result = parseSkillMd(content);

      expect(result.success).toBe(false);
      expect(result.error).toContain('semver');
    });

    it('should handle empty body', () => {
      const content = `---
name: test-cookbook
description: Test description
---
`;

      const result = parseSkillMd(content);

      expect(result.success).toBe(true);
      expect(result.cookbook!.body).toBe('');
    });

    it('should preserve raw frontmatter', () => {
      const content = `---
name: test-cookbook
description: Test description
---

# Body
`;

      const result = parseSkillMd(content);

      expect(result.success).toBe(true);
      expect(result.cookbook!.rawFrontmatter).toContain('name: test-cookbook');
      expect(result.cookbook!.rawFrontmatter).toContain('description: Test description');
    });
  });

  describe('parseSkillMdOrThrow', () => {
    it('should return cookbook on success', () => {
      const content = `---
name: test-cookbook
description: Test description
---

# Body
`;

      const cookbook = parseSkillMdOrThrow(content);

      expect(cookbook.frontmatter.name).toBe('test-cookbook');
    });

    it('should throw SkillParseError on failure', () => {
      const content = `invalid content`;

      expect(() => parseSkillMdOrThrow(content)).toThrow(SkillParseError);
    });
  });

  describe('extractPluginSlug', () => {
    it('should extract slug from name with -cookbook suffix', () => {
      expect(extractPluginSlug('elementor-cookbook')).toBe('elementor');
      expect(extractPluginSlug('gutenberg-cookbook')).toBe('gutenberg');
      expect(extractPluginSlug('woocommerce-cookbook')).toBe('woocommerce');
    });

    it('should return name unchanged if no -cookbook suffix', () => {
      expect(extractPluginSlug('elementor')).toBe('elementor');
      expect(extractPluginSlug('woocommerce')).toBe('woocommerce');
    });
  });

  describe('getAllowedTools', () => {
    it('should parse comma-separated tools', () => {
      const content = `---
name: test-cookbook
description: Test
allowed-tools: "wpnav_get_page, wpnav_update_page, wpnav_list_pages"
---
`;

      const result = parseSkillMd(content);
      const tools = getAllowedTools(result.cookbook!);

      expect(tools).toEqual(['wpnav_get_page', 'wpnav_update_page', 'wpnav_list_pages']);
    });

    it('should return empty array when allowed-tools not set', () => {
      const content = `---
name: test-cookbook
description: Test
---
`;

      const result = parseSkillMd(content);
      const tools = getAllowedTools(result.cookbook!);

      expect(tools).toEqual([]);
    });

    it('should filter empty entries', () => {
      const content = `---
name: test-cookbook
description: Test
allowed-tools: "wpnav_get_page,, ,wpnav_update_page"
---
`;

      const result = parseSkillMd(content);
      const tools = getAllowedTools(result.cookbook!);

      expect(tools).toEqual(['wpnav_get_page', 'wpnav_update_page']);
    });
  });
});

describe('SKILL.md Loader Integration', () => {
  // These tests verify the loader correctly handles SKILL.md files
  // via the loadCookbook function

  it('should be tested via cookbook.test.ts integration tests', () => {
    // Placeholder - actual integration tests in cookbook.test.ts
    expect(true).toBe(true);
  });
});
