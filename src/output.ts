import type { WPConfig } from './config.js';
import {
  createCompressionState,
  type CompressionOptions,
  type CompressionState,
} from './compression/index.js';

/**
 * Clamp a text payload to maxResponseKb from config toggles.
 * Appends a truncation message when clamped.
 */
export function clampText(text: string, config: WPConfig): string {
  const maxBytes = Math.max(1, config.toggles.maxResponseKb) * 1024;
  const bytes = byteLength(text);
  if (bytes <= maxBytes) return text;

  // Trim to ~maxBytes - 512 for headroom, then adjust down to boundary
  let limit = Math.max(0, maxBytes - 512);
  let out = safeSliceByBytes(text, limit);
  const note = `\n\n[Output truncated at ${config.toggles.maxResponseKb}KB. Set WPNAV_MAX_RESPONSE_KB to adjust or refine your query.]`;
  // Ensure note fits
  const noteBytes = byteLength(note);
  if (byteLength(out) + noteBytes > maxBytes) {
    out = safeSliceByBytes(out, maxBytes - noteBytes);
  }
  return out + note;
}

/**
 * Format a JSON‑serializable payload using the compression
 * infrastructure and clamp it to the configured response limit.
 *
 * This helper is intended for new tools that want a consistent
 * compact/full envelope. Existing tools can continue to use
 * clampText directly until they are migrated.
 */
export function formatCompressedJson(
  payload: unknown,
  config: WPConfig,
  options?: CompressionOptions
): { json: string; compression: CompressionState } {
  const compression = createCompressionState(config, options);

  const envelope = {
    _meta: {
      mode: compression.mode,
    },
    data: payload,
  };

  const json = clampText(JSON.stringify(envelope, null, 2), config);

  return { json, compression };
}

function byteLength(s: string): number {
  return Buffer.byteLength(s, 'utf8');
}

function safeSliceByBytes(s: string, maxBytes: number): string {
  if (maxBytes <= 0) return '';
  let bytes = 0;
  let i = 0;
  while (i < s.length) {
    const code = s.codePointAt(i)!;
    const encLen = code <= 0x7f ? 1 : code <= 0x7ff ? 2 : code <= 0xffff ? 3 : 4;
    if (bytes + encLen > maxBytes) break;
    bytes += encLen;
    i += code > 0xffff ? 2 : 1;
  }
  return s.slice(0, i);
}
