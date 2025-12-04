import fetch from 'cross-fetch';
import type { WPConfig } from './config.js';
import { getAgentHeaders } from './agent-detection.js';

function isLocalhostHost(host: string): boolean {
  return (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local')
  );
}

export type RequestInitEx = RequestInit & { timeoutMs?: number };

/**
 * Create a WordPress request function bound to the given config.
 * Behavior matches the prior inline implementation in index.ts.
 */
export function makeWpRequest(config: WPConfig) {
  const debugTiming = String(process.env.WPNAV_DEBUG_HTTP_TIMING || '').trim() === '1';
  // Precompute base origin and TLS policy
  const base = new URL(config.restApi);
  const baseOrigin = `${base.protocol}//${base.host}`;
  const isLocal = isLocalhostHost(base.hostname);
  const httpsRequired = !isLocal && base.protocol !== 'https:' && !config.toggles.allowInsecureHttp;

  if (httpsRequired) {
    throw new Error(
      `Insecure HTTP to non-localhost is not allowed. Use HTTPS for ${baseOrigin} or set ALLOW_INSECURE_HTTP=1 for development.`
    );
  }

  let writesInFlight = 0;
  const writeQueue: Array<() => void> = [];

  async function acquireWrite() {
    if (writesInFlight < 1) {
      writesInFlight++;
      return;
    }
    await new Promise<void>((resolve) => writeQueue.push(resolve));
    writesInFlight++;
  }

  function releaseWrite() {
    writesInFlight = Math.max(0, writesInFlight - 1);
    const next = writeQueue.shift();
    if (next) next();
  }

  function buildUrl(endpoint: string): string {
    if (endpoint.startsWith('http')) {
      // Enforce single-origin allowlist
      const u = new URL(endpoint);
      const origin = `${u.protocol}//${u.host}`;
      if (origin !== baseOrigin) {
        throw new Error(`Off-origin request blocked: ${origin} (allowed: ${baseOrigin})`);
      }
      if (u.protocol !== 'http:' && u.protocol !== 'https:') {
        throw new Error(`Unsupported URL scheme: ${u.protocol}`);
      }
      if (!isLocal && u.protocol !== 'https:' && !config.toggles.allowInsecureHttp) {
        throw new Error(`Non-HTTPS request blocked to ${origin}. Set ALLOW_INSECURE_HTTP=1 for dev.`);
      }
      return u.toString();
    }
    // Relative path — join to REST root
    return `${config.restApi}${endpoint}`;
  }

  return async function wpRequest(endpoint: string, options: RequestInitEx = {}): Promise<any> {
    // Debug: log endpoint to trace URL encoding
    console.error(`[wpRequest] endpoint received: ${endpoint}`);
    const authHeader = Buffer.from(`${config.auth.username}:${config.auth.password}`).toString('base64');
    const url = buildUrl(endpoint);
    console.error(`[wpRequest] final URL: ${url}`);
    const method = (options.method || 'GET').toUpperCase();
    const body = options.body ? String(options.body) : '';

    // Get AI agent headers (v1.2.0 actor attribution)
    const agentHeaders = getAgentHeaders({
      method,
      url,
      body,
      signHeaders: config.auth.signHeaders,
      hmacSecret: config.auth.hmacSecret,
    });

    const defaultHeaders = {
      Authorization: `Basic ${authHeader}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...agentHeaders, // Add AI agent identification headers
    } as Record<string, string>;

    // Default write-deny (safe-by-default). Phase 4 will route writes via plan/diff/apply.
    const isWrite = method !== 'GET' && method !== 'HEAD';
    if (isWrite && !config.toggles.enableWrites) {
      throw new Error('WRITES_DISABLED: MCP server env var WPNAV_ENABLE_WRITES=1 not set. Add to your .mcp.json env configuration (this is NOT a WordPress setting).');
    }

    const controller = new AbortController();
    const timeoutMs = options.timeoutMs ?? config.toggles.toolTimeoutMs;
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const attemptFetch = async () => {
      const t0 = debugTiming ? Date.now() : 0;
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          ...defaultHeaders,
          ...(options.headers as Record<string, string> | undefined),
        },
      });
      if (debugTiming) {
        const ms = Date.now() - t0;
        // Safe, minimal diagnostic line
        console.error(`[http] ${method} ${url} -> ${response.status} in ${ms}ms`);
      }
      return response;
    };

    const maxRetries = 3;
    let attempt = 0;
    let lastErr: any;

    // Write concurrency: only 1 in-flight write
    if (isWrite) await acquireWrite();
    try {
      while (attempt <= maxRetries) {
        try {
          const res = await attemptFetch();
          if (res.ok) {
            const text = await res.text();
            clearTimeout(timeout);
            if (!text) return null;
            try {
              return JSON.parse(text);
            } catch {
              return text;
            }
          }

          // Retry on 429/5xx
          if (res.status === 429 || (res.status >= 500 && res.status <= 599)) {
            attempt++;
            if (attempt > maxRetries) {
              const body = await res.text();
              throw new Error(`WordPress API error (${res.status}): ${body}`);
            }
            const retryAfter = res.headers.get('retry-after');
            let delayMs = backoffDelay(attempt);
            if (retryAfter) {
              const seconds = parseInt(retryAfter, 10);
              if (Number.isFinite(seconds)) delayMs = Math.max(delayMs, seconds * 1000);
            }
            await sleep(delayMs);
            continue;
          }

          // Non-retriable errors with enhanced error messages
          const errorText = await res.text();

          // Check if response is JSON
          const contentType = res.headers.get('content-type');
          if (!contentType?.includes('application/json')) {
            throw createFormatError(res.status, contentType, method, endpoint, baseOrigin, config);
          }

          const parsed = parseWpError(errorText);
          if (parsed) {
            const { code, message } = parsed;
            throw createEnhancedError(res.status, code || 'WP_ERROR', message, method, endpoint, config.auth.username, baseOrigin);
          }
          throw createEnhancedError(res.status, 'unknown', errorText, method, endpoint, config.auth.username, baseOrigin);
        } catch (e: any) {
          if (e?.name === 'AbortError') {
            lastErr = new Error(`Request timed out after ${timeoutMs}ms`);
            break;
          }
          // Network error: retry with backoff
          attempt++;
          if (attempt > maxRetries) {
            lastErr = e;
            break;
          }
          await sleep(backoffDelay(attempt));
        }
      }
      clearTimeout(timeout);
      if (lastErr) throw lastErr;
      throw new Error('Unknown request failure');
    } finally {
      if (isWrite) releaseWrite();
    }
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function backoffDelay(attempt: number): number {
  // Exponential backoff with jitter (base 250ms)
  const base = 250;
  const max = 3000;
  const expo = Math.min(max, base * Math.pow(2, attempt));
  const jitter = Math.random() * 200;
  return Math.floor(expo + jitter);
}

function parseWpError(text: string): { code?: string; message: string; data?: any } | null {
  try {
    const obj = JSON.parse(text);
    if (obj && (obj.message || obj.code)) {
      return { code: obj.code, message: obj.message || String(text), data: obj.data };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Create enhanced error with actionable context for AI agents
 */
function createEnhancedError(
  status: number,
  code: string,
  message: string,
  method: string,
  endpoint: string,
  username: string,
  baseUrl: string
): Error {
  switch (status) {
    case 401:
      return new Error(
        `❌ Authentication Failed (401)\n\n` +
        `Problem: ${message}\n` +
        `Code: ${code}\n` +
        `Context: ${method} ${endpoint}\n` +
        `Username: ${username}\n\n` +
        `Likely Cause: Your Application Password is invalid or expired.\n\n` +
        `How to Fix:\n` +
        `1. Open WordPress admin: ${baseUrl}/wp-admin\n` +
        `2. Login as user: ${username}\n` +
        `3. Go to: Users → Profile → Application Passwords\n` +
        `4. Generate a new password named "wp-navigator"\n` +
        `5. Update WP_APP_PASS in .local-wp.env (or your environment)\n` +
        `6. Restart your MCP server / AI agent session\n\n` +
        `Note: Application Passwords expire and can be revoked.\n` +
        `      You'll need to regenerate them periodically.\n\n`
      );

    case 403:
      return new Error(
        `❌ Permission Denied (403)\n\n` +
        `Problem: ${message}\n` +
        `Code: ${code}\n` +
        `Context: ${method} ${endpoint}\n` +
        `Username: ${username}\n\n` +
        `Likely Causes:\n` +
        `1. User doesn't have required WordPress capabilities\n` +
        `2. WP Navigator policy settings are blocking this action\n` +
        `3. WordPress nonce validation failed\n\n` +
        `How to Fix:\n` +
        `1. Check user capabilities: ${baseUrl}/wp-admin/user-edit.php\n` +
        `2. Review WP Navigator policy: ${baseUrl}/wp-admin/admin.php?page=wp-navigator\n` +
        `3. Ensure user has 'edit_posts' or higher capability\n` +
        `4. Check if site is frozen (kill switch active)\n\n`
      );

    case 404:
      return new Error(
        `❌ Resource Not Found (404)\n\n` +
        `Problem: ${message}\n` +
        `Code: ${code}\n` +
        `Context: ${method} ${endpoint}\n\n` +
        `Likely Causes:\n` +
        `1. The resource ID doesn't exist\n` +
        `2. The endpoint is not registered\n` +
        `3. The wp-navigator-pro plugin is not activated\n\n` +
        `How to Fix:\n` +
        `1. Verify the resource exists in WordPress\n` +
        `2. Check plugin is activated: ${baseUrl}/wp-admin/plugins.php\n` +
        `3. Test introspect endpoint: ${baseUrl}/?rest_route=/wpnav/v1/introspect\n` +
        `4. Review available endpoints in introspect response\n\n`
      );

    case 500:
    case 502:
    case 503:
      return new Error(
        `❌ Server Error (${status})\n\n` +
        `Problem: ${message}\n` +
        `Code: ${code}\n` +
        `Context: ${method} ${endpoint}\n\n` +
        `Likely Causes:\n` +
        `1. PHP error in WordPress or plugin code\n` +
        `2. Database connection issue\n` +
        `3. Memory limit exceeded\n` +
        `4. Plugin conflict\n\n` +
        `How to Debug:\n` +
        `1. Check WordPress debug log: wp-content/debug.log\n` +
        `2. Check PHP error logs (location varies by server)\n` +
        `3. Try disabling other plugins to isolate conflict\n` +
        `4. Increase PHP memory limit if needed (wp-config.php)\n\n` +
        `Enable WordPress Debug Mode:\n` +
        `  In wp-config.php, set: define('WP_DEBUG', true);\n` +
        `  And: define('WP_DEBUG_LOG', true);\n\n`
      );

    default:
      return new Error(
        `❌ HTTP ${status} Error\n\n` +
        `Problem: ${message}\n` +
        `Code: ${code}\n` +
        `Context: ${method} ${endpoint}\n\n`
      );
  }
}

/**
 * Create enhanced error for invalid response format
 */
function createFormatError(
  status: number,
  contentType: string | null,
  method: string,
  endpoint: string,
  baseUrl: string,
  config: WPConfig
): Error {
  return new Error(
    `❌ Invalid Response Format\n\n` +
    `Problem: WordPress returned HTML instead of JSON\n` +
    `Context: ${method} ${endpoint}\n` +
    `Response Type: ${contentType || 'unknown'}\n` +
    `Status: ${status}\n\n` +
    `Likely Causes:\n` +
    `1. WordPress permalink settings causing redirect issues\n` +
    `2. Plugin not activated on WordPress site\n` +
    `3. REST API endpoint not registered\n` +
    `4. WordPress is showing an error page\n\n` +
    `How to Fix:\n` +
    `1. Verify WordPress is running: ${baseUrl}/wp-admin\n` +
    `2. Check if wp-navigator-pro plugin is activated\n` +
    `3. Test REST API directly: ${baseUrl}/wp-json/\n` +
    `4. Check WordPress debug log for errors (wp-content/debug.log)\n` +
    `5. Verify permalink structure is set (Settings → Permalinks)\n\n`
  );
}
