import { NotFoundException } from '@nestjs/common';

/**
 * The one `post` method this helper needs. `Pick<Prisma.TransactionClient, 'post'>` looked
 * like the right constraint but is not: `Pick` only narrows top-level keys, so it still demands
 * the full `PostDelegate` shape (`findUnique`, `findMany`, `create`, ... all ~17 methods) for
 * the `post` property, which forces every caller's mock to implement methods this function
 * never calls. This local interface is the actually-minimal contract.
 */
interface PostFindFirstClient {
  post: {
    findFirst: (args: {
      where: { id: string };
      select: { id: true };
    }) => Promise<{ id: string } | null>;
  };
}

/**
 * Resolves a post within the current tenant transaction or throws 404 NOT_FOUND. Shared by
 * `VotesService` and `CommentsService`, which both need to confirm a post exists — within the
 * caller's tenant, via the same `tx` the caller already opened through `TenantPrismaService` —
 * before writing a dependent row (TDD §11).
 */
export async function assertPostExists(tx: PostFindFirstClient, postId: string): Promise<void> {
  const post = await tx.post.findFirst({ where: { id: postId }, select: { id: true } });

  if (post === null) {
    throw new NotFoundException({ error: 'NOT_FOUND' });
  }
}
