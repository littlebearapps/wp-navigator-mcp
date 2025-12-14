/**
 * Centralized WordPress REST API Client
 *
 * Provides enhanced error handling and consistent API access for all wp-navigator tools.
 * All tools should use this client instead of making direct fetch() calls.
 */

interface WPAPIRequest {
  endpoint: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: any;
  headers?: Record<string, string>;
}

interface WPAPIError {
  code: string;
  message: string;
  data?: any;
}

/**
 * WordPress API Client with enhanced error handling
 */
export class WordPressAPIClient {
  private baseUrl: string;
  private auth: string;
  private username: string;

  constructor(baseUrl: string, username: string, password: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, ''); // Remove trailing slashes
    this.username = username;
    this.auth = Buffer.from(`${username}:${password}`).toString('base64');
  }

  /**
   * Make a WordPress REST API request with enhanced error handling
   */
  async request<T>(options: WPAPIRequest): Promise<T> {
    const url = this.buildUrl(options.endpoint);

    try {
      const response = await fetch(url, {
        method: options.method || 'GET',
        headers: {
          Authorization: `Basic ${this.auth}`,
          'Content-Type': 'application/json',
          ...options.headers,
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
      });

      // Check if response is JSON
      const contentType = response.headers.get('content-type');
      if (!response.ok) {
        throw await this.enhanceError(response, options);
      }

      if (!contentType?.includes('application/json')) {
        throw new Error(
          `❌ Invalid Response Format\n\n` +
            `Problem: WordPress returned HTML instead of JSON\n` +
            `Context: ${options.method || 'GET'} ${options.endpoint}\n` +
            `Response Type: ${contentType || 'unknown'}\n\n` +
            `Likely Causes:\n` +
            `1. WordPress permalink settings causing redirect issues\n` +
            `2. Plugin not activated on WordPress site\n` +
            `3. REST API endpoint not registered\n\n` +
            `How to Fix:\n` +
            `1. Verify WordPress is running: ${this.baseUrl}/wp-admin\n` +
            `2. Check if wp-navigator-pro plugin is activated\n` +
            `3. Test REST API directly: ${this.baseUrl}/wp-json/\n` +
            `4. Verify permalink structure is set (Settings → Permalinks)\n\n`
        );
      }

      return await response.json();
    } catch (error) {
      // If it's already an enhanced error, re-throw it
      if (error instanceof Error && error.message.startsWith('❌')) {
        throw error;
      }
      // Otherwise, create a network error
      throw this.createNetworkError(error, options);
    }
  }

  /**
   * Build URL with query string format for permalink compatibility
   */
  private buildUrl(endpoint: string): string {
    // Remove leading slash if present
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

    // Use query string format for better compatibility with various WordPress configurations
    // This avoids permalink redirect issues (301 redirects) regardless of hosting environment
    return `${this.baseUrl}/?rest_route=${cleanEndpoint}`;
  }

  /**
   * Enhance HTTP errors with actionable context
   */
  private async enhanceError(response: Response, request: WPAPIRequest): Promise<Error> {
    let errorData: WPAPIError | null = null;

    try {
      errorData = await response.json();
    } catch {
      // Response wasn't JSON, will use generic error
    }

    switch (response.status) {
      case 401:
        return this.createAuthError(
          errorData?.code || 'unauthorized',
          errorData?.message || 'Authentication required',
          request
        );

      case 403:
        return this.createPermissionError(
          errorData?.code || 'forbidden',
          errorData?.message || 'Permission denied',
          request
        );

      case 404:
        return this.createNotFoundError(
          errorData?.code || 'not_found',
          errorData?.message || 'Resource not found',
          request
        );

      case 500:
      case 502:
      case 503:
        // Check for specific WordPress error codes that need special handling
        if (errorData?.code === 'incompatible_wp_required_version') {
          return this.createVersionIncompatibilityError(errorData, request);
        }
        return this.createServerError(
          response.status,
          errorData?.code || 'server_error',
          errorData?.message || 'Internal server error',
          request
        );

      default:
        return new Error(
          `❌ HTTP ${response.status} Error\n\n` +
            `Problem: ${errorData?.message || response.statusText}\n` +
            `Code: ${errorData?.code || 'unknown'}\n` +
            `Context: ${request.method || 'GET'} ${request.endpoint}\n\n`
        );
    }
  }

  /**
   * Create enhanced authentication error (401)
   */
  private createAuthError(code: string, message: string, request: WPAPIRequest): Error {
    return new Error(
      `❌ Authentication Failed (401)\n\n` +
        `Problem: ${message}\n` +
        `Code: ${code}\n` +
        `Context: Attempting ${request.method || 'GET'} ${request.endpoint}\n` +
        `Username: ${this.username}\n\n` +
        `Likely Cause: Your Application Password is invalid or expired.\n\n` +
        `How to Fix:\n` +
        `1. Open WordPress admin: ${this.baseUrl}/wp-admin\n` +
        `2. Login as user: ${this.username}\n` +
        `3. Go to: Users → Profile → Application Passwords\n` +
        `4. Generate a new password named "wp-navigator"\n` +
        `5. Update WP_APP_PASS in .local-wp.env (or your environment)\n` +
        `6. Restart your MCP server / AI agent session\n\n` +
        `Note: Application Passwords expire and can be revoked.\n` +
        `      You'll need to regenerate them periodically.\n\n`
    );
  }

  /**
   * Create enhanced permission error (403)
   */
  private createPermissionError(code: string, message: string, request: WPAPIRequest): Error {
    return new Error(
      `❌ Permission Denied (403)\n\n` +
        `Problem: ${message}\n` +
        `Code: ${code}\n` +
        `Context: ${request.method || 'GET'} ${request.endpoint}\n` +
        `Username: ${this.username}\n\n` +
        `Likely Causes:\n` +
        `1. User doesn't have required WordPress capabilities\n` +
        `2. WP Navigator policy settings are blocking this action\n` +
        `3. WordPress nonce validation failed\n\n` +
        `How to Fix:\n` +
        `1. Check user capabilities: ${this.baseUrl}/wp-admin/user-edit.php\n` +
        `2. Review WP Navigator policy: ${this.baseUrl}/wp-admin/admin.php?page=wp-navigator\n` +
        `3. Ensure user has 'edit_posts' or higher capability\n` +
        `4. Check if site is frozen (kill switch active)\n\n`
    );
  }

  /**
   * Create enhanced not found error (404)
   */
  private createNotFoundError(code: string, message: string, request: WPAPIRequest): Error {
    return new Error(
      `❌ Resource Not Found (404)\n\n` +
        `Problem: ${message}\n` +
        `Code: ${code}\n` +
        `Context: ${request.method || 'GET'} ${request.endpoint}\n\n` +
        `Likely Causes:\n` +
        `1. The resource ID doesn't exist\n` +
        `2. The endpoint is not registered\n` +
        `3. The wp-navigator-pro plugin is not activated\n\n` +
        `How to Fix:\n` +
        `1. Verify the resource exists in WordPress\n` +
        `2. Check plugin is activated: ${this.baseUrl}/wp-admin/plugins.php\n` +
        `3. Test introspect endpoint: ${this.baseUrl}/?rest_route=/wpnav/v1/introspect\n` +
        `4. Review available endpoints in introspect response\n\n`
    );
  }

  /**
   * Create enhanced server error (500, 502, 503)
   */
  private createServerError(
    status: number,
    code: string,
    message: string,
    request: WPAPIRequest
  ): Error {
    return new Error(
      `❌ Server Error (${status})\n\n` +
        `Problem: ${message}\n` +
        `Code: ${code}\n` +
        `Context: ${request.method || 'GET'} ${request.endpoint}\n\n` +
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
  }

  /**
   * Create enhanced WordPress version incompatibility error
   *
   * This occurs when trying to install a plugin that requires a newer WordPress version.
   * Provides clear guidance on how to resolve.
   */
  private createVersionIncompatibilityError(errorData: WPAPIError, request: WPAPIRequest): Error {
    // Parse version info from the error message
    // Example: "Your WordPress version is 6.5, however the uploaded plugin requires 6.7."
    const message = errorData.message || '';
    const versionMatch = message.match(/version is ([\d.]+).*requires ([\d.]+)/i);
    const currentVersion = versionMatch?.[1] || 'unknown';
    const requiredVersion = versionMatch?.[2] || 'unknown';

    return new Error(
      `❌ WordPress Version Incompatibility\n\n` +
        `Problem: ${message}\n` +
        `Code: ${errorData.code}\n` +
        `Context: ${request.method || 'GET'} ${request.endpoint}\n\n` +
        `Version Details:\n` +
        `  Current WordPress: ${currentVersion}\n` +
        `  Required Version: ${requiredVersion}\n\n` +
        `How to Fix:\n` +
        `1. Update WordPress to version ${requiredVersion} or newer:\n` +
        `   - WordPress Admin → Dashboard → Updates\n` +
        `   - Or via WP-CLI: wp core update\n` +
        `   - Or via wp-env: npx @wordpress/env run cli wp core update\n\n` +
        `2. Alternatively, use an older version of the plugin that supports WordPress ${currentVersion}\n\n` +
        `3. Check plugin compatibility before installing:\n` +
        `   - Visit the plugin page on wordpress.org\n` +
        `   - Check "Requires WordPress Version" in the sidebar\n\n` +
        `Prevention:\n` +
        `  Use wpnav_introspect to check your WordPress version before installing plugins.\n` +
        `  The response includes: wordpress.version\n\n`
    );
  }

  /**
   * Create enhanced network error
   */
  private createNetworkError(error: any, request: WPAPIRequest): Error {
    const errorMessage = error?.message || String(error);

    return new Error(
      `❌ Network Error\n\n` +
        `Problem: ${errorMessage}\n` +
        `Context: ${request.method || 'GET'} ${request.endpoint}\n` +
        `Target: ${this.baseUrl}\n\n` +
        `Likely Causes:\n` +
        `1. WordPress is not running\n` +
        `2. Network connectivity issue\n` +
        `3. Incorrect WP_BASE_URL configuration\n` +
        `4. Firewall blocking connection\n\n` +
        `How to Fix:\n` +
        `1. Verify WordPress is running: ${this.baseUrl}/wp-admin\n` +
        `2. Check WP_BASE_URL in your wp-config.json or environment\n` +
        `3. Test network connection: curl ${this.baseUrl}\n` +
        `4. Check firewall rules if using a remote server\n` +
        `5. For Docker: docker ps | grep wordpress\n\n`
    );
  }
}

/**
 * Singleton WordPress API client instance
 */
let apiClient: WordPressAPIClient | null = null;

/**
 * Get or create the WordPress API client singleton
 *
 * Reads configuration from environment variables:
 * - WP_BASE_URL: WordPress site URL (e.g., http://localhost:8888)
 * - WP_APP_USER: WordPress username
 * - WP_APP_PASS: Application Password
 *
 * @throws Error if required environment variables are missing
 */
export function getWPAPIClient(): WordPressAPIClient {
  if (!apiClient) {
    const baseUrl = process.env.WP_BASE_URL;
    const username = process.env.WP_APP_USER;
    const password = process.env.WP_APP_PASS;

    if (!baseUrl) {
      throw new Error(
        `❌ Missing Configuration: WP_BASE_URL\n\n` +
          `The WP_BASE_URL environment variable is required.\n\n` +
          `How to Fix:\n` +
          `1. Set WP_BASE_URL in your wp-config.json\n` +
          `2. Example: "WP_BASE_URL": "https://example.com"\n` +
          `3. Or set as environment variable in your shell\n\n`
      );
    }

    if (!username) {
      throw new Error(
        `❌ Missing Configuration: WP_APP_USER\n\n` +
          `The WP_APP_USER environment variable is required.\n\n` +
          `How to Fix:\n` +
          `1. Set WP_APP_USER in your wp-config.json\n` +
          `2. Example: "WP_APP_USER": "admin"\n` +
          `3. Or set as environment variable in your shell\n\n`
      );
    }

    if (!password) {
      throw new Error(
        `❌ Missing Configuration: WP_APP_PASS\n\n` +
          `The WP_APP_PASS environment variable is required.\n\n` +
          `How to Fix:\n` +
          `1. Generate an Application Password in WordPress:\n` +
          `   ${baseUrl}/wp-admin → Users → Profile → Application Passwords\n` +
          `2. Set WP_APP_PASS in your wp-config.json\n` +
          `3. Example: "WP_APP_PASS": "xxxx xxxx xxxx xxxx xxxx xxxx"\n` +
          `4. Or set as environment variable in your shell\n\n`
      );
    }

    apiClient = new WordPressAPIClient(baseUrl, username, password);
  }

  return apiClient;
}

/**
 * Reset the API client singleton (useful for testing or credential changes)
 */
export function resetWPAPIClient(): void {
  apiClient = null;
}
