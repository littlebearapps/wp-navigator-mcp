#!/usr/bin/env node

/**
 * WP Navigator Pro MCP Server
 *
 * Enables MCP clients to interact with WordPress via typed MCP tools.
 * Provides type-safe, policy-aware WordPress operations.
 *
 * @package WP_Navigator_Pro
 * @since 1.1.0
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { loadEnvFromArgOrDotEnv, getConfigOrExit } from './config.js';
import { makeWpRequest } from './http.js';
import { logger } from './logger.js';
import { clampText } from './output.js';
import { validateStartup, printStartupSummary, printFriendlyError } from './startup-validator.js';
import { toolRegistry, createToolFilter } from './tool-registry/index.js';
import { registerAllTools } from './tools/index.js';
import {
  loadManifest,
  isManifestV2,
  getManifestTools,
  getManifestRoles,
  getManifestAI,
} from './manifest.js';
import { resolveFocusMode, getFocusMode, mergeFocusModeWithManifest } from './focus-modes.js';
import {
  registerAllResources,
  handleListResources,
  handleReadResource,
} from './resources/index.js';

/**
 * Meta-tools exposed via MCP ListTools (v2.7.0 Dynamic Toolsets)
 *
 * These are the only tools directly exposed to MCP clients.
 * All other tools must be discovered via wpnav_search_tools and
 * executed via wpnav_execute.
 *
 * This reduces token usage from ~19,500 tokens (75 tools) to ~800 tokens.
 */
const META_TOOLS = new Set([
  'wpnav_introspect',
  'wpnav_search_tools',
  'wpnav_describe_tools',
  'wpnav_execute',
  'wpnav_context',
]);

/**
 * Start the MCP server.
 *
 * This function initializes configuration, registers tools and resources,
 * validates the WordPress connection, and starts the MCP server.
 *
 * Exported for use by:
 * - src/index.ts (dynamic import for npm usage)
 * - src/binary-entry.ts (static import for Bun compile)
 *
 * @since 2.7.0 - Refactored from module-level execution to exported function
 */
export async function startMcpServer(): Promise<void> {
  // Load configuration from file or environment (matches previous behavior)
  loadEnvFromArgOrDotEnv();
  const config = getConfigOrExit();

  // Create bound request helper (same behavior as prior inline function)
  const wpRequest = makeWpRequest(config);

  // Register all tools with the registry
  registerAllTools();

  // Register all resources with the registry
  registerAllResources();

  // Configure feature flags from config (must be before tool filter)
  toolRegistry.setFeatureFlag('WORKFLOWS_ENABLED', config.featureFlags.workflowsEnabled);
  toolRegistry.setFeatureFlag(
    'WP_BULK_VALIDATOR_ENABLED',
    config.featureFlags.bulkValidatorEnabled
  );
  toolRegistry.setFeatureFlag('WP_SEO_AUDIT_ENABLED', config.featureFlags.seoAuditEnabled);
  toolRegistry.setFeatureFlag(
    'WP_CONTENT_REVIEWER_ENABLED',
    config.featureFlags.contentReviewerEnabled
  );
  toolRegistry.setFeatureFlag(
    'WP_MIGRATION_PLANNER_ENABLED',
    config.featureFlags.migrationPlannerEnabled
  );
  toolRegistry.setFeatureFlag(
    'WP_PERFORMANCE_ANALYZER_ENABLED',
    config.featureFlags.performanceAnalyzerEnabled
  );

  // Load manifest and apply tool filter (v2.7.0+)
  const manifestResult = loadManifest();

  // Check for manifest parse errors (P1 fix: don't silently ignore malformed manifests)
  if (manifestResult.found && manifestResult.error) {
    logger.error('Failed to parse wpnavigator.jsonc manifest', {
      error: manifestResult.error,
      path: manifestResult.path,
    });
    // Continue with default tool access, but warn the user
    logger.warn(
      'Server starting with default tool access due to manifest error. ' +
        'Fix the manifest to apply focus-mode, tool, and role restrictions.'
    );
  }

  if (manifestResult.found && manifestResult.manifest && isManifestV2(manifestResult.manifest)) {
    const manifest = manifestResult.manifest;

    // Resolve focus mode and merge with manifest tools (v2.7.0)
    const focusMode = getFocusMode(manifest);
    const resolvedFocusMode = resolveFocusMode(focusMode, manifest);
    const rawManifestTools = getManifestTools(manifest);
    const manifestTools = mergeFocusModeWithManifest(resolvedFocusMode, rawManifestTools);
    const manifestRoles = getManifestRoles(manifest);

    // Resolve effective role (config active or auto-detect at startup)
    // Note: Runtime overrides from wpnav_load_role will recompute the filter
    const { resolveEffectiveRoleSync, runtimeRoleState } = await import('./roles/index.js');
    const effectiveRole = resolveEffectiveRoleSync({
      manifestRoles,
      runtimeRoleOverride: runtimeRoleState.getRole(),
      roleOverrides: manifestRoles.overrides,
      // userCapabilities will be populated after first introspect call if auto_detect
    });

    // Create filter options (stored for later recomputation)
    const filterOptions = {
      manifestTools,
      allTools: toolRegistry.getAllTools(),
      featureFlags: toolRegistry.getFeatureFlags(),
      activeRole: effectiveRole.role,
      roleOverrides: manifestRoles.overrides,
    };

    // Create and apply tool filter
    const filter = createToolFilter(filterOptions);
    toolRegistry.applyFilter(filter, filterOptions);

    // Log warnings for invalid patterns or tool names
    const allWarnings = [...filter.warnings, ...effectiveRole.warnings];
    if (allWarnings.length > 0) {
      logger.warn('Tool filter warnings', { warnings: allWarnings });
    }

    // Log summary
    const roleInfo = effectiveRole.role
      ? `role "${effectiveRole.role.name}" (${effectiveRole.source})`
      : 'no role';
    logger.info(
      `Tool filter applied: ${filter.enabledTools.size} tools enabled, focus "${focusMode}", ${roleInfo}`
    );
  }

  // Initialize MCP server
  const server = new Server(
    {
      name: 'wp-navigator',
      version: '2.7.0',
    },
    {
      capabilities: {
        tools: {},
        resources: {},
      },
    }
  );

  /**
   * Tool Definitions (v2.7.0 Dynamic Toolsets)
   *
   * Only exposes meta-tools to reduce token usage from ~19,500 to ~800 tokens.
   * AI agents should use:
   *   1. wpnav_introspect - Get API capabilities
   *   2. wpnav_search_tools - Discover tools by query/category
   *   3. wpnav_describe_tools - Get full schemas for specific tools
   *   4. wpnav_execute - Execute any tool dynamically
   *   5. wpnav_context - Get compact site context
   */
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    // Return only meta-tools (not all 75+ tools)
    const metaToolDefs = Array.from(META_TOOLS)
      .map((name) => toolRegistry.getTool(name)?.definition)
      .filter((def): def is NonNullable<typeof def> => def !== undefined);

    return { tools: metaToolDefs };
  });

  /**
   * Tool Implementations (v2.7.0 Dynamic Toolsets)
   *
   * Meta-tools execute directly. Non-meta-tools must go through wpnav_execute.
   */
  server.setRequestHandler(CallToolRequestSchema, async (request): Promise<any> => {
    const { name, arguments: args = {} } = request.params;

    // Check if this is a meta-tool (direct execution allowed)
    if (!META_TOOLS.has(name)) {
      // Non-meta-tools must be called via wpnav_execute
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                error: 'DIRECT_CALL_NOT_ALLOWED',
                message: `Tool '${name}' must be called via wpnav_execute`,
                hint: 'Use wpnav_search_tools to discover tools, wpnav_describe_tools to get schemas, then wpnav_execute to run them',
              },
              null,
              2
            ),
          },
        ],
      };
    }

    // Execute meta-tool via registry
    const tool = toolRegistry.getTool(name);
    if (!tool) {
      throw new Error(`Unknown tool: ${name}`);
    }

    if (!toolRegistry.isEnabled(name)) {
      throw new Error(`Tool is disabled: ${name}`);
    }

    try {
      // Build execution context
      const context = {
        wpRequest: (endpoint: string, options?: RequestInit) => wpRequest(endpoint, options),
        config,
        logger,
        clampText: (text: string) => clampText(text, config),
      };

      // Execute tool via registry
      logger.debug(`[Registry] Executing meta-tool: ${name}`);
      return await toolRegistry.execute(name, args, context);
    } catch (error) {
      // Surface errors to the MCP client as JSON‑RPC errors
      throw error instanceof Error ? error : new Error(String(error));
    }
  });

  /**
   * Resource Definitions
   */
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return handleListResources();
  });

  /**
   * Resource Implementations
   */
  server.setRequestHandler(ReadResourceRequestSchema, async (request): Promise<any> => {
    const { uri } = request.params;

    // Build execution context for resource generators
    const context = {
      wpRequest: (endpoint: string, options?: RequestInit) => wpRequest(endpoint, options),
      config,
    };

    return handleReadResource(uri, context);
  });

  // Run startup validation and start server
  try {
    const validation = await validateStartup(wpRequest, config);
    printStartupSummary(validation, config);

    // If validation failed, exit
    if (!validation.allPassed) {
      process.exit(1);
    }

    // Start MCP server
    const transport = new StdioServerTransport();
    await server.connect(transport);

    logger.info('MCP Server running on stdio');
  } catch (error: any) {
    printFriendlyError(error);
    throw error;
  }
}
