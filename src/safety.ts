import crypto from 'crypto';
import type { WPConfig } from './config.js';

export type JsonPatchOp = {
  op: 'replace' | 'insert' | 'delete' | 'patch';
  path: string; // e.g., "/title", "/content", "/status"
  value?: any;
};

export type ApplyContentOptions = {
  postId: number;
  operations: JsonPatchOp[];
  force?: boolean;
};

export type GutenbergBlock = {
  blockName: string;
  attrs: Record<string, any>;
  innerBlocks?: GutenbergBlock[];
};

export type CreateContentOptions = {
  postType: 'post' | 'page' | string;
  title: string;
  content?: string;
  excerpt?: string;
  status?: 'draft' | 'publish' | 'private';
  blocks?: GutenbergBlock[]; // For creating posts with blocks
};

export type WpRequest = (
  endpoint: string,
  options?: RequestInit & { timeoutMs?: number }
) => Promise<any>;

export async function applyContentChanges(
  wpRequest: WpRequest,
  config: WPConfig,
  opts: ApplyContentOptions
) {
  const idempotencyKey = makeIdempotencyKey();

  // 1) Plan
  const plan = await wpRequest('/wpnav/v1/content/plan', {
    method: 'POST',
    body: JSON.stringify({
      post_id: opts.postId,
      operations: opts.operations,
      idempotency_key: idempotencyKey,
    }),
  });

  const planId = plan?.plan_id ?? plan?.id ?? plan?.planId;
  if (!planId) {
    throw new Error(`PLAN_FAILED: Could not retrieve plan_id from response`);
  }

  // 2) Diff (json format; small context)
  const diff = await wpRequest('/wpnav/v1/content/diff', {
    method: 'POST',
    body: JSON.stringify({
      plan_id: planId,
      format: 'json',
      context_lines: 3,
    }),
  });

  // 3) Apply
  const apply = await wpRequest('/wpnav/v1/content/apply', {
    method: 'POST',
    body: JSON.stringify({
      plan_id: planId,
      idempotency_key: idempotencyKey,
      force: !!opts.force,
    }),
  });

  return { plan, diff, apply };
}

export async function applyContentCreation(
  wpRequest: WpRequest,
  config: WPConfig,
  opts: CreateContentOptions
) {
  const idempotencyKey = makeIdempotencyKey();

  // Build operations from create options
  const operations: JsonPatchOp[] = [{ op: 'replace', path: '/title', value: opts.title }];

  if (opts.content) {
    operations.push({ op: 'replace', path: '/content', value: opts.content });
  }

  if (opts.excerpt) {
    operations.push({ op: 'replace', path: '/excerpt', value: opts.excerpt });
  }

  if (opts.status) {
    operations.push({ op: 'replace', path: '/status', value: opts.status });
  }

  // Add Gutenberg block operations if provided
  if (opts.blocks && opts.blocks.length > 0) {
    opts.blocks.forEach((block, index) => {
      operations.push({
        op: 'insert',
        path: `/blocks/${index}`,
        value: {
          type: 'block',
          blockName: block.blockName,
          attrs: block.attrs,
          innerBlocks: block.innerBlocks || [],
          innerContent: [],
          children: [],
        },
      });
    });
  }

  // 1) Plan (with post_id: 0 for creates)
  const plan = await wpRequest('/wpnav/v1/content/plan', {
    method: 'POST',
    body: JSON.stringify({
      post_id: 0, // Sentinel: indicates create mode
      post_type: opts.postType,
      operations,
      idempotency_key: idempotencyKey,
    }),
  });

  const planId = plan?.plan_id ?? plan?.id ?? plan?.planId;
  if (!planId) {
    throw new Error(`PLAN_FAILED: Could not retrieve plan_id from response`);
  }

  // 2) Diff (same as updates)
  const diff = await wpRequest('/wpnav/v1/content/diff', {
    method: 'POST',
    body: JSON.stringify({
      plan_id: planId,
      format: 'json',
      context_lines: 3,
    }),
  });

  // 3) Apply (creates the post)
  const apply = await wpRequest('/wpnav/v1/content/apply', {
    method: 'POST',
    body: JSON.stringify({
      plan_id: planId,
      idempotency_key: idempotencyKey,
      force: true, // Required for critical-risk operations like creates
    }),
  });

  return { plan, diff, apply };
}

export function makeIdempotencyKey(): string {
  try {
    return crypto.randomBytes(16).toString('hex');
  } catch {
    // Fallback (non‑crypto) if environment restricts
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}
