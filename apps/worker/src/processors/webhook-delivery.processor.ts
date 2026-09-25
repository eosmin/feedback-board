import { Injectable } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { UnrecoverableError } from 'bullmq';
import {
  PinoLogger,
  QUEUES,
  TenantRunner,
  WebhookDeliveryService,
  deliverWebhookJobSchema,
} from '@feedback-board/core';
import type { Job } from 'bullmq';

/**
 * The outcome of one delivery attempt, decided *inside* the tenant transaction but acted on
 * *outside* it — see the note on `process()` for why the split matters.
 */
interface DeliveryOutcome {
  readonly shouldRetry: boolean;
  readonly webhookId?: string;
  readonly responseStatus?: number | null;
}

/**
 * Consumes the `webhooks` queue (TDD §3.7, §3.10). The payload carries
 * `{ orgId, webhookId, event, postId }` only — ids, never tenant content (§3.10). Writes go
 * through `TenantRunner.runAs`, never the admin client (§3.2): there is no request here, and
 * `orgId` is taken from the **validated** payload, never trusted as-is.
 *
 * Injects `PinoLogger` (re-exported from `@feedback-board/core`, §2.6.16), the same
 * `runInContext` pattern `AiClassifyProcessor` uses, so every log line inside `process()`
 * carries `queue`/`jobId` as structured fields.
 */
@Injectable()
@Processor(QUEUES.WEBHOOKS)
export class WebhookDeliveryProcessor extends WorkerHost {
  constructor(
    private readonly runner: TenantRunner,
    private readonly delivery: WebhookDeliveryService,
    private readonly logger: PinoLogger,
  ) {
    super();
    this.logger.setContext(WebhookDeliveryProcessor.name);
  }

  async process(job: Job): Promise<void> {
    return this.logger.runInContext(
      async () => {
        const parsed = deliverWebhookJobSchema.safeParse(job.data);

        if (!parsed.success) {
          // A malformed payload fails PERMANENTLY, never retried (TDD §3.10) — retrying it
          // just burns attempts. UnrecoverableError bypasses the job's configured `attempts`.
          throw new UnrecoverableError('deliver job payload failed validation');
        }

        const { orgId, webhookId, event, postId } = parsed.data;

        // The BullMQ-retry throw happens AFTER this call returns, never inside the callback
        // passed to it: TenantRunner.runAs wraps the callback in db.$transaction, and Prisma
        // rolls back the whole transaction — including the WebhookDelivery row this callback
        // just inserted — the instant the callback throws. Throwing here would silently erase
        // every failed-attempt row the delivery log (TDD §3.7) exists to show.
        const outcome = await this.runner.runAs<DeliveryOutcome>(orgId, async (tx) => {
          const webhook = await tx.webhook.findFirst({
            where: { id: webhookId, isActive: true, events: { has: event } },
            select: { id: true, targetUrl: true, secret: true },
          });

          if (webhook === null) {
            // Deleted, deactivated, or unsubscribed since enqueue — not a failure, and not an
            // attempt to burn: no delivery, no WebhookDelivery row (TDD §3.7 step 3).
            this.logger.warn(`deliver: webhook ${webhookId} no longer active/subscribed, skipping`);
            return { shouldRetry: false };
          }

          const post = await tx.post.findFirst({
            where: { id: postId },
            select: { id: true, title: true, body: true, status: true, voteCount: true },
          });

          if (post === null) {
            this.logger.warn(`deliver: post ${postId} not found in org ${orgId}, skipping`);
            return { shouldRetry: false };
          }

          const result = await this.delivery.deliver(
            webhook.targetUrl,
            webhook.secret,
            event,
            post,
          );

          // One row per attempt, never updated in place (TDD §3.7) — attempt is BullMQ's own
          // 1-based attemptsMade counter, not a value this processor tracks itself. This write
          // is the last statement in the callback on every path, so it always commits.
          await tx.webhookDelivery.create({
            data: {
              webhookId: webhook.id,
              orgId,
              event,
              payload: post,
              responseStatus: result.responseStatus,
              attempt: job.attemptsMade + 1,
            },
          });

          return {
            shouldRetry: result.responseStatus === null || result.responseStatus >= 400,
            webhookId: webhook.id,
            responseStatus: result.responseStatus,
          };
        });

        if (outcome.shouldRetry) {
          // A non-2xx or network error must actually retry — BullMQ only retries a job that
          // throws (TDD §2.6.14's exponential backoff applies to this queue's `attempts: 3`).
          // Thrown here, after the transaction above has already committed the attempt's row.
          throw new Error(
            `deliver: webhook ${outcome.webhookId ?? webhookId} responded ${String(outcome.responseStatus)}`,
          );
        }
      },
      { bindings: { queue: QUEUES.WEBHOOKS, jobId: job.id } },
    );
  }
}
