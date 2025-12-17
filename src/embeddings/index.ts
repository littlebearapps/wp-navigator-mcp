/**
 * Embeddings Module - Semantic Tool Search
 *
 * Provides semantic search over WP Navigator tools using dual-mode matching:
 * 1. TF-IDF (default): Fast keyword-based scoring, no model download
 * 2. Embeddings (optional): Higher accuracy via @xenova/transformers
 *
 * Tool vectors are pre-computed at build time and shipped with the package.
 *
 * @package WP_Navigator_MCP
 * @since 2.7.0
 */

import { cosineSimilarity } from './cosine.js';
import { buildIndex, score as tfidfScore, TFIDFIndex, extractKeywords } from './tf-idf.js';

/**
 * Tool embedding data structure
 */
export interface ToolEmbedding {
  /** Tool name (e.g., wpnav_list_posts) */
  name: string;
  /** Tool description */
  description: string;
  /** Tool category */
  category: string;
  /** Neural embedding vector (384-dim, optional) */
  vector?: number[];
  /** Pre-extracted keywords for TF-IDF */
  keywords: string[];
}

/**
 * Tool vectors file structure
 */
export interface ToolVectorsFile {
  /** Generation timestamp */
  generated: string;
  /** Embedding model used */
  model: string;
  /** Array of tool embeddings */
  tools: ToolEmbedding[];
}

/**
 * Search options
 */
export interface SearchOptions {
  /** Maximum results to return (default: 10) */
  limit?: number;
  /** Use neural embeddings for query (default: false) */
  useEmbeddings?: boolean;
  /** Minimum score threshold (default: 0.1) */
  minScore?: number;
}

/**
 * Search result
 */
export interface ToolSearchResult {
  /** Tool name */
  name: string;
  /** Tool description */
  description: string;
  /** Tool category */
  category: string;
  /** Relevance score (0-1) */
  score: number;
}

// Module state
let toolVectors: ToolEmbedding[] | null = null;
let tfidfIndex: TFIDFIndex | null = null;
let isLoaded = false;

/**
 * Load tool vectors from the pre-generated JSON file
 *
 * This is called lazily on first search. The vectors are embedded
 * in the package at build time.
 *
 * @returns Array of tool embeddings
 */
export function loadToolVectors(): ToolEmbedding[] {
  if (toolVectors !== null) {
    return toolVectors;
  }

  try {
    // Dynamic import of the JSON file
    // In production, this is bundled with the package
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const data = require('./tool-vectors.json') as ToolVectorsFile;
    toolVectors = data.tools;
    isLoaded = true;

    // Build TF-IDF index from tool descriptions
    const documents = toolVectors.map((tool) => ({
      id: tool.name,
      text: `${tool.name} ${tool.description} ${tool.keywords.join(' ')}`,
    }));
    tfidfIndex = buildIndex(documents);

    return toolVectors;
  } catch {
    // Return empty array if vectors not found (e.g., during development)
    console.warn('Tool vectors not found. Run npm run build:embeddings to generate.');
    toolVectors = [];
    return toolVectors;
  }
}

/**
 * Check if tool vectors are loaded
 */
export function isVectorsLoaded(): boolean {
  return isLoaded && toolVectors !== null && toolVectors.length > 0;
}

/**
 * Search tools by natural language query
 *
 * Uses TF-IDF by default for fast, accurate keyword matching.
 * Set useEmbeddings: true for neural embedding similarity (requires model).
 *
 * @param query Natural language search query
 * @param options Search options
 * @returns Sorted array of matching tools with scores
 */
export function searchTools(query: string, options: SearchOptions = {}): ToolSearchResult[] {
  const { limit = 10, useEmbeddings = false, minScore = 0.1 } = options;

  // Ensure vectors are loaded
  const tools = loadToolVectors();

  if (tools.length === 0) {
    return [];
  }

  // Validate query
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return [];
  }

  // Use embeddings if requested and available
  if (useEmbeddings) {
    return searchWithEmbeddings(trimmedQuery, tools, limit, minScore);
  }

  // Default: Use TF-IDF
  return searchWithTFIDF(trimmedQuery, limit, minScore);
}

/**
 * Search using TF-IDF scoring
 */
function searchWithTFIDF(query: string, limit: number, minScore: number): ToolSearchResult[] {
  if (!tfidfIndex || !toolVectors) {
    return [];
  }

  const results = tfidfScore(query, tfidfIndex, limit * 2); // Get extra for filtering

  // Map results to ToolSearchResult
  const toolMap = new Map(toolVectors.map((t) => [t.name, t]));
  const output: ToolSearchResult[] = [];

  for (const result of results) {
    if (result.score < minScore) {
      continue;
    }

    const tool = toolMap.get(result.id);
    if (tool) {
      output.push({
        name: tool.name,
        description: tool.description,
        category: tool.category,
        score: Math.min(result.score, 1), // Normalize to max 1
      });
    }

    if (output.length >= limit) {
      break;
    }
  }

  return output;
}

/**
 * Search using neural embeddings (requires runtime model)
 *
 * Falls back to TF-IDF if embeddings are not available.
 */
function searchWithEmbeddings(
  query: string,
  tools: ToolEmbedding[],
  limit: number,
  minScore: number
): ToolSearchResult[] {
  // Check if tools have embeddings
  const hasEmbeddings = tools.some((t) => t.vector && t.vector.length > 0);

  if (!hasEmbeddings) {
    // Fall back to TF-IDF
    console.warn('Neural embeddings not available, falling back to TF-IDF');
    return searchWithTFIDF(query, limit, minScore);
  }

  // Try to get query embedding (async operation - not yet implemented)
  // For now, fall back to TF-IDF
  // TODO: Implement runtime query embedding in runtime-embeddings.ts
  return searchWithTFIDF(query, limit, minScore);
}

/**
 * Search tools by category
 *
 * @param category Tool category to filter by
 * @returns Array of tools in the category
 */
export function searchByCategory(category: string): ToolSearchResult[] {
  const tools = loadToolVectors();

  if (tools.length === 0) {
    return [];
  }

  const normalizedCategory = category.toLowerCase();

  return tools
    .filter((tool) => tool.category.toLowerCase() === normalizedCategory)
    .map((tool) => ({
      name: tool.name,
      description: tool.description,
      category: tool.category,
      score: 1.0, // Perfect match for category filter
    }));
}

/**
 * Get all available categories
 *
 * @returns Array of unique category names
 */
export function getCategories(): string[] {
  const tools = loadToolVectors();
  const categories = new Set(tools.map((t) => t.category));
  return Array.from(categories).sort();
}

/**
 * Get tool count statistics
 */
export function getStats(): { total: number; byCategory: Record<string, number> } {
  const tools = loadToolVectors();
  const byCategory: Record<string, number> = {};

  for (const tool of tools) {
    byCategory[tool.category] = (byCategory[tool.category] || 0) + 1;
  }

  return {
    total: tools.length,
    byCategory,
  };
}

/**
 * Reset module state (for testing)
 * @internal
 */
export function _resetState(): void {
  toolVectors = null;
  tfidfIndex = null;
  isLoaded = false;
}

/**
 * Set tool vectors directly (for testing)
 * @internal
 */
export function _setToolVectors(tools: ToolEmbedding[]): void {
  toolVectors = tools;
  isLoaded = true;

  // Build TF-IDF index
  const documents = tools.map((tool) => ({
    id: tool.name,
    text: `${tool.name} ${tool.description} ${tool.keywords.join(' ')}`,
  }));
  tfidfIndex = buildIndex(documents);
}

// Re-export utilities for use in build scripts
export { extractKeywords } from './tf-idf.js';
export { cosineSimilarity, normalize } from './cosine.js';
