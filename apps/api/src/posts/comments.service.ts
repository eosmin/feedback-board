import { Injectable, NotFoundException } from '@nestjs/common';
import type { Comment } from '@feedback-board/shared';

import { TenantPrismaService } from '../database/tenant-prisma.service';
import type { CreateCommentDto } from './dto/create-comment.dto';

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
      const post = await tx.post.findFirst({ where: { id: postId }, select: { id: true } });

      if (post === null) {
        throw new NotFoundException({ error: 'NOT_FOUND' });
      }

      const comment = await tx.comment.create({
        data: { orgId, postId, authorId, body: dto.body },
      });

      return this.toComment(comment);
    });
  }

  /** `GET /orgs/:orgSlug/posts/:postId/comments` — oldest first, matching a conversation thread. */
  async listForPost(postId: string): Promise<Comment[]> {
    return this.tenantPrisma.run(async (tx) => {
      const post = await tx.post.findFirst({ where: { id: postId }, select: { id: true } });

      if (post === null) {
        throw new NotFoundException({ error: 'NOT_FOUND' });
      }

      const comments = await tx.comment.findMany({
        where: { postId },
        orderBy: { createdAt: 'asc' },
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
  }): Comment {
    return {
      id: comment.id,
      postId: comment.postId,
      orgId: comment.orgId,
      authorId: comment.authorId,
      body: comment.body,
      createdAt: comment.createdAt.toISOString(),
    };
  }
}
