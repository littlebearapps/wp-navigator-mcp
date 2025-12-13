/**
 * Snapshot Type Definitions
 *
 * Defines schemas for site and page snapshots, enabling version-controlled
 * WordPress state management.
 *
 * @package WP_Navigator_Pro
 * @since 1.1.0
 */

/**
 * Current snapshot schema version
 */
export const SNAPSHOT_VERSION = '1.0';

// =============================================================================
// Site Index Snapshot Schema (task-29)
// =============================================================================

/**
 * Theme information in site snapshot
 */
export interface SiteThemeInfo {
  /** Active theme name */
  name: string;
  /** Theme slug */
  slug: string;
  /** Theme version */
  version: string;
  /** Parent theme name (for child themes) */
  parent?: string;
  /** Parent theme slug (for child themes) */
  parent_slug?: string;
}

/**
 * Content summary for pages
 */
export interface PageSummary {
  /** WordPress page ID */
  id: number;
  /** Page URL slug */
  slug: string;
  /** Page title */
  title: string;
  /** Publication status */
  status: 'publish' | 'draft' | 'pending' | 'private' | 'trash';
  /** Page template if set */
  template?: string;
  /** Last modified timestamp */
  modified: string;
}

/**
 * Content summary for posts
 */
export interface PostSummary {
  /** WordPress post ID */
  id: number;
  /** Post URL slug */
  slug: string;
  /** Post title */
  title: string;
  /** Publication status */
  status: 'publish' | 'draft' | 'pending' | 'private' | 'trash';
  /** Post type (post, custom post types) */
  type: string;
  /** Last modified timestamp */
  modified: string;
}

/**
 * Media library summary
 */
export interface MediaSummary {
  /** Total media count */
  count: number;
  /** Count by MIME type */
  by_type?: {
    images?: number;
    videos?: number;
    documents?: number;
    audio?: number;
    other?: number;
  };
}

/**
 * Content section of site snapshot
 */
export interface SiteContentSnapshot {
  /** List of pages with basic metadata */
  pages: PageSummary[];
  /** List of posts with basic metadata */
  posts: PostSummary[];
  /** Media library summary */
  media: MediaSummary;
}

/**
 * Plugin information
 */
export interface PluginInfo {
  /** Plugin slug */
  slug: string;
  /** Plugin name */
  name: string;
  /** Plugin version */
  version: string;
  /** Whether plugin needs update */
  update_available?: boolean;
}

/**
 * Plugins section of site snapshot
 */
export interface SitePluginsSnapshot {
  /** Active plugins */
  active: PluginInfo[];
  /** Inactive plugins */
  inactive: PluginInfo[];
}

/**
 * Site metadata section
 */
export interface SiteMetadata {
  /** Site name/title */
  name: string;
  /** Site URL */
  url: string;
  /** WordPress version */
  wordpress_version: string;
  /** PHP version (if available) */
  php_version?: string;
  /** Active theme information */
  theme: SiteThemeInfo;
  /** Site tagline/description */
  tagline?: string;
  /** Admin email */
  admin_email?: string;
  /** Site timezone */
  timezone?: string;
  /** Site language */
  language?: string;
}

/**
 * Site Index Snapshot
 *
 * Complete snapshot of WordPress site state for versioning and sync.
 * Created by `wpnav snapshot site` command.
 */
export interface SiteIndexSnapshot {
  /** Schema version for migration support */
  snapshot_version: typeof SNAPSHOT_VERSION;
  /** ISO timestamp when snapshot was captured */
  captured_at: string;
  /** Site metadata */
  site: SiteMetadata;
  /** Content summary */
  content: SiteContentSnapshot;
  /** Plugin inventory */
  plugins: SitePluginsSnapshot;
  /** WP Navigator plugin info */
  wpnav?: {
    /** WP Navigator plugin version */
    version: string;
    /** License tier */
    tier?: 'free' | 'pro';
  };
}

// =============================================================================
// Page Snapshot Schema (task-30)
// =============================================================================

/**
 * Gutenberg block in snapshot
 */
export interface BlockSnapshot {
  /** Block name (e.g., 'core/paragraph', 'core/heading') */
  blockName: string;
  /** Block attributes */
  attrs: Record<string, unknown>;
  /** Inner blocks for container blocks */
  innerBlocks: BlockSnapshot[];
  /** Inner HTML content */
  innerHTML: string;
  /** Inner content array (mixed HTML and block markers) */
  innerContent: string[];
}

/**
 * SEO metadata (Yoast, RankMath, etc.)
 */
export interface SeoMetadata {
  /** SEO title override */
  title?: string;
  /** Meta description */
  description?: string;
  /** Focus keyword */
  focus_keyword?: string;
  /** Open Graph title */
  og_title?: string;
  /** Open Graph description */
  og_description?: string;
  /** Open Graph image URL */
  og_image?: string;
  /** Canonical URL override */
  canonical?: string;
  /** Robots meta (index, follow, etc.) */
  robots?: string;
  /** Schema.org data */
  schema?: Record<string, unknown>;
}

/**
 * Page metadata section
 */
export interface PageMetadata {
  /** WordPress page ID */
  id: number;
  /** Page URL slug */
  slug: string;
  /** Page title */
  title: string;
  /** Publication status */
  status: 'publish' | 'draft' | 'pending' | 'private' | 'trash';
  /** Author username */
  author: string;
  /** Author ID */
  author_id: number;
  /** Page template (empty string for default) */
  template: string;
  /** Parent page ID (0 for top-level) */
  parent: number;
  /** Menu order */
  menu_order: number;
  /** Created timestamp */
  date: string;
  /** Last modified timestamp */
  modified: string;
  /** Full permalink */
  link: string;
}

/**
 * Page content section
 */
export interface PageContentSnapshot {
  /** Gutenberg blocks (structured) */
  blocks: BlockSnapshot[];
  /** Raw block content (WordPress format) */
  raw: string;
  /** Rendered HTML (for reference) */
  rendered?: string;
}

/**
 * Page extra metadata
 */
export interface PageExtraMetadata {
  /** Featured image URL */
  featured_image?: string;
  /** Featured image ID */
  featured_image_id?: number;
  /** SEO metadata (if Yoast/RankMath present) */
  seo?: SeoMetadata;
  /** Custom fields */
  custom_fields?: Record<string, unknown>;
  /** Comments status */
  comment_status?: 'open' | 'closed';
  /** Ping status */
  ping_status?: 'open' | 'closed';
}

/**
 * Page Snapshot
 *
 * Complete snapshot of a single WordPress page including content blocks.
 * Created by `wpnav snapshot page <slug>` command.
 */
export interface PageSnapshot {
  /** Schema version for migration support */
  snapshot_version: typeof SNAPSHOT_VERSION;
  /** ISO timestamp when snapshot was captured */
  captured_at: string;
  /** Page metadata */
  page: PageMetadata;
  /** Page content (blocks and raw) */
  content: PageContentSnapshot;
  /** Additional metadata (featured image, SEO, etc.) */
  meta: PageExtraMetadata;
}

// =============================================================================
// Snapshot File Paths
// =============================================================================

/**
 * Standard snapshot file paths relative to project root
 */
export const SNAPSHOT_PATHS = {
  /** Directory for all snapshots */
  ROOT: 'snapshots',
  /** Site index snapshot file */
  SITE_INDEX: 'snapshots/site_index.json',
  /** Pages snapshot directory */
  PAGES: 'snapshots/pages',
  /** Plugins snapshot directory */
  PLUGINS: 'snapshots/plugins',
} as const;

// =============================================================================
// Validation Helpers
// =============================================================================

/**
 * Check if value is a valid SiteIndexSnapshot
 */
export function isSiteIndexSnapshot(value: unknown): value is SiteIndexSnapshot {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.snapshot_version === 'string' &&
    typeof obj.captured_at === 'string' &&
    typeof obj.site === 'object' &&
    typeof obj.content === 'object' &&
    typeof obj.plugins === 'object'
  );
}

/**
 * Check if value is a valid PageSnapshot
 */
export function isPageSnapshot(value: unknown): value is PageSnapshot {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.snapshot_version === 'string' &&
    typeof obj.captured_at === 'string' &&
    typeof obj.page === 'object' &&
    typeof obj.content === 'object'
  );
}

/**
 * Create an empty site index snapshot template
 */
export function createEmptySiteSnapshot(): SiteIndexSnapshot {
  return {
    snapshot_version: SNAPSHOT_VERSION,
    captured_at: new Date().toISOString(),
    site: {
      name: '',
      url: '',
      wordpress_version: '',
      theme: {
        name: '',
        slug: '',
        version: '',
      },
    },
    content: {
      pages: [],
      posts: [],
      media: { count: 0 },
    },
    plugins: {
      active: [],
      inactive: [],
    },
  };
}

/**
 * Create an empty page snapshot template
 */
export function createEmptyPageSnapshot(): PageSnapshot {
  return {
    snapshot_version: SNAPSHOT_VERSION,
    captured_at: new Date().toISOString(),
    page: {
      id: 0,
      slug: '',
      title: '',
      status: 'draft',
      author: '',
      author_id: 0,
      template: '',
      parent: 0,
      menu_order: 0,
      date: '',
      modified: '',
      link: '',
    },
    content: {
      blocks: [],
      raw: '',
    },
    meta: {},
  };
}
