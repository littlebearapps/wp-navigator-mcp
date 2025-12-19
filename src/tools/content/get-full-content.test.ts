import { describe, it, expect, vi, beforeEach } from 'vitest';
import { toolRegistry, ToolCategory } from '../../tool-registry/index.js';
import './get-full-content.js';

describe('wpnav_get_full_content', () => {
  const mockContext = {
    wpRequest: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches full post content', async () => {
    mockContext.wpRequest.mockResolvedValueOnce({
      id: 42,
      content: { rendered: '<p>Full post content here...</p>' },
      excerpt: { rendered: '<p>Excerpt</p>' },
    });

    const tool = toolRegistry.getTool('wpnav_get_full_content');
    expect(tool).toBeDefined();

    const result = await tool!.handler({ id: 42, type: 'post' }, mockContext as any);

    const parsed = JSON.parse(result.content[0].text!);
    expect(parsed.id).toBe(42);
    expect(parsed.type).toBe('post');
    expect(parsed.field).toBe('content');
    expect(parsed.full_content).toBe('<p>Full post content here...</p>');
    expect(parsed.content_length).toBe('<p>Full post content here...</p>'.length);
    expect(parsed._meta.token_estimate).toBeGreaterThan(0);
  });

  it('fetches post excerpt', async () => {
    mockContext.wpRequest.mockResolvedValueOnce({
      id: 42,
      content: { rendered: '<p>Full content</p>' },
      excerpt: { rendered: '<p>The excerpt text</p>' },
    });

    const tool = toolRegistry.getTool('wpnav_get_full_content');
    const result = await tool!.handler(
      { id: 42, type: 'post', field: 'excerpt' },
      mockContext as any
    );

    const parsed = JSON.parse(result.content[0].text!);
    expect(parsed.field).toBe('excerpt');
    expect(parsed.full_content).toBe('<p>The excerpt text</p>');
  });

  it('fetches full page content', async () => {
    mockContext.wpRequest.mockResolvedValueOnce({
      id: 10,
      content: { rendered: '<p>Page content</p>' },
    });

    const tool = toolRegistry.getTool('wpnav_get_full_content');
    const result = await tool!.handler({ id: 10, type: 'page' }, mockContext as any);

    const parsed = JSON.parse(result.content[0].text!);
    expect(parsed.type).toBe('page');
    expect(parsed.full_content).toBe('<p>Page content</p>');
    expect(mockContext.wpRequest).toHaveBeenCalledWith('wp/v2/pages/10', {
      method: 'GET',
    });
  });

  it('fetches media description', async () => {
    mockContext.wpRequest.mockResolvedValueOnce({
      id: 99,
      description: { rendered: 'Full image description' },
      caption: { rendered: 'Image caption' },
      alt_text: 'Alt text',
    });

    const tool = toolRegistry.getTool('wpnav_get_full_content');
    const result = await tool!.handler({ id: 99, type: 'media' }, mockContext as any);

    const parsed = JSON.parse(result.content[0].text!);
    expect(parsed.type).toBe('media');
    expect(parsed.field).toBe('description');
    expect(parsed.full_content).toBe('Full image description');
  });

  it('fetches media caption', async () => {
    mockContext.wpRequest.mockResolvedValueOnce({
      id: 99,
      description: { rendered: 'Description' },
      caption: { rendered: 'The caption' },
      alt_text: 'Alt text',
    });

    const tool = toolRegistry.getTool('wpnav_get_full_content');
    const result = await tool!.handler(
      { id: 99, type: 'media', field: 'caption' },
      mockContext as any
    );

    const parsed = JSON.parse(result.content[0].text!);
    expect(parsed.field).toBe('caption');
    expect(parsed.full_content).toBe('The caption');
  });

  it('fetches media alt_text', async () => {
    mockContext.wpRequest.mockResolvedValueOnce({
      id: 99,
      description: { rendered: 'Description' },
      caption: { rendered: 'Caption' },
      alt_text: 'Alternative text for image',
    });

    const tool = toolRegistry.getTool('wpnav_get_full_content');
    const result = await tool!.handler(
      { id: 99, type: 'media', field: 'alt_text' },
      mockContext as any
    );

    const parsed = JSON.parse(result.content[0].text!);
    expect(parsed.field).toBe('alt_text');
    expect(parsed.full_content).toBe('Alternative text for image');
  });

  it('throws error for missing id', async () => {
    const tool = toolRegistry.getTool('wpnav_get_full_content');

    await expect(tool!.handler({ type: 'post' }, mockContext as any)).rejects.toThrow(
      'Missing required fields: id'
    );
  });

  it('throws error for invalid content type', async () => {
    const tool = toolRegistry.getTool('wpnav_get_full_content');

    await expect(tool!.handler({ id: 1, type: 'comment' }, mockContext as any)).rejects.toThrow(
      'Invalid content type'
    );
  });

  it('throws error for invalid field', async () => {
    mockContext.wpRequest.mockResolvedValueOnce({ id: 1 });

    const tool = toolRegistry.getTool('wpnav_get_full_content');

    await expect(
      tool!.handler({ id: 1, type: 'post', field: 'caption' }, mockContext as any)
    ).rejects.toThrow("Invalid field 'caption' for type 'post'");
  });

  it('handles empty content gracefully', async () => {
    mockContext.wpRequest.mockResolvedValueOnce({
      id: 50,
      content: { rendered: '' },
    });

    const tool = toolRegistry.getTool('wpnav_get_full_content');
    const result = await tool!.handler({ id: 50, type: 'post' }, mockContext as any);

    const parsed = JSON.parse(result.content[0].text!);
    expect(parsed.full_content).toBe('');
    expect(parsed.content_length).toBe(0);
  });
});
