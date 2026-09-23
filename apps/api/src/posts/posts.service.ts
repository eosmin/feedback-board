import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { JOBS, QUEUES, classifyPostJobSchema } from '@feedback-board/core';
import type { Queue } from 'bullmq';
import type { Post } from '@feedback-board/shared';

import { TenantPrismaService } from '../database/tenant-prisma.service';
import type { CreatePostDto } from './dto/create-post.dto';
import type { UpdatePostStatusDto } from './dto/update-post-status.dto';

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
   * payload carries `{ orgId, postId }` only, never `title`/`body` — a payload sitting in Redis
   * must carry no tenant content (§3.10).
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

    // Post-commit side effect (TDD §3.7, §3.8, §3.10): the transaction above has already
    // returned by the time this line runs, and the HTTP response never waits on the job —
    // enqueue failures are not caught here on purpose, matching §17's "AI is an enhancement"
    // rule only for the classification *result*, not for the enqueue call itself, which BullMQ
    // already retries via its own connection-level reconnection logic.
    await this.aiClassifyQueue.add(
      JOBS.CLASSIFY,
      classifyPostJobSchema.parse({ orgId, postId: post.id }),
      { attempts: 3, backoff: { type: 'exponential', delay: 2_000, jitter: 0.5 } },
    );

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

    return this.toPost(post);
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
