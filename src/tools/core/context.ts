/**
 * Context Tool Meta-Tool
 *
 * MCP tool exposing the wpnav context functionality to AI agents.
 * Provides a compact context dump of the WordPress site, tools, roles,
 * and cookbooks for token-efficient AI agent initialization.
 *
 * @package WP_Navigator_MCP
 * @since 2.7.0
 */

import { toolRegistry, ToolCategory } from '../../tool-registry/index.js';
import type { ToolExecutionContext, ToolResult } from '../../tool-registry/types.js';
import { loadManifest, isManifestV2, getManifestAI, getManifestSafetyV2 } from '../../manifest.js';
import { getFocusMode, getFocusModePreset } from '../../focus-modes.js';
import { discoverCookbooks } from '../../cookbook/index.js';
import { discoverRoles, getRole, type LoadedRole } from '../../roles/index.js';
import { runtimeRoleState } from '../../roles/runtime-state.js';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';

// =============================================================================
// Types
// =============================================================================

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
// Context Building Helpers
// =============================================================================

/**
 * Group enabled tools by category
 */
function groupToolsByCategory(tools: Tool[]): Record<string, number> {
  const grouped: Record<string, number> = {};
  for (const tool of tools) {
    const name = tool.name;
    let category = 'other';
    if (
      name.startsWith('wpnav_list_') ||
      name.startsWith('wpnav_get_') ||
      name.startsWith('wpnav_create_') ||
      name.startsWith('wpnav_update_') ||
      name.startsWith('wpnav_delete_')
    ) {
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
    } else if (
      name.includes('search_tools') ||
      name.includes('describe_tools') ||
      name.includes('execute')
    ) {
      category = 'meta';
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

  const detected = introspect.detected_plugins as string[] | undefined;
  if (Array.isArray(detected)) {
    plugins.push(...detected);
  }

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

/**
 * Build context output from gathered data
 */
export async function buildContextOutput(
  context: ToolExecutionContext,
  options: { compact?: boolean; includeSnapshot?: boolean } = {}
): Promise<ContextOutput> {
  // 1. Fetch introspect data from WordPress
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

  // 9. Determine environment
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
      // Include tool list only if not compact mode
      ...(!options.compact ? { list: enabledTools.map((t) => t.name) } : {}),
    },
    role: activeRole
      ? {
          active: activeRoleSlug,
          name: activeRole.name,
          context: !options.compact ? activeRole.context : null,
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

  return contextOutput;
}

// =============================================================================
// Tool Definition
// =============================================================================

/**
 * Tool definition for wpnav_context
 */
export const contextToolDefinition = {
  name: 'wpnav_context',
  description:
    'Get a compact context dump of the WordPress site including focus mode, available tools, active role, cookbooks, site info, and safety settings. Designed for AI agent initialization.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      compact: {
        type: 'boolean',
        description:
          'If true, returns minimal context (~200-300 tokens). If false, includes full tool list and role context.',
        default: true,
      },
      include_snapshot: {
        type: 'boolean',
        description: 'If true, includes a summary of pages and posts. Increases token usage.',
        default: false,
      },
    },
  },
};

// =============================================================================
// Handler
// =============================================================================

/**
 * Handler for wpnav_context
 *
 * Returns context dump for AI agent initialization.
 */
export async function contextToolHandler(
  args: { compact?: boolean; include_snapshot?: boolean },
  context: ToolExecutionContext
): Promise<ToolResult> {
  const { compact = true, include_snapshot = false } = args;

  try {
    const contextOutput = await buildContextOutput(context, {
      compact,
      includeSnapshot: include_snapshot,
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(contextOutput, null, 2),
        },
      ],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              error: 'CONTEXT_FAILED',
              message: `Failed to gather context: ${errorMessage}`,
              hint: 'Ensure WordPress site is reachable and WP Navigator plugin is active',
            },
            null,
            2
          ),
        },
      ],
    };
  }
}

// =============================================================================
// Registration
// =============================================================================

/**
 * Register the context tool
 */
export function registerContextTool(): void {
  toolRegistry.register({
    definition: contextToolDefinition,
    handler: contextToolHandler,
    category: ToolCategory.CORE,
  });
}
