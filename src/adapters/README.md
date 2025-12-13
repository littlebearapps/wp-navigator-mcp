# Builder Adapters

Type-safe interface and registry for page builder adapters.

## Overview

Builder adapters convert between builder-specific formats (Gutenberg blocks, Elementor widgets, Divi modules) and the neutral layout model. The adapter interface enables extension without modifying core code.

## Interface

```typescript
interface BuilderAdapter {
  // Identification
  readonly name: string;                    // Unique ID (e.g., 'gutenberg')
  readonly displayName: string;             // Human-readable name
  readonly supported: boolean;              // Whether currently supported
  readonly version: AdapterVersion;         // Version info
  readonly capabilities: AdapterCapabilities; // Feature support

  // Detection
  detect(page: PageData): BuilderDetectionResult;

  // Extraction (Builder → Neutral)
  extractLayout(page: PageData, options?: ConversionOptions): ConversionResult<NeutralLayout>;
  extractLayoutFromContent(content: string, options?: ConversionOptions): ConversionResult<NeutralLayout>;

  // Application (Neutral → Builder)
  applyLayout(layout: NeutralLayout, options?: ConversionOptions): ConversionResult<string>;
}
```

## Registry Usage

```typescript
import { AdapterRegistry, adapterRegistry } from './adapters/index.js';

// Use global singleton
adapterRegistry.register(gutenbergAdapter, { priority: 100 });

// Or create isolated registry
const registry = new AdapterRegistry();
registry.register(gutenbergAdapter);
registry.register(elementorAdapter, { priority: 90 });

// Auto-detect builder
const result = registry.detectBuilder(pageData);
if (result) {
  console.log(`Detected: ${result.adapter.displayName}`);
  console.log(`Confidence: ${result.detection.confidence}`);

  // Extract layout
  const layout = result.adapter.extractLayout(pageData);
}

// Get specific adapter
const gutenberg = registry.get('gutenberg');
if (gutenberg?.supported) {
  const layout = gutenberg.extractLayout(pageData);
}
```

## Detection

Adapters detect their builder via content analysis:

```typescript
detect(page: PageData): BuilderDetectionResult {
  const hasBlockComments = page.content.raw?.includes('<!-- wp:');
  return {
    detected: hasBlockComments,
    confidence: hasBlockComments ? 0.95 : 0,
    method: 'content',
    details: { blockCount: countBlocks(page.content.raw) },
  };
}
```

Detection methods:
- `content` - Analyze raw content (block comments, shortcodes)
- `meta` - Check post meta for builder markers
- `template` - Check page template assignment
- `class` - Check CSS classes in rendered HTML
- `shortcode` - Detect builder shortcodes

## Conversion Options

```typescript
interface ConversionOptions {
  preserveBuilderData?: boolean;  // Keep _builderData for round-trip
  stripUnknown?: boolean;         // Remove unsupported elements
  includeRendered?: boolean;      // Include rendered HTML fallback
  strict?: boolean;               // Fail on unsupported elements
}
```

## Conversion Results

All conversion methods return detailed results:

```typescript
interface ConversionResult<T> {
  data: T;                        // Converted data
  success: boolean;               // Overall success
  warnings: ConversionWarning[];  // Non-fatal issues
  unsupportedElements?: string[]; // Elements that couldn't convert
  stats?: {
    totalElements: number;
    convertedElements: number;
    skippedElements: number;
    processingTime: number;
  };
}
```

## Graceful Degradation

The `supported` flag enables graceful degradation:

```typescript
const adapter = registry.get('elementor');
if (!adapter?.supported) {
  console.log('Elementor adapter not available, using fallback');
  // Fall back to raw HTML or skip
}
```

## Creating an Adapter

```typescript
import type { BuilderAdapter, PageData } from './adapters/index.js';

class MyBuilderAdapter implements BuilderAdapter {
  readonly name = 'mybuilder';
  readonly displayName = 'My Page Builder';
  readonly supported = true;

  readonly version = {
    adapter: '1.0.0',
    minBuilderVersion: '2.0.0',
  };

  readonly capabilities = {
    canExtract: true,
    canApply: true,
    canDetect: true,
    supportsNesting: true,
    supportsResponsive: true,
    supportsAnimations: false,
    supportedElements: [
      'section', 'heading', 'paragraph', 'image', 'button',
    ],
  };

  detect(page: PageData): BuilderDetectionResult {
    const hasMarker = page.content.raw?.includes('[mybuilder]');
    return {
      detected: hasMarker,
      confidence: hasMarker ? 0.9 : 0,
      method: 'content',
    };
  }

  extractLayout(page: PageData, options?: ConversionOptions): ConversionResult<NeutralLayout> {
    // Parse builder format into neutral elements
    const elements = this.parseContent(page.content.raw || '');
    return {
      data: {
        layout_version: '1.0',
        source: { builder: this.name },
        elements,
      },
      success: true,
      warnings: [],
    };
  }

  extractLayoutFromContent(content: string, options?: ConversionOptions): ConversionResult<NeutralLayout> {
    return this.extractLayout({ content: { raw: content } } as PageData, options);
  }

  applyLayout(layout: NeutralLayout, options?: ConversionOptions): ConversionResult<string> {
    // Convert neutral elements back to builder format
    const content = this.serializeElements(layout.elements);
    return {
      data: content,
      success: true,
      warnings: [],
    };
  }

  private parseContent(content: string): LayoutElement[] {
    // Implementation...
    return [];
  }

  private serializeElements(elements: LayoutElement[]): string {
    // Implementation...
    return '';
  }
}
```

## Registering Adapters

```typescript
// At app initialization
import { adapterRegistry } from './adapters/index.js';
import { GutenbergAdapter } from './adapters/gutenberg.js';

// Register with priority (higher = checked first for detection)
adapterRegistry.register(new GutenbergAdapter(), { priority: 100 });

// Register disabled adapter (for future use)
adapterRegistry.register(new ElementorAdapter(), { priority: 90, enabled: false });
```

## Available Adapters

| Adapter | Status | Priority | Notes |
|---------|--------|----------|-------|
| `gutenberg` | ✅ Supported | 100 | WordPress Block Editor |
| `elementor` | 🚧 Planned | 90 | Elementor Page Builder |
| `divi` | 🚧 Planned | 90 | Divi Builder |
| `bricks` | 🚧 Planned | 80 | Bricks Builder |
| `beaver` | 🚧 Planned | 80 | Beaver Builder |

## Testing Adapters

```typescript
import { describe, it, expect } from 'vitest';
import { MyBuilderAdapter } from './mybuilder.js';

describe('MyBuilderAdapter', () => {
  const adapter = new MyBuilderAdapter();

  it('should detect builder content', () => {
    const page = { content: { raw: '[mybuilder]...[/mybuilder]' } };
    const result = adapter.detect(page);
    expect(result.detected).toBe(true);
    expect(result.confidence).toBeGreaterThan(0.8);
  });

  it('should extract layout', () => {
    const page = { content: { raw: '[mybuilder]<h1>Title</h1>[/mybuilder]' } };
    const result = adapter.extractLayout(page);
    expect(result.success).toBe(true);
    expect(result.data.elements.length).toBeGreaterThan(0);
  });

  it('should apply layout', () => {
    const layout = {
      layout_version: '1.0',
      source: { builder: 'mybuilder' },
      elements: [{ type: 'heading', attrs: { level: 1 }, content: 'Title' }],
    };
    const result = adapter.applyLayout(layout);
    expect(result.success).toBe(true);
    expect(result.data).toContain('Title');
  });
});
```
