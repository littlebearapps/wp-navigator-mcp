# Tool Registry System

**Version**: 1.3.0
**Status**: ✅ Complete (Day 2: MCP Server Modularity)
**Purpose**: Centralized tool management system for MCP server scalability

---

## Overview

The Tool Registry System provides a scalable, maintainable architecture for managing MCP tools. It replaces the monolithic switch statement approach with a flexible registry pattern that supports:

- **Dynamic tool registration** - Add tools without modifying core server code
- **Category organization** - Group related tools for better discoverability
- **Feature flags** - Safe rollout of new tools with per-tool control
- **Alias support** - Backward compatibility for tool name changes
- **Shared utilities** - Reusable validation and transformation logic
- **Type safety** - Full TypeScript support for tool definitions and handlers

---

## Architecture

### Core Components

```
src/tool-registry/
├── types.ts       # TypeScript interfaces and enums
├── registry.ts    # Main registry implementation
├── utils.ts       # Shared validation utilities
├── index.ts       # Module exports
├── registry.test.ts  # Registry unit tests
└── utils.test.ts     # Utilities unit tests
```

### Tool Categories

Tools are organized into 7 categories:

| Category | Description | Example Tools |
|----------|-------------|---------------|
| `CORE` | Core server functionality | introspect, help, status |
| `CONTENT` | Pages, posts, media, comments | list_pages, create_post, delete_media |
| `TAXONOMY` | Categories, tags, taxonomies | list_categories, create_tag, get_taxonomy |
| `USERS` | User management | list_users, create_user, update_user |
| `PLUGINS` | Plugin management | list_plugins, activate_plugin, update_plugin |
| `THEMES` | Theme management | list_themes, activate_theme, delete_theme |
| `WORKFLOWS` | AI-powered workflows | bulk_validator, seo_audit, content_reviewer |

---

## Usage Guide

### 1. Registering a Tool

Tools are registered using the `toolRegistry.register()` method:

```typescript
import { toolRegistry, ToolCategory } from './tool-registry/index.js';

// Register a simple tool
toolRegistry.register({
  definition: {
    name: 'wpnav_list_pages',
    description: 'List WordPress pages with optional filtering',
    inputSchema: {
      type: 'object',
      properties: {
        page: { type: 'number', description: 'Page number (default: 1)' },
        per_page: { type: 'number', description: 'Items per page (default: 10, max: 100)' },
        status: { type: 'string', enum: ['publish', 'draft', 'private', 'any'] },
        search: { type: 'string', description: 'Search term' },
      },
      required: [],
    },
  },
  handler: async (args, context) => {
    const { page, per_page } = validatePagination(args);
    const status = normalizeStatus(args.status);

    const qs = buildQueryString({ page, per_page, status, search: args.search });
    const response = await context.wpRequest(`${context.config.restApi}/wp/v2/pages?${qs}`);

    return {
      content: [{ type: 'text', text: JSON.stringify(response, null, 2) }],
    };
  },
  category: ToolCategory.CONTENT,
});
```

### 2. Tool with Feature Flag

Tools can be gated behind feature flags for safe rollout:

```typescript
toolRegistry.register({
  definition: {
    name: 'wpnav_bulk_validator',
    description: 'Validate multiple pages/posts in a single request',
    inputSchema: { /* ... */ },
  },
  handler: async (args, context) => {
    // Implementation
  },
  category: ToolCategory.WORKFLOWS,
  featureFlag: 'WORKFLOWS_ENABLED', // Tool is disabled unless flag is true
});

// Enable the feature flag
toolRegistry.setFeatureFlag('WORKFLOWS_ENABLED', true);
```

### 3. Tool with Aliases

Support backward compatibility with legacy tool names:

```typescript
toolRegistry.register({
  definition: {
    name: 'wpnav_list_pages',
    description: 'List WordPress pages',
    inputSchema: { /* ... */ },
  },
  handler: async (args, context) => { /* ... */ },
  category: ToolCategory.CONTENT,
  aliases: ['list_pages', 'pages.list'], // Legacy names
});

// All of these work:
// - wpnav_list_pages (canonical name)
// - list_pages (legacy alias)
// - pages.list (legacy alias)
```

---

## Shared Utilities

The `utils.ts` module provides reusable validation and transformation functions:

### Validation Utilities

```typescript
import {
  validateRequired,
  validatePagination,
  validateId,
  validateEnum,
  validateArray,
  parseBoolean,
} from './tool-registry/utils.js';

// Validate required fields
validateRequired(args, ['id', 'title']); // Throws if missing

// Validate pagination parameters
const { page, per_page } = validatePagination(args);
// Returns: { page: 1, per_page: 10 } (with defaults and limits)

// Validate positive integer ID
const id = validateId(args.id); // Throws if not positive integer
const pageId = validateId(args.id, 'Page'); // Custom error message

// Validate enum value
const status = validateEnum(args.status, ['publish', 'draft', 'private'], 'status', 'publish');
// Returns validated enum value or default

// Validate array (accepts array or comma-separated string)
const tags = validateArray(args.tags, 'tags');
// Accepts: ['a', 'b'] or 'a, b, c'

// Parse boolean (accepts various formats)
const enabled = parseBoolean(args.enabled);
// Accepts: true, 'true', '1', 'yes', 'on', 1
```

### Transformation Utilities

```typescript
import {
  buildQueryString,
  extractSummary,
  normalizeStatus,
} from './tool-registry/utils.js';

// Build query string from object
const qs = buildQueryString({ page: 1, per_page: 10, search: 'hello' });
// Returns: 'page=1&per_page=10&search=hello'

// Extract specific fields from object
const summary = extractSummary(post, ['id', 'title.rendered', 'status']);
// Returns: { id: 123, 'title.rendered': 'Post Title', status: 'publish' }

// Normalize status value
const status = normalizeStatus('PUBLISH'); // Returns: 'publish'
const status = normalizeStatus(); // Returns: 'publish' (default)
```

---

## Tool Execution Context

All tool handlers receive a standardized execution context:

```typescript
export interface ToolExecutionContext {
  wpRequest: (endpoint: string, options?: RequestInit) => Promise<any>;
  config: WPConfig;
  logger: any;
  clampText: (text: string) => string;
}
```

### Using the Context

```typescript
const handler = async (args, context) => {
  // Make WordPress REST API request
  const response = await context.wpRequest('/wp-json/wp/v2/posts');

  // Access configuration
  const baseUrl = context.config.baseUrl;
  const maxKb = context.config.toggles.maxResponseKb;

  // Clamp text to configured size limit
  const clamped = context.clampText(JSON.stringify(response));

  // Log debug information
  context.logger.debug('Fetched posts:', response.length);

  return {
    content: [{ type: 'text', text: clamped }],
  };
};
```

---

## Feature Flags

Feature flags control tool availability at runtime:

### Configuration

Feature flags are configured via environment variables:

```bash
# Enable workflows category tools
WPNAV_FLAG_WORKFLOWS_ENABLED=1

# Enable specific workflow tools
WPNAV_FLAG_WP_BULK_VALIDATOR_ENABLED=1
WPNAV_FLAG_WP_SEO_AUDIT_ENABLED=1
WPNAV_FLAG_WP_CONTENT_REVIEWER_ENABLED=1
WPNAV_FLAG_WP_MIGRATION_PLANNER_ENABLED=1
WPNAV_FLAG_WP_PERFORMANCE_ANALYZER_ENABLED=1
```

### Checking Tool Status

```typescript
// Check if tool is enabled
const isEnabled = toolRegistry.isEnabled('wpnav_bulk_validator');

// Get all enabled tools
const definitions = toolRegistry.getAllDefinitions();
// Only returns tools that are enabled (no feature flag or flag is true)
```

### Runtime Feature Flag Control

```typescript
// Enable feature flag at runtime (testing/debugging)
toolRegistry.setFeatureFlag('WORKFLOWS_ENABLED', true);

// Check feature flag status
const isEnabled = toolRegistry.isFeatureFlagEnabled('WORKFLOWS_ENABLED');
```

---

## Testing

### Running Tests

```bash
# Install dependencies
npm install

# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

### Writing Tool Tests

```typescript
import { describe, it, expect } from 'vitest';
import { toolRegistry } from './tool-registry/registry.js';

describe('My Tool', () => {
  it('should handle valid input', async () => {
    const context = {
      wpRequest: async () => ({ id: 1, title: 'Test' }),
      config: { /* ... */ },
      logger: { debug: () => {} },
      clampText: (t) => t,
    };

    const result = await toolRegistry.execute('my_tool', { id: 1 }, context);

    expect(result.content[0].type).toBe('text');
    expect(result.content[0].text).toContain('Test');
  });

  it('should validate required fields', async () => {
    await expect(
      toolRegistry.execute('my_tool', {}, context)
    ).rejects.toThrow('Missing required fields: id');
  });
});
```

---

## Integration with Main Server

### Current State (index.ts)

The main server currently uses a 73-line switch statement:

```typescript
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case 'wpnav_introspect': { /* ... */ } break;
    case 'wpnav_list_pages': { /* ... */ } break;
    // ... 48 total tools
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});
```

### Migration Path

Replace the switch statement with registry-based execution:

```typescript
import { toolRegistry } from './tool-registry/index.js';

// Register all tools (in separate module)
import './tools/core/index.js';    // Registers core tools
import './tools/content/index.js'; // Registers content tools
import './tools/taxonomy/index.js'; // Registers taxonomy tools
// ... etc

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    // Build execution context
    const context = {
      wpRequest: (endpoint, options) => wpRequest(endpoint, options),
      config,
      logger,
      clampText: (text) => clampText(text, config.toggles.maxResponseKb),
    };

    // Execute tool via registry
    const result = await toolRegistry.execute(name, args, context);
    return result;

  } catch (error) {
    logger.error(`Tool execution error [${name}]:`, error);
    return {
      content: [{
        type: 'text',
        text: `Error: ${error instanceof Error ? error.message : String(error)}`,
      }],
      isError: true,
    };
  }
});

// List available tools (for introspection)
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: toolRegistry.getAllDefinitions(),
  };
});
```

---

## Best Practices

### 1. Tool Naming Convention

- **Canonical names**: Use `wpnav_` prefix (e.g., `wpnav_list_pages`)
- **Aliases**: Support legacy names without prefix for backward compatibility
- **Consistency**: Follow verb_noun pattern (e.g., `list_pages`, `create_post`, `delete_user`)

### 2. Error Handling

```typescript
const handler = async (args, context) => {
  try {
    // Validate inputs early
    validateRequired(args, ['id']);
    const id = validateId(args.id);

    // Make API request
    const response = await context.wpRequest(`/wp-json/wp/v2/posts/${id}`);

    // Return success
    return {
      content: [{ type: 'text', text: JSON.stringify(response, null, 2) }],
    };
  } catch (error) {
    // Let registry handle error formatting
    throw error;
  }
};
```

### 3. Input Validation

Always validate inputs at the start of the handler:

```typescript
const handler = async (args, context) => {
  // Validate required fields
  validateRequired(args, ['title']);

  // Validate optional fields with defaults
  const { page, per_page } = validatePagination(args);
  const status = normalizeStatus(args.status);

  // Validate enums
  const orderBy = validateEnum(args.orderBy, ['date', 'title', 'author'], 'orderBy', 'date');

  // Validate arrays
  const tags = validateArray(args.tags, 'tags');

  // Validate booleans
  const featured = parseBoolean(args.featured);

  // Now proceed with validated inputs
  // ...
};
```

### 4. Response Formatting

Use consistent response format:

```typescript
// Success response
return {
  content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
};

// Error response (throw error, let registry handle it)
throw new Error('Page not found');
```

### 5. Feature Flag Usage

Only use feature flags for:
- New experimental tools
- Beta features requiring opt-in
- Tools with external dependencies (API keys, etc.)

Don't use feature flags for:
- Core CRUD operations (list, get, create, update, delete)
- Stable, battle-tested features

---

## Registry API Reference

### ToolRegistry Class

```typescript
class ToolRegistry implements IToolRegistry {
  // Register a tool
  register(tool: RegisteredTool): void;

  // Get tool by name or alias
  getTool(name: string): RegisteredTool | undefined;

  // Get all enabled tool definitions (for introspection)
  getAllDefinitions(): Tool[];

  // Get tools by category
  getByCategory(category: ToolCategory): RegisteredTool[];

  // Check if tool is enabled (respects feature flags)
  isEnabled(name: string): boolean;

  // Execute tool with args and context
  async execute(name: string, args: any, context: ToolExecutionContext): Promise<ToolResult>;

  // Set feature flag (runtime control)
  setFeatureFlag(flag: string, enabled: boolean): void;

  // Check feature flag status
  isFeatureFlagEnabled(flag: string): boolean;

  // Get registry statistics
  getStats(): ToolRegistryStats;
}
```

### Global Registry Instance

```typescript
import { toolRegistry } from './tool-registry/index.js';

// The toolRegistry is a singleton instance
// Use it throughout your application
```

---

## Migration Checklist

When migrating existing tools to the registry:

- [ ] Create tool registration in appropriate category module
- [ ] Use shared validation utilities where applicable
- [ ] Add feature flag if tool is experimental
- [ ] Add aliases for backward compatibility
- [ ] Write unit tests for tool handler
- [ ] Update tool documentation
- [ ] Remove tool from old switch statement
- [ ] Test tool execution via registry
- [ ] Verify tool appears in introspection

---

## Statistics and Monitoring

Get registry statistics for monitoring:

```typescript
const stats = toolRegistry.getStats();

console.log(`Total tools: ${stats.totalTools}`);
console.log(`Enabled tools: ${stats.enabledTools}`);
console.log(`Disabled tools: ${stats.disabledTools}`);
console.log(`By category:`, stats.byCategory);

// Example output:
// Total tools: 53
// Enabled tools: 48
// Disabled tools: 5
// By category: {
//   core: 3,
//   content: 20,
//   taxonomy: 8,
//   users: 6,
//   plugins: 7,
//   themes: 6,
//   workflows: 3
// }
```

---

## Troubleshooting

### Tool Not Found

```
Error: Tool not found: wpnav_my_tool
```

**Solution**: Ensure tool is registered before server starts
```typescript
import './tools/my-tool.js'; // Register tool
```

### Tool Is Disabled

```
Error: Tool is disabled: wpnav_bulk_validator (requires feature flag: WORKFLOWS_ENABLED)
```

**Solution**: Enable feature flag in environment
```bash
export WPNAV_FLAG_WORKFLOWS_ENABLED=1
```

### Validation Errors

```
Error: Missing required fields: id, title
```

**Solution**: Ensure client passes all required fields
```typescript
await toolRegistry.execute('wpnav_create_page', {
  id: 123,        // ✅ Required field
  title: 'Test',  // ✅ Required field
}, context);
```

---

## Performance Considerations

- **O(1) lookup**: Tool lookup by name is constant time (Map-based)
- **Lazy loading**: Tools are only executed when called
- **Caching**: Tool definitions are cached after first introspection
- **Feature flags**: Checked once per execution (minimal overhead)

---

## Future Enhancements

Potential improvements for v1.4+:

1. **Middleware system**: Pre/post-execution hooks for logging, metrics, etc.
2. **Tool versioning**: Support multiple versions of same tool
3. **Rate limiting**: Per-tool rate limits
4. **Deprecation warnings**: Soft deprecation of old tools
5. **Tool groups**: Logical grouping beyond categories
6. **Dynamic tool loading**: Load tools on-demand from plugins

---

## Related Documentation

- **Implementation Plan**: `docs/plans/ai-tools-unified-mcp-implementation-plan.md`
- **Tool Definitions**: `src/tools.ts` (legacy, to be migrated)
- **Config Documentation**: `src/config.ts`
- **Testing Guide**: `docs/quickrefs/testing.md`

---

**Version**: 1.3.0
**Last Updated**: 2025-11-13
**Status**: ✅ Complete (Day 2: MCP Server Modularity)
