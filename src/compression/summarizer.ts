/**
 * AI Summary Generator
 *
 * Generates natural language summaries optimized for LLM consumption.
 *
 * @package WP_Navigator_Pro
 * @since 2.8.0
 */

/**
 * Content type for summary generation
 */
export type SummaryContentType =
  | 'posts'
  | 'pages'
  | 'media'
  | 'plugins'
  | 'themes'
  | 'users'
  | 'categories'
  | 'tags'
  | 'comments'
  | 'taxonomies'
  | 'blocks'
  | 'patterns'
  | 'roles'
  | 'cookbooks'
  | 'post_types';

/**
 * Summary options
 */
export interface SummaryOptions {
  /** Content type for template selection */
  contentType: SummaryContentType;
  /** Maximum tokens for summary (approximate, ~4 chars/token) */
  maxTokens?: number;
  /** Include recent item highlight */
  includeRecent?: boolean;
  /** Include top/popular item highlight */
  includeTop?: boolean;
}

/**
 * Default summary options
 */
const DEFAULT_OPTIONS: Required<Omit<SummaryOptions, 'contentType'>> = {
  maxTokens: 150,
  includeRecent: true,
  includeTop: true,
};

/**
 * Generate AI-friendly summary for list data.
 */
export function generateSummary<T extends Record<string, any>>(
  items: T[],
  options: SummaryOptions
): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const count = items.length;

  if (count === 0) {
    return `No ${options.contentType} found.`;
  }

  switch (options.contentType) {
    case 'posts':
      return generatePostsSummary(items, opts);
    case 'pages':
      return generatePagesSummary(items, opts);
    case 'media':
      return generateMediaSummary(items, opts);
    case 'plugins':
      return generatePluginsSummary(items, opts);
    case 'themes':
      return generateThemesSummary(items, opts);
    case 'users':
      return generateUsersSummary(items, opts);
    case 'categories':
    case 'tags':
      return generateTaxonomySummary(items, options.contentType, opts);
    case 'comments':
      return generateCommentsSummary(items, opts);
    default:
      return generateGenericSummary(items, options.contentType);
  }
}

/**
 * Posts summary: count, category breakdown, recent, popular
 */
function generatePostsSummary<T extends Record<string, any>>(
  items: T[],
  opts: Required<Omit<SummaryOptions, 'contentType'>>
): string {
  const count = items.length;
  const parts: string[] = [`${count} post${count !== 1 ? 's' : ''} found.`];

  // Category breakdown
  const categories = groupBy(items, 'category_name');
  if (Object.keys(categories).length > 0) {
    const top3 = Object.entries(categories)
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 3)
      .map(([name, posts]) => `${name || 'Uncategorized'} (${posts.length})`)
      .join(', ');
    parts.push(`Categories: ${top3}.`);
  }

  // Most recent
  if (opts.includeRecent && items.length > 0) {
    const recent = findMostRecent(items);
    if (recent) {
      parts.push(
        `Most recent: '${truncate(recent.title?.rendered || recent.title || 'Untitled', 30)}' (id:${recent.id}).`
      );
    }
  }

  return parts.join(' ');
}

/**
 * Pages summary: count, hierarchy, recently edited
 */
function generatePagesSummary<T extends Record<string, any>>(
  items: T[],
  opts: Required<Omit<SummaryOptions, 'contentType'>>
): string {
  const count = items.length;
  const parts: string[] = [`${count} page${count !== 1 ? 's' : ''} found.`];

  // Hierarchy info
  const topLevel = items.filter((p) => !p.parent || p.parent === 0);
  const children = items.filter((p) => p.parent && p.parent !== 0);
  if (topLevel.length > 0 || children.length > 0) {
    parts.push(`${topLevel.length} top-level, ${children.length} child pages.`);
  }

  // Most recent
  if (opts.includeRecent && items.length > 0) {
    const recent = findMostRecent(items);
    if (recent) {
      parts.push(
        `Recently edited: '${truncate(recent.title?.rendered || recent.title || 'Untitled', 30)}' (id:${recent.id}).`
      );
    }
  }

  return parts.join(' ');
}

/**
 * Media summary: count, type breakdown, recent
 */
function generateMediaSummary<T extends Record<string, any>>(
  items: T[],
  opts: Required<Omit<SummaryOptions, 'contentType'>>
): string {
  const count = items.length;
  const parts: string[] = [`${count} media item${count !== 1 ? 's' : ''} found.`];

  // Type breakdown
  const types = groupBy(items, 'media_type');
  if (Object.keys(types).length > 0) {
    const breakdown = Object.entries(types)
      .map(([type, files]) => `${type || 'other'} (${files.length})`)
      .join(', ');
    parts.push(`Types: ${breakdown}.`);
  }

  return parts.join(' ');
}

/**
 * Plugins summary: count, active/inactive, recently updated
 */
function generatePluginsSummary<T extends Record<string, any>>(
  items: T[],
  opts: Required<Omit<SummaryOptions, 'contentType'>>
): string {
  const count = items.length;
  const active = items.filter((p) => p.status === 'active').length;
  const inactive = count - active;

  const parts: string[] = [`${count} plugin${count !== 1 ? 's' : ''} found.`];
  parts.push(`${active} active, ${inactive} inactive.`);

  // Recently updated
  const updatable = items.filter((p) => p.update);
  if (updatable.length > 0) {
    parts.push(`${updatable.length} with updates available.`);
  }

  return parts.join(' ');
}

/**
 * Themes summary: active, child theme, available
 */
function generateThemesSummary<T extends Record<string, any>>(
  items: T[],
  opts: Required<Omit<SummaryOptions, 'contentType'>>
): string {
  const count = items.length;
  const active = items.find((t) => t.status === 'active');

  const parts: string[] = [`${count} theme${count !== 1 ? 's' : ''} available.`];

  if (active) {
    const name = active.name?.rendered || active.name || 'Unknown';
    parts.push(`Active: ${name}.`);

    if (active.template && active.template !== active.stylesheet) {
      parts.push('Using child theme.');
    }
  }

  return parts.join(' ');
}

/**
 * Users summary: count, role breakdown
 */
function generateUsersSummary<T extends Record<string, any>>(
  items: T[],
  opts: Required<Omit<SummaryOptions, 'contentType'>>
): string {
  const count = items.length;
  const parts: string[] = [`${count} user${count !== 1 ? 's' : ''} found.`];

  // Role breakdown
  const roles = new Map<string, number>();
  for (const user of items) {
    const userRoles = user.roles || [];
    for (const role of userRoles) {
      roles.set(role, (roles.get(role) || 0) + 1);
    }
  }

  if (roles.size > 0) {
    const breakdown = Array.from(roles.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([role, count]) => `${role} (${count})`)
      .join(', ');
    parts.push(`Roles: ${breakdown}.`);
  }

  return parts.join(' ');
}

/**
 * Taxonomy summary: count, items with most posts
 */
function generateTaxonomySummary<T extends Record<string, any>>(
  items: T[],
  type: 'categories' | 'tags',
  opts: Required<Omit<SummaryOptions, 'contentType'>>
): string {
  const count = items.length;
  const label = type === 'categories' ? 'categor' : 'tag';
  const parts: string[] = [
    `${count} ${label}${
      count !== 1 ? (type === 'categories' ? 'ies' : 's') : type === 'categories' ? 'y' : ''
    } found.`,
  ];

  // Top by post count
  const withCounts = items.filter((i) => typeof i.count === 'number' && i.count > 0);
  if (withCounts.length > 0) {
    const top = withCounts
      .sort((a, b) => (b.count || 0) - (a.count || 0))
      .slice(0, 3)
      .map((i) => `${i.name} (${i.count})`)
      .join(', ');
    parts.push(`Most used: ${top}.`);
  }

  return parts.join(' ');
}

/**
 * Comments summary: count, status breakdown
 */
function generateCommentsSummary<T extends Record<string, any>>(
  items: T[],
  opts: Required<Omit<SummaryOptions, 'contentType'>>
): string {
  const count = items.length;
  const parts: string[] = [`${count} comment${count !== 1 ? 's' : ''} found.`];

  // Status breakdown
  const statuses = groupBy(items, 'status');
  if (Object.keys(statuses).length > 0) {
    const breakdown = Object.entries(statuses)
      .map(([status, comments]) => `${status} (${comments.length})`)
      .join(', ');
    parts.push(`Status: ${breakdown}.`);
  }

  return parts.join(' ');
}

/**
 * Generic summary for unknown content types
 */
function generateGenericSummary<T extends Record<string, any>>(
  items: T[],
  contentType: string
): string {
  return `${items.length} ${contentType} found.`;
}

// Helper functions

function groupBy<T extends Record<string, any>>(items: T[], key: string): Record<string, T[]> {
  return items.reduce(
    (acc, item) => {
      const value = String(item[key] || 'unknown');
      if (!acc[value]) acc[value] = [];
      acc[value].push(item);
      return acc;
    },
    {} as Record<string, T[]>
  );
}

function findMostRecent<T extends Record<string, any>>(items: T[]): T | undefined {
  return items
    .filter((i) => i.modified || i.date)
    .sort((a, b) => {
      const dateA = new Date(iOrDate(a)).getTime();
      const dateB = new Date(iOrDate(b)).getTime();
      return dateB - dateA;
    })[0];
}

function iOrDate(item: Record<string, any>): string {
  return (item.modified as string) || (item.date as string) || '';
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + '...';
}
