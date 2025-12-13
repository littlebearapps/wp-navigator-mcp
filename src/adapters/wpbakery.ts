/**
 * WPBakery Builder Adapter (Stub)
 *
 * Stub implementation for WPBakery (Visual Composer) page builder content.
 * Detects WPBakery pages but does not yet support extraction/application.
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
// WPBakery Adapter Implementation (Stub)
// =============================================================================

/**
 * WPBakery Builder Adapter
 *
 * Stub implementation that detects WPBakery/Visual Composer content
 * and provides informative "not supported" messages for extraction/application.
 */
export class WPBakeryAdapter implements BuilderAdapter {
  readonly name = 'wpbakery';
  readonly displayName = 'WPBakery Page Builder';
  readonly supported = false;

  readonly version: AdapterVersion = {
    adapter: '0.1.0',
    minBuilderVersion: '6.0.0',
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
   * Detect if content uses WPBakery (Visual Composer)
   *
   * Checks for WPBakery-specific markers:
   * - Shortcodes: [vc_row], [vc_column], [vc_*]
   * - CSS classes: vc_*, wpb_*
   * - Data attributes: data-vc-*
   */
  detect(page: PageData): BuilderDetectionResult {
    const content = page.content.raw || page.content.rendered || '';
    const meta = page.meta || {};

    // Check for WPBakery meta fields
    const hasWPBakeryMeta =
      meta._wpb_vc_js_status === 'true' ||
      meta._wpb_shortcodes_custom_css !== undefined ||
      meta._vc_post_settings !== undefined;

    // Check for WPBakery shortcodes
    const hasWPBakeryShortcodes =
      content.includes('[vc_row') ||
      content.includes('[vc_column') ||
      content.includes('[vc_') ||
      // Also check for classic Visual Composer shortcodes
      content.includes('[/vc_row]') ||
      content.includes('[/vc_column]');

    // Check for WPBakery CSS classes in rendered content
    const hasWPBakeryClasses =
      content.includes('class="vc_') ||
      content.includes('class="wpb_') ||
      content.includes('vc_row') ||
      content.includes('wpb_column');

    // Check for WPBakery data attributes
    const hasWPBakeryData =
      content.includes('data-vc-') ||
      content.includes('data-vc-full-width') ||
      content.includes('data-vc-stretch-content');

    // Calculate confidence
    let confidence = 0;
    let method: 'meta' | 'content' | 'shortcode' = 'content';

    if (hasWPBakeryShortcodes) {
      confidence += 0.6;
      method = 'shortcode';
    }
    if (hasWPBakeryMeta) {
      confidence += 0.25;
      if (!hasWPBakeryShortcodes) method = 'meta';
    }
    if (hasWPBakeryClasses) confidence += 0.1;
    if (hasWPBakeryData) confidence += 0.05;

    const detected = hasWPBakeryShortcodes || hasWPBakeryMeta || hasWPBakeryClasses;

    return {
      detected,
      confidence: Math.min(confidence, 1),
      method,
      details: {
        hasWPBakeryMeta,
        hasWPBakeryShortcodes,
        hasWPBakeryClasses,
        hasWPBakeryData,
        message: detected ? 'WPBakery support coming in v2.0' : undefined,
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Extraction (Not Supported)
  // ---------------------------------------------------------------------------

  /**
   * Extract layout from WPBakery page (not supported)
   */
  extractLayout(_page: PageData, _options?: ConversionOptions): ConversionResult<NeutralLayout> {
    return this.notSupportedResult();
  }

  /**
   * Extract layout from raw content (not supported)
   */
  extractLayoutFromContent(_content: string, _options?: ConversionOptions): ConversionResult<NeutralLayout> {
    return this.notSupportedResult();
  }

  // ---------------------------------------------------------------------------
  // Application (Not Supported)
  // ---------------------------------------------------------------------------

  /**
   * Apply layout to WPBakery format (not supported)
   */
  applyLayout(_layout: NeutralLayout, _options?: ConversionOptions): ConversionResult<string> {
    return {
      data: '',
      success: false,
      warnings: [
        {
          code: 'BUILDER_NOT_SUPPORTED',
          message: 'WPBakery support is coming in WP Navigator v2.0. Currently, only Gutenberg blocks are supported.',
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
          message: 'WPBakery support is coming in WP Navigator v2.0. Currently, only Gutenberg blocks are supported.',
          severity: 'error',
        },
      ],
    };
  }
}

/**
 * Singleton instance of WPBakeryAdapter
 */
export const wpbakeryAdapter = new WPBakeryAdapter();
