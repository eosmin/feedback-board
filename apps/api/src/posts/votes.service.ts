import { Injectable, NotFoundException } from '@nestjs/common';
import type { VoteToggleResult } from '@feedback-board/shared';

import { TenantPrismaService } from '../database/tenant-prisma.service';

/**
 * Toggle semantics (TDD §11): a first call by a given user on a given post inserts a `Vote`
 * row, a second call removes it. The existence check, the vote write, and the `Post.voteCount`
 * update all run inside the single `TenantPrismaService.run()` transaction — never a second,
 * unguarded write — so `voteCount` can never drift from `SELECT count(*) FROM votes` even under
 * a crash between the two statements (TDD §10).
 */
@Injectable()
export class VotesService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  async toggle(orgId: string, postId: string, userId: string): Promise<VoteToggleResult> {
    return this.tenantPrisma.run(async (tx) => {
      const post = await tx.post.findFirst({ where: { id: postId }, select: { id: true } });

      if (post === null) {
        throw new NotFoundException({ error: 'NOT_FOUND' });
      }

      const existingVote = await tx.vote.findUnique({
        where: { postId_userId: { postId, userId } },
        select: { id: true },
      });

      if (existingVote !== null) {
        await tx.vote.delete({ where: { id: existingVote.id } });
        const updated = await tx.post.update({
          where: { id: postId },
          data: { voteCount: { decrement: 1 } },
          select: { voteCount: true },
        });

        return { postId, voted: false, voteCount: updated.voteCount };
      }

      await tx.vote.create({ data: { orgId, postId, userId } });
      const updated = await tx.post.update({
        where: { id: postId },
        data: { voteCount: { increment: 1 } },
        select: { voteCount: true },
      });

      return { postId, voted: true, voteCount: updated.voteCount };
    });
  }
}
