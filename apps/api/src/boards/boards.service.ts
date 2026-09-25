import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AiService, Prisma } from '@feedback-board/core';
import type { AiService as Ai, DigestPostInput } from '@feedback-board/core';
import { ERROR_CODES } from '@feedback-board/shared';
import type { Board, BoardDetail, BoardDigest } from '@feedback-board/shared';

import { TenantPrismaService } from '../database/tenant-prisma.service';
import type { CreateBoardDto } from './dto/create-board.dto';

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
  async generateDigest(boardSlug: string): Promise<BoardDigest> {
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

    const input: DigestPostInput[] = posts.map((post) => ({
      title: post.title,
      body: post.body,
      voteCount: post.voteCount,
      category: post.aiCategory,
      priority: post.aiPriority,
    }));

    const summary = await this.aiService.generateDigest(input);

    return { summary };
  }
}
