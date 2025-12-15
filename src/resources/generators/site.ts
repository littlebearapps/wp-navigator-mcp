/**
 * Site Context Resource Generator
 *
 * Generates wpnav://site/context content with current site information.
 *
 * @package WP_Navigator_MCP
 * @since 2.6.0
 */

import type { ResourceContent, ResourceGeneratorContext } from '../types.js';

/**
 * Generate site context content
 *
 * Fetches site information from WordPress REST API including:
 * - Site settings (title, description)
 * - Active theme
 * - Active plugins
 */
export async function generateSiteContext(
  context: ResourceGeneratorContext
): Promise<ResourceContent> {
  const { wpRequest, config } = context;

  // Fetch site data in parallel
  const [siteSettings, activeTheme, plugins] = await Promise.all([
    wpRequest('/wp/v2/settings').catch(() => ({})),
    wpRequest('/wp/v2/themes?status=active').catch(() => []),
    wpRequest('/wp/v2/plugins?status=active').catch(() => []),
  ]);

  // Parse active theme
  const theme = Array.isArray(activeTheme) && activeTheme.length > 0 ? activeTheme[0] : null;

  // Parse plugins
  const pluginList = Array.isArray(plugins) ? plugins : [];

  // Build markdown content
  const content = `# Site Context

## Site Information

- **Name**: ${siteSettings.title || 'Unknown'}
- **Tagline**: ${siteSettings.description || 'N/A'}
- **URL**: ${config.baseUrl}
- **REST API**: ${config.restApi}

## Active Theme

${
  theme
    ? `- **Name**: ${theme.name?.rendered || theme.stylesheet || 'Unknown'}
- **Version**: ${theme.version || 'Unknown'}
- **Stylesheet**: \`${theme.stylesheet || 'unknown'}\`
- **Is Child Theme**: ${theme.template && theme.template !== theme.stylesheet ? `Yes (Parent: \`${theme.template}\`)` : 'No'}`
    : 'Unable to retrieve theme information'
}

## Active Plugins (${pluginList.length})

${
  pluginList.length > 0
    ? pluginList
        .map((p: any) => {
          const slug = (p.plugin || '').split('/')[0];
          const name = p.name?.rendered || p.name || slug;
          return `- **${name}** (v${p.version || 'unknown'}) - \`${slug}\``;
        })
        .join('\n')
    : 'No active plugins or unable to retrieve plugin information'
}

## Configuration

- **Writes Enabled**: ${config.toggles?.enableWrites ? 'Yes' : 'No'}

## Available Cookbooks

Use \`wpnav_match_cookbooks\` to find AI guidance cookbooks for your active plugins.

## Next Steps

1. Use \`wpnav_list_pages\` to see site pages
2. Use \`wpnav_list_posts\` to see blog posts
3. Use \`wpnav_list_plugins\` for full plugin details
4. Load a role with \`wpnav://roles/{slug}\` for focused assistance
`;

  return {
    uri: 'wpnav://site/context',
    mimeType: 'text/markdown',
    text: content,
  };
}
