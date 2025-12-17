/**
 * WP Navigator Credentials Command
 *
 * Manage credentials stored in OS keychain.
 * Supports macOS Keychain and Linux Secret Service.
 *
 * Usage:
 *   wpnav credentials store --site example.com   # Store credential
 *   wpnav credentials show --site example.com    # Show credential
 *   wpnav credentials clear --site example.com   # Remove credential
 *   wpnav credentials list                       # List all credentials
 *
 * @package WP_Navigator_MCP
 * @since 2.7.0
 */

import {
  getKeychainProvider,
  isKeychainAvailable,
  getKeychainProviderName,
  createKeychainReference,
  KEYCHAIN_SERVICE,
} from '../credentials/index.js';
import { inputPrompt, confirmPrompt } from '../tui/prompts.js';
import {
  success,
  error as errorMessage,
  warning,
  info,
  newline,
  box,
  keyValue,
  list,
  colorize,
  symbols,
} from '../tui/components.js';

// =============================================================================
// Types
// =============================================================================

export interface CredentialsOptions {
  /** Output JSON instead of TUI */
  json?: boolean;
  /** Site domain for store/show/clear operations */
  site?: string;
  /** Skip confirmation prompts */
  yes?: boolean;
  /** Reveal password in clear text (default: masked) */
  reveal?: boolean;
}

export type CredentialsAction = 'store' | 'show' | 'clear' | 'list' | 'status';

// =============================================================================
// JSON Output
// =============================================================================

interface JsonResult {
  success: boolean;
  command: string;
  data?: unknown;
  error?: {
    code: string;
    message: string;
  };
}

function outputJSON(result: JsonResult): void {
  // Safe: passwords in JsonResult are always masked before being passed here (see maskPassword usage)
  // lgtm[js/clear-text-logging]
  console.log(JSON.stringify(result, null, 2));
}

// =============================================================================
// Credential Input
// =============================================================================

/**
 * Prompt for password input via stdin (for piped input in JSON mode)
 */
async function readPasswordFromStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let resolved = false;

    // Set a timeout in case stdin isn't available
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve('');
      }
    }, 100);

    process.stdin.on('data', (chunk) => {
      chunks.push(chunk);
    });

    process.stdin.on('end', () => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        resolve(Buffer.concat(chunks).toString('utf8').trim());
      }
    });

    process.stdin.on('error', (err) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        reject(err);
      }
    });

    // If stdin is a TTY, it won't have piped data
    if (process.stdin.isTTY) {
      resolved = true;
      clearTimeout(timeout);
      resolve('');
    }
  });
}

/**
 * Mask a password for display
 */
function maskPassword(password: string, showFirst = 4): string {
  if (password.length <= showFirst) {
    return '*'.repeat(password.length);
  }
  return password.slice(0, showFirst) + '*'.repeat(Math.min(password.length - showFirst, 16));
}

// =============================================================================
// Store Command
// =============================================================================

async function handleStore(options: CredentialsOptions): Promise<number> {
  const provider = getKeychainProvider();
  const isJson = options.json === true;

  // Check keychain availability
  if (!provider.available) {
    if (isJson) {
      outputJSON({
        success: false,
        command: 'credentials store',
        error: {
          code: 'KEYCHAIN_UNAVAILABLE',
          message: `Keychain not available: ${provider.name}`,
        },
      });
    } else {
      errorMessage(`Keychain not available: ${provider.name}`);
      newline();
      info('Store credentials in .wpnav.env file instead.');
    }
    return 1;
  }

  let site = options.site;
  let password: string;

  // Get site domain
  if (!site) {
    if (isJson) {
      outputJSON({
        success: false,
        command: 'credentials store',
        error: {
          code: 'MISSING_SITE',
          message: 'Site is required. Use --site <domain>',
        },
      });
      return 1;
    }

    site = await inputPrompt({
      message: 'Site domain (e.g., example.com)',
      validate: (v) => (v.length >= 3 ? null : 'Domain must be at least 3 characters'),
    });
  }

  // Normalize site - remove protocol and trailing slash
  site = site.replace(/^https?:\/\//, '').replace(/\/+$/, '');

  // Get password
  if (isJson) {
    // In JSON mode, require --yes and read password from stdin
    if (!options.yes) {
      outputJSON({
        success: false,
        command: 'credentials store',
        error: {
          code: 'CONFIRMATION_REQUIRED',
          message: 'JSON mode requires --yes flag. Pass password via stdin.',
        },
      });
      return 1;
    }

    password = await readPasswordFromStdin();
    if (!password) {
      outputJSON({
        success: false,
        command: 'credentials store',
        error: {
          code: 'MISSING_PASSWORD',
          message:
            'Password required via stdin. Example: echo "password" | wpnav credentials store --site example.com --json --yes',
        },
      });
      return 1;
    }
  } else {
    // Interactive TUI mode - use readline for password
    const readline = await import('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stderr,
    });

    password = await new Promise<string>((resolve) => {
      process.stderr.write('Application Password: ');
      rl.question('', (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    });

    if (!password) {
      errorMessage('Password is required.');
      return 1;
    }
  }

  // Store the credential
  try {
    await provider.store({
      service: KEYCHAIN_SERVICE,
      account: site,
      password,
    });

    if (isJson) {
      outputJSON({
        success: true,
        command: 'credentials store',
        data: {
          account: site,
          keychain_reference: createKeychainReference(site),
        },
      });
    } else {
      newline();
      success(`Credential stored for ${site}`);
      newline();
      info('Use in wpnav.config.json:');
      console.error(`  "password": "${createKeychainReference(site)}"`);
    }
    return 0;
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    if (isJson) {
      outputJSON({
        success: false,
        command: 'credentials store',
        error: { code: 'STORE_FAILED', message: errMsg },
      });
    } else {
      errorMessage(`Failed to store credential: ${errMsg}`);
    }
    return 1;
  }
}

// =============================================================================
// Show Command
// =============================================================================

async function handleShow(options: CredentialsOptions): Promise<number> {
  const provider = getKeychainProvider();
  const isJson = options.json === true;
  const site = options.site;
  const revealPassword = options.reveal === true;

  // Check keychain availability
  if (!provider.available) {
    if (isJson) {
      outputJSON({
        success: false,
        command: 'credentials show',
        error: {
          code: 'KEYCHAIN_UNAVAILABLE',
          message: `Keychain not available: ${provider.name}`,
        },
      });
    } else {
      errorMessage(`Keychain not available: ${provider.name}`);
    }
    return 1;
  }

  // Require site
  if (!site) {
    if (isJson) {
      outputJSON({
        success: false,
        command: 'credentials show',
        error: { code: 'MISSING_SITE', message: 'Site required. Use --site <domain>' },
      });
    } else {
      errorMessage('Site required. Use --site <domain>');
    }
    return 1;
  }

  // Normalize site
  const normalizedSite = site.replace(/^https?:\/\//, '').replace(/\/+$/, '');

  // Retrieve credential
  try {
    const password = await provider.retrieve(normalizedSite);

    if (!password) {
      if (isJson) {
        outputJSON({
          success: false,
          command: 'credentials show',
          error: { code: 'NOT_FOUND', message: `No credential found for ${normalizedSite}` },
        });
      } else {
        warning(`No credential found for ${normalizedSite}`);
      }
      return 1;
    }

    if (isJson) {
      // JSON mode: mask password unless --reveal is used
      // This prevents accidental exposure in logs/scripts
      const outputPassword = revealPassword ? password : maskPassword(password);
      outputJSON({
        success: true,
        command: 'credentials show',
        data: {
          account: normalizedSite,
          password: outputPassword,
          masked: !revealPassword,
          keychain_reference: createKeychainReference(normalizedSite),
        },
      });
    } else {
      newline();
      keyValue('Site', normalizedSite);
      // TUI mode: mask password unless --reveal is used
      // This prevents shoulder-surfing and accidental log exposure
      const displayPassword = revealPassword ? password : maskPassword(password);
      keyValue('Password', displayPassword);
      keyValue('Reference', createKeychainReference(normalizedSite));
      newline();
      if (revealPassword) {
        warning('Handle this password carefully - do not share or log it.');
      } else {
        info('Use --reveal to show the full password.');
      }
    }
    return 0;
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    if (isJson) {
      outputJSON({
        success: false,
        command: 'credentials show',
        error: { code: 'RETRIEVE_FAILED', message: errMsg },
      });
    } else {
      errorMessage(`Failed to retrieve credential: ${errMsg}`);
    }
    return 1;
  }
}

// =============================================================================
// Clear Command
// =============================================================================

async function handleClear(options: CredentialsOptions): Promise<number> {
  const provider = getKeychainProvider();
  const isJson = options.json === true;
  const site = options.site;
  const skipConfirm = options.yes === true;

  // Check keychain availability
  if (!provider.available) {
    if (isJson) {
      outputJSON({
        success: false,
        command: 'credentials clear',
        error: {
          code: 'KEYCHAIN_UNAVAILABLE',
          message: `Keychain not available: ${provider.name}`,
        },
      });
    } else {
      errorMessage(`Keychain not available: ${provider.name}`);
    }
    return 1;
  }

  // Require site
  if (!site) {
    if (isJson) {
      outputJSON({
        success: false,
        command: 'credentials clear',
        error: { code: 'MISSING_SITE', message: 'Site required. Use --site <domain>' },
      });
    } else {
      errorMessage('Site required. Use --site <domain>');
    }
    return 1;
  }

  // Normalize site
  const normalizedSite = site.replace(/^https?:\/\//, '').replace(/\/+$/, '');

  // Confirm deletion in TUI mode
  if (!isJson && !skipConfirm) {
    const confirmed = await confirmPrompt({
      message: `Delete credential for ${normalizedSite}?`,
      defaultValue: false,
    });

    if (!confirmed) {
      info('Cancelled. No credential was deleted.');
      return 0;
    }
  }

  // Delete credential
  try {
    const deleted = await provider.delete(normalizedSite);

    if (isJson) {
      outputJSON({
        success: true,
        command: 'credentials clear',
        data: {
          account: normalizedSite,
          deleted,
        },
      });
    } else {
      if (deleted) {
        success(`Credential deleted for ${normalizedSite}`);
      } else {
        warning(`No credential found for ${normalizedSite}`);
      }
    }
    return 0;
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    if (isJson) {
      outputJSON({
        success: false,
        command: 'credentials clear',
        error: { code: 'DELETE_FAILED', message: errMsg },
      });
    } else {
      errorMessage(`Failed to delete credential: ${errMsg}`);
    }
    return 1;
  }
}

// =============================================================================
// List Command
// =============================================================================

async function handleList(options: CredentialsOptions): Promise<number> {
  const provider = getKeychainProvider();
  const isJson = options.json === true;

  // Check keychain availability
  if (!provider.available) {
    if (isJson) {
      outputJSON({
        success: false,
        command: 'credentials list',
        error: {
          code: 'KEYCHAIN_UNAVAILABLE',
          message: `Keychain not available: ${provider.name}`,
        },
      });
    } else {
      errorMessage(`Keychain not available: ${provider.name}`);
    }
    return 1;
  }

  // List credentials
  try {
    const accounts = await provider.list();

    if (isJson) {
      outputJSON({
        success: true,
        command: 'credentials list',
        data: {
          provider: provider.name,
          accounts,
          count: accounts.length,
        },
      });
    } else {
      newline();
      box(`Stored Credentials (${provider.name})`);
      newline();

      if (accounts.length === 0) {
        info('No credentials stored.');
        newline();
        info('Use `wpnav credentials store --site <domain>` to add credentials.');
      } else {
        for (const account of accounts) {
          console.error(`  ${colorize(symbols.success, 'green')} ${account}`);
          console.error(`    ${colorize(createKeychainReference(account), 'dim')}`);
        }
        newline();
        info(`${accounts.length} credential${accounts.length > 1 ? 's' : ''} stored.`);
      }
    }
    return 0;
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    if (isJson) {
      outputJSON({
        success: false,
        command: 'credentials list',
        error: { code: 'LIST_FAILED', message: errMsg },
      });
    } else {
      errorMessage(`Failed to list credentials: ${errMsg}`);
    }
    return 1;
  }
}

// =============================================================================
// Status Command
// =============================================================================

async function handleStatus(options: CredentialsOptions): Promise<number> {
  const provider = getKeychainProvider();
  const isJson = options.json === true;

  if (isJson) {
    outputJSON({
      success: true,
      command: 'credentials status',
      data: {
        provider: provider.name,
        available: provider.available,
        platform: process.platform,
      },
    });
  } else {
    newline();
    box('Keychain Status');
    newline();
    keyValue('Platform', process.platform);
    keyValue('Provider', provider.name);
    keyValue('Available', provider.available ? colorize('Yes', 'green') : colorize('No', 'red'));

    if (!provider.available) {
      newline();
      if (process.platform === 'linux') {
        info('Install libsecret-tools for keychain support:');
        console.error('  apt install libsecret-tools  # Debian/Ubuntu');
        console.error('  dnf install libsecret        # Fedora');
      } else if (process.platform === 'win32') {
        info('Windows Credential Manager is not yet supported.');
        info('Store credentials in .wpnav.env file instead.');
      }
    }
  }

  return 0;
}

// =============================================================================
// Main Handler
// =============================================================================

/**
 * Handle the credentials command
 *
 * @param action - The subcommand (store, show, clear, list, status)
 * @param options - Command options
 * @returns Exit code: 0 for success, 1 for errors
 */
export async function handleCredentials(
  action: CredentialsAction,
  options: CredentialsOptions = {}
): Promise<number> {
  switch (action) {
    case 'store':
      return handleStore(options);
    case 'show':
      return handleShow(options);
    case 'clear':
      return handleClear(options);
    case 'list':
      return handleList(options);
    case 'status':
      return handleStatus(options);
    default:
      if (options.json) {
        outputJSON({
          success: false,
          command: 'credentials',
          error: {
            code: 'INVALID_ACTION',
            message: `Invalid action: ${action}. Use: store, show, clear, list, or status`,
          },
        });
      } else {
        errorMessage(`Invalid action: ${action}`);
        newline();
        info('Available actions:');
        list([
          'store --site <domain>  Store credential in keychain',
          'show --site <domain>   Show stored credential',
          'clear --site <domain>  Remove credential from keychain',
          'list                   List all stored credentials',
          'status                 Show keychain status',
        ]);
      }
      return 1;
  }
}

export default handleCredentials;
