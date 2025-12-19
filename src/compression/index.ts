/**
 * Compression Module
 *
 * Core types and helpers for compact/expanded response modes.
 *
 * @package WP_Navigator_Pro
 * @since 2.8.0
 */

import type { WPConfig } from '../config.js';

export type CompressionMode = 'compact' | 'full';

export interface CompressionOptions {
  compact?: boolean;
}

export interface CompressionState {
  mode: CompressionMode;
  maxResponseBytes: number;
}

export function createCompressionState(
  config: WPConfig,
  options: CompressionOptions = {}
): CompressionState {
  const compact = options.compact ?? true;
  const maxResponseBytes = Math.max(1, config.toggles.maxResponseKb) * 1024;

  return {
    mode: compact ? 'compact' : 'full',
    maxResponseBytes,
  };
}

export * from './types.js';
export * from './compact.js';
export * from './summarizer.js';
export * from './truncation.js';
export * from './metadata.js';
export * from './field-defaults.js';
export * from './delta.js';
export * from './compact-list.js';
export * from './hints.js';
