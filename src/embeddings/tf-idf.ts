/**
 * TF-IDF (Term Frequency-Inverse Document Frequency) Implementation
 *
 * Provides fast keyword-based semantic search without requiring
 * neural network models. Used as the default search method.
 *
 * @package WP_Navigator_MCP
 * @since 2.7.0
 */

import { cosineSimilarity } from './cosine.js';

/**
 * Common English stopwords to filter out during tokenization
 */
const STOPWORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'by',
  'for',
  'from',
  'has',
  'he',
  'in',
  'is',
  'it',
  'its',
  'of',
  'on',
  'or',
  'that',
  'the',
  'to',
  'was',
  'were',
  'will',
  'with',
  'this',
  'can',
  'you',
  'your',
  'all',
  'also',
  'any',
  'but',
  'etc',
  'if',
  'into',
  'may',
  'no',
  'not',
  'only',
  'other',
  'our',
  'out',
  'so',
  'some',
  'such',
  'than',
  'their',
  'them',
  'then',
  'there',
  'these',
  'they',
  'when',
  'which',
  'who',
  'would',
]);

/**
 * Simple stemming rules for common suffixes
 * This is a lightweight Porter-like stemmer
 */
function stem(word: string): string {
  // Handle common verb forms
  if (word.endsWith('ing')) {
    const base = word.slice(0, -3);
    if (base.length > 2) return base;
  }
  if (word.endsWith('ed')) {
    const base = word.slice(0, -2);
    if (base.length > 2) return base;
  }
  if (word.endsWith('es')) {
    const base = word.slice(0, -2);
    if (base.length > 2) return base;
  }
  if (word.endsWith('s') && !word.endsWith('ss')) {
    const base = word.slice(0, -1);
    if (base.length > 2) return base;
  }

  // Handle common noun/adjective forms
  if (word.endsWith('tion')) {
    return word.slice(0, -4) + 't';
  }
  if (word.endsWith('ment')) {
    const base = word.slice(0, -4);
    if (base.length > 2) return base;
  }
  if (word.endsWith('ness')) {
    const base = word.slice(0, -4);
    if (base.length > 2) return base;
  }
  if (word.endsWith('able') || word.endsWith('ible')) {
    const base = word.slice(0, -4);
    if (base.length > 2) return base;
  }
  if (word.endsWith('ly')) {
    const base = word.slice(0, -2);
    if (base.length > 2) return base;
  }

  return word;
}

/**
 * Tokenize text into normalized terms
 *
 * @param text Input text to tokenize
 * @returns Array of stemmed, lowercase tokens without stopwords
 */
export function tokenize(text: string): string[] {
  // Convert to lowercase and split on non-alphanumeric characters
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1);

  // Filter stopwords and stem
  const tokens: string[] = [];
  for (const word of words) {
    if (!STOPWORDS.has(word)) {
      tokens.push(stem(word));
    }
  }

  return tokens;
}

/**
 * TF-IDF index for a document collection
 */
export interface TFIDFIndex {
  /** Document count */
  documentCount: number;
  /** Term -> document frequency (number of docs containing term) */
  documentFrequency: Map<string, number>;
  /** Document ID -> term -> term frequency */
  termFrequencies: Map<string, Map<string, number>>;
  /** Document ID -> TF-IDF vector */
  vectors: Map<string, number[]>;
  /** Ordered list of terms for vector indexing */
  vocabulary: string[];
}

/**
 * Document for indexing
 */
export interface IndexDocument {
  id: string;
  text: string;
}

/**
 * Build a TF-IDF index from documents
 *
 * @param documents Array of documents to index
 * @returns TF-IDF index
 */
export function buildIndex(documents: IndexDocument[]): TFIDFIndex {
  const documentFrequency = new Map<string, number>();
  const termFrequencies = new Map<string, Map<string, number>>();

  // First pass: calculate term frequencies and document frequencies
  for (const doc of documents) {
    const tokens = tokenize(doc.text);
    const tf = new Map<string, number>();
    const seen = new Set<string>();

    for (const token of tokens) {
      tf.set(token, (tf.get(token) || 0) + 1);

      // Count document frequency (once per document)
      if (!seen.has(token)) {
        seen.add(token);
        documentFrequency.set(token, (documentFrequency.get(token) || 0) + 1);
      }
    }

    termFrequencies.set(doc.id, tf);
  }

  // Build vocabulary (sorted for consistent vector indexing)
  const vocabulary = Array.from(documentFrequency.keys()).sort();

  // Second pass: calculate TF-IDF vectors
  const vectors = new Map<string, number[]>();
  const N = documents.length;

  for (const doc of documents) {
    const tf = termFrequencies.get(doc.id)!;
    const vector: number[] = new Array(vocabulary.length).fill(0);

    for (let i = 0; i < vocabulary.length; i++) {
      const term = vocabulary[i];
      const termFreq = tf.get(term) || 0;

      if (termFreq > 0) {
        const docFreq = documentFrequency.get(term) || 1;
        // TF-IDF formula: tf * log(N / df)
        const idf = Math.log(N / docFreq);
        vector[i] = termFreq * idf;
      }
    }

    vectors.set(doc.id, vector);
  }

  return {
    documentCount: N,
    documentFrequency,
    termFrequencies,
    vectors,
    vocabulary,
  };
}

/**
 * Search result with score
 */
export interface ScoredResult {
  id: string;
  score: number;
}

/**
 * Score a query against the TF-IDF index
 *
 * @param query Search query
 * @param index TF-IDF index
 * @param limit Maximum results to return
 * @returns Sorted array of scored results
 */
export function score(query: string, index: TFIDFIndex, limit: number = 10): ScoredResult[] {
  const queryTokens = tokenize(query);

  if (queryTokens.length === 0) {
    return [];
  }

  // Build query TF-IDF vector
  const queryTf = new Map<string, number>();
  for (const token of queryTokens) {
    queryTf.set(token, (queryTf.get(token) || 0) + 1);
  }

  const queryVector: number[] = new Array(index.vocabulary.length).fill(0);

  for (let i = 0; i < index.vocabulary.length; i++) {
    const term = index.vocabulary[i];
    const termFreq = queryTf.get(term) || 0;

    if (termFreq > 0) {
      const docFreq = index.documentFrequency.get(term) || 1;
      const idf = Math.log(index.documentCount / docFreq);
      queryVector[i] = termFreq * idf;
    }
  }

  // Score each document
  const results: ScoredResult[] = [];

  for (const [docId, docVector] of index.vectors) {
    const similarity = cosineSimilarity(queryVector, docVector);

    if (similarity > 0) {
      results.push({ id: docId, score: similarity });
    }
  }

  // Sort by score descending and limit
  results.sort((a, b) => b.score - a.score);

  return results.slice(0, limit);
}

/**
 * Extract keywords from text (for pre-computed keyword lists)
 *
 * @param text Input text
 * @param maxKeywords Maximum keywords to extract
 * @returns Array of unique keywords sorted by frequency
 */
export function extractKeywords(text: string, maxKeywords: number = 20): string[] {
  const tokens = tokenize(text);
  const freq = new Map<string, number>();

  for (const token of tokens) {
    freq.set(token, (freq.get(token) || 0) + 1);
  }

  // Sort by frequency descending
  const sorted = Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([token]) => token);

  return sorted.slice(0, maxKeywords);
}
