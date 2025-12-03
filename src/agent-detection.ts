/**
 * AI Agent Detection
 *
 * Detects which AI agent is running this MCP server and provides
 * agent identification headers for WordPress actor attribution.
 *
 * @package WP_Navigator_MCP
 * @since 1.2.0
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * Detect which AI agent is running this MCP server
 *
 * @returns Agent slug (e.g., 'claude-code', 'codex', 'gemini-cli', 'mcp-client')
 */
export function detectAgent(): string {
  // Check environment variables
  if (process.env.CLAUDE_CODE_SESSION) return 'claude-code';
  if (process.env.CODEX_SESSION) return 'codex';
  if (process.env.GEMINI_CLI_SESSION) return 'gemini-cli';

  // Check process.title (set by CLI tools)
  const title = process.title?.toLowerCase() || '';
  if (title.includes('claude')) return 'claude-code';
  if (title.includes('codex')) return 'codex';
  if (title.includes('gemini')) return 'gemini-cli';

  // Check parent process name (macOS/Linux only)
  // This is a best-effort detection and may not work in all environments
  try {
    const ppid = process.ppid;
    // Could inspect parent process via ps command
    // (omitted for brevity - would exec `ps -p ${ppid} -o comm=`)
  } catch (e) {
    // Fallback
  }

  // Generic MCP client
  return 'mcp-client';
}

/**
 * Get human-readable agent name
 *
 * @returns Human-readable agent name with model info
 */
export function getAgentName(): string {
  const agent = detectAgent();
  const modelInfo = detectModelInfo();

  const names: Record<string, string> = {
    'claude-code': `Claude Code (${modelInfo})`,
    'codex': `Codex (${modelInfo})`,
    'gemini-cli': `Gemini CLI (${modelInfo})`,
    'mcp-client': 'Generic MCP Client',
  };

  return names[agent] || 'Unknown Agent';
}

/**
 * Detect AI model info from environment
 *
 * @returns AI model name or 'Unknown'
 */
function detectModelInfo(): string {
  // Claude Desktop / Claude Code sets these
  if (process.env.ANTHROPIC_MODEL) return process.env.ANTHROPIC_MODEL;

  // Codex / OpenAI CLI
  if (process.env.OPENAI_MODEL) return process.env.OPENAI_MODEL;

  // Gemini
  if (process.env.GEMINI_MODEL) return process.env.GEMINI_MODEL;

  // Fallback: infer from agent
  const agent = detectAgent();
  if (agent === 'claude-code') return 'Sonnet 4';
  if (agent === 'codex') return 'GPT-5';
  if (agent === 'gemini-cli') return 'Gemini 2.0 Flash';

  return 'Unknown';
}

/**
 * Get or create persistent session UUID
 *
 * Session ID is stored in ~/.wpnav-session-id and persists across
 * MCP server restarts to correlate operations within the same AI session.
 *
 * @returns Session UUID v4
 */
export function getOrCreateSessionId(): string {
  const sessionFile = path.join(os.homedir(), '.wpnav-session-id');

  try {
    if (fs.existsSync(sessionFile)) {
      const sessionId = fs.readFileSync(sessionFile, 'utf-8').trim();
      if (sessionId && sessionId.length === 36) {
        return sessionId;
      }
    }
  } catch (e) {
    // File doesn't exist or not readable
  }

  // Generate new UUID v4
  const uuid = crypto.randomUUID();

  try {
    fs.writeFileSync(sessionFile, uuid, 'utf-8');
  } catch (e) {
    // Can't persist, just use in-memory UUID
  }

  return uuid;
}

/**
 * Generate HMAC signature for request
 *
 * Implements Stripe-style HMAC-SHA256 signature validation:
 * - Canonical string: {METHOD}\n{PATH}\n{TIMESTAMP}\n{BODY_SHA256}
 * - Signature: Base64(HMAC-SHA256(secret, canonical))
 *
 * @param method HTTP method (GET, POST, etc.)
 * @param url Full URL (will extract path)
 * @param timestamp ISO 8601 timestamp
 * @param body Request body (or empty string)
 * @param secret Shared secret
 * @returns Base64-encoded HMAC signature
 */
export function generateHmacSignature(
  method: string,
  url: string,
  timestamp: string,
  body: string,
  secret: string
): string {
  // Parse URL to get path only
  const urlObj = new URL(url);
  const urlPath = urlObj.pathname + urlObj.search;

  // Compute body hash
  const bodyHash = crypto.createHash('sha256').update(body || '').digest('hex');

  // Build canonical string
  const canonical = `${method}\n${urlPath}\n${timestamp}\n${bodyHash}`;

  // Compute HMAC
  const hmac = crypto.createHmac('sha256', secret).update(canonical).digest('base64');

  return hmac;
}

/**
 * Get AI agent headers for WordPress requests
 *
 * @param config Optional config with HMAC signing options
 * @returns Headers object
 */
export function getAgentHeaders(config?: {
  method?: string;
  url?: string;
  body?: string;
  signHeaders?: boolean;
  hmacSecret?: string;
}): Record<string, string> {
  const agent = detectAgent();
  const agentName = getAgentName();
  const sessionId = getOrCreateSessionId();
  const timestamp = new Date().toISOString();

  const headers: Record<string, string> = {
    'User-Agent': `WP-Navigator-MCP/1.0.0 (${agent})`,
    'X-WP-Navigator-Client': 'wp-navigator',
    'X-WP-Navigator-Version': '1.0.0',
    'X-WP-Navigator-Agent': agent,
    'X-WP-Navigator-Agent-Name': agentName,
    'X-WP-Navigator-Session': sessionId,
    'X-WP-Navigator-Timestamp': timestamp,
  };

  // Add model info if available
  const modelInfo = detectModelInfo();
  if (modelInfo !== 'Unknown') {
    headers['X-WP-Navigator-Model'] = modelInfo;
  }

  // Add HMAC signature if requested
  if (config?.signHeaders && config?.hmacSecret && config?.method && config?.url) {
    const signature = generateHmacSignature(
      config.method,
      config.url,
      timestamp,
      config.body || '',
      config.hmacSecret
    );
    headers['X-WP-Navigator-Signature'] = signature;
  }

  return headers;
}
