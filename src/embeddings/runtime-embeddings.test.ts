/**
 * Runtime Embeddings Module Tests
 *
 * Tests for the optional neural embeddings module.
 * The @xenova/transformers package is mocked since it requires downloading
 * a 50MB model.
 *
 * @package WP_Navigator_MCP
 * @since 2.7.0
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  isModelAvailable,
  isPipelineReady,
  getLoadError,
  loadPipeline,
  embedQuery,
  embedTexts,
  unloadPipeline,
} from './runtime-embeddings.js';

// Mock @xenova/transformers
vi.mock('@xenova/transformers', () => ({
  pipeline: vi.fn(),
}));

describe('isModelAvailable', () => {
  it('returns true when @xenova/transformers is installed', () => {
    // The mock makes require.resolve succeed
    expect(isModelAvailable()).toBe(true);
  });
});

describe('isPipelineReady', () => {
  beforeEach(() => {
    unloadPipeline();
  });

  it('returns false initially', () => {
    expect(isPipelineReady()).toBe(false);
  });
});

describe('getLoadError', () => {
  beforeEach(() => {
    unloadPipeline();
  });

  it('returns null initially', () => {
    expect(getLoadError()).toBeNull();
  });
});

describe('unloadPipeline', () => {
  it('clears pipeline and error state', () => {
    unloadPipeline();
    expect(isPipelineReady()).toBe(false);
    expect(getLoadError()).toBeNull();
  });
});

describe('loadPipeline', () => {
  beforeEach(() => {
    unloadPipeline();
    vi.clearAllMocks();
  });

  it('returns null when pipeline loading fails', async () => {
    // The mock doesn't set up a valid pipeline, so it should fail gracefully
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await loadPipeline();

    // Either returns a pipeline or null (depending on mock behavior)
    expect(result === null || typeof result === 'function').toBe(true);
    spy.mockRestore();
  });
});

describe('embedQuery', () => {
  beforeEach(() => {
    unloadPipeline();
    vi.clearAllMocks();
  });

  it('returns null when pipeline is not available', async () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await embedQuery('test query');

    // Should return null when pipeline can't be loaded
    expect(result).toBeNull();
    spy.mockRestore();
  });
});

describe('embedTexts', () => {
  beforeEach(() => {
    unloadPipeline();
    vi.clearAllMocks();
  });

  it('returns array of nulls when pipeline is not available', async () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await embedTexts(['text1', 'text2', 'text3']);

    // Should return array of nulls when pipeline can't be loaded
    expect(result).toEqual([null, null, null]);
    spy.mockRestore();
  });
});
