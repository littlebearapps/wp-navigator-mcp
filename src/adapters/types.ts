/**
 * Builder Adapter Types
 *
 * Defines the interface for page builder adapters that convert between
 * builder-specific formats and the neutral layout model.
 *
 * @package WP_Navigator_Pro
 * @since 1.2.0
 */

import type { NeutralLayout, LayoutElement } from '../layout/types.js';
import type { PageSnapshot, BlockSnapshot } from '../snapshots/types.js';

// =============================================================================
// Page Data Types
// =============================================================================

/**
 * WordPress page data from REST API
 */
export interface PageData {
  /** WordPress page ID */
  id: number;
  /** Page URL slug */
  slug: string;
  /** Page title */
  title: {
    rendered: string;
    raw?: string;
  };
  /** Page content */
  content: {
    rendered: string;
    raw?: string;
    protected?: boolean;
  };
  /** Page excerpt */
  excerpt?: {
    rendered: string;
    raw?: string;
  };
  /** Page status */
  status: 'publish' | 'draft' | 'pending' | 'private' | 'trash';
  /** Page template */
  template?: string;
  /** Post meta */
  meta?: Record<string, unknown>;
  /** ACF fields (if ACF plugin active) */
  acf?: Record<string, unknown>;
  /** Additional builder metadata */
  _builderMeta?: Record<string, unknown>;
}

/**
 * Builder detection result
 */
export interface BuilderDetectionResult {
  /** Whether the builder was detected */
  detected: boolean;
  /** Confidence level (0-1) */
  confidence: number;
  /** Detection method used */
  method: 'content' | 'meta' | 'template' | 'class' | 'shortcode';
  /** Additional detection details */
  details?: Record<string, unknown>;
}

/**
 * Conversion options for extract/apply operations
 */
export interface ConversionOptions {
  /** Preserve builder-specific data for round-trip */
  preserveBuilderData?: boolean;
  /** Strip unknown/unsupported elements */
  stripUnknown?: boolean;
  /** Include rendered HTML fallback */
  includeRendered?: boolean;
  /** Strict mode - fail on unsupported elements */
  strict?: boolean;
}

/**
 * Conversion result with metadata
 */
export interface ConversionResult<T> {
  /** The converted data */
  data: T;
  /** Whether conversion was successful */
  success: boolean;
  /** Warnings during conversion */
  warnings: ConversionWarning[];
  /** Elements that couldn't be converted */
  unsupportedElements?: string[];
  /** Processing statistics */
  stats?: {
    totalElements: number;
    convertedElements: number;
    skippedElements: number;
    processingTime: number;
  };
}

/**
 * Conversion warning
 */
export interface ConversionWarning {
  /** Warning code */
  code: string;
  /** Human-readable message */
  message: string;
  /** Element path where warning occurred */
  path?: string;
  /** Severity level */
  severity: 'info' | 'warning' | 'error';
}

// =============================================================================
// Builder Adapter Interface
// =============================================================================

/**
 * Builder adapter version info
 */
export interface AdapterVersion {
  /** Adapter version */
  adapter: string;
  /** Minimum supported builder version */
  minBuilderVersion?: string;
  /** Maximum supported builder version */
  maxBuilderVersion?: string;
}

/**
 * Builder adapter capabilities
 */
export interface AdapterCapabilities {
  /** Can extract layouts from this builder */
  canExtract: boolean;
  /** Can apply layouts to this builder */
  canApply: boolean;
  /** Can detect this builder's content */
  canDetect: boolean;
  /** Supports nested/inner blocks */
  supportsNesting: boolean;
  /** Supports responsive attributes */
  supportsResponsive: boolean;
  /** Supports animations */
  supportsAnimations: boolean;
  /** Supported element types */
  supportedElements: string[];
}

/**
 * Builder Adapter Interface
 *
 * Adapters convert between builder-specific formats (Gutenberg blocks,
 * Elementor widgets, Divi modules) and the neutral layout model.
 *
 * @example
 * ```typescript
 * class GutenbergAdapter implements BuilderAdapter {
 *   readonly name = 'gutenberg';
 *   readonly displayName = 'Gutenberg (Block Editor)';
 *   readonly supported = true;
 *
 *   detect(page: PageData): BuilderDetectionResult {
 *     // Detect Gutenberg block comments
 *   }
 *
 *   extractLayout(page: PageData): ConversionResult<NeutralLayout> {
 *     // Convert blocks to neutral format
 *   }
 *
 *   applyLayout(layout: NeutralLayout): ConversionResult<string> {
 *     // Convert neutral format back to blocks
 *   }
 * }
 * ```
 */
export interface BuilderAdapter {
  // -------------------------------------------------------------------------
  // Identification
  // -------------------------------------------------------------------------

  /** Unique adapter identifier (lowercase, no spaces) */
  readonly name: string;

  /** Human-readable display name */
  readonly displayName: string;

  /** Whether this adapter is currently supported/enabled */
  readonly supported: boolean;

  /** Version information */
  readonly version: AdapterVersion;

  /** Adapter capabilities */
  readonly capabilities: AdapterCapabilities;

  // -------------------------------------------------------------------------
  // Detection
  // -------------------------------------------------------------------------

  /**
   * Detect if a page uses this builder
   *
   * @param page - WordPress page data
   * @returns Detection result with confidence
   */
  detect(page: PageData): BuilderDetectionResult;

  // -------------------------------------------------------------------------
  // Extraction (Builder Format → Neutral Layout)
  // -------------------------------------------------------------------------

  /**
   * Extract neutral layout from page data
   *
   * @param page - WordPress page data
   * @param options - Conversion options
   * @returns Neutral layout with conversion metadata
   */
  extractLayout(page: PageData, options?: ConversionOptions): ConversionResult<NeutralLayout>;

  /**
   * Extract layout from raw content string
   *
   * @param content - Raw content (block comments, shortcodes, etc.)
   * @param options - Conversion options
   * @returns Neutral layout with conversion metadata
   */
  extractLayoutFromContent(content: string, options?: ConversionOptions): ConversionResult<NeutralLayout>;

  // -------------------------------------------------------------------------
  // Application (Neutral Layout → Builder Format)
  // -------------------------------------------------------------------------

  /**
   * Apply neutral layout to generate builder content
   *
   * @param layout - Neutral layout to convert
   * @param options - Conversion options
   * @returns Builder-specific content string
   */
  applyLayout(layout: NeutralLayout, options?: ConversionOptions): ConversionResult<string>;

  // -------------------------------------------------------------------------
  // Element Conversion
  // -------------------------------------------------------------------------

  /**
   * Convert a single builder element to neutral format
   *
   * @param element - Builder-specific element
   * @returns Neutral layout element or null if unsupported
   */
  convertToNeutral?(element: unknown): LayoutElement | null;

  /**
   * Convert a neutral element to builder format
   *
   * @param element - Neutral layout element
   * @returns Builder-specific element or null if unsupported
   */
  convertFromNeutral?(element: LayoutElement): unknown;

  // -------------------------------------------------------------------------
  // Validation
  // -------------------------------------------------------------------------

  /**
   * Validate builder content
   *
   * @param content - Content to validate
   * @returns Validation result
   */
  validate?(content: string): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  };
}

// =============================================================================
// Adapter Registry Types
// =============================================================================

/**
 * Adapter registration info
 */
export interface AdapterRegistration {
  /** The adapter instance */
  adapter: BuilderAdapter;
  /** Registration priority (higher = checked first for detection) */
  priority: number;
  /** Whether adapter is enabled */
  enabled: boolean;
}

/**
 * Adapter lookup result
 */
export interface AdapterLookupResult {
  /** Matched adapter */
  adapter: BuilderAdapter;
  /** Detection result */
  detection: BuilderDetectionResult;
}
