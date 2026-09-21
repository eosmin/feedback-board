import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@feedback-board/core';
import type { Board, BoardDetail } from '@feedback-board/shared';

import { TenantPrismaService } from '../database/tenant-prisma.service';
import type { CreateBoardDto } from './dto/create-board.dto';

/**
 * Prisma's error code for a violated `@@unique` (here, `@@unique([orgId, slug])` on `Board`,
 * TDD §10) — checked by code rather than by message text, which is not part of Prisma's stable
 * API surface.
 */
const PRISMA_UNIQUE_CONSTRAINT_CODE = 'P2002';

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
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

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
        throw new ConflictException({ error: 'CONFLICT' });
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
      throw new NotFoundException({ error: 'NOT_FOUND' });
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
}
