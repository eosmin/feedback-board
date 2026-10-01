import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AiService, Prisma } from '@feedback-board/core';
import type { AiService as Ai, DigestPostInput } from '@feedback-board/core';
import { ERROR_CODES } from '@feedback-board/shared';
import type { AiDigestQuota, Board, BoardDetail, BoardDigest } from '@feedback-board/shared';

import { TenantPrismaService } from '../database/tenant-prisma.service';
import { buildRateLimitKey } from '../orgs/guards/org-rate-limit.guard';
import { RateLimitStore } from '../queue/rate-limit.store';
import type { CreateBoardDto } from './dto/create-board.dto';

/**
 * The single source for the `ai-digest` route's hourly budget (TDD §3.8) — `BoardsController`'s
 * `@RateLimit(...)` decorator, this service's own refund/peek calls, and
 * `getDigestQuota()`'s response all read this instead of each repeating the literal `5`/
 * `3_600_000`.
 */
export const AI_DIGEST_RATE_LIMIT = { limit: 5, ttlMs: 3_600_000, route: 'ai-digest' } as const;

/**
 * `OrgRateLimitGuard` reads `AI_DIGEST_RATE_LIMIT.route` via `@RateLimit(AI_DIGEST_RATE_LIMIT)`,
 * so this is guaranteed to match the guard's counter key — not the handler's `.name`, which a
 * future rename of `BoardsController.generateDigest` would silently desync.
 */
const AI_DIGEST_RATE_LIMIT_ROUTE = AI_DIGEST_RATE_LIMIT.route;

/**
 * Prisma's error code for a violated `@@unique` (here, `@@unique([orgId, slug])` on `Board`,
 * TDD §10) — checked by code rather than by message text, which is not part of Prisma's stable
 * API surface.
 */
const PRISMA_UNIQUE_CONSTRAINT_CODE = 'P2002';

/**
 * The digest only ever summarizes feedback still in play (TDD §3.8) — `DONE`/`CLOSED` posts are
 * resolved and would only dilute the prompt with items the team has already acted on.
 */
const DIGEST_STATUSES = ['OPEN', 'PLANNED', 'IN_PROGRESS'] as const;

function isUniqueConstraintViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === PRISMA_UNIQUE_CONSTRAINT_CODE
  );
}

/**
 * All data access goes through `TenantPrismaService` (TDD §3.2, §3.3) — `runAs`/`run` only set
 * the `app.org_id` session variable that RLS policies match against; they do **not** populate
 * insert columns. `Board.orgId` is a required, non-default column, so a `create()` still needs
 * `orgId` supplied explicitly in `data`, the same way `OrgsService.create()` supplies it for
 * `Membership` — RLS controls *visibility*, not what a write inserts.
 */
@Injectable()
export class BoardsService {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    @Inject(AiService) private readonly aiService: Ai,
    private readonly rateLimitStore: RateLimitStore,
  ) {}

  /**
   * `PlanGuard`'s `@LimitedByPlan('boards')` has already refused this request at the FREE cap
   * (TDD §3.9) by the time this runs — this method only needs to guard against the
   * `@@unique([orgId, slug])` collision a guard cannot see.
   */
  async create(orgId: string, dto: CreateBoardDto): Promise<Board> {
    try {
      const board = await this.tenantPrisma.run((tx) =>
        tx.board.create({
          data: { orgId, name: dto.name, slug: dto.slug, isPublic: dto.isPublic ?? true },
        }),
      );

      return {
        id: board.id,
        orgId: board.orgId,
        name: board.name,
        slug: board.slug,
        isPublic: board.isPublic,
        createdAt: board.createdAt.toISOString(),
      };
    } catch (error) {
      if (isUniqueConstraintViolation(error)) {
        throw new ConflictException({ error: ERROR_CODES.CONFLICT });
      }
      throw error;
    }
  }

  /** `GET /orgs/:orgSlug/boards` — membership-gated, no plan check (TDD §11). */
  async list(): Promise<Board[]> {
    const boards = await this.tenantPrisma.run((tx) =>
      tx.board.findMany({ orderBy: { createdAt: 'asc' } }),
    );

    return boards.map((board) => ({
      id: board.id,
      orgId: board.orgId,
      name: board.name,
      slug: board.slug,
      isPublic: board.isPublic,
      createdAt: board.createdAt.toISOString(),
    }));
  }

  /**
   * `GET /orgs/:orgSlug/boards/:boardSlug` — metadata plus the post count the dashboard board
   * page renders (TDD §12). The count is scoped to this board specifically, unlike the FREE-cap
   * count in `PlanGuard`, which counts posts for the whole org (§3.9).
   */
  async getDetail(boardSlug: string): Promise<BoardDetail> {
    const board = await this.tenantPrisma.run((tx) =>
      tx.board.findFirst({ where: { slug: boardSlug } }),
    );

    if (board === null) {
      throw new NotFoundException({ error: ERROR_CODES.NOT_FOUND });
    }

    const postCount = await this.tenantPrisma.run((tx) =>
      tx.post.count({ where: { boardId: board.id } }),
    );

    return {
      id: board.id,
      orgId: board.orgId,
      name: board.name,
      slug: board.slug,
      isPublic: board.isPublic,
      createdAt: board.createdAt.toISOString(),
      postCount,
    };
  }

  /**
   * `POST /orgs/:orgSlug/boards/:boardSlug/ai-digest` (TDD §3.8) — loads only
   * `OPEN`/`PLANNED`/`IN_PROGRESS` posts for the board, builds one prompt, and returns the
   * model's text directly. **Not persisted, not cached**: regenerating costs another call, an
   * accepted trade-off for a portfolio-scale demo (§1.5). Unlike `classifyPost()`, a failure
   * here is not swallowed — `AiService.generateDigest()` throws, and this method lets that
   * propagate, because the digest is an on-demand, user-visible action, not a background
   * enhancement (§3.8).
   */
  async generateDigest(
    orgId: string,
    boardSlug: string,
    acceptLanguage?: string,
  ): Promise<BoardDigest> {
    const board = await this.tenantPrisma.run((tx) =>
      tx.board.findFirst({ where: { slug: boardSlug }, select: { id: true } }),
    );

    if (board === null) {
      throw new NotFoundException({ error: ERROR_CODES.NOT_FOUND });
    }

    const posts = await this.tenantPrisma.run((tx) =>
      tx.post.findMany({
        where: { boardId: board.id, status: { in: [...DIGEST_STATUSES] } },
        select: { title: true, body: true, voteCount: true, aiCategory: true, aiPriority: true },
        orderBy: { voteCount: 'desc' },
      }),
    );

    // Nothing to summarize — never spend a model call on a prompt with no posts, which is also
    // exactly what led the model to ask the caller to paste some instead of producing a digest.
    // `OrgRateLimitGuard` already counted this request before this method could know that, so
    // refund it: a no-op attempt should not cost part of the org's hourly budget (§3.8).
    if (posts.length === 0) {
      await this.rateLimitStore.release(buildRateLimitKey(AI_DIGEST_RATE_LIMIT_ROUTE, orgId));
      throw new BadRequestException({ error: ERROR_CODES.DIGEST_NO_POSTS });
    }

    const input: DigestPostInput[] = posts.map((post) => ({
      title: post.title,
      body: post.body,
      voteCount: post.voteCount,
      category: post.aiCategory,
      priority: post.aiPriority,
    }));

    const summary = await this.aiService.generateDigest(input, acceptLanguage);

    return { summary };
  }

  /**
   * `GET .../ai-digest/quota` (TDD §3.8) — a read-only peek at the org's remaining hourly budget,
   * so the dashboard can show it before the caller ever generates a digest. `RateLimitStore.peek`
   * never increments the counter, so calling this never costs an attempt.
   */
  async getDigestQuota(orgId: string): Promise<AiDigestQuota> {
    const key = buildRateLimitKey(AI_DIGEST_RATE_LIMIT_ROUTE, orgId);
    const count = await this.rateLimitStore.peek(key);

    return {
      remaining: Math.max(0, AI_DIGEST_RATE_LIMIT.limit - count),
      limit: AI_DIGEST_RATE_LIMIT.limit,
    };
  }
}
