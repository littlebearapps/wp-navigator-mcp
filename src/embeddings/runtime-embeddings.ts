/**
 * Runtime Embeddings - Lazy-Loaded Neural Search
 *
 * Provides optional neural embeddings for query matching.
 * Uses @xenova/transformers which downloads ~50MB model on first use.
 *
 * This module is lazy-loaded to avoid impacting startup time.
 * Falls back gracefully to TF-IDF if model is unavailable.
 *
 * @package WP_Navigator_MCP
 * @since 2.7.0
 */

// Pipeline type from @xenova/transformers
type Pipeline = {
  (text: string | string[]): Promise<{ data: Float32Array }[]>;
};

// Module state
let pipeline: Pipeline | null = null;
let isLoading = false;
let loadError: Error | null = null;

/**
 * Model to use for embeddings
 * all-MiniLM-L6-v2 is a good balance of size (~23MB) and quality
 */
const MODEL_NAME = 'Xenova/all-MiniLM-L6-v2';

/**
 * Check if the embedding model is available
 *
 * @returns True if model can be loaded (package installed)
 */
export function isModelAvailable(): boolean {
  try {
    // Check if @xenova/transformers is installed
    // This is a devDependency, so may not be present at runtime
    require.resolve('@xenova/transformers');
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if the pipeline is ready for use
 */
export function isPipelineReady(): boolean {
  return pipeline !== null;
}

/**
 * Get the last load error, if any
 */
export function getLoadError(): Error | null {
  return loadError;
}

/**
 * Load the embedding pipeline (lazy initialization)
 *
 * Downloads the model on first use (~50MB).
 * Returns null if model is not available.
 */
export async function loadPipeline(): Promise<Pipeline | null> {
  if (pipeline !== null) {
    return pipeline;
  }

  if (loadError !== null) {
    return null;
  }

  if (isLoading) {
    // Wait for existing load to complete
    while (isLoading) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return pipeline;
  }

  isLoading = true;

  try {
    // Dynamic import to avoid bundling if not used
    // The module name is constructed dynamically to prevent TypeScript from
    // analyzing it at compile time (it's an optional devDependency)
    const moduleName = '@xenova/transformers';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const transformers = await (Function('m', 'return import(m)')(moduleName) as Promise<any>);

    // Create feature extraction pipeline
    pipeline = (await transformers.pipeline('feature-extraction', MODEL_NAME, {
      quantized: true, // Use quantized model for faster inference
    })) as Pipeline;

    return pipeline;
  } catch (error) {
    loadError = error instanceof Error ? error : new Error(String(error));
    console.warn(`Failed to load embedding model: ${loadError.message}`);
    return null;
  } finally {
    isLoading = false;
  }
}

/**
 * Generate embedding for a text query
 *
 * @param query Text to embed
 * @returns 384-dimensional embedding vector, or null if unavailable
 */
export async function embedQuery(query: string): Promise<number[] | null> {
  const pipe = await loadPipeline();

  if (!pipe) {
    return null;
  }

  try {
    const result = await pipe(query);

    // Result is an array of embeddings (one per input)
    // Each embedding has shape [1, sequence_length, 384]
    // We need to mean-pool across the sequence dimension
    const embedding = result[0];

    if (!embedding || !embedding.data) {
      return null;
    }

    // Convert Float32Array to regular array
    return Array.from(embedding.data);
  } catch (error) {
    console.warn(`Failed to generate embedding: ${error}`);
    return null;
  }
}

/**
 * Generate embeddings for multiple texts
 *
 * @param texts Array of texts to embed
 * @returns Array of 384-dimensional embedding vectors
 */
export async function embedTexts(texts: string[]): Promise<(number[] | null)[]> {
  const pipe = await loadPipeline();

  if (!pipe) {
    return texts.map(() => null);
  }

  try {
    const results = await pipe(texts);

    return results.map((result) => {
      if (!result || !result.data) {
        return null;
      }
      return Array.from(result.data);
    });
  } catch (error) {
    console.warn(`Failed to generate embeddings: ${error}`);
    return texts.map(() => null);
  }
}

/**
 * Unload the pipeline to free memory
 */
export function unloadPipeline(): void {
  pipeline = null;
  loadError = null;
}
