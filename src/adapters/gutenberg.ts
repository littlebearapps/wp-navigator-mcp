/**
 * Gutenberg Builder Adapter
 *
 * Converts between WordPress Gutenberg blocks and neutral layout model.
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
  ConversionWarning,
  AdapterVersion,
  AdapterCapabilities,
} from './types.js';
import type {
  NeutralLayout,
  LayoutElement,
  LayoutElementType,
  HeadingAttributes,
  ImageAttributes,
  ButtonAttributes,
  ColumnAttributes,
  SectionAttributes,
  ListAttributes,
  QuoteAttributes,
  EmbedAttributes,
  SpacerAttributes,
  SeparatorAttributes,
} from '../layout/types.js';
import type { BlockSnapshot } from '../snapshots/types.js';
import {
  parseGutenbergBlocks,
  serializeBlocks,
  flattenBlocks,
  countBlocks,
} from '../gutenberg/index.js';

// =============================================================================
// Block Type Mapping
// =============================================================================

/**
 * Map Gutenberg block names to neutral element types
 */
const BLOCK_TO_ELEMENT_MAP: Record<string, LayoutElementType> = {
  // Structural
  'core/group': 'group',
  'core/columns': 'row',
  'core/column': 'column',
  'core/cover': 'section',
  'core/template-part': 'section',

  // Content
  'core/paragraph': 'paragraph',
  'core/heading': 'heading',
  'core/list': 'list',
  'core/list-item': 'text',
  'core/quote': 'quote',
  'core/pullquote': 'quote',
  'core/code': 'code',
  'core/preformatted': 'code',
  'core/verse': 'text',
  'core/freeform': 'html',

  // Media
  'core/image': 'image',
  'core/gallery': 'gallery',
  'core/video': 'video',
  'core/audio': 'audio',
  'core/file': 'button',
  'core/media-text': 'row',
  'core/embed': 'embed',
  'core-embed/youtube': 'embed',
  'core-embed/vimeo': 'embed',
  'core-embed/twitter': 'embed',

  // Interactive
  'core/button': 'button',
  'core/buttons': 'buttons',
  'core/search': 'form',

  // Special
  'core/separator': 'separator',
  'core/spacer': 'spacer',
  'core/html': 'html',
  'core/shortcode': 'shortcode',
  'core/block': 'unknown', // Reusable block reference
};

/**
 * Map neutral element types back to Gutenberg block names
 */
const ELEMENT_TO_BLOCK_MAP: Record<LayoutElementType, string> = {
  section: 'core/group',
  container: 'core/group',
  row: 'core/columns',
  column: 'core/column',
  group: 'core/group',
  heading: 'core/heading',
  paragraph: 'core/paragraph',
  text: 'core/paragraph',
  list: 'core/list',
  quote: 'core/quote',
  code: 'core/code',
  image: 'core/image',
  video: 'core/video',
  audio: 'core/audio',
  gallery: 'core/gallery',
  embed: 'core/embed',
  button: 'core/button',
  buttons: 'core/buttons',
  form: 'core/html',
  input: 'core/html',
  separator: 'core/separator',
  spacer: 'core/spacer',
  html: 'core/html',
  shortcode: 'core/shortcode',
  unknown: 'core/html',
};

// =============================================================================
// Gutenberg Adapter Implementation
// =============================================================================

/**
 * Gutenberg Builder Adapter
 *
 * Reference implementation of BuilderAdapter for WordPress Block Editor.
 */
export class GutenbergAdapter implements BuilderAdapter {
  readonly name = 'gutenberg';
  readonly displayName = 'Gutenberg (Block Editor)';
  readonly supported = true;

  readonly version: AdapterVersion = {
    adapter: '1.0.0',
    minBuilderVersion: '5.0.0', // WordPress 5.0+
  };

  readonly capabilities: AdapterCapabilities = {
    canExtract: true,
    canApply: true,
    canDetect: true,
    supportsNesting: true,
    supportsResponsive: true,
    supportsAnimations: false,
    supportedElements: [
      'section',
      'container',
      'row',
      'column',
      'group',
      'heading',
      'paragraph',
      'text',
      'list',
      'quote',
      'code',
      'image',
      'video',
      'audio',
      'gallery',
      'embed',
      'button',
      'buttons',
      'separator',
      'spacer',
      'html',
      'shortcode',
    ],
  };

  // ---------------------------------------------------------------------------
  // Detection
  // ---------------------------------------------------------------------------

  /**
   * Detect if content uses Gutenberg blocks
   */
  detect(page: PageData): BuilderDetectionResult {
    const content = page.content.raw || page.content.rendered || '';

    // Look for Gutenberg block comment markers
    const hasBlockComments = content.includes('<!-- wp:');
    const hasSelfClosingBlocks = /<!-- wp:\w+[^>]*\/-->/.test(content);
    const hasClosingTags = /<!-- \/wp:\w+/.test(content);

    // Count blocks for confidence
    let blockCount = 0;
    if (hasBlockComments) {
      const matches = content.match(/<!-- wp:/g);
      blockCount = matches ? matches.length : 0;
    }

    // Calculate confidence based on markers found
    let confidence = 0;
    if (hasBlockComments) confidence += 0.5;
    if (hasSelfClosingBlocks) confidence += 0.2;
    if (hasClosingTags) confidence += 0.2;
    if (blockCount > 5) confidence += 0.1;

    return {
      detected: hasBlockComments,
      confidence: Math.min(confidence, 1),
      method: 'content',
      details: {
        blockCount,
        hasSelfClosingBlocks,
        hasClosingTags,
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Extraction (Gutenberg → Neutral)
  // ---------------------------------------------------------------------------

  /**
   * Extract neutral layout from page data
   */
  extractLayout(page: PageData, options: ConversionOptions = {}): ConversionResult<NeutralLayout> {
    const content = page.content.raw || '';
    return this.extractLayoutFromContent(content, options);
  }

  /**
   * Extract neutral layout from raw content
   */
  extractLayoutFromContent(
    content: string,
    options: ConversionOptions = {}
  ): ConversionResult<NeutralLayout> {
    const startTime = Date.now();
    const warnings: ConversionWarning[] = [];
    const unsupportedElements: string[] = [];

    // Parse Gutenberg blocks
    const blocks = parseGutenbergBlocks(content);

    // Convert blocks to neutral elements
    const elements: LayoutElement[] = [];
    for (const block of blocks) {
      const element = this.blockToElement(block, warnings, unsupportedElements, options);
      if (element) {
        elements.push(element);
      }
    }

    // Build layout
    const layout: NeutralLayout = {
      layout_version: '1.0',
      source: {
        builder: this.name,
        formatVersion: '1.0',
      },
      elements,
    };

    // Add builder metadata if preserving
    if (options.preserveBuilderData) {
      layout._builderMetadata = {
        rawContent: content,
        originalBlockCount: blocks.length,
      };
    }

    const totalBlocks = countBlocks(blocks);
    const convertedCount = this.countElements(elements);

    return {
      data: layout,
      success: true,
      warnings,
      unsupportedElements: unsupportedElements.length > 0 ? unsupportedElements : undefined,
      stats: {
        totalElements: totalBlocks,
        convertedElements: convertedCount,
        skippedElements: totalBlocks - convertedCount,
        processingTime: Date.now() - startTime,
      },
    };
  }

  /**
   * Convert a single Gutenberg block to neutral element
   */
  private blockToElement(
    block: BlockSnapshot,
    warnings: ConversionWarning[],
    unsupportedElements: string[],
    options: ConversionOptions
  ): LayoutElement | null {
    const elementType = BLOCK_TO_ELEMENT_MAP[block.blockName] || 'unknown';

    // Track unsupported blocks
    if (elementType === 'unknown' && !BLOCK_TO_ELEMENT_MAP[block.blockName]) {
      unsupportedElements.push(block.blockName);
      if (options.strict) {
        warnings.push({
          code: 'UNSUPPORTED_BLOCK',
          message: `Unsupported block type: ${block.blockName}`,
          severity: 'warning',
        });
      }
      if (options.stripUnknown) {
        return null;
      }
    }

    // Convert inner blocks recursively
    const children: LayoutElement[] = [];
    for (const innerBlock of block.innerBlocks) {
      const child = this.blockToElement(innerBlock, warnings, unsupportedElements, options);
      if (child) {
        children.push(child);
      }
    }

    // Build element based on type
    return this.buildElement(elementType, block, children, options);
  }

  /**
   * Build a neutral element from block data
   */
  private buildElement(
    type: LayoutElementType,
    block: BlockSnapshot,
    children: LayoutElement[],
    options: ConversionOptions
  ): LayoutElement {
    const baseAttrs: Record<string, unknown> = {};

    // Preserve builder data if requested
    if (options.preserveBuilderData) {
      baseAttrs._builderData = {
        blockName: block.blockName,
        originalAttrs: block.attrs,
      };
    }

    // Extract common attributes
    if (block.attrs.className) {
      baseAttrs.className = block.attrs.className as string;
    }
    if (block.attrs.anchor) {
      baseAttrs.anchor = block.attrs.anchor as string;
    }

    // Extract background/color attributes
    if (block.attrs.backgroundColor || block.attrs.gradient) {
      const bgAttrs: Record<string, unknown> = {};
      if (block.attrs.backgroundColor) bgAttrs.color = block.attrs.backgroundColor;
      if (block.attrs.gradient) bgAttrs.gradient = block.attrs.gradient;
      baseAttrs.background = bgAttrs;
    }

    // Handle specific element types
    switch (type) {
      case 'heading': {
        const headingAttrs: Record<string, unknown> = {
          ...baseAttrs,
          level: (block.attrs.level as 1 | 2 | 3 | 4 | 5 | 6) || 2,
        };
        if (block.attrs.textAlign) {
          headingAttrs.typography = {
            textAlign: block.attrs.textAlign as 'left' | 'center' | 'right',
          };
        }
        return {
          type: 'heading',
          attrs: headingAttrs as unknown as HeadingAttributes,
          content: this.extractTextContent(block.innerHTML),
          children: children.length > 0 ? children : undefined,
        };
      }

      case 'paragraph':
      case 'text': {
        const paraAttrs: Record<string, unknown> = { ...baseAttrs };
        if (block.attrs.align) {
          paraAttrs.typography = { textAlign: block.attrs.align as 'left' | 'center' | 'right' };
        }
        if (block.attrs.dropCap && baseAttrs._builderData) {
          paraAttrs._builderData = { ...(baseAttrs._builderData as object), dropCap: true };
        } else if (block.attrs.dropCap) {
          paraAttrs._builderData = { dropCap: true };
        }
        return {
          type: 'paragraph',
          attrs: paraAttrs,
          content: block.innerHTML,
        };
      }

      case 'image': {
        const imageAttrs: Record<string, unknown> = {
          ...baseAttrs,
          src: (block.attrs.url as string) || this.extractImageSrc(block.innerHTML),
          alt: (block.attrs.alt as string) || '',
          width: block.attrs.width as number,
          height: block.attrs.height as number,
          caption: block.attrs.caption as string,
          mediaId: block.attrs.id as number,
          sizeSlug: block.attrs.sizeSlug as string,
        };
        if (block.attrs.linkDestination) {
          imageAttrs.linkUrl = block.attrs.href as string;
        }
        return {
          type: 'image',
          attrs: imageAttrs as unknown as ImageAttributes,
        };
      }

      case 'button':
        return {
          type: 'button',
          attrs: {
            ...baseAttrs,
            url: block.attrs.url as string,
            target: block.attrs.linkTarget as '_self' | '_blank',
            rel: block.attrs.rel as string,
          } as ButtonAttributes,
          content: this.extractTextContent(block.innerHTML),
        };

      case 'buttons':
        return {
          type: 'buttons',
          attrs: baseAttrs,
          children,
        };

      case 'row': // columns
        return {
          type: 'row',
          attrs: {
            ...baseAttrs,
            verticalAlignment: block.attrs.verticalAlignment as 'top' | 'center' | 'bottom',
          } as SectionAttributes,
          children,
        };

      case 'column':
        return {
          type: 'column',
          attrs: {
            ...baseAttrs,
            width: block.attrs.width as string,
            verticalAlignment: block.attrs.verticalAlignment as 'top' | 'center' | 'bottom',
          } as ColumnAttributes,
          children,
        };

      case 'group':
      case 'section': {
        const sectionAttrs: Record<string, unknown> = { ...baseAttrs };
        if (block.attrs.layout) {
          const layoutAttr = block.attrs.layout as Record<string, unknown>;
          sectionAttrs.layout = {
            display: layoutAttr.type === 'flex' ? 'flex' : undefined,
            flexDirection: layoutAttr.orientation === 'horizontal' ? 'row' : 'column',
            justifyContent: layoutAttr.justifyContent,
          };
        }
        return {
          type: type as 'group' | 'section',
          attrs: sectionAttrs as SectionAttributes,
          children,
        };
      }

      case 'list':
        return {
          type: 'list',
          attrs: {
            ...baseAttrs,
            ordered: block.attrs.ordered as boolean,
            start: block.attrs.start as number,
            reversed: block.attrs.reversed as boolean,
          } as ListAttributes,
          content: block.innerHTML,
        };

      case 'quote':
        return {
          type: 'quote',
          attrs: {
            ...baseAttrs,
            citation: block.attrs.citation as string,
          } as QuoteAttributes,
          content: block.innerHTML,
        };

      case 'embed':
        return {
          type: 'embed',
          attrs: {
            ...baseAttrs,
            url: (block.attrs.url as string) || '',
            provider: block.attrs.providerNameSlug as string,
            aspectRatio: block.attrs.aspectRatio as string,
          } as EmbedAttributes,
        };

      case 'separator': {
        const className = block.attrs.className as string | undefined;
        let separatorStyle: 'default' | 'wide' | 'dots' = 'default';
        if (className?.includes('is-style-wide')) separatorStyle = 'wide';
        else if (className?.includes('is-style-dots')) separatorStyle = 'dots';
        return {
          type: 'separator',
          attrs: {
            ...baseAttrs,
            style: separatorStyle,
          } as SeparatorAttributes,
        };
      }

      case 'spacer':
        return {
          type: 'spacer',
          attrs: {
            ...baseAttrs,
            height: (block.attrs.height as string) || '100px',
          } as SpacerAttributes,
        };

      case 'html':
        return {
          type: 'html',
          attrs: {
            ...baseAttrs,
            html: block.innerHTML,
          },
        };

      case 'code':
        return {
          type: 'code',
          attrs: baseAttrs,
          content: this.extractTextContent(block.innerHTML),
        };

      default:
        return {
          type: 'unknown',
          attrs: {
            ...baseAttrs,
            _builderData: {
              blockName: block.blockName,
              originalAttrs: block.attrs,
              innerHTML: block.innerHTML,
            },
          },
          children: children.length > 0 ? children : undefined,
        };
    }
  }

  // ---------------------------------------------------------------------------
  // Application (Neutral → Gutenberg)
  // ---------------------------------------------------------------------------

  /**
   * Apply neutral layout to generate Gutenberg content
   */
  applyLayout(layout: NeutralLayout, options: ConversionOptions = {}): ConversionResult<string> {
    const startTime = Date.now();
    const warnings: ConversionWarning[] = [];
    const unsupportedElements: string[] = [];

    // Convert elements to blocks
    const blocks: BlockSnapshot[] = [];
    for (const element of layout.elements) {
      const block = this.elementToBlock(element, warnings, unsupportedElements, options);
      if (block) {
        blocks.push(block);
      }
    }

    // Serialize blocks to WordPress format
    const content = serializeBlocks(blocks);

    return {
      data: content,
      success: true,
      warnings,
      unsupportedElements: unsupportedElements.length > 0 ? unsupportedElements : undefined,
      stats: {
        totalElements: this.countElements(layout.elements),
        convertedElements: countBlocks(blocks),
        skippedElements: 0,
        processingTime: Date.now() - startTime,
      },
    };
  }

  /**
   * Convert a neutral element to Gutenberg block
   */
  private elementToBlock(
    element: LayoutElement,
    warnings: ConversionWarning[],
    unsupportedElements: string[],
    options: ConversionOptions
  ): BlockSnapshot | null {
    const blockName = ELEMENT_TO_BLOCK_MAP[element.type] || 'core/html';

    // Convert children recursively
    const innerBlocks: BlockSnapshot[] = [];
    if (element.children) {
      for (const child of element.children) {
        const childBlock = this.elementToBlock(child, warnings, unsupportedElements, options);
        if (childBlock) {
          innerBlocks.push(childBlock);
        }
      }
    }

    // Build block based on element type
    return this.buildBlock(blockName, element, innerBlocks);
  }

  /**
   * Build a Gutenberg block from neutral element
   */
  private buildBlock(
    blockName: string,
    element: LayoutElement,
    innerBlocks: BlockSnapshot[]
  ): BlockSnapshot {
    const attrs: Record<string, unknown> = {};

    // Restore builder data if present
    if (element.attrs._builderData) {
      Object.assign(attrs, (element.attrs._builderData as any).originalAttrs || {});
    }

    // Apply common attributes
    if (element.attrs.className) {
      attrs.className = element.attrs.className;
    }
    if (element.attrs.anchor) {
      attrs.anchor = element.attrs.anchor;
    }

    // Build innerHTML based on element type
    let innerHTML = '';

    switch (element.type) {
      case 'heading': {
        const headingEl = element as { attrs: HeadingAttributes; content: string };
        attrs.level = headingEl.attrs.level;
        if (headingEl.attrs.typography?.textAlign) {
          attrs.textAlign = headingEl.attrs.typography.textAlign;
        }
        innerHTML = `<h${headingEl.attrs.level}>${headingEl.content}</h${headingEl.attrs.level}>`;
        break;
      }

      case 'paragraph':
      case 'text': {
        const textEl = element as { content: string };
        innerHTML = textEl.content.startsWith('<p>') ? textEl.content : `<p>${textEl.content}</p>`;
        break;
      }

      case 'image': {
        const imgEl = element as { attrs: ImageAttributes };
        attrs.url = imgEl.attrs.src;
        attrs.alt = imgEl.attrs.alt || '';
        if (imgEl.attrs.width) attrs.width = imgEl.attrs.width;
        if (imgEl.attrs.height) attrs.height = imgEl.attrs.height;
        if (imgEl.attrs.mediaId) attrs.id = imgEl.attrs.mediaId;
        if (imgEl.attrs.sizeSlug) attrs.sizeSlug = imgEl.attrs.sizeSlug;
        innerHTML = `<figure class="wp-block-image"><img src="${imgEl.attrs.src}" alt="${imgEl.attrs.alt || ''}"/></figure>`;
        break;
      }

      case 'button': {
        const btnEl = element as { attrs: ButtonAttributes; content: string };
        if (btnEl.attrs.url) attrs.url = btnEl.attrs.url;
        if (btnEl.attrs.target) attrs.linkTarget = btnEl.attrs.target;
        innerHTML = `<div class="wp-block-button"><a class="wp-block-button__link">${btnEl.content}</a></div>`;
        break;
      }

      case 'separator': {
        // Self-closing block
        const sepEl = element as { attrs: SeparatorAttributes };
        if (sepEl.attrs.style && sepEl.attrs.style !== 'default') {
          attrs.className = `is-style-${sepEl.attrs.style}`;
        }
        break;
      }

      case 'spacer': {
        const spacerEl = element as { attrs: SpacerAttributes };
        attrs.height = spacerEl.attrs.height;
        break;
      }

      case 'html': {
        const htmlEl = element as { attrs: { html: string } };
        innerHTML = htmlEl.attrs.html || '';
        break;
      }

      case 'code': {
        const codeEl = element as { content: string };
        innerHTML = `<pre class="wp-block-code"><code>${codeEl.content}</code></pre>`;
        break;
      }

      case 'list': {
        const listEl = element as { attrs: ListAttributes; content: string };
        if (listEl.attrs.ordered) attrs.ordered = true;
        innerHTML = listEl.content;
        break;
      }

      case 'quote': {
        const quoteEl = element as { attrs: QuoteAttributes; content: string };
        if (quoteEl.attrs.citation) attrs.citation = quoteEl.attrs.citation;
        innerHTML = `<blockquote class="wp-block-quote">${quoteEl.content}</blockquote>`;
        break;
      }

      case 'row':
      case 'column':
      case 'group':
      case 'section':
      case 'buttons':
        // Container blocks - innerHTML comes from inner blocks
        break;

      default:
        // Unknown elements become HTML blocks
        if ('content' in element) {
          innerHTML = (element as { content: string }).content;
        }
    }

    return {
      blockName,
      attrs,
      innerBlocks,
      innerHTML,
      innerContent: innerHTML ? [innerHTML] : [],
    };
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /**
   * Extract text content from HTML
   */
  private extractTextContent(html: string): string {
    // Simple HTML tag removal
    return html.replace(/<[^>]+>/g, '').trim();
  }

  /**
   * Extract image src from innerHTML
   */
  private extractImageSrc(html: string): string {
    const match = html.match(/src="([^"]+)"/);
    return match ? match[1] : '';
  }

  /**
   * Count total elements including nested
   */
  private countElements(elements: LayoutElement[]): number {
    let count = 0;
    for (const el of elements) {
      count++;
      if (el.children) {
        count += this.countElements(el.children);
      }
    }
    return count;
  }
}

/**
 * Singleton instance of GutenbergAdapter
 */
export const gutenbergAdapter = new GutenbergAdapter();
