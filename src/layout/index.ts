/**
 * Layout Module
 *
 * Exports neutral layout model types and utilities.
 *
 * @package WP_Navigator_Pro
 * @since 1.2.0
 */

export {
  // Version
  LAYOUT_VERSION,
  // Core types
  type LayoutElementType,
  type LayoutElement,
  type NeutralLayout,
  type LayoutSourceInfo,
  // Attribute types
  type LayoutAttributes,
  type SpacingValue,
  type BorderValue,
  type BackgroundValue,
  type TypographyValue,
  type LayoutPositionValue,
  type AnimationValue,
  // Element-specific attribute types
  type HeadingAttributes,
  type ImageAttributes,
  type VideoAttributes,
  type ButtonAttributes,
  type ListAttributes,
  type QuoteAttributes,
  type EmbedAttributes,
  type ColumnAttributes,
  type SectionAttributes,
  type SpacerAttributes,
  type SeparatorAttributes,
  type HtmlAttributes,
  type ShortcodeAttributes,
  // Base types
  type LayoutElementBase,
  type TextLayoutElement,
  // Type guards
  hasTextContent,
  hasChildren,
  isStructuralElement,
  isContentElement,
  isMediaElement,
  isNeutralLayout,
  // Factory functions
  createEmptyLayout,
  createHeading,
  createParagraph,
  createImage,
  createButton,
  createSection,
  createColumn,
  createRow,
} from './types.js';
