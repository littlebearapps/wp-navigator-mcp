/**
 * Gutenberg Block Parser
 *
 * Parses WordPress Gutenberg block content into structured format.
 * Handles nested blocks (innerBlocks), block attributes, and reusable blocks.
 *
 * @package WP_Navigator_Pro
 * @since 1.1.0
 */

import type { BlockSnapshot } from '../snapshots/types.js';

/**
 * Block delimiter markers in WordPress content
 */
const BLOCK_COMMENT_START = '<!-- wp:';
const BLOCK_COMMENT_END = '-->';
const BLOCK_COMMENT_CLOSE = '<!-- /wp:';

/**
 * Parse state for tracking position in content
 */
interface ParseState {
  content: string;
  position: number;
}

/**
 * Result from parsing a single block
 */
interface BlockParseResult {
  block: BlockSnapshot;
  endPosition: number;
}

/**
 * Check if position is at a block start marker
 */
function isBlockStart(state: ParseState): boolean {
  return (
    state.content.substring(state.position, state.position + BLOCK_COMMENT_START.length) ===
    BLOCK_COMMENT_START
  );
}

/**
 * Check if position is at a block close marker
 */
function isBlockClose(state: ParseState, blockName: string): boolean {
  const closeMarker = `${BLOCK_COMMENT_CLOSE}${blockName}`;
  return (
    state.content.substring(state.position, state.position + closeMarker.length) === closeMarker
  );
}

/**
 * Parse block name and attributes from opening comment
 *
 * Handles formats:
 * - <!-- wp:paragraph -->
 * - <!-- wp:heading {"level":2} -->
 * - <!-- wp:separator /-->
 * - <!-- wp:acf/testimonial {"id":"123"} -->
 */
function parseBlockOpening(state: ParseState): {
  blockName: string;
  attrs: Record<string, unknown>;
  isSelfClosing: boolean;
  endPosition: number;
} | null {
  if (!isBlockStart(state)) {
    return null;
  }

  // Find the end of the block comment
  const commentEnd = state.content.indexOf(BLOCK_COMMENT_END, state.position);
  if (commentEnd === -1) {
    return null;
  }

  const commentContent = state.content
    .substring(state.position + BLOCK_COMMENT_START.length, commentEnd)
    .trim();

  // Check for self-closing marker (ends with /)
  const isSelfClosing = commentContent.endsWith('/');
  const cleanContent = isSelfClosing ? commentContent.slice(0, -1).trim() : commentContent;

  // Parse block name and attributes
  // Block name can be "paragraph" or "namespace/block-name"
  const spaceIndex = cleanContent.indexOf(' ');
  let blockName: string;
  let attrsJson = '';

  if (spaceIndex === -1) {
    blockName = cleanContent;
  } else {
    blockName = cleanContent.substring(0, spaceIndex);
    attrsJson = cleanContent.substring(spaceIndex + 1).trim();
  }

  // Normalize block name (add core/ prefix if no namespace)
  if (!blockName.includes('/')) {
    blockName = `core/${blockName}`;
  }

  // Parse attributes JSON
  let attrs: Record<string, unknown> = {};
  if (attrsJson) {
    try {
      attrs = JSON.parse(attrsJson);
    } catch {
      // Invalid JSON, keep empty attrs
    }
  }

  return {
    blockName,
    attrs,
    isSelfClosing,
    endPosition: commentEnd + 3, // length of '-->'
  };
}

/**
 * Parse a single block and its inner content recursively
 */
function parseBlock(state: ParseState): BlockParseResult | null {
  const opening = parseBlockOpening(state);
  if (!opening) {
    return null;
  }

  const { blockName, attrs, isSelfClosing, endPosition } = opening;

  // For self-closing blocks, return immediately
  if (isSelfClosing) {
    return {
      block: {
        blockName,
        attrs,
        innerBlocks: [],
        innerHTML: '',
        innerContent: [],
      },
      endPosition,
    };
  }

  // Find the closing marker for this block
  // Need to handle nested blocks of the same type
  const closeMarker = `${BLOCK_COMMENT_CLOSE}${blockName.replace('core/', '')} -->`;
  const coreCloseMarker = `${BLOCK_COMMENT_CLOSE}${blockName} -->`;

  // Parse inner content - can contain HTML and nested blocks
  const innerBlocks: BlockSnapshot[] = [];
  const innerContent: string[] = [];
  let innerHTML = '';
  let currentPosition = endPosition;
  let htmlBuffer = '';

  while (currentPosition < state.content.length) {
    // Check if we've reached the closing marker
    const remainingContent = state.content.substring(currentPosition);
    if (remainingContent.startsWith(closeMarker) || remainingContent.startsWith(coreCloseMarker)) {
      // Flush any remaining HTML
      if (htmlBuffer) {
        innerContent.push(htmlBuffer);
        innerHTML += htmlBuffer;
        htmlBuffer = '';
      }

      // Find end of closing marker
      const closeEnd = state.content.indexOf(' -->', currentPosition);
      return {
        block: {
          blockName,
          attrs,
          innerBlocks,
          innerHTML,
          innerContent,
        },
        endPosition: closeEnd !== -1 ? closeEnd + 4 : currentPosition,
      };
    }

    // Check if there's a nested block
    if (isBlockStart({ content: state.content, position: currentPosition })) {
      // Flush HTML buffer before nested block
      if (htmlBuffer) {
        innerContent.push(htmlBuffer);
        innerHTML += htmlBuffer;
        htmlBuffer = '';
      }

      // Parse the nested block
      const nestedResult = parseBlock({ content: state.content, position: currentPosition });
      if (nestedResult) {
        innerBlocks.push(nestedResult.block);
        innerContent.push(null as any); // Marker for inner block position
        currentPosition = nestedResult.endPosition;
        continue;
      }
    }

    // Regular character - add to HTML buffer
    htmlBuffer += state.content[currentPosition];
    currentPosition++;
  }

  // If we reach here, there was no closing marker (malformed content)
  // Return what we have
  if (htmlBuffer) {
    innerContent.push(htmlBuffer);
    innerHTML += htmlBuffer;
  }

  return {
    block: {
      blockName,
      attrs,
      innerBlocks,
      innerHTML,
      innerContent,
    },
    endPosition: currentPosition,
  };
}

/**
 * Parse all Gutenberg blocks from WordPress content
 *
 * @param content - Raw WordPress content with Gutenberg block comments
 * @returns Array of parsed blocks with preserved hierarchy
 */
export function parseGutenbergBlocks(content: string): BlockSnapshot[] {
  if (!content || typeof content !== 'string') {
    return [];
  }

  const blocks: BlockSnapshot[] = [];
  const state: ParseState = {
    content,
    position: 0,
  };

  while (state.position < content.length) {
    // Skip until we find a block start
    if (!isBlockStart(state)) {
      state.position++;
      continue;
    }

    // Parse the block
    const result = parseBlock(state);
    if (result) {
      blocks.push(result.block);
      state.position = result.endPosition;
    } else {
      // Couldn't parse, skip past the marker
      state.position++;
    }
  }

  return blocks;
}

/**
 * Serialize blocks back to WordPress block format
 *
 * @param blocks - Array of blocks to serialize
 * @returns WordPress block content string
 */
export function serializeBlocks(blocks: BlockSnapshot[]): string {
  return blocks.map(serializeBlock).join('\n\n');
}

/**
 * Serialize a single block to WordPress format
 */
function serializeBlock(block: BlockSnapshot): string {
  const { blockName, attrs, innerBlocks, innerHTML } = block;

  // Remove core/ prefix for serialization
  const shortName = blockName.startsWith('core/') ? blockName.slice(5) : blockName;

  // Build attributes JSON if present
  const attrsJson = Object.keys(attrs).length > 0 ? ` ${JSON.stringify(attrs)}` : '';

  // Self-closing block (no content, no inner blocks)
  if (!innerHTML && innerBlocks.length === 0) {
    return `<!-- wp:${shortName}${attrsJson} /-->`;
  }

  // Block with content
  const openTag = `<!-- wp:${shortName}${attrsJson} -->`;
  const closeTag = `<!-- /wp:${shortName} -->`;

  // If there are inner blocks, serialize them too
  let innerContentStr = innerHTML;
  if (innerBlocks.length > 0) {
    innerContentStr = innerBlocks.map(serializeBlock).join('\n');
  }

  return `${openTag}\n${innerContentStr}\n${closeTag}`;
}

/**
 * Check if a block is a reusable block (block reference)
 */
export function isReusableBlock(block: BlockSnapshot): boolean {
  return block.blockName === 'core/block' && typeof block.attrs.ref === 'number';
}

/**
 * Get the reference ID of a reusable block
 */
export function getReusableBlockRef(block: BlockSnapshot): number | null {
  if (isReusableBlock(block)) {
    return block.attrs.ref as number;
  }
  return null;
}

/**
 * Flatten blocks to a single-level array (removes nesting)
 */
export function flattenBlocks(blocks: BlockSnapshot[]): BlockSnapshot[] {
  const flat: BlockSnapshot[] = [];

  for (const block of blocks) {
    flat.push(block);
    if (block.innerBlocks.length > 0) {
      flat.push(...flattenBlocks(block.innerBlocks));
    }
  }

  return flat;
}

/**
 * Count total blocks including nested
 */
export function countBlocks(blocks: BlockSnapshot[]): number {
  return flattenBlocks(blocks).length;
}

/**
 * Get all unique block types used
 */
export function getBlockTypes(blocks: BlockSnapshot[]): string[] {
  const types = new Set<string>();

  for (const block of flattenBlocks(blocks)) {
    types.add(block.blockName);
  }

  return Array.from(types).sort();
}
