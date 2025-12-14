/**
 * Graduation Prompt
 *
 * Displays copy-paste ready AI prompts after successful smoke test.
 * Includes cross-platform clipboard support using native commands.
 *
 * @package WP_Navigator_MCP
 * @since 2.1.0
 */

import { spawn } from 'child_process';
import { box, success, info, newline, colorize, symbols } from '../tui/components.js';

// =============================================================================
// Types
// =============================================================================

export interface GraduationContext {
  siteUrl: string;
  siteName?: string;
  pluginEdition?: 'free' | 'pro';
}

export interface GraduationPrompt {
  primary: string;
  alternatives: string[];
}

// =============================================================================
// Prompt Generation
// =============================================================================

/**
 * Extract display-friendly site name from URL or siteName
 */
function getSiteDisplayName(context: GraduationContext): string {
  if (context.siteName) {
    return context.siteName;
  }

  try {
    const url = new URL(context.siteUrl);
    return url.hostname;
  } catch {
    return context.siteUrl;
  }
}

/**
 * Generate context-aware AI prompts
 */
export function generateGraduationPrompts(context: GraduationContext): GraduationPrompt {
  const siteName = getSiteDisplayName(context);

  const primary = `Show me an overview of my WordPress site at ${siteName} and list the 5 most recent posts`;

  const alternatives = [
    `Audit the SEO metadata for all pages on ${siteName}`,
    `List all plugins on ${siteName} and check for available updates`,
    `Show me pages on ${siteName} that haven't been updated in 30 days`,
  ];

  // Add Pro-only prompts if edition is pro
  if (context.pluginEdition === 'pro') {
    alternatives.push(`Analyze content performance across ${siteName}`);
  }

  return { primary, alternatives };
}

/**
 * Format prompt text for terminal display
 * Wraps long lines at word boundaries
 */
export function formatPromptForTerminal(prompt: string, maxWidth: number = 60): string {
  const words = prompt.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if (currentLine.length + word.length + 1 <= maxWidth) {
      currentLine += (currentLine ? ' ' : '') + word;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);

  return lines.join('\n');
}

// =============================================================================
// Clipboard Support
// =============================================================================

/**
 * Check if clipboard is available on this platform
 */
export function isClipboardAvailable(): boolean {
  const platform = process.platform;
  return platform === 'darwin' || platform === 'linux' || platform === 'win32';
}

/**
 * Copy text to clipboard using native commands via spawn (no shell)
 * - macOS: pbcopy
 * - Linux: xclip or xsel
 * - Windows: clip.exe
 *
 * Uses spawn instead of exec to prevent shell injection vulnerabilities.
 * Text is piped to stdin, not passed as command arguments.
 *
 * @returns true if copy succeeded, false otherwise
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  const platform = process.platform;

  const runClipboardCommand = (cmd: string, args: string[]): Promise<boolean> => {
    return new Promise((resolve) => {
      try {
        const proc = spawn(cmd, args, { stdio: ['pipe', 'ignore', 'ignore'] });

        proc.on('error', () => resolve(false));
        proc.on('close', (code) => resolve(code === 0));

        if (proc.stdin) {
          proc.stdin.write(text);
          proc.stdin.end();
        } else {
          resolve(false);
        }
      } catch {
        resolve(false);
      }
    });
  };

  try {
    if (platform === 'darwin') {
      // macOS - use pbcopy
      return await runClipboardCommand('pbcopy', []);
    } else if (platform === 'linux') {
      // Linux - try xclip first, then xsel
      const xclipResult = await runClipboardCommand('xclip', ['-selection', 'clipboard']);
      if (xclipResult) return true;

      // Try xsel as fallback
      return await runClipboardCommand('xsel', ['--clipboard', '--input']);
    } else if (platform === 'win32') {
      // Windows - use clip.exe
      return await runClipboardCommand('clip', []);
    }
    return false;
  } catch {
    return false;
  }
}

// =============================================================================
// Interactive Display
// =============================================================================

/**
 * Wait for keypress with timeout
 * Returns the key pressed or null on timeout
 */
async function waitForKeypress(timeoutMs: number = 10000): Promise<string | null> {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    const wasRaw = stdin.isRaw;

    // Set up timeout
    const timer = setTimeout(() => {
      cleanup();
      resolve(null);
    }, timeoutMs);

    // Set up raw mode for single keypress
    if (stdin.isTTY) {
      stdin.setRawMode(true);
    }
    stdin.resume();

    const cleanup = () => {
      clearTimeout(timer);
      stdin.removeListener('data', onData);
      if (stdin.isTTY) {
        stdin.setRawMode(wasRaw ?? false);
      }
      stdin.pause();
    };

    const onData = (data: Buffer) => {
      cleanup();
      const key = data.toString();
      // Handle Ctrl+C
      if (key === '\x03') {
        process.exit(0);
      }
      resolve(key);
    };

    stdin.once('data', onData);
  });
}

/**
 * Display graduation prompt with interactive copy option
 */
export async function displayGraduationPrompt(
  context: GraduationContext,
  options?: { showAlternatives?: boolean; timeout?: number }
): Promise<void> {
  const { showAlternatives = true, timeout = 10000 } = options ?? {};

  const prompts = generateGraduationPrompts(context);
  const clipboardAvailable = isClipboardAvailable();

  // Display header
  newline();
  console.error(colorize('Setup Complete!', 'bold') + ' Try this in Claude:');
  newline();

  // Display primary prompt in a box
  const formattedPrompt = formatPromptForTerminal(prompts.primary, 56);
  box(`"${formattedPrompt}"`, { title: 'Copy this prompt' });
  newline();

  // Display interactive options
  if (clipboardAvailable && process.stdin.isTTY) {
    console.error(
      `  Press ${colorize('[c]', 'cyan')} to copy  ${colorize(symbols.bullet, 'dim')}  Press ${colorize('[Enter]', 'cyan')} to continue`
    );
    newline();

    // Wait for keypress
    const key = await waitForKeypress(timeout);

    if (key?.toLowerCase() === 'c') {
      const copied = await copyToClipboard(prompts.primary);
      if (copied) {
        success('Copied to clipboard!');
      } else {
        console.error(colorize('Could not copy to clipboard', 'yellow'));
      }
      newline();
    }
  } else {
    // Non-TTY or clipboard unavailable - just show the prompt
    info('Copy the prompt above to try it in Claude');
    newline();
  }

  // Display alternative prompts
  if (showAlternatives && prompts.alternatives.length > 0) {
    console.error(colorize('Alternative prompts:', 'dim'));
    for (const alt of prompts.alternatives) {
      console.error(`  ${colorize(symbols.bullet, 'dim')} "${alt}"`);
    }
    newline();
  }
}

export default displayGraduationPrompt;
