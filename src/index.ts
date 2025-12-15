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
import { tools } from './tools.js';
import { loadEnvFromArgOrDotEnv, getConfigOrExit } from './config.js';
import { makeWpRequest } from './http.js';
import { validateArgsForTool } from './validation.js';
import { logger } from './logger.js';
import { clampText } from './output.js';
import { applyContentChanges } from './safety.js';
import { validateStartup, printStartupSummary, printFriendlyError } from './startup-validator.js';
import { toolRegistry } from './tool-registry/index.js';
import { registerAllTools } from './tools/index.js';
import {
  registerAllResources,
  handleListResources,
  handleReadResource,
} from './resources/index.js';

// Load configuration from file or environment (matches previous behavior)
loadEnvFromArgOrDotEnv();
const config = getConfigOrExit();

// Create bound request helper (same behavior as prior inline function)
const wpRequest = makeWpRequest(config);

// Register all tools with the registry
registerAllTools();

// Register all resources with the registry
registerAllResources();

// Configure feature flags from config
toolRegistry.setFeatureFlag('WORKFLOWS_ENABLED', config.featureFlags.workflowsEnabled);
toolRegistry.setFeatureFlag('WP_BULK_VALIDATOR_ENABLED', config.featureFlags.bulkValidatorEnabled);
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

// (wpRequest implementation moved to ./http.ts)

// Initialize MCP server
const server = new Server(
  {
    name: 'wp-navigator',
    version: '2.6.0',
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

/**
 * Tool Definitions
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  // Return tools from registry (only includes enabled tools)
  const enabledTools = toolRegistry.getAllDefinitions();

  // Also include legacy tools for backward compatibility during migration
  const allTools = [...enabledTools, ...tools];

  // Deduplicate by name (registry tools take precedence)
  const seen = new Set<string>();
  const uniqueTools = allTools.filter((tool) => {
    if (seen.has(tool.name)) return false;
    seen.add(tool.name);
    return true;
  });

  return { tools: uniqueTools };
});

/**
 * Tool Implementations
 */
server.setRequestHandler(CallToolRequestSchema, async (request): Promise<any> => {
  const { name, arguments: args = {} } = request.params;

  // Execute tool via registry
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
    logger.debug(`[Registry] Executing tool: ${name}`);
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

/**
 * Start server
 */
async function main() {
  try {
    // Run startup validation
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
  }
}

main();
