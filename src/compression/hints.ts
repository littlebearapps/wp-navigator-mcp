/**
 * Tool Chaining Hints
 *
 * Provides contextual suggestions for AI agents on next actions.
 *
 * @package WP_Navigator_Pro
 * @since 2.8.0
 */

/**
 * Single action hint for tool chaining
 */
export interface ActionHint {
  tool: string;
  args?: Record<string, unknown>;
  reason: string;
}

/**
 * Hints schema for response metadata
 */
export interface ResponseHints {
  next_actions?: ActionHint[];
  common_followups?: string[];
}

/**
 * Create a next action hint.
 */
export function createActionHint(
  tool: string,
  reason: string,
  args?: Record<string, unknown>
): ActionHint {
  const hint: ActionHint = { tool, reason };
  if (args && Object.keys(args).length > 0) {
    hint.args = args;
  }
  return hint;
}

/**
 * Create hints for post creation.
 */
export function getPostCreationHints(postId: number, status: string): ResponseHints {
  const hints: ResponseHints = {
    next_actions: [],
    common_followups: ['wpnav_list_posts', 'wpnav_get_post'],
  };

  if (status === 'draft') {
    hints.next_actions!.push(
      createActionHint('wpnav_update_post', 'Publish the draft', { id: postId, status: 'publish' })
    );
  }
  hints.next_actions!.push(
    createActionHint('wpnav_upload_media_from_url', 'Add featured image', { post_id: postId })
  );

  return hints;
}

/**
 * Create hints for page creation.
 */
export function getPageCreationHints(pageId: number, status: string): ResponseHints {
  const hints: ResponseHints = {
    next_actions: [],
    common_followups: ['wpnav_list_pages', 'wpnav_get_page'],
  };

  if (status === 'draft') {
    hints.next_actions!.push(
      createActionHint('wpnav_update_page', 'Publish the draft', { id: pageId, status: 'publish' })
    );
  }
  hints.next_actions!.push(
    createActionHint('wpnav_gutenberg_list_blocks', 'View page blocks', { post_id: pageId })
  );

  return hints;
}

/**
 * Create hints for media upload.
 */
export function getMediaUploadHints(mediaId: number): ResponseHints {
  return {
    next_actions: [
      createActionHint('wpnav_update_page', 'Set as featured image', { featured_media: mediaId }),
      createActionHint('wpnav_gutenberg_insert_block', 'Insert image block'),
    ],
    common_followups: ['wpnav_list_media', 'wpnav_get_media'],
  };
}

/**
 * Create hints for update operations.
 */
export function getUpdateHints(type: 'post' | 'page' | 'media', id: number): ResponseHints {
  const getTool = type === 'media' ? 'wpnav_get_media' : `wpnav_get_${type}`;
  const listTool = type === 'media' ? 'wpnav_list_media' : `wpnav_list_${type}s`;

  return {
    next_actions: [createActionHint(getTool, 'Verify the changes', { id })],
    common_followups: [listTool],
  };
}

/**
 * Create hints for delete operations.
 */
export function getDeleteHints(type: 'post' | 'page' | 'media'): ResponseHints {
  const listTool = type === 'media' ? 'wpnav_list_media' : `wpnav_list_${type}s`;
  return {
    next_actions: [createActionHint(listTool, 'View remaining items')],
    common_followups: [],
  };
}
