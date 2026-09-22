import { NotFoundException } from '@nestjs/common';

import { VotesService } from '../../../src/posts/votes.service';
import type { TenantPrismaService } from '../../../src/database/tenant-prisma.service';

const ORG_ID = '11111111-1111-4111-8111-111111111111';
const POST_ID = '33333333-3333-4333-8333-333333333333';
const USER_ID = '44444444-4444-4444-8444-444444444444';
const VOTE_ID = '55555555-5555-4555-8555-555555555555';

function buildTenantPrisma(overrides: {
  findFirstPost?: jest.Mock;
  findUniqueVote?: jest.Mock;
  deleteVote?: jest.Mock;
  createVote?: jest.Mock;
  updatePost?: jest.Mock;
}): TenantPrismaService {
  const run = jest.fn(async (fn: (tx: unknown) => unknown) => {
    const tx = {
      post: {
        findFirst: overrides.findFirstPost ?? jest.fn(),
        update: overrides.updatePost ?? jest.fn(),
      },
      vote: {
        findUnique: overrides.findUniqueVote ?? jest.fn(),
        delete: overrides.deleteVote ?? jest.fn(),
        create: overrides.createVote ?? jest.fn(),
      },
    };
    return fn(tx);
  });
  return { run } as unknown as TenantPrismaService;
}

describe('VotesService', () => {
  it('throws 404 NOT_FOUND when the post does not resolve within the tenant', async () => {
    const findFirstPost = jest.fn().mockResolvedValue(null);
    const service = new VotesService(buildTenantPrisma({ findFirstPost }));

    await expect(service.toggle(ORG_ID, POST_ID, USER_ID)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('casts a first vote: creates the row and increments voteCount in the same transaction', async () => {
    const findFirstPost = jest.fn().mockResolvedValue({ id: POST_ID });
    const findUniqueVote = jest.fn().mockResolvedValue(null);
    const createVote = jest.fn().mockResolvedValue({ id: VOTE_ID });
    const updatePost = jest.fn().mockResolvedValue({ voteCount: 1 });
    const service = new VotesService(
      buildTenantPrisma({ findFirstPost, findUniqueVote, createVote, updatePost }),
    );

    const result = await service.toggle(ORG_ID, POST_ID, USER_ID);

    expect(findUniqueVote).toHaveBeenCalledWith({
      where: { postId_userId: { postId: POST_ID, userId: USER_ID } },
      select: { id: true },
    });
    expect(createVote).toHaveBeenCalledWith({
      data: { orgId: ORG_ID, postId: POST_ID, userId: USER_ID },
    });
    expect(updatePost).toHaveBeenCalledWith({
      where: { id: POST_ID },
      data: { voteCount: { increment: 1 } },
      select: { voteCount: true },
    });
    expect(result).toEqual({ postId: POST_ID, voted: true, voteCount: 1 });
  });

  it('removes an existing vote on a second call: deletes the row and decrements voteCount', async () => {
    const findFirstPost = jest.fn().mockResolvedValue({ id: POST_ID });
    const findUniqueVote = jest.fn().mockResolvedValue({ id: VOTE_ID });
    const deleteVote = jest.fn().mockResolvedValue({ id: VOTE_ID });
    const updatePost = jest.fn().mockResolvedValue({ voteCount: 0 });
    const service = new VotesService(
      buildTenantPrisma({ findFirstPost, findUniqueVote, deleteVote, updatePost }),
    );

    const result = await service.toggle(ORG_ID, POST_ID, USER_ID);

    expect(deleteVote).toHaveBeenCalledWith({ where: { id: VOTE_ID } });
    expect(updatePost).toHaveBeenCalledWith({
      where: { id: POST_ID },
      data: { voteCount: { decrement: 1 } },
      select: { voteCount: true },
    });
    expect(result).toEqual({ postId: POST_ID, voted: false, voteCount: 0 });
  });
});
