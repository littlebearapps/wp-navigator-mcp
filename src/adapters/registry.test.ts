/**
 * Tests for Builder Adapter Registry
 *
 * @package WP_Navigator_MCP
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AdapterRegistry } from './registry.js';
import type {
  BuilderAdapter,
  PageData,
  BuilderDetectionResult,
  ConversionResult,
  ConversionOptions,
} from './types.js';
import type { NeutralLayout } from '../layout/types.js';

/**
 * Create a mock adapter for testing
 */
function createMockAdapter(
  name: string,
  options: {
    supported?: boolean;
    detectConfidence?: number;
    detectResult?: boolean;
  } = {}
): BuilderAdapter {
  const { supported = true, detectConfidence = 0.9, detectResult = true } = options;

  return {
    name,
    displayName: `${name.charAt(0).toUpperCase()}${name.slice(1)} Builder`,
    supported,
    version: { adapter: '1.0.0' },
    capabilities: {
      canExtract: true,
      canApply: true,
      canDetect: true,
      supportsNesting: true,
      supportsResponsive: true,
      supportsAnimations: false,
      supportedElements: ['paragraph', 'heading', 'image'],
    },
    detect(_page: PageData): BuilderDetectionResult {
      return {
        detected: detectResult,
        confidence: detectConfidence,
        method: 'content',
      };
    },
    extractLayout(_page: PageData, _options?: ConversionOptions): ConversionResult<NeutralLayout> {
      return {
        data: {
          layout_version: '1.0',
          source: { builder: name },
          elements: [],
        },
        success: true,
        warnings: [],
      };
    },
    extractLayoutFromContent(_content: string, _options?: ConversionOptions): ConversionResult<NeutralLayout> {
      return {
        data: {
          layout_version: '1.0',
          source: { builder: name },
          elements: [],
        },
        success: true,
        warnings: [],
      };
    },
    applyLayout(_layout: NeutralLayout, _options?: ConversionOptions): ConversionResult<string> {
      return {
        data: '',
        success: true,
        warnings: [],
      };
    },
  };
}

/**
 * Create mock page data for testing
 */
function createMockPageData(content: string = ''): PageData {
  return {
    id: 1,
    slug: 'test-page',
    title: { rendered: 'Test Page' },
    content: { rendered: content, raw: content },
    status: 'publish',
  };
}

describe('AdapterRegistry', () => {
  let registry: AdapterRegistry;

  beforeEach(() => {
    registry = new AdapterRegistry();
  });

  describe('register', () => {
    it('should register an adapter', () => {
      const adapter = createMockAdapter('gutenberg');
      registry.register(adapter);
      expect(registry.has('gutenberg')).toBe(true);
      expect(registry.get('gutenberg')).toBe(adapter);
    });

    it('should register with custom priority', () => {
      registry.register(createMockAdapter('gutenberg'), { priority: 100 });
      registry.register(createMockAdapter('elementor'), { priority: 50 });

      const all = registry.getAll();
      expect(all[0].name).toBe('gutenberg'); // Higher priority first
      expect(all[1].name).toBe('elementor');
    });

    it('should throw on duplicate registration', () => {
      registry.register(createMockAdapter('gutenberg'));
      expect(() => registry.register(createMockAdapter('gutenberg'))).toThrow(
        "Adapter 'gutenberg' is already registered"
      );
    });

    it('should register disabled by default with option', () => {
      registry.register(createMockAdapter('experimental'), { enabled: false });
      expect(registry.has('experimental')).toBe(true);
      expect(registry.getAll()).toHaveLength(0); // Not in enabled list
    });
  });

  describe('unregister', () => {
    it('should unregister an adapter', () => {
      registry.register(createMockAdapter('gutenberg'));
      expect(registry.unregister('gutenberg')).toBe(true);
      expect(registry.has('gutenberg')).toBe(false);
    });

    it('should return false for non-existent adapter', () => {
      expect(registry.unregister('nonexistent')).toBe(false);
    });
  });

  describe('get', () => {
    it('should return adapter by name', () => {
      const adapter = createMockAdapter('gutenberg');
      registry.register(adapter);
      expect(registry.get('gutenberg')).toBe(adapter);
    });

    it('should return undefined for unknown adapter', () => {
      expect(registry.get('unknown')).toBeUndefined();
    });
  });

  describe('setEnabled', () => {
    it('should enable/disable adapters', () => {
      registry.register(createMockAdapter('gutenberg'));
      expect(registry.getAll()).toHaveLength(1);

      registry.setEnabled('gutenberg', false);
      expect(registry.getAll()).toHaveLength(0);

      registry.setEnabled('gutenberg', true);
      expect(registry.getAll()).toHaveLength(1);
    });
  });

  describe('getAll', () => {
    it('should return all enabled adapters sorted by priority', () => {
      registry.register(createMockAdapter('low'), { priority: 10 });
      registry.register(createMockAdapter('high'), { priority: 100 });
      registry.register(createMockAdapter('medium'), { priority: 50 });

      const all = registry.getAll();
      expect(all.map((a) => a.name)).toEqual(['high', 'medium', 'low']);
    });

    it('should exclude disabled adapters', () => {
      registry.register(createMockAdapter('enabled'), { enabled: true });
      registry.register(createMockAdapter('disabled'), { enabled: false });

      const all = registry.getAll();
      expect(all).toHaveLength(1);
      expect(all[0].name).toBe('enabled');
    });
  });

  describe('getSupported', () => {
    it('should return only supported adapters', () => {
      registry.register(createMockAdapter('supported', { supported: true }));
      registry.register(createMockAdapter('unsupported', { supported: false }));

      const supported = registry.getSupported();
      expect(supported).toHaveLength(1);
      expect(supported[0].name).toBe('supported');
    });
  });

  describe('getNames', () => {
    it('should return all adapter names', () => {
      registry.register(createMockAdapter('gutenberg'));
      registry.register(createMockAdapter('elementor'));
      registry.register(createMockAdapter('divi'));

      const names = registry.getNames();
      expect(names).toContain('gutenberg');
      expect(names).toContain('elementor');
      expect(names).toContain('divi');
    });
  });

  describe('detectBuilder', () => {
    it('should detect builder with highest confidence', () => {
      registry.register(createMockAdapter('low', { detectConfidence: 0.5 }));
      registry.register(createMockAdapter('high', { detectConfidence: 0.95 }));
      registry.register(createMockAdapter('medium', { detectConfidence: 0.7 }));

      const result = registry.detectBuilder(createMockPageData());
      expect(result).not.toBeNull();
      expect(result!.adapter.name).toBe('high');
      expect(result!.detection.confidence).toBe(0.95);
    });

    it('should respect minimum confidence threshold', () => {
      registry.register(createMockAdapter('low', { detectConfidence: 0.3 }));

      const result = registry.detectBuilder(createMockPageData(), 0.5);
      expect(result).toBeNull();
    });

    it('should return null when no builder detected', () => {
      registry.register(createMockAdapter('none', { detectResult: false }));

      const result = registry.detectBuilder(createMockPageData());
      expect(result).toBeNull();
    });

    it('should skip unsupported adapters', () => {
      registry.register(createMockAdapter('unsupported', { supported: false, detectConfidence: 1.0 }));
      registry.register(createMockAdapter('supported', { supported: true, detectConfidence: 0.6 }));

      const result = registry.detectBuilder(createMockPageData());
      expect(result).not.toBeNull();
      expect(result!.adapter.name).toBe('supported');
    });

    it('should handle adapter detection errors gracefully', () => {
      const throwingAdapter = createMockAdapter('throwing');
      throwingAdapter.detect = () => {
        throw new Error('Detection failed');
      };

      registry.register(throwingAdapter);
      registry.register(createMockAdapter('working'));

      const result = registry.detectBuilder(createMockPageData());
      expect(result).not.toBeNull();
      expect(result!.adapter.name).toBe('working');
    });
  });

  describe('detectAllBuilders', () => {
    it('should return all matching builders sorted by confidence', () => {
      registry.register(createMockAdapter('low', { detectConfidence: 0.4 }));
      registry.register(createMockAdapter('high', { detectConfidence: 0.9 }));
      registry.register(createMockAdapter('medium', { detectConfidence: 0.6 }));

      const results = registry.detectAllBuilders(createMockPageData(), 0.3);
      expect(results).toHaveLength(3);
      expect(results[0].adapter.name).toBe('high');
      expect(results[1].adapter.name).toBe('medium');
      expect(results[2].adapter.name).toBe('low');
    });

    it('should filter by minimum confidence', () => {
      registry.register(createMockAdapter('low', { detectConfidence: 0.3 }));
      registry.register(createMockAdapter('high', { detectConfidence: 0.9 }));

      const results = registry.detectAllBuilders(createMockPageData(), 0.5);
      expect(results).toHaveLength(1);
      expect(results[0].adapter.name).toBe('high');
    });
  });

  describe('clear', () => {
    it('should remove all adapters', () => {
      registry.register(createMockAdapter('one'));
      registry.register(createMockAdapter('two'));
      registry.register(createMockAdapter('three'));

      registry.clear();
      expect(registry.getAll()).toHaveLength(0);
      expect(registry.getNames()).toHaveLength(0);
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', () => {
      registry.register(createMockAdapter('enabled1', { supported: true }), { enabled: true });
      registry.register(createMockAdapter('enabled2', { supported: false }), { enabled: true });
      registry.register(createMockAdapter('disabled', { supported: true }), { enabled: false });

      const stats = registry.getStats();
      expect(stats.total).toBe(3);
      expect(stats.enabled).toBe(2);
      expect(stats.supported).toBe(1);
    });
  });
});

describe('BuilderAdapter Interface', () => {
  it('should have all required properties', () => {
    const adapter = createMockAdapter('test');

    // Identification
    expect(adapter.name).toBe('test');
    expect(adapter.displayName).toBeTruthy();
    expect(typeof adapter.supported).toBe('boolean');

    // Version
    expect(adapter.version).toBeDefined();
    expect(adapter.version.adapter).toBeTruthy();

    // Capabilities
    expect(adapter.capabilities).toBeDefined();
    expect(typeof adapter.capabilities.canExtract).toBe('boolean');
    expect(typeof adapter.capabilities.canApply).toBe('boolean');
    expect(typeof adapter.capabilities.canDetect).toBe('boolean');
    expect(Array.isArray(adapter.capabilities.supportedElements)).toBe(true);

    // Methods
    expect(typeof adapter.detect).toBe('function');
    expect(typeof adapter.extractLayout).toBe('function');
    expect(typeof adapter.extractLayoutFromContent).toBe('function');
    expect(typeof adapter.applyLayout).toBe('function');
  });

  it('should implement detect correctly', () => {
    const adapter = createMockAdapter('test');
    const result = adapter.detect(createMockPageData());

    expect(result).toHaveProperty('detected');
    expect(result).toHaveProperty('confidence');
    expect(result).toHaveProperty('method');
    expect(typeof result.detected).toBe('boolean');
    expect(typeof result.confidence).toBe('number');
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it('should implement extractLayout correctly', () => {
    const adapter = createMockAdapter('test');
    const result = adapter.extractLayout(createMockPageData());

    expect(result).toHaveProperty('data');
    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('warnings');
    expect(result.data).toHaveProperty('layout_version');
    expect(result.data).toHaveProperty('source');
    expect(result.data).toHaveProperty('elements');
  });

  it('should implement applyLayout correctly', () => {
    const adapter = createMockAdapter('test');
    const layout = {
      layout_version: '1.0' as const,
      source: { builder: 'test' },
      elements: [],
    };
    const result = adapter.applyLayout(layout);

    expect(result).toHaveProperty('data');
    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('warnings');
    expect(typeof result.data).toBe('string');
  });
});
