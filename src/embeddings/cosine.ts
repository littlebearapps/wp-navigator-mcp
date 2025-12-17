/**
 * Cosine Similarity and Vector Math Utilities
 *
 * Provides efficient vector operations for semantic search.
 * Used for both TF-IDF vectors and neural embeddings.
 *
 * @package WP_Navigator_MCP
 * @since 2.7.0
 */

/**
 * Calculate cosine similarity between two vectors
 *
 * @param a First vector
 * @param b Second vector
 * @returns Similarity score between -1 and 1 (1 = identical, 0 = orthogonal, -1 = opposite)
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Vector length mismatch: ${a.length} vs ${b.length}`);
  }

  if (a.length === 0) {
    return 0;
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);

  if (denominator === 0) {
    return 0;
  }

  return dotProduct / denominator;
}

/**
 * Normalize a vector to unit length
 *
 * @param vector Input vector
 * @returns Normalized vector with magnitude 1
 */
export function normalize(vector: number[]): number[] {
  if (vector.length === 0) {
    return [];
  }

  let magnitude = 0;
  for (let i = 0; i < vector.length; i++) {
    magnitude += vector[i] * vector[i];
  }
  magnitude = Math.sqrt(magnitude);

  if (magnitude === 0) {
    return vector.map(() => 0);
  }

  return vector.map((v) => v / magnitude);
}

/**
 * Calculate dot product of two vectors
 *
 * @param a First vector
 * @param b Second vector
 * @returns Dot product scalar
 */
export function dotProduct(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Vector length mismatch: ${a.length} vs ${b.length}`);
  }

  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += a[i] * b[i];
  }
  return sum;
}

/**
 * Calculate Euclidean distance between two vectors
 *
 * @param a First vector
 * @param b Second vector
 * @returns Euclidean distance (lower = more similar)
 */
export function euclideanDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Vector length mismatch: ${a.length} vs ${b.length}`);
  }

  let sumSquares = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sumSquares += diff * diff;
  }
  return Math.sqrt(sumSquares);
}

/**
 * Calculate vector magnitude (L2 norm)
 *
 * @param vector Input vector
 * @returns Magnitude of the vector
 */
export function magnitude(vector: number[]): number {
  let sum = 0;
  for (let i = 0; i < vector.length; i++) {
    sum += vector[i] * vector[i];
  }
  return Math.sqrt(sum);
}
