import { Injectable } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { UnrecoverableError } from 'bullmq';
import {
  AiService,
  PinoLogger,
  QUEUES,
  TenantRunner,
  classifyPostJobSchema,
} from '@feedback-board/core';
import type { Job } from 'bullmq';

/**
 * Consumes the `ai-classify` queue (TDD §3.8, §3.10). The payload carries `{ orgId, postId }`
 * only — this processor re-reads `title`/`body` inside `runAs(orgId, ...)` itself, so a job can
 * never smuggle a stale or forged row past RLS, and Redis never holds tenant content.
 *
 * Writes go through `TenantRunner.runAs`, never the admin client (§3.2) — there is no request
 * here, and faking one would hide which `orgId` a job actually ran under. `orgId` comes from
 * the **validated** payload, never trusted as-is (§3.2, §3.10).
 *
 * Injects `PinoLogger` (re-exported from `@feedback-board/core`, §2.6.16), not a bare
 * `@nestjs/common` `Logger` — `nestjs-pino`'s own documented pattern for a BullMQ `@Processor`
 * wraps the job body in `PinoLogger.runInContext(fn, { bindings })` so every log line inside
 * `process()` carries `queue`/`jobId` as structured fields, not string interpolation.
 */
@Injectable()
@Processor(QUEUES.AI_CLASSIFY)
export class AiClassifyProcessor extends WorkerHost {
  constructor(
    private readonly runner: TenantRunner,
    private readonly aiService: AiService,
    private readonly logger: PinoLogger,
  ) {
    super();
    this.logger.setContext(AiClassifyProcessor.name);
  }

  async process(job: Job): Promise<void> {
    return this.logger.runInContext(
      async () => {
        const parsed = classifyPostJobSchema.safeParse(job.data);

        if (!parsed.success) {
          // A malformed payload fails PERMANENTLY, never retried (TDD §3.10) — retrying it just
          // burns attempts. UnrecoverableError bypasses the job's configured `attempts` entirely.
          throw new UnrecoverableError('ai-classify job payload failed validation');
        }

        const { orgId, postId } = parsed.data;

        await this.runner.runAs(orgId, async (tx) => {
          const post = await tx.post.findFirst({
            where: { id: postId },
            select: { title: true, body: true },
          });

          if (post === null) {
            // The post was deleted (or never existed under this org) between enqueue and
            // processing — not a validation failure, but there is nothing left to classify. Log
            // and return rather than throw: retrying cannot make a missing row reappear (§3.8's
            // "AI is an enhancement, never a blocking dependency" applies here too).
            this.logger.warn(`ai-classify: post ${postId} not found in org ${orgId}, skipping`);
            return;
          }

          const classification = await this.aiService.classifyPost(post.title, post.body);

          if (classification === null) {
            // Any AI failure — rate limit, network, refusal, parse miss — leaves both fields null
            // and logs; the post stays fully usable without them (TDD §3.8, §17).
            this.logger.warn(`ai-classify: classification failed for post ${postId}, leaving null`);
            return;
          }

          await tx.post.update({
            where: { id: postId },
            data: { aiCategory: classification.category, aiPriority: classification.priority },
          });
        });
      },
      { bindings: { queue: QUEUES.AI_CLASSIFY, jobId: job.id } },
    );
  }
}
