/**
 * wpnav suggest Command
 *
 * Context-aware AI guidance based on project state.
 *
 * @package WP_Navigator_Pro
 * @since 2.8.0
 */

import { analyzeState, AnalyzerOptions } from '../../suggest/analyzer.js';
import {
  evaluateRules,
  Suggestion,
  SuggestionCategory,
  ProjectContext,
} from '../../suggest/rules.js';

/**
 * Command options
 */
export interface SuggestOptions {
  json?: boolean;
  category?: SuggestionCategory;
  limit?: number;
  /** For testing: provide introspect data */
  introspect?: AnalyzerOptions['introspect'];
  /** For testing: provide loaded cookbooks */
  loadedCookbooks?: string[];
  /** For testing: provide active role */
  activeRole?: string;
}

/**
 * Suggest command result
 */
export interface SuggestResult {
  suggestions: Suggestion[];
  context: {
    has_manifest: boolean;
    has_connection: boolean;
    has_site_snapshot: boolean;
    detected_plugins: string[];
    active_role?: string;
  };
}

/**
 * Format suggestions for CLI output
 */
function formatSuggestionsCLI(suggestions: Suggestion[]): string {
  if (suggestions.length === 0) {
    return '✓ No suggestions - project looks well configured!';
  }

  const lines: string[] = ['Suggested next actions:', ''];

  for (const s of suggestions) {
    const priorityIcon = s.priority === 'high' ? '❗' : s.priority === 'medium' ? '•' : '○';
    lines.push(`${priorityIcon} ${s.action}`);
    lines.push(`  ${s.reason}`);
    lines.push('');
  }

  return lines.join('\n').trimEnd();
}

/**
 * Execute the suggest command
 */
export async function suggestCommand(options: SuggestOptions = {}): Promise<SuggestResult> {
  // Analyze state
  const context = analyzeState({
    introspect: options.introspect,
    loadedCookbooks: options.loadedCookbooks,
    activeRole: options.activeRole,
  });

  // Evaluate rules
  const suggestions = evaluateRules(context, {
    category: options.category,
    limit: options.limit,
  });

  const result: SuggestResult = {
    suggestions,
    context: {
      has_manifest: context.hasManifest,
      has_connection: context.hasConnection,
      has_site_snapshot: context.hasSiteSnapshot,
      detected_plugins: context.detectedPlugins,
      active_role: context.activeRole,
    },
  };

  // Output
  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(formatSuggestionsCLI(suggestions));
  }

  return result;
}
