/**
 * Template generators for wpnav init
 *
 * Provides template rendering and file generation utilities
 * for the init wizard (CLAUDE.md, .mcp.json, etc.)
 */
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Context for CLAUDE.md template rendering
 */
export interface ClaudeMdContext {
  site_name?: string;
  site_url?: string;
  environment: string;
  generated_date: string;
  mcp_version: string;
}

/**
 * Options for .mcp.json generation
 */
export interface McpJsonOptions {
  /** Path to wpnav config file (default: ./wpnav.config.json) */
  configPath?: string;
  /** Enable write operations (default: false) */
  enableWrites?: boolean;
}

/**
 * Simple template renderer using regex-based replacement
 *
 * Supports:
 * - {{variable}} - Simple variable substitution
 * - {{#if var}}...{{/if}} - Conditional blocks (renders content if var is truthy)
 *
 * @param template - Template string with placeholders
 * @param context - Object with values to substitute
 * @returns Rendered template string
 */
export function renderTemplate(template: string, context: Record<string, unknown>): string {
  let result = template;

  // Handle {{#if var}}...{{/if}} blocks
  // Matches: {{#if varName}}content{{/if}}
  result = result.replace(
    /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g,
    (_match, varName: string, content: string) => {
      const value = context[varName];
      // Render content if value is truthy (not undefined, null, false, '', 0)
      return value ? content : '';
    }
  );

  // Handle {{variable}} substitutions
  result = result.replace(/\{\{(\w+)\}\}/g, (_match, varName: string) => {
    const value = context[varName];
    // Return empty string for undefined/null, otherwise convert to string
    return value !== undefined && value !== null ? String(value) : '';
  });

  return result;
}

/**
 * Load a template file from the templates directory
 *
 * @param templateName - Name of the template file (e.g., 'CLAUDE.md.template')
 * @returns Template content as string
 * @throws Error if template file not found
 */
export function loadTemplate(templateName: string): string {
  const templatePath = path.join(__dirname, '..', 'templates', templateName);
  try {
    return fs.readFileSync(templatePath, 'utf8');
  } catch (err) {
    throw new Error(`Template not found: ${templateName} (looked in ${templatePath})`);
  }
}

/**
 * Generate CLAUDE.md content from template
 *
 * @param context - Template context with site info
 * @returns Rendered CLAUDE.md content
 */
export function generateClaudeMd(context: ClaudeMdContext): string {
  const template = loadTemplate('CLAUDE.md.template');
  return renderTemplate(template, context as unknown as Record<string, unknown>);
}

/**
 * Generate AGENTS.md content from template (OpenAI Codex)
 *
 * @param context - Template context with site info
 * @returns Rendered AGENTS.md content
 */
export function generateAgentsMd(context: ClaudeMdContext): string {
  const template = loadTemplate('AGENTS.md.template');
  return renderTemplate(template, context as unknown as Record<string, unknown>);
}

/**
 * Generate GEMINI.md content from template (Google Gemini CLI)
 *
 * @param context - Template context with site info
 * @returns Rendered GEMINI.md content
 */
export function generateGeminiMd(context: ClaudeMdContext): string {
  const template = loadTemplate('GEMINI.md.template');
  return renderTemplate(template, context as unknown as Record<string, unknown>);
}

/**
 * Get default CLAUDE.md context with current date and package version
 *
 * @param overrides - Optional context values to override defaults
 * @returns Complete context for CLAUDE.md generation
 */
export function getDefaultClaudeMdContext(overrides?: Partial<ClaudeMdContext>): ClaudeMdContext {
  return {
    environment: 'local',
    generated_date: new Date().toISOString().split('T')[0],
    mcp_version: getPackageVersion(),
    ...overrides,
  };
}

/**
 * Get package version from package.json
 * Falls back to 'unknown' if not found
 */
function getPackageVersion(): string {
  try {
    // Navigate from dist/cli/init/ to project root
    const packagePath = path.join(__dirname, '..', '..', '..', 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    return packageJson.version || 'unknown';
  } catch {
    return 'unknown';
  }
}

/**
 * Generate .mcp.json content for Claude Code project-level MCP configuration
 *
 * This creates the Claude Code project MCP config format, which is different
 * from mcp-config.json (the general MCP setup guide).
 *
 * @param options - Generation options
 * @returns JSON string for .mcp.json file
 */
export function generateMcpJson(options: McpJsonOptions = {}): string {
  const { configPath = './wpnav.config.json', enableWrites = false } = options;

  return JSON.stringify(
    {
      mcpServers: {
        wpnav: {
          command: 'npx',
          args: ['-y', '@littlebearapps/wp-navigator-mcp', configPath],
          env: {
            WPNAV_ENABLE_WRITES: enableWrites ? '1' : '0',
          },
        },
      },
    },
    null,
    2
  );
}
