/**
 * TUI Prompts
 *
 * Interactive input prompts for WP Navigator CLI.
 * Uses Node.js readline for cross-platform compatibility.
 *
 * @package WP_Navigator_Pro
 * @since 1.1.0
 */

import * as readline from 'readline';
import type {
  InputPromptOptions,
  SelectPromptOptions,
  ConfirmPromptOptions,
} from './types.js';
import { colorize, colors, symbols, supportsColor } from './components.js';

/**
 * Create readline interface for prompts
 */
function createReadline(): readline.Interface {
  return readline.createInterface({
    input: process.stdin,
    output: process.stderr,
    terminal: process.stdin.isTTY ?? false,
  });
}

/**
 * Prompt for text input
 *
 * @example
 * const name = await inputPrompt({
 *   message: 'Site name',
 *   defaultValue: 'My Site',
 *   validate: (v) => v.length < 3 ? 'Name too short' : null
 * });
 */
export async function inputPrompt(options: InputPromptOptions): Promise<string> {
  const { message, defaultValue, validate, transform, secret } = options;

  const rl = createReadline();

  // Build prompt string
  let promptStr = `${colorize('?', 'cyan')} ${message}`;
  if (defaultValue) {
    promptStr += ` ${colorize(`(${defaultValue})`, 'dim')}`;
  }
  promptStr += ': ';

  // Hide input for secrets
  if (secret && process.stdin.isTTY) {
    // Mute output while typing
    const originalWrite = process.stderr.write.bind(process.stderr);
    (process.stderr as any).write = (chunk: any) => {
      // Only write prompt, not the input
      if (typeof chunk === 'string' && chunk.includes('?')) {
        return originalWrite(chunk);
      }
      return true;
    };

    return new Promise((resolve) => {
      rl.question(promptStr, (answer) => {
        (process.stderr as any).write = originalWrite;
        process.stderr.write('\n');
        rl.close();

        let result = answer || defaultValue || '';
        if (transform) result = transform(result);
        resolve(result);
      });
    });
  }

  const askQuestion = (): Promise<string> => {
    return new Promise((resolve) => {
      rl.question(promptStr, (answer) => {
        let result = answer || defaultValue || '';

        // Validate
        if (validate) {
          const errorMsg = validate(result);
          if (errorMsg) {
            console.error(`  ${colorize(symbols.error, 'red')} ${colorize(errorMsg, 'red')}`);
            resolve(askQuestion()); // Re-prompt
            return;
          }
        }

        // Transform
        if (transform) {
          result = transform(result);
        }

        rl.close();
        resolve(result);
      });
    });
  };

  return askQuestion();
}

/**
 * Prompt for selection from choices
 *
 * @example
 * const env = await selectPrompt({
 *   message: 'Select environment',
 *   choices: [
 *     { label: 'Development', value: 'dev' },
 *     { label: 'Production', value: 'prod', recommended: true }
 *   ]
 * });
 */
export async function selectPrompt(options: SelectPromptOptions): Promise<string> {
  const { message, choices } = options;

  // Find recommended choice (default on Enter)
  const recommendedIndex = choices.findIndex((c) => c.recommended);
  const defaultChoice = recommendedIndex >= 0 ? choices[recommendedIndex] : choices[0];

  console.error(`${colorize('?', 'cyan')} ${message}`);

  // Display choices
  choices.forEach((choice, index) => {
    const num = index + 1;
    const isRecommended = choice.recommended;
    let line = `  ${colorize(`${num})`, 'dim')} ${choice.label}`;
    if (isRecommended) {
      line += ` ${colorize('(recommended)', 'green')}`;
    }
    console.error(line);
  });

  const rl = createReadline();

  const promptStr = `${colorize('Enter choice', 'dim')} [${defaultChoice.value}]: `;

  return new Promise((resolve) => {
    const ask = () => {
      rl.question(promptStr, (answer) => {
        // Empty = default
        if (!answer.trim()) {
          rl.close();
          resolve(defaultChoice.value);
          return;
        }

        // Try as number
        const num = parseInt(answer, 10);
        if (!isNaN(num) && num >= 1 && num <= choices.length) {
          rl.close();
          resolve(choices[num - 1].value);
          return;
        }

        // Try as value match
        const matchedChoice = choices.find(
          (c) => c.value.toLowerCase() === answer.toLowerCase() || c.label.toLowerCase() === answer.toLowerCase()
        );
        if (matchedChoice) {
          rl.close();
          resolve(matchedChoice.value);
          return;
        }

        // Invalid - re-prompt
        console.error(`  ${colorize(symbols.error, 'red')} ${colorize('Invalid choice. Enter a number or value.', 'red')}`);
        ask();
      });
    };

    ask();
  });
}

/**
 * Prompt for yes/no confirmation
 *
 * @example
 * const confirmed = await confirmPrompt({
 *   message: 'Continue with deployment?',
 *   defaultValue: false
 * });
 */
export async function confirmPrompt(options: ConfirmPromptOptions): Promise<boolean> {
  const { message, defaultValue = true } = options;

  const rl = createReadline();

  // Show y/n with default capitalized
  const yesNo = defaultValue ? 'Y/n' : 'y/N';
  const promptStr = `${colorize('?', 'cyan')} ${message} ${colorize(`(${yesNo})`, 'dim')}: `;

  return new Promise((resolve) => {
    rl.question(promptStr, (answer) => {
      rl.close();

      const trimmed = answer.trim().toLowerCase();

      // Empty = default
      if (!trimmed) {
        resolve(defaultValue);
        return;
      }

      // Yes variants
      if (['y', 'yes', 'true', '1'].includes(trimmed)) {
        resolve(true);
        return;
      }

      // No variants
      if (['n', 'no', 'false', '0'].includes(trimmed)) {
        resolve(false);
        return;
      }

      // Anything else = default
      resolve(defaultValue);
    });
  });
}

/**
 * Wait for user to press Enter
 */
export async function pressEnterToContinue(message = 'Press Enter to continue...'): Promise<void> {
  const rl = createReadline();

  return new Promise((resolve) => {
    rl.question(colorize(message, 'dim'), () => {
      rl.close();
      resolve();
    });
  });
}
