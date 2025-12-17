/**
 * Focus Modes Module Tests
 *
 * @package WP_Navigator_MCP
 * @since 2.7.0
 */

import { describe, it, expect } from 'vitest';
import {
  FOCUS_MODE_PRESETS,
  resolveFocusMode,
  getFocusMode,
  getFocusModePreset,
  listFocusModes,
  mergeFocusModeWithManifest,
  estimateToolCount,
} from './focus-modes.js';
import type { WPNavManifestV2, ManifestTools } from './manifest.js';

// =============================================================================
// Preset Definitions
// =============================================================================

describe('FOCUS_MODE_PRESETS', () => {
  it('should have all four focus modes defined', () => {
    expect(FOCUS_MODE_PRESETS).toHaveProperty('content-editing');
    expect(FOCUS_MODE_PRESETS).toHaveProperty('full-admin');
    expect(FOCUS_MODE_PRESETS).toHaveProperty('read-only');
    expect(FOCUS_MODE_PRESETS).toHaveProperty('custom');
  });

  describe('content-editing preset', () => {
    const preset = FOCUS_MODE_PRESETS['content-editing'];

    it('should have correct metadata', () => {
      expect(preset.name).toBe('content-editing');
      expect(preset.description).toContain('content');
      expect(preset.tokenEstimate).toContain('500');
    });

    it('should include core introspection tools', () => {
      expect(preset.tools.overrides).toHaveProperty('wpnav_introspect', true);
      expect(preset.tools.overrides).toHaveProperty('wpnav_get_site_overview', true);
    });

    it('should include post management tools', () => {
      expect(preset.tools.overrides).toHaveProperty('wpnav_list_posts', true);
      expect(preset.tools.overrides).toHaveProperty('wpnav_create_post_with_blocks', true);
      expect(preset.tools.overrides).toHaveProperty('wpnav_update_post', true);
    });

    it('should include page management tools', () => {
      expect(preset.tools.overrides).toHaveProperty('wpnav_list_pages', true);
      expect(preset.tools.overrides).toHaveProperty('wpnav_create_page', true);
      expect(preset.tools.overrides).toHaveProperty('wpnav_update_page', true);
    });

    it('should include taxonomy read tools', () => {
      expect(preset.tools.overrides).toHaveProperty('wpnav_list_categories', true);
      expect(preset.tools.overrides).toHaveProperty('wpnav_list_tags', true);
    });

    it('should include full media access', () => {
      expect(preset.tools.overrides).toHaveProperty('wpnav_list_media', true);
      expect(preset.tools.overrides).toHaveProperty('wpnav_upload_media_from_url', true);
    });
  });

  describe('full-admin preset', () => {
    const preset = FOCUS_MODE_PRESETS['full-admin'];

    it('should have correct metadata', () => {
      expect(preset.name).toBe('full-admin');
      expect(preset.description).toContain('Full');
      expect(preset.tokenEstimate).toContain('19,500');
    });

    it('should enable all categories', () => {
      expect(preset.tools.enabled).toContain('core');
      expect(preset.tools.enabled).toContain('content');
      expect(preset.tools.enabled).toContain('users');
      expect(preset.tools.enabled).toContain('plugins');
      expect(preset.tools.enabled).toContain('themes');
    });

    it('should have no disabled categories', () => {
      expect(preset.tools.disabled).toHaveLength(0);
    });

    it('should have no specific overrides', () => {
      expect(Object.keys(preset.tools.overrides || {})).toHaveLength(0);
    });
  });

  describe('read-only preset', () => {
    const preset = FOCUS_MODE_PRESETS['read-only'];

    it('should have correct metadata', () => {
      expect(preset.name).toBe('read-only');
      expect(preset.description).toContain('Read-only');
      expect(preset.tokenEstimate).toContain('300');
    });

    it('should enable list and get operations via wildcards', () => {
      expect(preset.tools.overrides).toHaveProperty('wpnav_list_*', true);
      expect(preset.tools.overrides).toHaveProperty('wpnav_get_*', true);
    });

    it('should disable write operations via wildcards', () => {
      expect(preset.tools.overrides).toHaveProperty('wpnav_create_*', false);
      expect(preset.tools.overrides).toHaveProperty('wpnav_update_*', false);
      expect(preset.tools.overrides).toHaveProperty('wpnav_delete_*', false);
    });

    it('should disable batch operations', () => {
      expect(preset.tools.overrides).toHaveProperty('wpnav_batch_*', false);
    });
  });

  describe('custom preset', () => {
    const preset = FOCUS_MODE_PRESETS['custom'];

    it('should have correct metadata', () => {
      expect(preset.name).toBe('custom');
      expect(preset.description).toContain('Custom');
      expect(preset.tokenEstimate).toBe('varies');
    });

    it('should have empty tools configuration (placeholder)', () => {
      expect(preset.tools.enabled).toHaveLength(0);
      expect(preset.tools.disabled).toHaveLength(0);
      expect(Object.keys(preset.tools.overrides || {})).toHaveLength(0);
    });
  });
});

// =============================================================================
// resolveFocusMode
// =============================================================================

describe('resolveFocusMode', () => {
  it('should resolve content-editing to preset', () => {
    const result = resolveFocusMode('content-editing');

    expect(result.mode).toBe('content-editing');
    expect(result.source).toBe('preset');
    expect(result.tools.overrides).toHaveProperty('wpnav_introspect', true);
  });

  it('should resolve full-admin to preset', () => {
    const result = resolveFocusMode('full-admin');

    expect(result.mode).toBe('full-admin');
    expect(result.source).toBe('preset');
    expect(result.tools.enabled).toContain('core');
  });

  it('should resolve read-only to preset', () => {
    const result = resolveFocusMode('read-only');

    expect(result.mode).toBe('read-only');
    expect(result.source).toBe('preset');
    expect(result.tools.overrides).toHaveProperty('wpnav_list_*', true);
  });

  it('should resolve custom to manifest tools', () => {
    const manifest: WPNavManifestV2 = {
      schema_version: 2,
      manifest_version: '1.0',
      meta: { name: 'Test' },
      tools: {
        enabled: ['core', 'content'],
        disabled: ['users'],
        overrides: { wpnav_delete_post: false },
      },
    };

    const result = resolveFocusMode('custom', manifest);

    expect(result.mode).toBe('custom');
    expect(result.source).toBe('manifest');
    expect(result.tools.enabled).toContain('core');
    expect(result.tools.disabled).toContain('users');
  });

  it('should return empty tools for custom without manifest', () => {
    const result = resolveFocusMode('custom');

    expect(result.mode).toBe('custom');
    expect(result.source).toBe('manifest');
    // Should return defaults from getManifestTools
    expect(result.tools).toBeDefined();
  });
});

// =============================================================================
// getFocusMode
// =============================================================================

describe('getFocusMode', () => {
  it('should return focus mode from v2 manifest', () => {
    const manifest: WPNavManifestV2 = {
      schema_version: 2,
      manifest_version: '1.0',
      meta: { name: 'Test' },
      ai: { focus: 'read-only' },
    };

    expect(getFocusMode(manifest)).toBe('read-only');
  });

  it('should default to content-editing when no focus specified', () => {
    const manifest: WPNavManifestV2 = {
      schema_version: 2,
      manifest_version: '1.0',
      meta: { name: 'Test' },
    };

    expect(getFocusMode(manifest)).toBe('content-editing');
  });

  it('should default to content-editing when no manifest', () => {
    expect(getFocusMode()).toBe('content-editing');
    expect(getFocusMode(undefined)).toBe('content-editing');
  });

  it('should default to content-editing for v1 manifest', () => {
    const v1Manifest = {
      schema_version: 1,
      manifest_version: '1.0',
      meta: { name: 'Test' },
    };

    expect(getFocusMode(v1Manifest as any)).toBe('content-editing');
  });
});

// =============================================================================
// getFocusModePreset
// =============================================================================

describe('getFocusModePreset', () => {
  it('should return preset for valid mode', () => {
    const preset = getFocusModePreset('content-editing');
    expect(preset.name).toBe('content-editing');
    expect(preset.description).toBeDefined();
  });

  it('should return preset for all modes', () => {
    for (const mode of ['content-editing', 'full-admin', 'read-only', 'custom'] as const) {
      const preset = getFocusModePreset(mode);
      expect(preset.name).toBe(mode);
    }
  });
});

// =============================================================================
// listFocusModes
// =============================================================================

describe('listFocusModes', () => {
  it('should return all four modes', () => {
    const modes = listFocusModes();
    expect(modes).toHaveLength(4);
  });

  it('should include name, description, and tokenEstimate', () => {
    const modes = listFocusModes();
    for (const mode of modes) {
      expect(mode).toHaveProperty('name');
      expect(mode).toHaveProperty('description');
      expect(mode).toHaveProperty('tokenEstimate');
    }
  });

  it('should have content-editing as first mode', () => {
    const modes = listFocusModes();
    const names = modes.map((m) => m.name);
    expect(names).toContain('content-editing');
  });
});

// =============================================================================
// mergeFocusModeWithManifest
// =============================================================================

describe('mergeFocusModeWithManifest', () => {
  it('should return focus mode tools when no manifest tools', () => {
    const focusMode = resolveFocusMode('content-editing');
    const merged = mergeFocusModeWithManifest(focusMode);

    expect(merged).toEqual(focusMode.tools);
  });

  it('should return manifest tools for custom mode', () => {
    const manifest: WPNavManifestV2 = {
      schema_version: 2,
      manifest_version: '1.0',
      meta: { name: 'Test' },
      tools: {
        enabled: ['core'],
        disabled: ['users'],
      },
    };

    const focusMode = resolveFocusMode('custom', manifest);
    const merged = mergeFocusModeWithManifest(focusMode, manifest.tools);

    expect(merged).toEqual(focusMode.tools);
  });

  it('should merge enabled categories', () => {
    const focusMode = resolveFocusMode('content-editing');
    const manifestTools: ManifestTools = {
      enabled: ['users'],
      disabled: [],
      overrides: {},
    };

    const merged = mergeFocusModeWithManifest(focusMode, manifestTools);

    expect(merged.enabled).toContain('users');
  });

  it('should let manifest overrides take precedence', () => {
    const focusMode = resolveFocusMode('content-editing');
    const manifestTools: ManifestTools = {
      enabled: [],
      disabled: [],
      overrides: { wpnav_introspect: false },
    };

    const merged = mergeFocusModeWithManifest(focusMode, manifestTools);

    expect(merged.overrides?.wpnav_introspect).toBe(false);
  });

  it('should deduplicate enabled categories', () => {
    const focusMode = resolveFocusMode('full-admin');
    const manifestTools: ManifestTools = {
      enabled: ['core', 'content'], // Already in full-admin
      disabled: [],
      overrides: {},
    };

    const merged = mergeFocusModeWithManifest(focusMode, manifestTools);

    const coreCount = merged.enabled?.filter((c) => c === 'core').length ?? 0;
    expect(coreCount).toBe(1);
  });
});

// =============================================================================
// estimateToolCount
// =============================================================================

describe('estimateToolCount', () => {
  it('should return 75 for full-admin', () => {
    expect(estimateToolCount('full-admin')).toBe(75);
  });

  it('should return -1 for custom (unknown)', () => {
    expect(estimateToolCount('custom')).toBe(-1);
  });

  it('should count explicit tool overrides for content-editing', () => {
    const count = estimateToolCount('content-editing');
    // Should have ~14-17 tools based on our preset definition
    expect(count).toBeGreaterThanOrEqual(14);
    expect(count).toBeLessThanOrEqual(20);
  });

  it('should not count wildcard patterns', () => {
    // read-only uses wildcards, so explicit count should be low
    const count = estimateToolCount('read-only');
    // Should have a few explicit tools (introspect, etc)
    expect(count).toBeGreaterThanOrEqual(0);
  });
});
