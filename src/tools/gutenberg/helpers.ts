/**
 * Gutenberg Tool Helpers
 *
 * Utility functions for Gutenberg MCP tools:
 * - IR node building
 * - Path validation
 * - Block structure helpers
 *
 * @package WP_Navigator_Pro
 * @since 1.3.0
 */

/**
 * Build IR node from block type and attributes
 *
 * Creates a properly structured IR node for Gutenberg blocks.
 *
 * @param blockType Block type (e.g., "core/heading", "core/paragraph")
 * @param attrs Block attributes
 * @param children Optional child nodes (default: empty array)
 * @returns IR node object
 */
export function buildIRNode(blockType: string, attrs: any, children: any[] = []): any {
  return {
    type: blockType,
    id: null,
    attrs: attrs,
    children: children,
    meta: {
      innerHTML: '',
      innerContent: [],
    },
  };
}

/**
 * Validate path array
 *
 * Ensures path is a valid array of non-negative integers.
 *
 * @param path Path array to validate
 * @returns True if valid, false otherwise
 */
export function validatePath(path: number[]): boolean {
  if (!Array.isArray(path)) {
    return false;
  }

  if (path.length === 0) {
    return false;
  }

  return path.every(n => Number.isInteger(n) && n >= 0);
}

/**
 * Parse IR document from API response
 *
 * Extracts IR document from REST API response, handling both
 * success and error cases.
 *
 * @param response API response object
 * @returns IR document or throws error
 * @throws Error if response invalid or missing ir_document
 */
export function parseIRDocument(response: any): any {
  if (!response) {
    throw new Error('Invalid response: response is null or undefined');
  }

  if (response.success === false) {
    throw new Error(`API Error: ${response.error || 'Unknown error'}`);
  }

  if (!response.ir_document) {
    throw new Error('Invalid response: missing ir_document');
  }

  return response.ir_document;
}

/**
 * Format IR document for Claude Code output
 *
 * Creates a human-readable summary of the IR document structure.
 *
 * @param ir IR document to format
 * @returns Formatted string
 */
export function formatIRSummary(ir: any): string {
  if (!ir || !ir.root) {
    return 'Empty IR document';
  }

  const blockCount = countBlocks(ir.root.children);
  const blockTypes = getBlockTypes(ir.root.children);

  return `IR Document Summary:
- Total blocks: ${blockCount}
- Block types: ${blockTypes.join(', ')}
- Root children: ${ir.root.children.length}`;
}

/**
 * Count total blocks in IR tree
 *
 * Recursively counts all blocks including nested children.
 *
 * @param nodes Array of IR nodes
 * @returns Total block count
 */
function countBlocks(nodes: any[]): number {
  let count = nodes.length;

  for (const node of nodes) {
    if (node.children && node.children.length > 0) {
      count += countBlocks(node.children);
    }
  }

  return count;
}

/**
 * Get unique block types in IR tree
 *
 * @param nodes Array of IR nodes
 * @returns Array of unique block types
 */
function getBlockTypes(nodes: any[]): string[] {
  const types = new Set<string>();

  function collectTypes(nodeList: any[]) {
    for (const node of nodeList) {
      if (node.type) {
        types.add(node.type);
      }
      if (node.children && node.children.length > 0) {
        collectTypes(node.children);
      }
    }
  }

  collectTypes(nodes);
  return Array.from(types);
}

/**
 * Validate block attributes for specific block type
 *
 * Ensures required attributes are present for common block types.
 *
 * @param blockType Block type
 * @param attrs Attributes object
 * @returns True if valid, throws error otherwise
 * @throws Error if required attributes missing
 */
export function validateBlockAttributes(blockType: string, attrs: any): boolean {
  // Common required attributes by block type
  const requiredAttrs: Record<string, string[]> = {
    'core/heading': ['level', 'content'],
    'core/paragraph': ['content'],
    'core/button': ['text', 'url'],
    'core/image': ['url'],
    'core/list': ['values'],
  };

  const required = requiredAttrs[blockType];

  if (!required) {
    // Unknown block type, allow any attributes
    return true;
  }

  for (const attr of required) {
    if (!(attr in attrs)) {
      throw new Error(`Missing required attribute "${attr}" for block type "${blockType}"`);
    }
  }

  return true;
}

/**
 * Build common block presets
 *
 * Helper functions to create commonly used blocks with proper attributes.
 */
export const blockPresets = {
  /**
   * Create heading block
   */
  heading(level: number, content: string): any {
    if (level < 1 || level > 6) {
      throw new Error('Heading level must be between 1 and 6');
    }

    return buildIRNode('core/heading', { level, content });
  },

  /**
   * Create paragraph block
   */
  paragraph(content: string): any {
    return buildIRNode('core/paragraph', { content });
  },

  /**
   * Create button block
   */
  button(text: string, url: string, linkTarget: string = '_self'): any {
    return buildIRNode('core/button', { text, url, linkTarget });
  },

  /**
   * Create image block
   */
  image(url: string, alt: string = '', caption: string = ''): any {
    return buildIRNode('core/image', { url, alt, caption });
  },

  /**
   * Create columns container with specified number of columns
   */
  columns(columnCount: number): any {
    if (columnCount < 1 || columnCount > 6) {
      throw new Error('Column count must be between 1 and 6');
    }

    const children: any[] = [];
    for (let i = 0; i < columnCount; i++) {
      children.push(buildIRNode('core/column', {}));
    }

    return buildIRNode('core/columns', { columns: columnCount }, children);
  },

  /**
   * Create separator block
   */
  separator(): any {
    return buildIRNode('core/separator', {});
  },

  /**
   * Create spacer block
   */
  spacer(height: number = 20): any {
    return buildIRNode('core/spacer', { height });
  },
};
