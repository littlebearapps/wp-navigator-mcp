/**
 * Authentication module exports
 *
 * @module cli/auth
 * @since v2.7.0
 */

export {
  // Types
  type ParsedMagicLink,
  type MagicLinkParseResult,
  type MagicLinkErrorCode,
  type MagicLinkError,
  type MagicLinkExchangeResponse,
  type MagicLinkExchangeResult,
  type MagicLinkExchangeErrorCode,
  type MagicLinkExchangeError,
  type ExchangeOptions,
  // Functions
  parseMagicLink,
  isExpired,
  buildExchangeUrl,
  exchangeToken,
  processMagicLink,
  formatErrorMessage,
  formatSuccessMessage,
} from './magic-link.js';
