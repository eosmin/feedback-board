import { Injectable } from '@nestjs/common';
import type { Comment } from '@feedback-board/shared';

import { TenantPrismaService } from '../database/tenant-prisma.service';
import { assertPostExists } from './assert-post-exists';
import { AUTHOR_SELECT, authorDisplayName } from './author-display-name';
import type { CreateCommentDto } from './dto/create-comment.dto';

const AUTHOR_INCLUDE = { author: { select: AUTHOR_SELECT } } as const;

/**
 * `GET`/`POST /orgs/:orgSlug/posts/:postId/comments` (TDD §11), membership-gated by the
 * controller's guard chain. All access goes through `TenantPrismaService` (TDD §3.2, §3.3) —
 * `Comment.orgId`/`postId`/`authorId` are required, non-default columns, so `orgId` must be
 * supplied explicitly on the insert, the same as `PostsService.create()` and `VotesService`.
 */
@Injectable()
export class CommentsService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  /** `POST /orgs/:orgSlug/posts/:postId/comments` — 404s if the post does not resolve within the tenant. */
  async create(
    orgId: string,
    postId: string,
    authorId: string,
    dto: CreateCommentDto,
  ): Promise<Comment> {
    return this.tenantPrisma.run(async (tx) => {
      await assertPostExists(tx, postId);

      const comment = await tx.comment.create({
        data: { orgId, postId, authorId, body: dto.body },
        include: AUTHOR_INCLUDE,
      });

      return this.toComment(comment);
    });
  }

  /** `GET /orgs/:orgSlug/posts/:postId/comments` — oldest first, matching a conversation thread. */
  async listForPost(postId: string): Promise<Comment[]> {
    return this.tenantPrisma.run(async (tx) => {
      await assertPostExists(tx, postId);

      const comments = await tx.comment.findMany({
        where: { postId },
        orderBy: { createdAt: 'asc' },
        include: AUTHOR_INCLUDE,
      });

      return comments.map((comment) => this.toComment(comment));
    });
  }

  private toComment(comment: {
    id: string;
    postId: string;
    orgId: string;
    authorId: string;
    body: string;
    createdAt: Date;
    author: { name: string | null; email: string };
  }): Comment {
    return {
      id: comment.id,
      postId: comment.postId,
      orgId: comment.orgId,
      authorId: comment.authorId,
      body: comment.body,
      authorName: authorDisplayName(comment.author),
      createdAt: comment.createdAt.toISOString(),
    };
  }
}
