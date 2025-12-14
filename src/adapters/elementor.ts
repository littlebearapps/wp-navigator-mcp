/**
 * Elementor Builder Adapter (Stub)
 *
 * Stub implementation for Elementor page builder content.
 * Detects Elementor pages but does not yet support extraction/application.
 *
 * @package WP_Navigator_Pro
 * @since 1.2.0
 */

import type {
  BuilderAdapter,
  PageData,
  BuilderDetectionResult,
  ConversionOptions,
  ConversionResult,
  AdapterVersion,
  AdapterCapabilities,
} from './types.js';
import type { NeutralLayout } from '../layout/types.js';

// =============================================================================
// Elementor Adapter Implementation (Stub)
// =============================================================================

/**
 * Elementor Builder Adapter
 *
 * Stub implementation that detects Elementor content and provides
 * informative "not supported" messages for extraction/application.
 */
export class ElementorAdapter implements BuilderAdapter {
  readonly name = 'elementor';
  readonly displayName = 'Elementor';
  readonly supported = false;

  readonly version: AdapterVersion = {
    adapter: '0.1.0',
    minBuilderVersion: '3.0.0',
  };

  readonly capabilities: AdapterCapabilities = {
    canExtract: false,
    canApply: false,
    canDetect: true,
    supportsNesting: false,
    supportsResponsive: false,
    supportsAnimations: false,
    supportedElements: [],
  };

  // ---------------------------------------------------------------------------
  // Detection
  // ---------------------------------------------------------------------------

  /**
   * Detect if content uses Elementor
   *
   * Checks for Elementor-specific markers:
   * - Post meta: _elementor_edit_mode, _elementor_data
   * - CSS classes: elementor-*, e-con-*
   * - Data attributes: data-elementor-*
   */
  detect(page: PageData): BuilderDetectionResult {
    const content = page.content.rendered || page.content.raw || '';
    const meta = page.meta || {};

    // Check for Elementor meta fields
    const hasElementorMeta =
      meta._elementor_edit_mode === 'builder' ||
      meta._elementor_data !== undefined ||
      meta._elementor_version !== undefined;

    // Check for Elementor CSS classes in content
    const hasElementorClasses =
      content.includes('class="elementor') ||
      content.includes('class="e-con') ||
      content.includes('elementor-widget') ||
      content.includes('elementor-element');

    // Check for Elementor data attributes
    const hasElementorData =
      content.includes('data-elementor-type') ||
      content.includes('data-elementor-id') ||
      content.includes('data-element_type');

    // Check for Elementor container structure
    const hasElementorStructure =
      content.includes('elementor-section') ||
      content.includes('elementor-column') ||
      content.includes('elementor-container');

    // Calculate confidence
    let confidence = 0;
    let method: 'meta' | 'content' | 'class' = 'content';

    if (hasElementorMeta) {
      confidence += 0.6;
      method = 'meta';
    }
    if (hasElementorClasses) confidence += 0.2;
    if (hasElementorData) confidence += 0.15;
    if (hasElementorStructure) confidence += 0.05;

    const detected = hasElementorMeta || hasElementorClasses || hasElementorData;

    return {
      detected,
      confidence: Math.min(confidence, 1),
      method,
      details: {
        hasElementorMeta,
        hasElementorClasses,
        hasElementorData,
        hasElementorStructure,
        message: detected ? 'Elementor support coming in v2.0' : undefined,
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Extraction (Not Supported)
  // ---------------------------------------------------------------------------

  /**
   * Extract layout from Elementor page (not supported)
   */
  extractLayout(_page: PageData, _options?: ConversionOptions): ConversionResult<NeutralLayout> {
    return this.notSupportedResult();
  }

  /**
   * Extract layout from raw content (not supported)
   */
  extractLayoutFromContent(
    _content: string,
    _options?: ConversionOptions
  ): ConversionResult<NeutralLayout> {
    return this.notSupportedResult();
  }

  // ---------------------------------------------------------------------------
  // Application (Not Supported)
  // ---------------------------------------------------------------------------

  /**
   * Apply layout to Elementor format (not supported)
   */
  applyLayout(_layout: NeutralLayout, _options?: ConversionOptions): ConversionResult<string> {
    return {
      data: '',
      success: false,
      warnings: [
        {
          code: 'BUILDER_NOT_SUPPORTED',
          message:
            'Elementor support is coming in WP Navigator v2.0. Currently, only Gutenberg blocks are supported.',
          severity: 'error',
        },
      ],
    };
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /**
   * Return a standard "not supported" result for extraction
   */
  private notSupportedResult(): ConversionResult<NeutralLayout> {
    return {
      data: {
        layout_version: '1.0',
        source: {
          builder: this.name,
          formatVersion: '1.0',
        },
        elements: [],
      },
      success: false,
      warnings: [
        {
          code: 'BUILDER_NOT_SUPPORTED',
          message:
            'Elementor support is coming in WP Navigator v2.0. Currently, only Gutenberg blocks are supported.',
          severity: 'error',
        },
      ],
    };
  }
}

/**
 * Singleton instance of ElementorAdapter
 */
export const elementorAdapter = new ElementorAdapter();
