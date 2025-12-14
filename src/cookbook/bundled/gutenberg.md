---
name: gutenberg-cookbook
description: Best practices for creating and editing content with the WordPress Block Editor (Gutenberg). Use when working with block-based pages and posts.
allowed-tools: "wpnav_list_posts,wpnav_get_post,wpnav_create_post,wpnav_update_post,wpnav_list_pages,wpnav_get_page,wpnav_create_page,wpnav_update_page,wpnav_snapshot_page,wpnav_gutenberg_list_blocks,wpnav_gutenberg_insert_block,wpnav_gutenberg_update_block,wpnav_gutenberg_delete_block,wpnav_gutenberg_insert_pattern"
version: "1.0.0"
min-plugin-version: "6.0"
---

# Gutenberg Cookbook

## Overview

Gutenberg is the default WordPress block editor, introduced in WordPress 5.0. It stores content as HTML with block delimiters (comments marking block boundaries) in the standard `post_content` field.

Unlike page builders (Elementor, WPBakery), Gutenberg content remains accessible as HTML even without the editor active.

## Detection

Pages/posts using Gutenberg have these markers:
- Content contains `<!-- wp:` block delimiters
- `wpnav_snapshot_page` returns `pageBuilder: "gutenberg"` or `pageBuilder: null`
- No `_elementor_data` or similar page builder meta

## Data Structure

### Block Format

Blocks are stored as HTML comments wrapping content:

```html
<!-- wp:paragraph -->
<p>Hello world</p>
<!-- /wp:paragraph -->

<!-- wp:heading {"level":2} -->
<h2>My Heading</h2>
<!-- /wp:heading -->

<!-- wp:image {"id":123,"sizeSlug":"large"} -->
<figure class="wp-block-image size-large">
  <img src="image.jpg" alt=""/>
</figure>
<!-- /wp:image -->
```

### Block Attributes

Block attributes are JSON inside the opening comment:
- `{"level":2}` - heading level
- `{"id":123,"sizeSlug":"large"}` - image settings
- `{"columns":3}` - column count

## Core Blocks Reference

### Text Blocks

| Block | Name | Purpose | Key Attributes |
|-------|------|---------|----------------|
| Paragraph | `core/paragraph` | Basic text | `align`, `dropCap`, `fontSize` |
| Heading | `core/heading` | H1-H6 headings | `level`, `textAlign` |
| List | `core/list` | Ordered/unordered lists | `ordered`, `values` |
| Quote | `core/quote` | Block quotes | `citation`, `align` |
| Code | `core/code` | Code snippets | - |
| Preformatted | `core/preformatted` | Preserves whitespace | - |
| Pullquote | `core/pullquote` | Highlighted quotes | `citation`, `textAlign` |
| Verse | `core/verse` | Poetry/lyrics | `textAlign` |

### Media Blocks

| Block | Name | Purpose | Key Attributes |
|-------|------|---------|----------------|
| Image | `core/image` | Single image | `id`, `url`, `alt`, `sizeSlug`, `linkDestination` |
| Gallery | `core/gallery` | Image gallery | `images`, `columns`, `linkTo` |
| Audio | `core/audio` | Audio player | `src`, `autoplay`, `loop` |
| Video | `core/video` | Video player | `src`, `autoplay`, `controls`, `loop`, `muted` |
| Cover | `core/cover` | Image/video with overlay | `url`, `dimRatio`, `overlayColor`, `minHeight` |
| File | `core/file` | Downloadable file | `href`, `fileName`, `showDownloadButton` |
| Media & Text | `core/media-text` | Side-by-side layout | `mediaId`, `mediaPosition`, `mediaType` |

### Design Blocks

| Block | Name | Purpose | Key Attributes |
|-------|------|---------|----------------|
| Buttons | `core/buttons` | Button group container | `layout` |
| Button | `core/button` | Single button | `text`, `url`, `linkTarget`, `backgroundColor` |
| Columns | `core/columns` | Multi-column layout | `columns` (contains `core/column`) |
| Column | `core/column` | Individual column | `width` |
| Group | `core/group` | Container wrapper | `layout`, `tagName` |
| Row | `core/row` | Horizontal flex layout | `layout` |
| Stack | `core/stack` | Vertical flex layout | `layout` |
| Separator | `core/separator` | Horizontal line | `style` |
| Spacer | `core/spacer` | Vertical spacing | `height` |

### Widget Blocks

| Block | Name | Purpose | Key Attributes |
|-------|------|---------|----------------|
| Shortcode | `core/shortcode` | Legacy shortcode | `text` |
| Archives | `core/archives` | Archive links | `displayAsDropdown`, `showPostCounts` |
| Calendar | `core/calendar` | Date calendar | - |
| Categories | `core/categories` | Category list | `displayAsDropdown`, `showHierarchy`, `showPostCounts` |
| Latest Posts | `core/latest-posts` | Recent posts list | `postsToShow`, `displayPostDate`, `displayFeaturedImage` |
| Latest Comments | `core/latest-comments` | Recent comments | `commentsToShow` |
| Page List | `core/page-list` | Site pages list | `parentPageID`, `isNested` |
| RSS | `core/rss` | RSS feed items | `feedURL`, `itemsToShow` |
| Search | `core/search` | Search form | `label`, `buttonText`, `buttonPosition` |
| Tag Cloud | `core/tag-cloud` | Tag list | `taxonomy`, `showTagCounts` |
| Social Links | `core/social-links` | Social media links | `iconColor`, `iconColorValue` |

### Theme Blocks (Full Site Editing)

| Block | Name | Purpose | Key Attributes |
|-------|------|---------|----------------|
| Navigation | `core/navigation` | Site navigation | `ref` (menu ID), `overlayMenu` |
| Site Logo | `core/site-logo` | Site logo image | `width`, `isLink` |
| Site Title | `core/site-title` | Site name | `level`, `isLink` |
| Site Tagline | `core/site-tagline` | Site description | - |
| Query Loop | `core/query` | Dynamic post list | `query` (postType, perPage, etc.) |
| Post Template | `core/post-template` | Query item layout | - |
| Post Title | `core/post-title` | Post/page title | `level`, `isLink` |
| Post Content | `core/post-content` | Post/page content | - |
| Post Date | `core/post-date` | Publication date | `format`, `isLink` |
| Post Excerpt | `core/post-excerpt` | Post excerpt | `moreText`, `showMoreOnNewLine` |
| Post Featured Image | `core/post-featured-image` | Featured image | `isLink`, `aspectRatio` |
| Post Author | `core/post-author` | Author info | `showAvatar`, `showBio`, `byline` |
| Comments | `core/comments` | Comments section | - |
| Template Part | `core/template-part` | Reusable template | `slug`, `area` |

## Block Patterns

Block patterns are pre-designed block arrangements. Use them to quickly add complex layouts.

### Using Patterns

1. Get available patterns: `wpnav_gutenberg_list_patterns`
2. Insert pattern: `wpnav_gutenberg_insert_pattern` with pattern name
3. Customize inserted blocks as needed

### Common Pattern Categories

- **Text**: Call to action, testimonials, features
- **Header**: Hero sections, page headers
- **Gallery**: Image grids, portfolios
- **Query**: Post grids, news layouts

## Reusable Blocks

Reusable blocks (synced patterns) allow content reuse across pages.

### Workflow

1. **Create reusable block**: Select blocks, save as reusable
2. **Find reusable blocks**: Listed under `wp_block` post type
3. **Insert reusable block**: Use `core/block` with `ref` attribute
4. **Edit source**: Changes sync to all instances
5. **Convert to regular**: Detach from sync to customize locally

### Reusable Block Structure

```html
<!-- wp:block {"ref":123} /-->
```

Where `123` is the post ID of the `wp_block` post type.

## Common Tasks

### Add a Heading and Paragraph

```
wpnav_gutenberg_insert_block post_id=123 block_type="core/heading" attributes={"level":2,"content":"Welcome"}
wpnav_gutenberg_insert_block post_id=123 block_type="core/paragraph" attributes={"content":"This is introductory text."} position="after_last"
```

### Create a Multi-Column Layout

```
wpnav_gutenberg_insert_block post_id=123 block_type="core/columns" attributes={"columns":3}
```

Then insert `core/column` blocks inside with content.

### Insert an Image with Caption

```
wpnav_gutenberg_insert_block post_id=123 block_type="core/image" attributes={"id":456,"url":"https://example.com/image.jpg","alt":"Description","caption":"Image caption here"}
```

### Build a Button Group

```
wpnav_gutenberg_insert_block post_id=123 block_type="core/buttons" inner_blocks=[
  {"name":"core/button","attributes":{"text":"Primary","url":"/action"}},
  {"name":"core/button","attributes":{"text":"Secondary","url":"/other","className":"is-style-outline"}}
]
```

### Create a Reusable Header Block

1. Create blocks for the header
2. Save as reusable: Creates `wp_block` post
3. Reference in other pages: `{"ref": <block_post_id>}`

### Use the Query Loop for Posts

```
wpnav_gutenberg_insert_block post_id=123 block_type="core/query" attributes={
  "query": {
    "postType": "post",
    "perPage": 6,
    "orderBy": "date",
    "order": "desc"
  }
}
```

## Common Pitfalls

### Don't Mix Block Delimiters with Raw HTML

Bad:
```html
<h2>My Heading</h2>
<p>Some text</p>
```

Good:
```html
<!-- wp:heading -->
<h2>My Heading</h2>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>Some text</p>
<!-- /wp:paragraph -->
```

Raw HTML without block delimiters becomes a single Classic block, losing editability.

### Don't Forget Inner Blocks for Containers

Columns, Groups, and Buttons are containers. Content goes in inner blocks:

Bad: Inserting content directly into `core/columns`
Good: Insert `core/column` inner blocks, then content inside each column

### Don't Hardcode IDs for Media

Always use `wpnav_list_media` to find existing media IDs, or `wpnav_upload_media_from_url` to upload new images. Never guess media IDs.

### Don't Break Block JSON Syntax

Block attributes are JSON - ensure proper quoting and escaping:
- Use double quotes for strings
- Escape special characters
- Validate JSON before insertion

### Don't Forget to Verify Changes

After block operations, use `wpnav_snapshot_page` or `wpnav_get_post` to verify the changes took effect.

## Resources

- WordPress Block Editor Handbook: https://developer.wordpress.org/block-editor/
- Block Patterns Directory: https://wordpress.org/patterns/
- Core Blocks Reference: https://developer.wordpress.org/block-editor/reference-guides/core-blocks/
