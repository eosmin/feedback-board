import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { JOBS, QUEUES, classifyPostJobSchema, deliverWebhookJobSchema } from '@feedback-board/core';
import { WEBHOOK_EVENT } from '@feedback-board/shared';
import type { Queue } from 'bullmq';
import type { Post } from '@feedback-board/shared';
import type { WebhookEvent } from '@feedback-board/shared';

import { TenantPrismaService } from '../database/tenant-prisma.service';
import type { CreatePostDto } from './dto/create-post.dto';
import type { UpdatePostStatusDto } from './dto/update-post-status.dto';

const JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 2_000, jitter: 0.5 },
  // Failed jobs stay in the failed set, inspectable in Bull Board next to their three
  // WebhookDelivery rows (TDD §2.6.14, §3.7 step 4) — BullMQ's default removes them on
  // exhausted retries, which would make a permanently-failing delivery silent.
  removeOnFail: false,
} as const;

/**
 * All data access goes through `TenantPrismaService` (TDD §3.2, §3.3). `Post.orgId`/`boardId`/
 * `authorId` are required, non-default columns, so — the same as `BoardsService.create()` —
 * `orgId` must be supplied explicitly in `data`; RLS controls *visibility*, not what a write
 * inserts.
 */
@Injectable()
export class PostsService {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    @InjectQueue(QUEUES.AI_CLASSIFY) private readonly aiClassifyQueue: Queue,
    @InjectQueue(QUEUES.WEBHOOKS) private readonly webhooksQueue: Queue,
  ) {}

  /** Resolves a board slug to its id within the tenant, or 404s (TDD §11 nesting). */
  async resolveBoardId(boardSlug: string): Promise<string> {
    const board = await this.tenantPrisma.run((tx) =>
      tx.board.findFirst({ where: { slug: boardSlug }, select: { id: true } }),
    );

    if (board === null) {
      throw new NotFoundException({ error: 'NOT_FOUND' });
    }

    return board.id;
  }

  /**
   * `PlanGuard`'s `@LimitedByPlan('posts')` has already refused this request at the FREE cap,
   * counted **per org, not per board** (TDD §3.9), by the time this runs. `aiCategory`/
   * `aiPriority` start `null` — the `ai-classify` job enqueued below, **after** the insert
   * transaction commits, populates them; nothing here waits on that job (§3.8, §3.10). The
   * `post.created` webhook fan-out (§3.7) enqueues the same way, right after: one job per
   * subscribed active `Webhook` row, never one job per event — a job is BullMQ's unit of retry,
   * so a per-event job would re-`POST` to endpoints that already succeeded when a sibling fails.
   */
  async create(
    orgId: string,
    boardId: string,
    authorId: string,
    dto: CreatePostDto,
  ): Promise<Post> {
    const post = await this.tenantPrisma.run((tx) =>
      tx.post.create({
        data: { orgId, boardId, authorId, title: dto.title, body: dto.body },
      }),
    );

    // Post-commit side effects (TDD §3.7, §3.8, §3.10): the transaction above has already
    // returned by the time these lines run, and the HTTP response never waits on either job —
    // enqueue failures are not caught here on purpose, matching §17's "AI is an enhancement"
    // rule only for the classification *result*, not for the enqueue call itself, which BullMQ
    // already retries via its own connection-level reconnection logic.
    await this.aiClassifyQueue.add(
      JOBS.CLASSIFY,
      classifyPostJobSchema.parse({ orgId, postId: post.id }),
      JOB_OPTIONS,
    );
    await this.enqueueWebhookDeliveries(WEBHOOK_EVENT.POST_CREATED, post.orgId, post.id);

    return this.toPost(post);
  }

  /** `GET /orgs/:orgSlug/boards/:boardSlug/posts` — admin view, all statuses (TDD §11). */
  async listForBoard(boardSlug: string): Promise<Post[]> {
    const boardId = await this.resolveBoardId(boardSlug);

    const posts = await this.tenantPrisma.run((tx) =>
      tx.post.findMany({ where: { boardId }, orderBy: { createdAt: 'desc' } }),
    );

    return posts.map((post) => this.toPost(post));
  }

  /** `GET /orgs/:orgSlug/posts/:postId` — single post detail (TDD §11). */
  async getById(postId: string): Promise<Post> {
    const post = await this.tenantPrisma.run((tx) => tx.post.findFirst({ where: { id: postId } }));

    if (post === null) {
      throw new NotFoundException({ error: 'NOT_FOUND' });
    }

    return this.toPost(post);
  }

  /**
   * `PATCH /orgs/:orgSlug/posts/:postId` — status change, OWNER/ADMIN only (TDD §11), enforced
   * by `@Roles` on the controller, not here — this method carries no role logic of its own.
   * The `post.status_changed` webhook fan-out follows the same post-commit rule as `create()`.
   */
  async updateStatus(postId: string, dto: UpdatePostStatusDto): Promise<Post> {
    const existing = await this.tenantPrisma.run((tx) =>
      tx.post.findFirst({ where: { id: postId } }),
    );

    if (existing === null) {
      throw new NotFoundException({ error: 'NOT_FOUND' });
    }

    const post = await this.tenantPrisma.run((tx) =>
      tx.post.update({ where: { id: postId }, data: { status: dto.status } }),
    );

    await this.enqueueWebhookDeliveries(WEBHOOK_EVENT.POST_STATUS_CHANGED, post.orgId, post.id);

    return this.toPost(post);
  }

  /**
   * One `deliver` job per subscribed, **active** webhook (TDD §3.7) — never a single job that
   * fans out internally, which is the queue fan-out §1.5 rules out; this is N calls to `add()`.
   * `events: { has: event }` filters at the database, not in application code, so an org with
   * many webhooks never pulls rows it will not enqueue for.
   */
  private async enqueueWebhookDeliveries(
    event: WebhookEvent,
    orgId: string,
    postId: string,
  ): Promise<void> {
    const webhooks = await this.tenantPrisma.run((tx) =>
      tx.webhook.findMany({
        where: { isActive: true, events: { has: event } },
        select: { id: true },
      }),
    );

    await Promise.all(
      webhooks.map((webhook) =>
        this.webhooksQueue.add(
          JOBS.DELIVER,
          deliverWebhookJobSchema.parse({ orgId, webhookId: webhook.id, event, postId }),
          JOB_OPTIONS,
        ),
      ),
    );
  }

  private toPost(post: {
    id: string;
    boardId: string;
    orgId: string;
    authorId: string;
    title: string;
    body: string;
    status: string;
    voteCount: number;
    aiCategory: string | null;
    aiPriority: string | null;
    createdAt: Date;
  }): Post {
    return {
      id: post.id,
      boardId: post.boardId,
      orgId: post.orgId,
      authorId: post.authorId,
      title: post.title,
      body: post.body,
      status: post.status as Post['status'],
      voteCount: post.voteCount,
      aiCategory: post.aiCategory as Post['aiCategory'],
      aiPriority: post.aiPriority as Post['aiPriority'],
      createdAt: post.createdAt.toISOString(),
    };
  }
}
