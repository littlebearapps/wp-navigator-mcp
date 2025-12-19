/**
 * Suggestion Rules Engine
 *
 * Defines rules for generating context-aware suggestions.
 *
 * @package WP_Navigator_Pro
 * @since 2.8.0
 */

/**
 * Suggestion priority levels
 */
export type SuggestionPriority = 'high' | 'medium' | 'low';

/**
 * Suggestion categories
 */
export type SuggestionCategory =
  | 'setup'
  | 'content'
  | 'plugins'
  | 'themes'
  | 'maintenance'
  | 'discovery';

/**
 * A single suggestion
 */
export interface Suggestion {
  action: string;
  reason: string;
  priority: SuggestionPriority;
  category: SuggestionCategory;
}

/**
 * Project context for rule evaluation
 */
export interface ProjectContext {
  hasManifest: boolean;
  hasConnection: boolean;
  hasSiteSnapshot: boolean;
  snapshotAge?: number; // hours since last snapshot
  detectedPlugins: string[];
  availableCookbooks: string[];
  loadedCookbooks: string[];
  activeRole?: string;
  recentErrors?: string[];
}

/**
 * A suggestion rule
 */
export interface SuggestionRule {
  id: string;
  condition: (ctx: ProjectContext) => boolean;
  suggestion: (ctx: ProjectContext) => Suggestion;
}

/**
 * Built-in suggestion rules
 */
export const SUGGESTION_RULES: SuggestionRule[] = [
  // Setup rules
  {
    id: 'no-connection',
    condition: (ctx) => !ctx.hasConnection,
    suggestion: () => ({
      action: 'wpnav configure',
      reason: 'No WordPress connection configured',
      priority: 'high',
      category: 'setup',
    }),
  },
  {
    id: 'no-manifest',
    condition: (ctx) => ctx.hasConnection && !ctx.hasManifest,
    suggestion: () => ({
      action: 'wpnav init',
      reason: 'Project not initialized with manifest',
      priority: 'high',
      category: 'setup',
    }),
  },
  {
    id: 'no-site-snapshot',
    condition: (ctx) => ctx.hasConnection && !ctx.hasSiteSnapshot,
    suggestion: () => ({
      action: 'wpnav snapshot site',
      reason: 'No site snapshot exists yet',
      priority: 'high',
      category: 'setup',
    }),
  },
  {
    id: 'stale-snapshot',
    condition: (ctx) => ctx.hasSiteSnapshot && (ctx.snapshotAge ?? 0) > 24,
    suggestion: (ctx) => ({
      action: 'wpnav snapshot site',
      reason: `Site snapshot is ${Math.round(ctx.snapshotAge ?? 0)} hours old`,
      priority: 'medium',
      category: 'maintenance',
    }),
  },

  // Content discovery
  {
    id: 'explore-content',
    condition: (ctx) => ctx.hasConnection && ctx.hasSiteSnapshot,
    suggestion: () => ({
      action: 'wpnav call wpnav_list_pages --limit 10',
      reason: 'Explore existing pages before making changes',
      priority: 'medium',
      category: 'content',
    }),
  },

  // Plugin cookbooks
  {
    id: 'missing-cookbook',
    condition: (ctx) => {
      const unmatchedPlugins = ctx.detectedPlugins.filter(
        (p) => !ctx.loadedCookbooks.some((c) => c.toLowerCase().includes(p.toLowerCase()))
      );
      return unmatchedPlugins.length > 0;
    },
    suggestion: (ctx) => {
      const unmatchedPlugins = ctx.detectedPlugins.filter(
        (p) => !ctx.loadedCookbooks.some((c) => c.toLowerCase().includes(p.toLowerCase()))
      );
      const plugin = unmatchedPlugins[0];
      return {
        action: `wpnav call wpnav_list_cookbooks`,
        reason: `Plugin '${plugin}' detected - check for available cookbook`,
        priority: 'medium',
        category: 'plugins',
      };
    },
  },

  // Role-specific suggestions
  {
    id: 'content-editor-posts',
    condition: (ctx) => ctx.activeRole === 'content-editor' && ctx.hasConnection,
    suggestion: () => ({
      action: 'wpnav call wpnav_list_posts --status draft --limit 10',
      reason: 'Review draft posts (content editor role)',
      priority: 'medium',
      category: 'content',
    }),
  },
  {
    id: 'developer-plugins',
    condition: (ctx) => ctx.activeRole === 'developer' && ctx.hasConnection,
    suggestion: () => ({
      action: 'wpnav call wpnav_list_plugins',
      reason: 'Review installed plugins (developer role)',
      priority: 'medium',
      category: 'plugins',
    }),
  },

  // Discovery
  {
    id: 'discover-routes',
    condition: (ctx) => ctx.hasConnection && ctx.activeRole === 'developer',
    suggestion: () => ({
      action: 'wpnav call wpnav_list_rest_routes',
      reason: 'Discover available REST API routes',
      priority: 'low',
      category: 'discovery',
    }),
  },
];

/**
 * Evaluate rules against context and return matching suggestions
 */
export function evaluateRules(
  context: ProjectContext,
  options?: { category?: SuggestionCategory; limit?: number }
): Suggestion[] {
  const suggestions: Suggestion[] = [];

  for (const rule of SUGGESTION_RULES) {
    if (rule.condition(context)) {
      const suggestion = rule.suggestion(context);

      // Filter by category if specified
      if (options?.category && suggestion.category !== options.category) {
        continue;
      }

      suggestions.push(suggestion);
    }
  }

  // Sort by priority
  const priorityOrder: Record<SuggestionPriority, number> = { high: 0, medium: 1, low: 2 };
  suggestions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  // Apply limit
  if (options?.limit && options.limit > 0) {
    return suggestions.slice(0, options.limit);
  }

  return suggestions;
}
