/**
 * TUI Link Components
 *
 * Terminal link utilities for WP Navigator CLI.
 * Provides clickable hyperlinks in supported terminals with fallback for others.
 *
 * OSC 8 hyperlink support:
 * - iTerm2 (macOS)
 * - GNOME Terminal
 * - Windows Terminal
 * - VS Code terminal
 * - Many modern terminals
 *
 * @package WP_Navigator_Pro
 * @since 1.1.0
 */

import { colorize, supportsColor } from './components.js';

// =============================================================================
// Types
// =============================================================================

export interface LinkOptions {
  /** Link display text (defaults to URL if not provided) */
  text?: string;
  /** Whether to show URL in parentheses after text (for fallback) */
  showUrl?: boolean;
}

// =============================================================================
// WP Navigator URLs
// =============================================================================

/**
 * Canonical WP Navigator URLs
 * Single source of truth for all links used in CLI output
 */
export const WPNAV_URLS = {
  /** Demo video/walkthrough */
  demo: 'https://wpnav.ai/start/demo',
  /** General help and support */
  help: 'https://wpnav.ai/help',
  /** Technical documentation */
  docs: 'https://wpnav.ai/docs',
  /** Troubleshooting guide */
  troubleshoot: 'https://wpnav.ai/troubleshoot',
  /** CLI documentation */
  cliDocs: 'https://wpnav.ai/docs/cli',
  /** Plugin download */
  download: 'https://wpnav.ai/download',
  /** Getting started guide */
  start: 'https://wpnav.ai/start',
} as const;

export type WpnavUrlKey = keyof typeof WPNAV_URLS;

// =============================================================================
// Terminal Link Detection
// =============================================================================

/**
 * Check if terminal supports OSC 8 hyperlinks
 *
 * OSC 8 is the standard escape sequence for terminal hyperlinks.
 * Support varies by terminal, but most modern terminals support it.
 */
export function supportsHyperlinks(): boolean {
  // Check for explicit override
  if (process.env.FORCE_HYPERLINK === '1') return true;
  if (process.env.FORCE_HYPERLINK === '0') return false;

  // Not a TTY, no hyperlinks
  if (!process.stdout.isTTY) return false;

  // Check TERM_PROGRAM for known supported terminals
  const termProgram = process.env.TERM_PROGRAM || '';
  const termProgramVersion = process.env.TERM_PROGRAM_VERSION || '';

  // iTerm2 3.1+ supports hyperlinks
  if (termProgram === 'iTerm.app') {
    const version = parseInt(termProgramVersion.split('.')[0] || '0', 10);
    if (version >= 3) return true;
  }

  // VS Code integrated terminal supports hyperlinks
  if (termProgram === 'vscode') return true;

  // Windows Terminal supports hyperlinks
  if (process.env.WT_SESSION) return true;

  // Check for GNOME Terminal (VTE-based terminals)
  if (process.env.VTE_VERSION) {
    const vteVersion = parseInt(process.env.VTE_VERSION || '0', 10);
    // VTE 0.50+ supports hyperlinks
    if (vteVersion >= 5000) return true;
  }

  // Alacritty supports hyperlinks
  if (process.env.ALACRITTY_LOG) return true;

  // Kitty supports hyperlinks
  if (process.env.KITTY_WINDOW_ID) return true;

  // WezTerm supports hyperlinks
  if (process.env.WEZTERM_EXECUTABLE) return true;

  // Default: assume no hyperlink support for safety
  // Better to show URL than broken escape sequences
  return false;
}

// =============================================================================
// Link Formatting
// =============================================================================

/**
 * Create a terminal hyperlink using OSC 8 escape sequences
 *
 * Format: \x1b]8;;URL\x1b\\text\x1b]8;;\x1b\\
 *
 * @param url - The URL to link to
 * @param text - Display text (defaults to URL)
 * @returns OSC 8 formatted hyperlink string
 */
function createOsc8Link(url: string, text: string): string {
  // OSC 8 format: ESC ] 8 ; ; URL ST text ESC ] 8 ; ; ST
  // Where ST (String Terminator) is ESC \ or BEL (\x07)
  // Using ESC \ for better compatibility
  return `\x1b]8;;${url}\x1b\\${text}\x1b]8;;\x1b\\`;
}

/**
 * Format a URL as a clickable terminal link (if supported)
 *
 * In terminals that support OSC 8 hyperlinks, the text will be clickable.
 * In other terminals, shows the URL in a readable format.
 *
 * @param url - The URL to link to
 * @param options - Link display options
 * @returns Formatted link string for terminal output
 *
 * @example
 * // In supported terminal:
 * link('https://wpnav.ai/docs')
 * // Clickable "https://wpnav.ai/docs"
 *
 * @example
 * // With custom text:
 * link('https://wpnav.ai/docs', { text: 'Documentation' })
 * // Clickable "Documentation"
 *
 * @example
 * // With URL shown:
 * link('https://wpnav.ai/docs', { text: 'Docs', showUrl: true })
 * // "Docs (https://wpnav.ai/docs)"
 */
export function link(url: string, options: LinkOptions = {}): string {
  const { text, showUrl = false } = options;
  const displayText = text || url;

  if (supportsHyperlinks()) {
    // Terminal supports clickable links
    const hyperlink = createOsc8Link(url, displayText);

    // Apply color styling to make links visually distinct
    if (supportsColor()) {
      // Cyan + underline for links
      return `\x1b[36m\x1b[4m${hyperlink}\x1b[24m\x1b[0m`;
    }
    return hyperlink;
  }

  // Fallback: plain text with optional URL
  if (text && showUrl) {
    // Show both text and URL for clarity
    if (supportsColor()) {
      return `${colorize(displayText, 'cyan')} (${url})`;
    }
    return `${displayText} (${url})`;
  }

  // Just the URL or text
  if (supportsColor()) {
    return colorize(displayText, 'cyan');
  }
  return displayText;
}

/**
 * Format a WP Navigator URL using the canonical URLs
 *
 * @param key - Key from WPNAV_URLS
 * @param options - Link display options
 * @returns Formatted link string
 *
 * @example
 * wpnavLink('docs')
 * // Clickable link to https://wpnav.ai/docs
 *
 * @example
 * wpnavLink('help', { text: 'Get Help' })
 * // Clickable "Get Help" link
 */
export function wpnavLink(key: WpnavUrlKey, options: LinkOptions = {}): string {
  const url = WPNAV_URLS[key];
  return link(url, options);
}

// =============================================================================
// Contextual Link Helpers
// =============================================================================

/**
 * Print a demo link with arrow prefix
 *
 * @example
 * demoLink()
 * // Output: "→ Watch demo: https://wpnav.ai/start/demo"
 */
export function demoLink(): string {
  const arrow = supportsColor() ? colorize('→', 'cyan') : '->';
  return `${arrow} Watch demo: ${wpnavLink('demo')}`;
}

/**
 * Print a help link with arrow prefix
 *
 * @example
 * helpLink()
 * // Output: "→ Need help? https://wpnav.ai/help"
 */
export function helpLink(): string {
  const arrow = supportsColor() ? colorize('→', 'cyan') : '->';
  return `${arrow} Need help? ${wpnavLink('help')}`;
}

/**
 * Print a docs link with arrow prefix
 *
 * @example
 * docsLink()
 * // Output: "→ Documentation: https://wpnav.ai/docs"
 */
export function docsLink(): string {
  const arrow = supportsColor() ? colorize('→', 'cyan') : '->';
  return `${arrow} Documentation: ${wpnavLink('docs')}`;
}

/**
 * Print a troubleshooting link with arrow prefix
 *
 * @example
 * troubleshootLink()
 * // Output: "→ Troubleshooting: https://wpnav.ai/troubleshoot"
 */
export function troubleshootLink(): string {
  const arrow = supportsColor() ? colorize('→', 'cyan') : '->';
  return `${arrow} Troubleshooting: ${wpnavLink('troubleshoot')}`;
}

/**
 * Print CLI documentation link with arrow prefix
 */
export function cliDocsLink(): string {
  const arrow = supportsColor() ? colorize('→', 'cyan') : '->';
  return `${arrow} CLI docs: ${wpnavLink('cliDocs')}`;
}

// =============================================================================
// Resource Link Block
// =============================================================================

/**
 * Print a formatted block of resource links
 *
 * Used for final summaries and help output.
 * Ensures no duplicate links are shown.
 *
 * @param keys - Which links to include (defaults to all main links)
 *
 * @example
 * resourceLinks()
 * // Output:
 * // Resources:
 * //   → Watch demo: https://wpnav.ai/start/demo
 * //   → Need help? https://wpnav.ai/help
 * //   → Documentation: https://wpnav.ai/docs
 */
export function resourceLinks(keys?: WpnavUrlKey[]): string[] {
  const defaultKeys: WpnavUrlKey[] = ['demo', 'help', 'docs'];
  const linksToShow = keys || defaultKeys;

  // Track shown URLs to prevent duplicates
  const shown = new Set<string>();
  const lines: string[] = [];

  for (const key of linksToShow) {
    const url = WPNAV_URLS[key];
    if (shown.has(url)) continue;
    shown.add(url);

    switch (key) {
      case 'demo':
        lines.push(demoLink());
        break;
      case 'help':
        lines.push(helpLink());
        break;
      case 'docs':
        lines.push(docsLink());
        break;
      case 'troubleshoot':
        lines.push(troubleshootLink());
        break;
      case 'cliDocs':
        lines.push(cliDocsLink());
        break;
      default: {
        const arrow = supportsColor() ? colorize('→', 'cyan') : '->';
        lines.push(`${arrow} ${wpnavLink(key)}`);
      }
    }
  }

  return lines;
}

/**
 * Print resource links block to stderr
 *
 * @param title - Optional title (default: "Resources:")
 * @param keys - Which links to include
 */
export function printResourceLinks(title = 'Resources:', keys?: WpnavUrlKey[]): void {
  const arrow = supportsColor() ? colorize('→', 'dim') : '';
  console.error(`${arrow} ${title}`);
  for (const line of resourceLinks(keys)) {
    console.error(`  ${line}`);
  }
}

// =============================================================================
// Error Context Links
// =============================================================================

/**
 * Get appropriate help link for an error context
 *
 * @param errorType - Type of error for context-specific help
 * @returns Appropriate help URL
 */
export function getErrorHelpLink(errorType?: string): string {
  // Map error types to specific help pages
  switch (errorType?.toLowerCase()) {
    case 'connection':
    case 'network':
    case 'timeout':
    case 'auth':
    case 'authentication':
      return WPNAV_URLS.troubleshoot;
    case 'config':
    case 'validation':
    case 'manifest':
      return WPNAV_URLS.docs;
    default:
      return WPNAV_URLS.help;
  }
}

/**
 * Format an error message with contextual help link
 *
 * @param message - Error message
 * @param errorType - Type of error for context-specific help
 * @returns Error message with help link appended
 */
export function errorWithHelp(message: string, errorType?: string): string {
  const helpUrl = getErrorHelpLink(errorType);
  return `${message}\n  ${link(helpUrl, { text: 'Get help' })}`;
}
