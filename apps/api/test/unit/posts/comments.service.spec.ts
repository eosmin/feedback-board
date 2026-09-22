import { NotFoundException } from '@nestjs/common';

import { CommentsService } from '../../../src/posts/comments.service';
import type { TenantPrismaService } from '../../../src/database/tenant-prisma.service';
import type { CreateCommentDto } from '../../../src/posts/dto/create-comment.dto';

const ORG_ID = '11111111-1111-4111-8111-111111111111';
const POST_ID = '33333333-3333-4333-8333-333333333333';
const AUTHOR_ID = '44444444-4444-4444-8444-444444444444';
const COMMENT_ID = '66666666-6666-4666-8666-666666666666';
const CREATED_AT = new Date('2026-01-01T00:00:00.000Z');

function buildCommentRow(
  overrides: Partial<Record<string, unknown>> = {},
): Record<string, unknown> {
  return {
    id: COMMENT_ID,
    postId: POST_ID,
    orgId: ORG_ID,
    authorId: AUTHOR_ID,
    body: 'Great idea!',
    createdAt: CREATED_AT,
    ...overrides,
  };
}

function buildTenantPrisma(overrides: {
  findFirstPost?: jest.Mock;
  create?: jest.Mock;
  findMany?: jest.Mock;
}): TenantPrismaService {
  const run = jest.fn(async (fn: (tx: unknown) => unknown) => {
    const tx = {
      post: {
        findFirst: overrides.findFirstPost ?? jest.fn(),
      },
      comment: {
        create: overrides.create ?? jest.fn(),
        findMany: overrides.findMany ?? jest.fn(),
      },
    };
    return fn(tx);
  });
  return { run } as unknown as TenantPrismaService;
}

describe('CommentsService', () => {
  it('creates a comment scoped to the given org and post, with orgId set explicitly on the insert', async () => {
    const findFirstPost = jest.fn().mockResolvedValue({ id: POST_ID });
    const create = jest.fn().mockResolvedValue(buildCommentRow());
    const service = new CommentsService(buildTenantPrisma({ findFirstPost, create }));
    const dto: CreateCommentDto = { body: 'Great idea!' };

    const result = await service.create(ORG_ID, POST_ID, AUTHOR_ID, dto);

    // orgId must be passed explicitly: TenantPrismaService.run only sets the app.org_id
    // session variable for RLS visibility, it does not populate insert columns (TDD §3.3).
    expect(create).toHaveBeenCalledWith({
      data: { orgId: ORG_ID, postId: POST_ID, authorId: AUTHOR_ID, body: 'Great idea!' },
    });
    expect(result).toEqual({
      id: COMMENT_ID,
      postId: POST_ID,
      orgId: ORG_ID,
      authorId: AUTHOR_ID,
      body: 'Great idea!',
      createdAt: CREATED_AT.toISOString(),
    });
  });

  it('throws 404 NOT_FOUND on create when the post does not resolve within the tenant', async () => {
    const findFirstPost = jest.fn().mockResolvedValue(null);
    const service = new CommentsService(buildTenantPrisma({ findFirstPost }));

    await expect(
      service.create(ORG_ID, POST_ID, AUTHOR_ID, { body: 'Great idea!' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lists comments for a post, oldest first', async () => {
    const findFirstPost = jest.fn().mockResolvedValue({ id: POST_ID });
    const findMany = jest.fn().mockResolvedValue([buildCommentRow()]);
    const service = new CommentsService(buildTenantPrisma({ findFirstPost, findMany }));

    const result = await service.listForPost(POST_ID);

    expect(findMany).toHaveBeenCalledWith({
      where: { postId: POST_ID },
      orderBy: { createdAt: 'asc' },
    });
    expect(result).toEqual([expect.objectContaining({ id: COMMENT_ID, body: 'Great idea!' })]);
  });

  it('throws 404 NOT_FOUND on listForPost when the post does not resolve within the tenant', async () => {
    const findFirstPost = jest.fn().mockResolvedValue(null);
    const service = new CommentsService(buildTenantPrisma({ findFirstPost }));

    await expect(service.listForPost(POST_ID)).rejects.toBeInstanceOf(NotFoundException);
  });
});
