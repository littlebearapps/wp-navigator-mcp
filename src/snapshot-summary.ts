/**
 * Snapshot Summary Generator
 *
 * Analyzes page snapshots to generate human-readable summaries
 * of content structure for the "aha moment" UX in CLI.
 *
 * @package WP_Navigator_Pro
 * @since 1.2.0
 */

import type { BlockSnapshot, PageSnapshot } from './snapshots/types.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Section type detection result
 */
export interface SectionInfo {
  /** Section type (hero, features, cta, grid, etc.) */
  type: string;
  /** Human-readable description */
  description: string;
  /** Component breakdown (e.g., "heading + text + button") */
  components?: string;
}

/**
 * Page content summary
 */
export interface PageContentSummary {
  /** Total block count */
  totalBlocks: number;
  /** Detected sections */
  sections: SectionInfo[];
  /** Summary lines for display */
  summaryLines: string[];
}

// =============================================================================
// Section Detection
// =============================================================================

/**
 * Block patterns that suggest section types
 */
const SECTION_PATTERNS: Record<string, {
  requiredBlocks: string[];
  optionalBlocks?: string[];
  minBlocks?: number;
  description: string;
}> = {
  hero: {
    requiredBlocks: ['core/heading', 'core/paragraph'],
    optionalBlocks: ['core/buttons', 'core/image', 'core/cover'],
    description: 'hero section',
  },
  features: {
    requiredBlocks: ['core/columns'],
    optionalBlocks: ['core/heading', 'core/image'],
    minBlocks: 3,
    description: 'feature grid',
  },
  cta: {
    requiredBlocks: ['core/buttons'],
    optionalBlocks: ['core/heading', 'core/paragraph'],
    description: 'CTA section',
  },
  testimonial: {
    requiredBlocks: ['core/quote'],
    optionalBlocks: ['core/image', 'core/paragraph'],
    description: 'testimonial',
  },
  gallery: {
    requiredBlocks: ['core/gallery'],
    description: 'image gallery',
  },
  media: {
    requiredBlocks: ['core/media-text'],
    description: 'media + text section',
  },
};

/**
 * Get all block names recursively
 */
function getAllBlockNames(blocks: BlockSnapshot[]): string[] {
  const names: string[] = [];
  for (const block of blocks) {
    names.push(block.blockName);
    if (block.innerBlocks.length > 0) {
      names.push(...getAllBlockNames(block.innerBlocks));
    }
  }
  return names;
}

/**
 * Count blocks by type
 */
function countBlockTypes(blocks: BlockSnapshot[]): Map<string, number> {
  const counts = new Map<string, number>();
  const allNames = getAllBlockNames(blocks);
  for (const name of allNames) {
    counts.set(name, (counts.get(name) || 0) + 1);
  }
  return counts;
}

/**
 * Get simple block type name (without core/ prefix)
 */
function getSimpleBlockName(blockName: string): string {
  return blockName.replace('core/', '').replace(/-/g, ' ');
}

/**
 * Analyze a group of blocks to detect section type
 */
function detectSectionType(blocks: BlockSnapshot[]): SectionInfo | null {
  const blockNames = getAllBlockNames(blocks);
  const uniqueNames = new Set(blockNames);

  // Check each pattern
  for (const [type, pattern] of Object.entries(SECTION_PATTERNS)) {
    const hasRequired = pattern.requiredBlocks.every((b) => uniqueNames.has(b));
    if (!hasRequired) continue;

    // Check minimum blocks if specified
    if (pattern.minBlocks && blockNames.length < pattern.minBlocks) continue;

    // Build component description
    const components: string[] = [];
    for (const block of blocks) {
      if (block.blockName === 'core/heading') components.push('heading');
      else if (block.blockName === 'core/paragraph') components.push('text');
      else if (block.blockName === 'core/buttons') components.push('button');
      else if (block.blockName === 'core/image') components.push('image');
    }

    return {
      type,
      description: pattern.description,
      components: components.length > 0 ? components.join(' + ') : undefined,
    };
  }

  return null;
}

/**
 * Analyze top-level structure and detect sections
 */
function detectSections(blocks: BlockSnapshot[]): SectionInfo[] {
  const sections: SectionInfo[] = [];
  let currentGroup: BlockSnapshot[] = [];

  for (const block of blocks) {
    // Container blocks are potential sections
    if (['core/group', 'core/cover', 'core/columns'].includes(block.blockName)) {
      // Flush current group
      if (currentGroup.length > 0) {
        const section = detectSectionType(currentGroup);
        if (section) sections.push(section);
        currentGroup = [];
      }

      // Analyze this container
      const innerBlocks = block.innerBlocks.length > 0 ? block.innerBlocks : [block];
      const section = detectSectionType(innerBlocks);
      if (section) {
        sections.push(section);
      } else if (block.blockName === 'core/columns') {
        // Columns without clear pattern - describe as grid
        const colCount = block.innerBlocks.length;
        sections.push({
          type: 'grid',
          description: `${colCount}-column grid`,
        });
      } else {
        // Generic section
        sections.push({
          type: 'section',
          description: 'content section',
        });
      }
    } else {
      // Accumulate non-container blocks
      currentGroup.push(block);
    }
  }

  // Flush remaining group
  if (currentGroup.length > 0) {
    const section = detectSectionType(currentGroup);
    if (section) {
      sections.push(section);
    } else if (currentGroup.length > 0) {
      // Describe based on block types
      const types = currentGroup.map((b) => getSimpleBlockName(b.blockName));
      const uniqueTypes = [...new Set(types)];
      sections.push({
        type: 'content',
        description: uniqueTypes.slice(0, 3).join(', ') + (uniqueTypes.length > 3 ? '...' : ''),
      });
    }
  }

  return sections;
}

// =============================================================================
// Summary Generation
// =============================================================================

/**
 * Generate human-readable summary of page content
 */
export function summarizePageContent(snapshot: PageSnapshot): PageContentSummary {
  const blocks = snapshot.content.blocks;
  const totalBlocks = countBlockTypes(blocks);
  const totalCount = Array.from(totalBlocks.values()).reduce((a, b) => a + b, 0);

  // Detect sections
  const sections = detectSections(blocks);

  // Build summary lines
  const summaryLines: string[] = [];

  if (sections.length === 0 && totalCount === 0) {
    summaryLines.push('Empty page (no blocks)');
  } else if (sections.length === 0) {
    // No clear sections, describe by block types
    const counts = countBlockTypes(blocks);
    const topTypes = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    for (const [blockName, count] of topTypes) {
      const name = getSimpleBlockName(blockName);
      summaryLines.push(`${count} ${name}${count > 1 ? 's' : ''}`);
    }
  } else {
    // Describe sections
    const sectionCounts = new Map<string, { count: number; info: SectionInfo }>();
    for (const section of sections) {
      const key = section.description;
      const existing = sectionCounts.get(key);
      if (existing) {
        existing.count++;
      } else {
        sectionCounts.set(key, { count: 1, info: section });
      }
    }

    for (const [desc, { count, info }] of sectionCounts) {
      const countStr = count > 1 ? `${count} ` : '';
      const suffix = count > 1 && !desc.endsWith('s') ? 's' : '';
      const components = info.components ? ` (${info.components})` : '';
      summaryLines.push(`${countStr}${desc}${suffix}${components}`);
    }
  }

  return {
    totalBlocks: totalCount,
    sections,
    summaryLines,
  };
}

/**
 * Check if this is the first snapshot (no existing snapshots directory)
 */
export function isFirstSnapshot(snapshotsDir: string): boolean {
  try {
    const fs = require('fs');
    return !fs.existsSync(snapshotsDir);
  } catch {
    return true;
  }
}

/**
 * Get the "aha moment" message for first snapshot
 */
export function getFirstSnapshotMessage(): string {
  return 'Your site is now "AI-readable."';
}
