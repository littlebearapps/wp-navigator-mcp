---
name: elementor-cookbook
description: Best practices for editing Elementor pages via WP Navigator MCP. Use when working with pages that have data-elementor-type markers or _elementor_data post meta.
allowed-tools: "wpnav_get_page,wpnav_update_page,wpnav_snapshot_page,wpnav_list_pages,wpnav_elementor_list_elements,wpnav_elementor_update_widget,wpnav_elementor_insert_element,wpnav_elementor_delete_element,wpnav_elementor_move_element,wpnav_elementor_regenerate_css,wpnav_elementor_use_preset"
version: "1.0.0"
min-plugin-version: "3.20.0"
requires-wpnav-pro: "1.9.0"
---

# Elementor Cookbook

## Overview

Elementor is a visual page builder used on 16M+ WordPress sites. It stores page content as JSON in the `_elementor_data` post meta field, NOT in the standard WordPress `post_content` field.

Key differences from Gutenberg:
- Content stored as JSON in post meta
- Element-based hierarchy (Container > Widget)
- Requires CSS regeneration after changes
- Pro version adds Theme Builder, Popup Builder, and more widgets

## Detection

Pages using Elementor have these markers:
- HTML contains `data-elementor-type="wp-page"` or `data-elementor-type="wp-post"`
- `wpnav_snapshot_page` returns `pageBuilder: "elementor"`
- Post meta includes `_elementor_data` key
- Related meta: `_elementor_version`, `_elementor_edit_mode`, `_elementor_page_settings`

## Data Structure

### Storage Location

- **Meta key**: `_elementor_data`
- **Format**: JSON string (must be parsed)
- **Structure**: Array of top-level elements

### Element Hierarchy

Modern Elementor uses a flat container model:

```
Document
└── Container (elType: "container")
    └── Widget (elType: "widget", widgetType: "heading")
```

Legacy pages may use sections/columns:
```
Document
└── Section (elType: "section")
    └── Column (elType: "column")
        └── Widget (elType: "widget")
```

### Element Structure

```json
{
  "id": "7a8b9c0d",
  "elType": "container|section|column|widget",
  "widgetType": "heading|text-editor|image|button|...",
  "isInner": false,
  "settings": {
    "title": "Hello World",
    "align": "center"
  },
  "elements": []
}
```

- `id`: Unique 7-8 character hex string
- `elType`: Element type (container, section, column, widget)
- `widgetType`: Widget type (only for widgets)
- `settings`: Widget-specific configuration
- `elements`: Child elements (for containers only)

### Element Paths

Elements are addressed by path arrays:
- `[0]` - First top-level container
- `[0,0]` - First widget in first container
- `[0,1]` - Second widget in first container
- `[1,2,0]` - First widget in third child of second container

## Core Widgets Reference

### Text Widgets

| Widget | Type | Purpose | Key Settings |
|--------|------|---------|--------------|
| Heading | `heading` | H1-H6 headings | `title`, `header_size`, `align`, `link` |
| Text Editor | `text-editor` | Rich text (WYSIWYG) | `editor` (HTML content), `align` |

### Media Widgets

| Widget | Type | Purpose | Key Settings |
|--------|------|---------|--------------|
| Image | `image` | Single image | `image.url`, `image.id`, `image_size`, `link_to`, `caption` |
| Video | `video` | YouTube/Vimeo/hosted | `video_type`, `youtube_url`, `vimeo_url`, `autoplay`, `controls` |
| Gallery | `gallery` | Image gallery | `gallery` (array), `gallery_columns`, `gallery_link` |

### Interactive Widgets

| Widget | Type | Purpose | Key Settings |
|--------|------|---------|--------------|
| Button | `button` | Clickable button | `text`, `link.url`, `size`, `button_type`, `icon` |
| Icon | `icon` | Icon display | `selected_icon`, `view`, `shape`, `link` |

### Structure Widgets

| Widget | Type | Purpose | Key Settings |
|--------|------|---------|--------------|
| Divider | `divider` | Horizontal line | `style`, `weight`, `color`, `width` |
| Spacer | `spacer` | Vertical spacing | `space.size`, `space.unit` |

### Content Widgets

| Widget | Type | Purpose | Key Settings |
|--------|------|---------|--------------|
| Icon Box | `icon-box` | Icon + title + description | `selected_icon`, `title_text`, `description_text`, `position` |
| Image Box | `image-box` | Image + title + description | `image`, `title_text`, `description_text`, `position` |
| Star Rating | `star-rating` | Star ratings | `rating_scale`, `rating`, `title` |
| Testimonial | `testimonial` | Quote with author | `testimonial_content`, `testimonial_name`, `testimonial_job`, `testimonial_image` |

### Accordion/Tabs Widgets

| Widget | Type | Purpose | Key Settings |
|--------|------|---------|--------------|
| Tabs | `tabs` | Horizontal tabs | `tabs` (array with `tab_title`, `tab_content`), `type` |
| Accordion | `accordion` | Collapsible sections | `tabs` (array), `faq_schema`, `icon`, `icon_active` |
| Toggle | `toggle` | Expandable toggles | `tabs` (array), `faq_schema` |

### Social Widgets

| Widget | Type | Purpose | Key Settings |
|--------|------|---------|--------------|
| Social Icons | `social-icons` | Social media links | `social_icon_list` (array), `shape`, `columns` |
| Icon List | `icon-list` | Bulleted list with icons | `icon_list` (array), `view` |

### Utility Widgets

| Widget | Type | Purpose | Key Settings |
|--------|------|---------|--------------|
| Alert | `alert` | Notification banner | `alert_title`, `alert_type`, `alert_description`, `show_dismiss` |
| Counter | `counter` | Animated number | `starting_number`, `ending_number`, `prefix`, `suffix`, `duration` |
| Progress | `progress` | Progress bar | `title`, `percent.size`, `display_percentage` |

### Embed Widgets

| Widget | Type | Purpose | Key Settings |
|--------|------|---------|--------------|
| HTML | `html` | Raw HTML code | `html` |
| Shortcode | `shortcode` | WordPress shortcode | `shortcode` |
| Google Maps | `google_maps` | Map embed | `address`, `zoom.size`, `height.size` |

### Container Settings

Containers support these settings:

| Setting | Values | Purpose |
|---------|--------|---------|
| `content_width` | `boxed`, `full` | Container width |
| `flex_direction` | `row`, `column` | Child arrangement |
| `flex_wrap` | `nowrap`, `wrap` | Line wrapping |
| `justify_content` | `flex-start`, `center`, `flex-end`, `space-between`, `space-around` | Horizontal alignment |
| `align_items` | `flex-start`, `center`, `flex-end`, `stretch` | Vertical alignment |
| `gap` | `{column, row, unit}` | Spacing between children |
| `min_height` | `{size, unit}` | Minimum height |
| `padding` | `{top, right, bottom, left, unit}` | Inner spacing |
| `background_background` | `classic`, `gradient` | Background type |
| `background_color` | Hex color | Background color |

## Template System

### Global Templates

Elementor templates are reusable design components:
- **Sections**: Single row/container templates
- **Pages**: Full page layouts
- **Popups** (Pro): Modal windows
- **Archive** (Pro): Post listing templates
- **Single** (Pro): Individual post templates

### Using Templates

1. Templates stored as `elementor_library` post type
2. Import template content into page
3. Customize as needed

### Saved Sections

Save any section as a template:
1. Design the section
2. Right-click > Save as Template
3. Reuse via Templates panel

## Theme Builder Workflows (Pro)

Theme Builder creates global templates for WordPress template parts.

### Header Template

1. Create new Header template
2. Design with Site Logo, Navigation, etc.
3. Set display conditions (entire site / specific pages)
4. Overrides theme header

### Footer Template

1. Create new Footer template
2. Add widgets, copyright, social links
3. Set display conditions
4. Overrides theme footer

### Single Post Template

1. Create new Single template
2. Use Post Title, Post Content, Featured Image widgets
3. Condition: Posts / specific category
4. Overrides theme's single.php

### Archive Template

1. Create new Archive template
2. Use Posts widget or Loop Grid
3. Condition: Archives / specific taxonomy
4. Overrides theme's archive.php

## Common Tasks

### Update a Heading

```
wpnav_elementor_update_widget post_id=13 element_id="a307a29" settings={"title": "Welcome to WPNav.ai", "header_size": "h1"}
```

### Add a Button

```
wpnav_elementor_insert_element post_id=13 path=[0,1] element_type="widget" widget_type="button" settings={"text": "Get Started", "link": {"url": "/pricing"}}
```

### Create a Hero Section

```
wpnav_elementor_use_preset post_id=13 path=[0] preset_name="hero_section" customizations={
  "heading": "AI-Powered WordPress",
  "subheading": "Manage your site with confidence",
  "button_text": "Get Started Free",
  "button_url": "/pricing/"
}
```

### Add an FAQ Accordion

```
wpnav_elementor_insert_element post_id=13 path=[0,2] element_type="widget" widget_type="accordion" settings={
  "tabs": [
    {"tab_title": "What is WP Navigator?", "tab_content": "WP Navigator is an AI-powered WordPress management tool."},
    {"tab_title": "How does it work?", "tab_content": "It connects AI assistants to your WordPress site via MCP."},
    {"tab_title": "Is it secure?", "tab_content": "Yes, it uses WordPress Application Passwords and HTTPS."}
  ],
  "faq_schema": true
}
```

### Delete an Element

```
wpnav_elementor_delete_element post_id=13 element_id="xyz789"
```

### Move an Element

```
wpnav_elementor_move_element post_id=13 element_id="abc123" to_path=[1,0]
```

### Regenerate CSS After Batch Operations

```
wpnav_elementor_regenerate_css post_id=13
```

## Common Pitfalls

### Don't Edit the `post_content` Field

Elementor ignores the WordPress `post_content` field for rendering. Changes to `post_content` won't appear on the page.

Always use Elementor tools to modify `_elementor_data`.

### Don't Guess Element IDs

Element IDs are randomly generated 7-8 character hex strings (e.g., `6af611eb`, `a307a29`).

Always get IDs from:
- `wpnav_snapshot_page` response
- `wpnav_elementor_list_elements` response

### Don't Forget CSS Regeneration

After modifying `_elementor_data` directly, CSS must be regenerated:
- Elementor tools handle this automatically with `auto_css=true` (default)
- For batch operations with `auto_css=false`, call `wpnav_elementor_regenerate_css` at the end

### Don't Use Legacy Section/Column Structure

Modern Elementor (3.6+) uses Flexbox Containers:

Legacy (avoid):
```
Section > Column > Widget
```

Modern (use):
```
Container > Widget
Container > Container > Widget
```

Only use section/column if the page already uses them.

### Don't Mix Container and Section Structure

Within a single page, stick to one structure type. Mixing can cause layout issues.

### Don't Forget Required Settings

Each widget has required settings. Check the widget schema before insertion:
- `heading` requires `title`
- `button` requires `text`
- `image` requires `image` object

### Don't Create Widgets Inside Widgets

Widgets cannot contain child elements. Only containers can have children:

Invalid:
```
Widget > Widget
```

Valid:
```
Container > Widget
Container > Widget
```

## Error Handling

| Error Code | Description | Resolution |
|------------|-------------|------------|
| `WIDGET_NOT_FOUND` | Widget type doesn't exist | Check `wpnav_elementor_introspect` for valid types |
| `ELEMENT_NOT_FOUND` | Element ID not in page | Refresh element list |
| `INVALID_PATH` | Path leads to non-existent location | Check page structure first |
| `MISSING_REQUIRED` | Required setting not provided | Refer to widget schema |
| `NESTING_ERROR` | Widget placed inside widget | Widgets cannot contain children |
| `CSS_REGEN_FAILED` | CSS regeneration failed | Check Elementor installation |

## Resources

- Elementor Developer Docs: https://developers.elementor.com/docs/
- Widget Documentation: https://developers.elementor.com/docs/widgets/
- Container Tutorial: https://elementor.com/help/flexbox-containers/
- Theme Builder Guide: https://elementor.com/help/theme-builder/
