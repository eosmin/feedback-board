import { z } from 'zod';

import { WEBHOOK_EVENTS } from '@feedback-board/shared';

/**
 * Payloads carry ids only, never a post's title or body (TDD §3.10, §3.7, §3.8) — the worker
 * re-reads the record under `runAs(orgId, ...)`, so a job cannot smuggle a stale or forged row
 * past RLS and a payload sitting in Redis never contains tenant content.
 *
 * Validated at the top of every processor (§3.2, §7.5). A payload that fails validation is
 * failed permanently, never retried — retrying a malformed payload just burns attempts.
 */
export const deliverWebhookJobSchema = z.object({
  orgId: z.uuid(),
  webhookId: z.uuid(),
  event: z.enum(WEBHOOK_EVENTS),
  postId: z.uuid(),
});

export type DeliverWebhookJob = z.infer<typeof deliverWebhookJobSchema>;

export const classifyPostJobSchema = z.object({
  orgId: z.uuid(),
  postId: z.uuid(),
});

export type ClassifyPostJob = z.infer<typeof classifyPostJobSchema>;
