/**
 * WP Navigator Context Command
 *
 * CLI command for outputting AI-consumable context for web-based AI agents
 * that cannot use MCP protocol (Claude Code Web, Codex Cloud, etc.).
 *
 * @package WP_Navigator_MCP
 * @since 2.7.0
 */

import {
  success,
  error as errorMessage,
  info,
  newline,
  box,
  keyValue,
  colorize,
  symbols,
} from '../tui/components.js';
import { toolRegistry } from '../../tool-registry/index.js';
import {
  loadManifest,
  isManifestV2,
  getManifestTools,
  getManifestAI,
  getManifestSafetyV2,
} from '../../manifest.js';
import {
  getFocusMode,
  getFocusModePreset,
  resolveFocusMode,
  mergeFocusModeWithManifest,
} from '../../focus-modes.js';
import { discoverRoles, getRole, type LoadedRole } from '../../roles/index.js';
import { runtimeRoleState } from '../../roles/runtime-state.js';
import { discoverCookbooks } from '../../cookbook/index.js';
import type { WPConfig } from '../../config.js';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';

// =============================================================================
// Types
// =============================================================================

export interface ContextCommandOptions {
  json?: boolean;
  format?: 'compact' | 'full';
  includeTools?: boolean;
  includeRole?: boolean;
  includeCookbooks?: boolean;
}

export interface ContextOutput {
  focus_mode: {
    name: string;
    description: string;
    token_estimate: string;
  };
  tools: {
    total_available: number;
    enabled: number;
    by_category: Record<string, number>;
    list?: string[];
  };
  role: {
    active: string | null;
    name: string | null;
    context: string | null;
    focus_areas: string[];
    tools_allowed: string[];
    tools_denied: string[];
  } | null;
  cookbooks: {
    loaded: string[];
    available: string[];
    recommended: string[];
  };
  site: {
    name: string | null;
    url: string;
    plugin_version: string | null;
    plugin_edition: string | null;
    detected_plugins: string[];
    page_builder: string | null;
  };
  safety: {
    mode: string;
    enable_writes: boolean;
    allowed_operations: string[];
    blocked_operations: string[];
  };
  ai: {
    instructions: string | null;
    prompts_path: string | null;
  };
  environment: string;
}

// =============================================================================
// Output Helpers
// =============================================================================

function outputJSON(data: unknown): void {
  console.log(JSON.stringify(data, null, 2));
}

// =============================================================================
// Context Gathering Functions
// =============================================================================

/**
 * Group enabled tools by category
 */
function groupToolsByCategory(tools: Tool[]): Record<string, number> {
  const grouped: Record<string, number> = {};
  for (const tool of tools) {
    // Tool names start with wpnav_ followed by category verb
    // e.g. wpnav_list_posts -> content, wpnav_introspect -> core
    const name = tool.name;
    let category = 'other';
    if (
      name.startsWith('wpnav_list_') ||
      name.startsWith('wpnav_get_') ||
      name.startsWith('wpnav_create_') ||
      name.startsWith('wpnav_update_') ||
      name.startsWith('wpnav_delete_')
    ) {
      // Extract category from the noun
      if (
        name.includes('_post') ||
        name.includes('_page') ||
        name.includes('_media') ||
        name.includes('_comment')
      ) {
        category = 'content';
      } else if (name.includes('_categor') || name.includes('_tag') || name.includes('_taxonom')) {
        category = 'taxonomy';
      } else if (name.includes('_user')) {
        category = 'users';
      } else if (name.includes('_plugin')) {
        category = 'plugins';
      } else if (name.includes('_theme')) {
        category = 'themes';
      } else if (name.includes('_cookbook') || name.includes('_role')) {
        category = 'ai';
      }
    } else if (name.includes('introspect') || name.includes('help') || name.includes('overview')) {
      category = 'core';
    } else if (name.includes('gutenberg') || name.includes('block')) {
      category = 'gutenberg';
    } else if (name.includes('batch')) {
      category = 'batch';
    }
    grouped[category] = (grouped[category] || 0) + 1;
  }
  return grouped;
}

/**
 * Detect plugins from introspect response
 */
function detectPlugins(introspect: Record<string, unknown>): string[] {
  const plugins: string[] = [];

  // Check for detected plugins in introspect response
  const detected = introspect.detected_plugins as string[] | undefined;
  if (Array.isArray(detected)) {
    plugins.push(...detected);
  }

  // Check for page builder
  const pageBuilder = introspect.page_builder as string | undefined;
  if (pageBuilder && !plugins.includes(pageBuilder)) {
    plugins.push(pageBuilder);
  }

  return plugins;
}

/**
 * Get safety operations based on mode
 */
function getSafetyOperations(mode: string): { allowed: string[]; blocked: string[] } {
  switch (mode) {
    case 'yolo':
      return {
        allowed: ['create', 'update', 'delete', 'activate', 'deactivate', 'batch'],
        blocked: [],
      };
    case 'cautious':
      return {
        allowed: ['create', 'update'],
        blocked: ['delete', 'activate', 'deactivate', 'batch'],
      };
    case 'normal':
    default:
      return {
        allowed: ['create', 'update', 'delete'],
        blocked: ['batch'],
      };
  }
}

// =============================================================================
// Command Handler
// =============================================================================

/**
 * Handle `wpnav context` command
 *
 * Gathers all AI context from config, manifest, tools, roles, and cookbooks.
 * Requires WordPress connection to ensure accurate, complete context.
 */
export async function handleContext(
  options: ContextCommandOptions = {},
  context?: {
    config: WPConfig;
    // wpRequest returns parsed JSON directly, not a Response object
    wpRequest: (endpoint: string, init?: RequestInit) => Promise<unknown>;
  }
): Promise<number> {
  // Require connection context
  if (!context) {
    if (options.json) {
      outputJSON({
        success: false,
        command: 'context',
        error: {
          code: 'CONNECTION_REQUIRED',
          message: 'WordPress connection required. Run wpnav context with a valid config.',
        },
      });
    } else {
      errorMessage('WordPress connection required.');
      newline();
      info(
        'The context command needs to connect to your WordPress site to gather accurate information.'
      );
      info('Ensure you have a valid wpnav.config.json or .wpnav.env file.');
    }
    return 1;
  }

  try {
    // 1. Fetch introspect data from WordPress
    // Note: wpRequest returns parsed JSON directly, not a Response object
    const introspect = (await context.wpRequest('/wpnav/v1/introspect')) as Record<string, unknown>;

    // 2. Load manifest
    const manifestResult = loadManifest();
    const manifest =
      manifestResult.found && manifestResult.manifest && isManifestV2(manifestResult.manifest)
        ? manifestResult.manifest
        : null;

    // 3. Get focus mode
    const focusMode = manifest ? getFocusMode(manifest) : 'content-editing';
    const focusModePreset = getFocusModePreset(focusMode);

    // 4. Get enabled tools
    const allTools = toolRegistry.getAllDefinitions();
    const enabledTools = allTools.filter((t) => toolRegistry.isEnabled(t.name));
    const toolsByCategory = groupToolsByCategory(enabledTools);

    // 5. Get active role
    const activeRoleSlug = runtimeRoleState.getRole();
    let activeRole: LoadedRole | null = null;
    if (activeRoleSlug) {
      activeRole = getRole(activeRoleSlug) || null;
    }

    // 6. Get cookbooks
    const { cookbooks: availableCookbooks } = discoverCookbooks();
    const loadedCookbooks: string[] = [];
    const recommendedCookbooks: string[] = [];

    // Check for detected plugins that have matching cookbooks
    const detectedPlugins = detectPlugins(introspect);
    for (const cookbook of availableCookbooks.values()) {
      // Check if cookbook matches detected plugins
      const cookbookSlug = cookbook.plugin.slug.toLowerCase();
      const cookbookPluginName = cookbook.plugin.name.toLowerCase();
      for (const plugin of detectedPlugins) {
        const pluginLower = plugin.toLowerCase();
        if (
          pluginLower.includes(cookbookSlug) ||
          cookbookSlug.includes(pluginLower) ||
          pluginLower.includes(cookbookPluginName) ||
          cookbookPluginName.includes(pluginLower)
        ) {
          recommendedCookbooks.push(cookbook.plugin.name);
          break;
        }
      }
    }

    // 7. Get safety settings
    const safety = manifest ? getManifestSafetyV2(manifest) : null;
    const safetyMode = safety?.mode || 'normal';
    const safetyOps = getSafetyOperations(safetyMode);

    // 8. Get AI settings
    const ai = manifest ? getManifestAI(manifest) : null;

    // 9. Determine environment (v2.7.0 multi-env will add this, default for now)
    const environment = 'production';

    // Build context output
    const contextOutput: ContextOutput = {
      focus_mode: {
        name: focusMode,
        description: focusModePreset.description,
        token_estimate: focusModePreset.tokenEstimate,
      },
      tools: {
        total_available: allTools.length,
        enabled: enabledTools.length,
        by_category: toolsByCategory,
        ...(options.includeTools || options.format === 'full'
          ? { list: enabledTools.map((t) => t.name) }
          : {}),
      },
      role: activeRole
        ? {
            active: activeRoleSlug,
            name: activeRole.name,
            context: options.includeRole || options.format === 'full' ? activeRole.context : null,
            focus_areas: activeRole.focus_areas || [],
            tools_allowed: activeRole.tools?.allowed || [],
            tools_denied: activeRole.tools?.denied || [],
          }
        : null,
      cookbooks: {
        loaded: loadedCookbooks,
        available: Array.from(availableCookbooks.keys()),
        recommended: recommendedCookbooks,
      },
      site: {
        name: (introspect.site_name as string) || null,
        url: context.config.baseUrl,
        plugin_version:
          (introspect.plugin_version as string) || (introspect.version as string) || null,
        plugin_edition: (introspect.edition as string) || null,
        detected_plugins: detectedPlugins,
        page_builder: (introspect.page_builder as string) || null,
      },
      safety: {
        mode: safetyMode,
        enable_writes: context.config.toggles.enableWrites,
        allowed_operations: safetyOps.allowed,
        blocked_operations: safetyOps.blocked,
      },
      ai: {
        instructions: ai?.instructions || null,
        prompts_path: ai?.prompts_path || null,
      },
      environment,
    };

    // Output based on format
    if (options.json || options.format === 'compact') {
      outputJSON({
        success: true,
        command: 'context',
        data: contextOutput,
      });
      return 0;
    }

    // TUI output
    newline();
    box('WP Navigator Context', { title: 'AI Agent Context' });
    newline();

    // Focus Mode section
    info('Focus Mode');
    keyValue('  Mode', focusMode);
    keyValue('  Description', focusModePreset.description);
    keyValue('  Token Estimate', focusModePreset.tokenEstimate);
    newline();

    // Tools section
    info('Tools');
    keyValue('  Total Available', String(allTools.length));
    keyValue('  Enabled', String(enabledTools.length));
    for (const [category, count] of Object.entries(toolsByCategory)) {
      keyValue(`  ${category}`, String(count));
    }
    newline();

    // Role section
    info('Active Role');
    if (activeRole) {
      keyValue('  Slug', activeRoleSlug || '-');
      keyValue('  Name', activeRole.name);
      keyValue('  Description', activeRole.description);
      if (activeRole.focus_areas && activeRole.focus_areas.length > 0) {
        info('  Focus Areas:');
        for (const area of activeRole.focus_areas.slice(0, 5)) {
          console.error(`    ${colorize(symbols.success, 'green')} ${area}`);
        }
      }
    } else {
      console.error(`  ${colorize('No role active', 'dim')}`);
    }
    newline();

    // Cookbooks section
    info('Cookbooks');
    keyValue('  Available', String(availableCookbooks.size));
    if (recommendedCookbooks.length > 0) {
      keyValue('  Recommended', recommendedCookbooks.join(', '));
    }
    newline();

    // Site section
    info('Site');
    keyValue('  Name', contextOutput.site.name || '-');
    keyValue('  URL', contextOutput.site.url);
    keyValue('  Plugin Version', contextOutput.site.plugin_version || '-');
    keyValue('  Plugin Edition', contextOutput.site.plugin_edition || 'Free');
    if (detectedPlugins.length > 0) {
      keyValue('  Detected Plugins', detectedPlugins.join(', '));
    }
    if (contextOutput.site.page_builder) {
      keyValue('  Page Builder', contextOutput.site.page_builder);
    }
    newline();

    // Safety section
    info('Safety');
    keyValue('  Mode', safetyMode);
    keyValue('  Writes Enabled', context.config.toggles.enableWrites ? 'Yes' : 'No');
    keyValue('  Allowed', safetyOps.allowed.join(', '));
    if (safetyOps.blocked.length > 0) {
      keyValue('  Blocked', safetyOps.blocked.join(', '));
    }
    newline();

    // Environment
    keyValue('Environment', environment);
    newline();

    // Hint for JSON output
    info(`Use ${colorize('--json', 'cyan')} for machine-readable output`);
    info(
      `Use ${colorize('--format full', 'cyan')} for complete details including tool list and role context`
    );

    return 0;
  } catch (error) {
    if (options.json) {
      outputJSON({
        success: false,
        command: 'context',
        error: {
          code: 'CONNECTION_FAILED',
          message: error instanceof Error ? error.message : 'Failed to gather context',
        },
      });
    } else {
      errorMessage(error instanceof Error ? error.message : 'Failed to gather context');
      newline();
      info('Ensure your WordPress site is reachable and WP Navigator plugin is active.');
    }
    return 1;
  }
}

export default handleContext;
