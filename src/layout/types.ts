/**
 * Neutral Layout Model Types
 *
 * Builder-agnostic layout representation enabling translation between
 * WordPress page builders (Gutenberg, Elementor, Divi, etc.).
 *
 * @package WP_Navigator_Pro
 * @since 1.2.0
 */

/**
 * Current layout schema version
 */
export const LAYOUT_VERSION = '1.0';

// =============================================================================
// Core Layout Element Types
// =============================================================================

/**
 * All supported neutral layout element types
 */
export type LayoutElementType =
  // Structural
  | 'section'
  | 'container'
  | 'row'
  | 'column'
  | 'group'
  // Content
  | 'heading'
  | 'paragraph'
  | 'text'
  | 'list'
  | 'quote'
  | 'code'
  // Media
  | 'image'
  | 'video'
  | 'audio'
  | 'gallery'
  | 'embed'
  // Interactive
  | 'button'
  | 'buttons'
  | 'form'
  | 'input'
  // Special
  | 'separator'
  | 'spacer'
  | 'html'
  | 'shortcode'
  | 'unknown';

// =============================================================================
// Layout Attributes (Styling Hints)
// =============================================================================

/**
 * Spacing values (padding, margin, gap)
 */
export interface SpacingValue {
  top?: string;
  right?: string;
  bottom?: string;
  left?: string;
}

/**
 * Border configuration
 */
export interface BorderValue {
  width?: string;
  style?: 'solid' | 'dashed' | 'dotted' | 'none';
  color?: string;
  radius?: string;
}

/**
 * Background configuration
 */
export interface BackgroundValue {
  color?: string;
  gradient?: string;
  image?: string;
  position?: string;
  size?: 'cover' | 'contain' | 'auto' | string;
  repeat?: 'repeat' | 'no-repeat' | 'repeat-x' | 'repeat-y';
  attachment?: 'scroll' | 'fixed';
  overlay?: string;
}

/**
 * Typography configuration
 */
export interface TypographyValue {
  fontFamily?: string;
  fontSize?: string;
  fontWeight?: string | number;
  fontStyle?: 'normal' | 'italic';
  lineHeight?: string;
  letterSpacing?: string;
  textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
  textDecoration?: 'none' | 'underline' | 'line-through';
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  color?: string;
}

/**
 * Layout/positioning configuration
 */
export interface LayoutPositionValue {
  width?: string;
  maxWidth?: string;
  minWidth?: string;
  height?: string;
  maxHeight?: string;
  minHeight?: string;
  display?: 'block' | 'flex' | 'grid' | 'inline' | 'inline-block' | 'none';
  flexDirection?: 'row' | 'column' | 'row-reverse' | 'column-reverse';
  justifyContent?: 'flex-start' | 'flex-end' | 'center' | 'space-between' | 'space-around';
  alignItems?: 'flex-start' | 'flex-end' | 'center' | 'stretch' | 'baseline';
  gap?: string;
  position?: 'static' | 'relative' | 'absolute' | 'fixed' | 'sticky';
  zIndex?: number;
}

/**
 * Animation/interaction configuration
 */
export interface AnimationValue {
  type?: 'fade' | 'slide' | 'zoom' | 'bounce' | 'flip' | 'none';
  direction?: 'up' | 'down' | 'left' | 'right';
  duration?: string;
  delay?: string;
  easing?: string;
}

/**
 * Common attributes shared by all layout elements
 */
export interface LayoutAttributes {
  // Identification
  id?: string;
  className?: string;
  anchor?: string;

  // Spacing
  padding?: SpacingValue | string;
  margin?: SpacingValue | string;

  // Border
  border?: BorderValue;

  // Background
  background?: BackgroundValue;

  // Typography (for text elements)
  typography?: TypographyValue;

  // Layout
  layout?: LayoutPositionValue;

  // Animation
  animation?: AnimationValue;

  // Responsive overrides
  responsive?: {
    tablet?: Partial<LayoutAttributes>;
    mobile?: Partial<LayoutAttributes>;
  };

  // Builder-specific data (preserved during round-trip)
  _builderData?: Record<string, unknown>;
}

// =============================================================================
// Content-Specific Attributes
// =============================================================================

/**
 * Heading element attributes
 */
export interface HeadingAttributes extends LayoutAttributes {
  level: 1 | 2 | 3 | 4 | 5 | 6;
}

/**
 * Image element attributes
 */
export interface ImageAttributes extends LayoutAttributes {
  src: string;
  alt?: string;
  title?: string;
  width?: number;
  height?: number;
  caption?: string;
  linkUrl?: string;
  linkTarget?: '_self' | '_blank';
  sizeSlug?: string;
  mediaId?: number;
}

/**
 * Video element attributes
 */
export interface VideoAttributes extends LayoutAttributes {
  src?: string;
  poster?: string;
  autoplay?: boolean;
  loop?: boolean;
  muted?: boolean;
  controls?: boolean;
  embedUrl?: string;
}

/**
 * Button element attributes
 */
export interface ButtonAttributes extends LayoutAttributes {
  url?: string;
  target?: '_self' | '_blank';
  rel?: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'text';
  size?: 'small' | 'medium' | 'large';
}

/**
 * List element attributes
 */
export interface ListAttributes extends LayoutAttributes {
  ordered?: boolean;
  start?: number;
  reversed?: boolean;
}

/**
 * Quote element attributes
 */
export interface QuoteAttributes extends LayoutAttributes {
  citation?: string;
  citationUrl?: string;
}

/**
 * Embed element attributes
 */
export interface EmbedAttributes extends LayoutAttributes {
  url: string;
  provider?: string;
  providerSlug?: string;
  aspectRatio?: string;
}

/**
 * Column element attributes
 */
export interface ColumnAttributes extends LayoutAttributes {
  width?: string;
  verticalAlignment?: 'top' | 'center' | 'bottom' | 'stretch';
}

/**
 * Section/row element attributes
 */
export interface SectionAttributes extends LayoutAttributes {
  fullWidth?: boolean;
  verticalAlignment?: 'top' | 'center' | 'bottom';
  contentWidth?: string;
}

/**
 * Spacer element attributes
 */
export interface SpacerAttributes extends LayoutAttributes {
  height: string;
}

/**
 * Separator element attributes
 */
export interface SeparatorAttributes extends LayoutAttributes {
  style?: 'default' | 'wide' | 'dots';
}

/**
 * HTML element attributes
 */
export interface HtmlAttributes extends LayoutAttributes {
  html: string;
}

/**
 * Shortcode element attributes
 */
export interface ShortcodeAttributes extends LayoutAttributes {
  shortcode: string;
  tag: string;
  atts?: Record<string, string>;
}

// =============================================================================
// Layout Element Definition
// =============================================================================

/**
 * Base layout element (abstract)
 */
export interface LayoutElementBase<T extends LayoutElementType, A extends LayoutAttributes = LayoutAttributes> {
  /** Element type identifier */
  type: T;
  /** Element attributes (styling hints) */
  attrs: A;
  /** Child elements (for containers) */
  children?: LayoutElement[];
}

/**
 * Text content for simple elements
 */
export interface TextLayoutElement<T extends LayoutElementType, A extends LayoutAttributes = LayoutAttributes>
  extends LayoutElementBase<T, A> {
  /** Text/HTML content */
  content: string;
}

/**
 * All layout element types with their specific interfaces
 */
export type LayoutElement =
  // Structural (children only)
  | LayoutElementBase<'section', SectionAttributes>
  | LayoutElementBase<'container', LayoutAttributes>
  | LayoutElementBase<'row', SectionAttributes>
  | LayoutElementBase<'column', ColumnAttributes>
  | LayoutElementBase<'group', LayoutAttributes>
  // Content (with text content)
  | TextLayoutElement<'heading', HeadingAttributes>
  | TextLayoutElement<'paragraph'>
  | TextLayoutElement<'text'>
  | TextLayoutElement<'list', ListAttributes>
  | TextLayoutElement<'quote', QuoteAttributes>
  | TextLayoutElement<'code'>
  // Media (with specific attrs)
  | LayoutElementBase<'image', ImageAttributes>
  | LayoutElementBase<'video', VideoAttributes>
  | LayoutElementBase<'audio', LayoutAttributes>
  | LayoutElementBase<'gallery', LayoutAttributes>
  | LayoutElementBase<'embed', EmbedAttributes>
  // Interactive
  | TextLayoutElement<'button', ButtonAttributes>
  | LayoutElementBase<'buttons', LayoutAttributes>
  | LayoutElementBase<'form', LayoutAttributes>
  | LayoutElementBase<'input', LayoutAttributes>
  // Special
  | LayoutElementBase<'separator', SeparatorAttributes>
  | LayoutElementBase<'spacer', SpacerAttributes>
  | LayoutElementBase<'html', HtmlAttributes>
  | LayoutElementBase<'shortcode', ShortcodeAttributes>
  | LayoutElementBase<'unknown', LayoutAttributes>;

// =============================================================================
// Layout Document
// =============================================================================

/**
 * Source builder information
 */
export interface LayoutSourceInfo {
  /** Builder name (gutenberg, elementor, divi, etc.) */
  builder: string;
  /** Builder version */
  builderVersion?: string;
  /** Original format version */
  formatVersion?: string;
}

/**
 * Complete neutral layout document
 *
 * Represents a page/post's content in builder-agnostic format.
 */
export interface NeutralLayout {
  /** Schema version for migrations */
  layout_version: typeof LAYOUT_VERSION;
  /** Source builder information */
  source: LayoutSourceInfo;
  /** Root layout elements */
  elements: LayoutElement[];
  /** Global styles (CSS variables, theme colors) */
  globalStyles?: {
    colors?: Record<string, string>;
    fonts?: Record<string, string>;
    spacing?: Record<string, string>;
  };
  /** Preserved builder-specific metadata */
  _builderMetadata?: Record<string, unknown>;
}

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Check if element has text content
 */
export function hasTextContent(element: LayoutElement): element is LayoutElement & { content: string } {
  return 'content' in element && typeof (element as any).content === 'string';
}

/**
 * Check if element has children
 */
export function hasChildren(element: LayoutElement): boolean {
  return Array.isArray(element.children) && element.children.length > 0;
}

/**
 * Check if element is structural (container)
 */
export function isStructuralElement(element: LayoutElement): boolean {
  const structuralTypes: LayoutElementType[] = ['section', 'container', 'row', 'column', 'group', 'buttons'];
  return structuralTypes.includes(element.type);
}

/**
 * Check if element is content (text-based)
 */
export function isContentElement(element: LayoutElement): boolean {
  const contentTypes: LayoutElementType[] = ['heading', 'paragraph', 'text', 'list', 'quote', 'code'];
  return contentTypes.includes(element.type);
}

/**
 * Check if element is media
 */
export function isMediaElement(element: LayoutElement): boolean {
  const mediaTypes: LayoutElementType[] = ['image', 'video', 'audio', 'gallery', 'embed'];
  return mediaTypes.includes(element.type);
}

/**
 * Check if value is a valid NeutralLayout
 */
export function isNeutralLayout(value: unknown): value is NeutralLayout {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.layout_version === 'string' &&
    typeof obj.source === 'object' &&
    Array.isArray(obj.elements)
  );
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create an empty neutral layout
 */
export function createEmptyLayout(builder: string = 'unknown'): NeutralLayout {
  return {
    layout_version: LAYOUT_VERSION,
    source: { builder },
    elements: [],
  };
}

/**
 * Create a heading element
 */
export function createHeading(level: 1 | 2 | 3 | 4 | 5 | 6, content: string, attrs?: Partial<HeadingAttributes>): TextLayoutElement<'heading', HeadingAttributes> {
  return {
    type: 'heading',
    attrs: { level, ...attrs },
    content,
  };
}

/**
 * Create a paragraph element
 */
export function createParagraph(content: string, attrs?: LayoutAttributes): TextLayoutElement<'paragraph'> {
  return {
    type: 'paragraph',
    attrs: attrs || {},
    content,
  };
}

/**
 * Create an image element
 */
export function createImage(src: string, attrs?: Partial<ImageAttributes>): LayoutElementBase<'image', ImageAttributes> {
  return {
    type: 'image',
    attrs: { src, ...attrs },
  };
}

/**
 * Create a button element
 */
export function createButton(content: string, attrs?: Partial<ButtonAttributes>): TextLayoutElement<'button', ButtonAttributes> {
  return {
    type: 'button',
    attrs: attrs || {},
    content,
  };
}

/**
 * Create a section element with children
 */
export function createSection(children: LayoutElement[], attrs?: Partial<SectionAttributes>): LayoutElementBase<'section', SectionAttributes> {
  return {
    type: 'section',
    attrs: attrs || {},
    children,
  };
}

/**
 * Create a column element
 */
export function createColumn(children: LayoutElement[], attrs?: Partial<ColumnAttributes>): LayoutElementBase<'column', ColumnAttributes> {
  return {
    type: 'column',
    attrs: attrs || {},
    children,
  };
}

/**
 * Create a row element with columns
 */
export function createRow(columns: LayoutElementBase<'column', ColumnAttributes>[], attrs?: Partial<SectionAttributes>): LayoutElementBase<'row', SectionAttributes> {
  return {
    type: 'row',
    attrs: attrs || {},
    children: columns,
  };
}
