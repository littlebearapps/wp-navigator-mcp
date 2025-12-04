#!/usr/bin/env node
// Generate MCP-TOOL-AUTHORITY.yaml from code
//
// Parses src/tools.ts and src/tools/[category]/index.ts to generate
// a canonical authority file for tool-endpoint mappings.
//
// Usage: npm run generate:authority

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// Read package.json for version info
const packageJson = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const mcpVersion = packageJson.version;

/**
 * Extract tool definitions from legacy tools.ts
 */
function extractLegacyTools() {
  const content = readFileSync(join(ROOT, 'src/tools.ts'), 'utf8');
  const tools = [];

  // Match tool definitions: { name: 'wpnav_...', description: '...' }
  const toolRegex = /\{\s*name:\s*['"]([^'"]+)['"]\s*,\s*description:\s*['"`]([^'"`]+(?:['"`][^'"`]*['"`])?[^'"`]*)['"`,]/gs;

  let match;
  while ((match = toolRegex.exec(content)) !== null) {
    const name = match[1];
    const description = match[2]
      .replace(/\s+/g, ' ')
      .trim();

    // Skip aliases (like wpnav.help)
    if (name.includes('.')) continue;

    tools.push({ name, description });
  }

  return tools;
}

/**
 * Extract tool definitions from registry-based files
 */
function extractRegistryTools() {
  const toolsDir = join(ROOT, 'src/tools');
  const tools = [];

  const categories = readdirSync(toolsDir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

  for (const category of categories) {
    const indexPath = join(toolsDir, category, 'index.ts');
    try {
      const content = readFileSync(indexPath, 'utf8');

      // Match toolRegistry.register({ definition: { name: '...', description: '...' }
      const defRegex = /toolRegistry\.register\(\{\s*definition:\s*\{\s*name:\s*['"]([^'"]+)['"]\s*,\s*description:\s*['"`]([^'"`]+)['"`,]/gs;

      let match;
      while ((match = defRegex.exec(content)) !== null) {
        const name = match[1];
        const description = match[2]
          .replace(/\s+/g, ' ')
          .trim();

        tools.push({ name, description, category });
      }
    } catch (e) {
      // Skip if index.ts doesn't exist
    }
  }

  return tools;
}

/**
 * Categorize tools by naming convention
 */
function categorizeTools(tools) {
  const categories = {
    core: { description: 'Core API introspection and help', tools: [] },
    pages: { description: 'Page management', tools: [] },
    posts: { description: 'Post management', tools: [] },
    media: { description: 'Media library management', tools: [] },
    comments: { description: 'Comment management', tools: [] },
    categories: { description: 'Category taxonomy', tools: [] },
    tags: { description: 'Tag taxonomy', tools: [] },
    taxonomies: { description: 'Custom taxonomies', tools: [] },
    users: { description: 'User management', tools: [] },
    plugins: { description: 'Plugin management', tools: [] },
    themes: { description: 'Theme management', tools: [] },
    gutenberg: { description: 'Gutenberg block editor', tools: [] },
    testing: { description: 'Testing utilities', tools: [] },
  };

  for (const tool of tools) {
    const name = tool.name;

    if (name.includes('help') || name.includes('introspect')) {
      categories.core.tools.push(tool);
    } else if (name.includes('_page')) {
      categories.pages.tools.push(tool);
    } else if (name.includes('_post') && !name.includes('_comment')) {
      categories.posts.tools.push(tool);
    } else if (name.includes('_media')) {
      categories.media.tools.push(tool);
    } else if (name.includes('_comment')) {
      categories.comments.tools.push(tool);
    } else if (name.includes('_categor')) {
      categories.categories.tools.push(tool);
    } else if (name.includes('_tag')) {
      categories.tags.tools.push(tool);
    } else if (name.includes('_taxonom')) {
      categories.taxonomies.tools.push(tool);
    } else if (name.includes('_user')) {
      categories.users.tools.push(tool);
    } else if (name.includes('_plugin')) {
      categories.plugins.tools.push(tool);
    } else if (name.includes('_theme')) {
      categories.themes.tools.push(tool);
    } else if (name.includes('gutenberg')) {
      categories.gutenberg.tools.push(tool);
    } else if (name.includes('test') || name.includes('seed')) {
      categories.testing.tools.push(tool);
    } else {
      // Default to core
      categories.core.tools.push(tool);
    }
  }

  return categories;
}

/**
 * Infer endpoint from tool name
 */
function inferEndpoint(name) {
  // Core endpoints
  if (name === 'wpnav_introspect') return 'GET /wpnav/v1/introspect';
  if (name === 'wpnav_help') return null; // Client-side only

  // Testing endpoints
  if (name === 'wpnav_test_metrics') return null; // Client-side only
  if (name === 'wpnav_seed_test_data') return null; // Uses multiple endpoints

  // Gutenberg endpoints
  if (name.startsWith('wpnav_gutenberg_')) {
    const action = name.replace('wpnav_gutenberg_', '');
    if (action === 'introspect') return 'GET /wpnav/v1/gutenberg/introspect';
    if (action === 'list_blocks') return 'GET /wpnav/v1/gutenberg/blocks';
    if (action === 'insert_block') return 'POST /wpnav/v1/gutenberg/blocks';
    if (action === 'replace_block') return 'PUT /wpnav/v1/gutenberg/blocks/{post_id}/{path}';
    if (action === 'delete_block') return 'DELETE /wpnav/v1/gutenberg/blocks/{post_id}/{path}';
    if (action === 'move_block') return 'POST /wpnav/v1/gutenberg/blocks/{post_id}/{path}/move';
    if (action === 'list_patterns') return 'GET /wpnav/v1/gutenberg/patterns';
    return 'GET /wpnav/v1/gutenberg/' + action;
  }

  // Theme endpoints (custom wpnav endpoints)
  if (name === 'wpnav_list_themes') return 'GET /wp/v2/themes';
  if (name === 'wpnav_get_theme') return 'GET /wp/v2/themes/{stylesheet}';
  if (name === 'wpnav_activate_theme') return 'POST /wpnav/v1/themes/activate';
  if (name === 'wpnav_install_theme') return 'POST /wpnav/v1/themes/install';
  if (name === 'wpnav_update_theme') return 'POST /wpnav/v1/themes/update';
  if (name === 'wpnav_delete_theme') return 'DELETE /wpnav/v1/themes/{stylesheet}';
  if (name === 'wpnav_revert_theme') return 'POST /wpnav/v1/themes/revert';

  // Plugin endpoints (custom wpnav endpoints)
  if (name === 'wpnav_list_plugins') return 'GET /wp/v2/plugins';
  if (name === 'wpnav_get_plugin') return 'GET /wp/v2/plugins/{plugin}';
  if (name === 'wpnav_activate_plugin') return 'POST /wpnav/v1/plugins/activate';
  if (name === 'wpnav_deactivate_plugin') return 'POST /wpnav/v1/plugins/deactivate';
  if (name === 'wpnav_install_plugin') return 'POST /wpnav/v1/plugins/install';
  if (name === 'wpnav_update_plugin') return 'POST /wpnav/v1/plugins/update';
  if (name === 'wpnav_delete_plugin') return 'DELETE /wpnav/v1/plugins/{plugin}';

  // Standard WordPress REST API patterns
  const patterns = [
    { match: /^wpnav_list_(.+)s$/, template: 'GET /wp/v2/{resource}' },
    { match: /^wpnav_get_(.+)$/, template: 'GET /wp/v2/{resource}s/{id}' },
    { match: /^wpnav_create_(.+)$/, template: 'POST /wp/v2/{resource}s' },
    { match: /^wpnav_update_(.+)$/, template: 'PUT /wp/v2/{resource}s/{id}' },
    { match: /^wpnav_delete_(.+)$/, template: 'DELETE /wp/v2/{resource}s/{id}' },
  ];

  for (const { match, template } of patterns) {
    const m = name.match(match);
    if (m) {
      const resource = m[1];
      // Handle pluralization
      const plural = resource.endsWith('y') ? resource.slice(0, -1) + 'ies' : resource + 's';
      return template.replace('{resource}', resource).replace('{resource}s', plural);
    }
  }

  return 'UNKNOWN';
}

/**
 * Generate YAML output
 */
function generateYaml(categories) {
  const date = new Date().toISOString().split('T')[0];

  let yaml = '# MCP-TOOL-AUTHORITY.yaml\n';
  yaml += '# Canonical source for WP Navigator MCP tool definitions\n';
  yaml += '# Auto-generated by scripts/generate-authority.mjs\n';
  yaml += '#\n';
  yaml += '# DO NOT EDIT MANUALLY - regenerate with: npm run generate:authority\n\n';
  yaml += 'schema_version: "1.0"\n';
  yaml += 'mcp_version: "' + mcpVersion + '"\n';
  yaml += 'min_plugin_version: "1.4.0"\n';
  yaml += 'generated: "' + date + '"\n\n';
  yaml += '# Tool categories with endpoint mappings\n';
  yaml += 'categories:\n';

  let totalTools = 0;

  for (const [catName, category] of Object.entries(categories)) {
    if (category.tools.length === 0) continue;

    yaml += '  ' + catName + ':\n';
    yaml += '    description: "' + category.description + '"\n';
    yaml += '    tools:\n';

    for (const tool of category.tools) {
      totalTools++;
      const endpoint = inferEndpoint(tool.name);
      const isWordPressCore = endpoint && endpoint.includes('/wp/v2/');
      const isClientSide = endpoint === null;

      yaml += '      - name: ' + tool.name + '\n';
      yaml += '        description: "' + tool.description.replace(/"/g, '\\"') + '"\n';

      if (isClientSide) {
        yaml += '        endpoint: null  # Client-side only\n';
      } else if (endpoint) {
        yaml += '        endpoint: "' + endpoint + '"\n';
        if (isWordPressCore) {
          yaml += '        wordpress_core: true\n';
        }
      }
      yaml += '        since_mcp: "1.0.0"\n';
    }
  }

  yaml += '\n# Summary\n';
  yaml += 'summary:\n';
  yaml += '  total_tools: ' + totalTools + '\n';
  yaml += '  categories: ' + Object.keys(categories).filter(k => categories[k].tools.length > 0).length + '\n';

  return yaml;
}

// Main
console.log('Generating MCP-TOOL-AUTHORITY.yaml...');

const legacyTools = extractLegacyTools();
console.log('  Found ' + legacyTools.length + ' tools in src/tools.ts');

const registryTools = extractRegistryTools();
console.log('  Found ' + registryTools.length + ' tools in src/tools/*/index.ts');

// Deduplicate by name (registry takes precedence)
const allToolsMap = new Map();
for (const tool of legacyTools) {
  allToolsMap.set(tool.name, tool);
}
for (const tool of registryTools) {
  allToolsMap.set(tool.name, tool);
}

const allTools = Array.from(allToolsMap.values());
console.log('  Total unique tools: ' + allTools.length);

const categories = categorizeTools(allTools);
const yaml = generateYaml(categories);

const outputPath = join(ROOT, 'docs/MCP-TOOL-AUTHORITY.yaml');
writeFileSync(outputPath, yaml);

console.log('\nGenerated: ' + outputPath);
console.log('Done!');
