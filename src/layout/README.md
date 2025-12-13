# Neutral Layout Model

Builder-agnostic layout representation for WP Navigator MCP.

## Overview

The neutral layout model enables translation between WordPress page builders (Gutenberg, Elementor, Divi). It provides a common format that preserves structure, styling, and content while abstracting away builder-specific details.

## Usage

```typescript
import {
  createEmptyLayout,
  createSection,
  createHeading,
  createParagraph,
  createRow,
  createColumn,
  type NeutralLayout,
} from './layout/index.js';

// Create a layout programmatically
const layout: NeutralLayout = {
  layout_version: '1.0',
  source: { builder: 'gutenberg' },
  elements: [
    createSection([
      createHeading(1, 'Welcome'),
      createParagraph('Lorem ipsum dolor sit amet.'),
      createRow([
        createColumn([createParagraph('Left')], { width: '50%' }),
        createColumn([createParagraph('Right')], { width: '50%' }),
      ]),
    ]),
  ],
};
```

## Element Types

### Structural Elements
| Type | Description | Children |
|------|-------------|----------|
| `section` | Top-level page section | Yes |
| `container` | Content width wrapper | Yes |
| `row` | Horizontal layout | Yes (columns) |
| `column` | Column within row | Yes |
| `group` | Generic grouping | Yes |

### Content Elements
| Type | Description | Content |
|------|-------------|---------|
| `heading` | Heading (H1-H6) | Text (level attr) |
| `paragraph` | Text paragraph | HTML/Text |
| `text` | Inline text | HTML/Text |
| `list` | Ordered/unordered list | HTML |
| `quote` | Blockquote | Text |
| `code` | Code block | Text |

### Media Elements
| Type | Description | Key Attributes |
|------|-------------|----------------|
| `image` | Image | src, alt, caption |
| `video` | Video | src, poster, autoplay |
| `audio` | Audio player | src |
| `gallery` | Image gallery | (children) |
| `embed` | External embed | url, provider |

### Interactive Elements
| Type | Description | Key Attributes |
|------|-------------|----------------|
| `button` | Button/CTA | url, variant |
| `buttons` | Button group | (children) |
| `form` | Form container | (children) |
| `input` | Form input | type |

### Special Elements
| Type | Description | Key Attributes |
|------|-------------|----------------|
| `separator` | Horizontal rule | style |
| `spacer` | Vertical spacing | height |
| `html` | Raw HTML | html |
| `shortcode` | WP shortcode | shortcode, tag |
| `unknown` | Unknown element | _builderData |

## Attributes

All elements support common attributes for styling:

```typescript
interface LayoutAttributes {
  // Identification
  id?: string;
  className?: string;
  anchor?: string;

  // Spacing
  padding?: SpacingValue;
  margin?: SpacingValue;

  // Visual
  border?: BorderValue;
  background?: BackgroundValue;
  typography?: TypographyValue;

  // Layout
  layout?: LayoutPositionValue;

  // Animation
  animation?: AnimationValue;

  // Responsive
  responsive?: {
    tablet?: Partial<LayoutAttributes>;
    mobile?: Partial<LayoutAttributes>;
  };

  // Builder preservation
  _builderData?: Record<string, unknown>;
}
```

### Spacing Values

```typescript
interface SpacingValue {
  top?: string;
  right?: string;
  bottom?: string;
  left?: string;
}

// Usage
{ padding: { top: '20px', bottom: '20px' } }
{ margin: '10px' } // shorthand also supported
```

### Background Values

```typescript
interface BackgroundValue {
  color?: string;
  gradient?: string;
  image?: string;
  position?: string;
  size?: 'cover' | 'contain' | 'auto';
  repeat?: 'repeat' | 'no-repeat';
  attachment?: 'scroll' | 'fixed';
  overlay?: string;
}
```

### Typography Values

```typescript
interface TypographyValue {
  fontFamily?: string;
  fontSize?: string;
  fontWeight?: string | number;
  lineHeight?: string;
  letterSpacing?: string;
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  color?: string;
}
```

## Type Guards

```typescript
import {
  hasTextContent,
  hasChildren,
  isStructuralElement,
  isContentElement,
  isMediaElement,
  isNeutralLayout,
} from './layout/index.js';

// Check element type
if (hasTextContent(element)) {
  console.log(element.content);
}

if (hasChildren(element)) {
  element.children.forEach(processChild);
}

// Validate layout object
if (isNeutralLayout(data)) {
  console.log(`Builder: ${data.source.builder}`);
}
```

## Factory Functions

Convenience functions for creating elements:

```typescript
import {
  createEmptyLayout,
  createHeading,
  createParagraph,
  createImage,
  createButton,
  createSection,
  createColumn,
  createRow,
} from './layout/index.js';

// Create layout
const layout = createEmptyLayout('gutenberg');

// Create elements
const h1 = createHeading(1, 'Title');
const para = createParagraph('Content', { className: 'intro' });
const img = createImage('photo.jpg', { alt: 'Photo', width: 800 });
const btn = createButton('Learn More', { url: '/about', variant: 'primary' });

// Create nested structures
const section = createSection([h1, para], {
  background: { color: '#f5f5f5' },
});

const twoColumn = createRow([
  createColumn([createParagraph('Left')], { width: '50%' }),
  createColumn([createParagraph('Right')], { width: '50%' }),
]);
```

## Builder Round-Trip

The model preserves builder-specific data during conversion:

```typescript
const layout: NeutralLayout = {
  layout_version: '1.0',
  source: {
    builder: 'elementor',
    builderVersion: '3.18.0',
  },
  elements: [
    {
      type: 'section',
      attrs: {
        _builderData: {
          elementor_id: 'abc123',
          custom_css: '.custom { color: red; }',
        },
      },
      children: [],
    },
  ],
  _builderMetadata: {
    page_settings: { template: 'elementor_header_footer' },
  },
};
```

The `_builderData` and `_builderMetadata` fields are preserved during round-trip conversion, allowing builders to restore original settings.

## Future Adapters

The neutral layout model enables future builder adapters:

- **GutenbergAdapter** - Convert Gutenberg blocks ↔ neutral layout
- **ElementorAdapter** - Convert Elementor widgets ↔ neutral layout
- **DiviAdapter** - Convert Divi modules ↔ neutral layout

Each adapter implements the `BuilderAdapter` interface for bidirectional conversion.
