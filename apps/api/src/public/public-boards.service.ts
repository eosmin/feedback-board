import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService, TenantRunner } from '@feedback-board/core';
import type {
  Prisma,
  PrismaService as AdminClient,
  TenantRunner as TenantRunnerService,
} from '@feedback-board/core';
import { ERROR_CODES, type PublicBoard, type PublicPost } from '@feedback-board/shared';

const PUBLIC_BOARD_SELECT = {
  id: true,
  name: true,
  slug: true,
  isPublic: true,
  createdAt: true,
} satisfies Prisma.BoardSelect;

// An explicit allow-list rather than `omit`: a column added to `posts` later stays private to
// anonymous visitors until someone deliberately adds it here.
const PUBLIC_POST_SELECT = {
  id: true,
  boardId: true,
  title: true,
  body: true,
  status: true,
  voteCount: true,
  aiCategory: true,
  aiPriority: true,
  createdAt: true,
} satisfies Prisma.PostSelect;

type PublicBoardRow = Prisma.BoardGetPayload<{ select: typeof PUBLIC_BOARD_SELECT }>;

/**
 * An unknown org, an unknown board and a private board all produce this exact body, so an
 * anonymous caller cannot probe which org slugs or private board slugs exist.
 */
function notFound(): NotFoundException {
  return new NotFoundException({ error: ERROR_CODES.NOT_FOUND });
}

/**
 * The fifth and last admin-client caller (TDD §3.2). The admin client resolves `orgSlug` to an
 * id and nothing else — one column of one row. Every row returned to the visitor is read
 * through `TenantRunner.runAs` on the RLS-enforcing connection. `TenantPrismaService` cannot be
 * used here: no guard sets `request.orgId` on a `@Public()` route, so it fails closed.
 *
 * Each class is its own `@Inject` token, while the parameter types come from a type-only import
 * (decision D10): a class-typed parameter would emit an untestable `typeof X !== "undefined"`
 * branch under the 85% branch gate on `./src/public/`.
 */
@Injectable()
export class PublicBoardsService {
  constructor(
    @Inject(PrismaService) private readonly admin: AdminClient,
    @Inject(TenantRunner) private readonly runner: TenantRunnerService,
  ) {}

  async getBoard(orgSlug: string, boardSlug: string): Promise<PublicBoard> {
    const orgId = await this.resolveOrgId(orgSlug);
    const board = await this.runner.runAs(orgId, (tx) => this.findPublicBoard(tx, boardSlug));

    return { ...board, createdAt: board.createdAt.toISOString() };
  }

  async listPosts(orgSlug: string, boardSlug: string): Promise<PublicPost[]> {
    const orgId = await this.resolveOrgId(orgSlug);
    const posts = await this.runner.runAs(orgId, async (tx) => {
      const board = await this.findPublicBoard(tx, boardSlug);
      return tx.post.findMany({
        where: { boardId: board.id },
        select: PUBLIC_POST_SELECT,
        orderBy: { createdAt: 'desc' },
      });
    });

    return posts.map((post) => ({ ...post, createdAt: post.createdAt.toISOString() }));
  }

  private async resolveOrgId(orgSlug: string): Promise<string> {
    const org = await this.admin.client.org.findUnique({
      where: { slug: orgSlug },
      select: { id: true },
    });

    if (org === null) {
      throw notFound();
    }

    return org.id;
  }

  /**
   * The `isPublic` filter lives here, in the query itself, so no caller of this service can
   * forget it — a private board is indistinguishable from a missing one.
   */
  private async findPublicBoard(
    tx: Prisma.TransactionClient,
    boardSlug: string,
  ): Promise<PublicBoardRow> {
    const board = await tx.board.findFirst({
      where: { slug: boardSlug, isPublic: true },
      select: PUBLIC_BOARD_SELECT,
    });

    if (board === null) {
      throw notFound();
    }

    return board;
  }
}
