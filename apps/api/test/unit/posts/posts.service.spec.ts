import { NotFoundException } from '@nestjs/common';
import type { Queue } from 'bullmq';

import { PostsService } from '../../../src/posts/posts.service';
import type { TenantPrismaService } from '../../../src/database/tenant-prisma.service';
import type { CreatePostDto } from '../../../src/posts/dto/create-post.dto';
import type { UpdatePostStatusDto } from '../../../src/posts/dto/update-post-status.dto';

const POST_ID = '33333333-3333-4333-8333-333333333333';
const BOARD_ID = '22222222-2222-4222-8222-222222222222';
const ORG_ID = '11111111-1111-4111-8111-111111111111';
const AUTHOR_ID = '44444444-4444-4444-8444-444444444444';
const CREATED_AT = new Date('2026-01-01T00:00:00.000Z');

function buildPostRow(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id: POST_ID,
    boardId: BOARD_ID,
    orgId: ORG_ID,
    authorId: AUTHOR_ID,
    title: 'Add dark mode',
    body: 'Please add a dark theme',
    status: 'OPEN',
    voteCount: 0,
    aiCategory: null,
    aiPriority: null,
    createdAt: CREATED_AT,
    ...overrides,
  };
}

function buildTenantPrisma(overrides: {
  findFirstBoard?: jest.Mock;
  create?: jest.Mock;
  findMany?: jest.Mock;
  findFirstPost?: jest.Mock;
  update?: jest.Mock;
}): TenantPrismaService {
  const run = jest.fn(async (fn: (tx: unknown) => unknown) => {
    const tx = {
      board: {
        findFirst: overrides.findFirstBoard ?? jest.fn(),
      },
      post: {
        create: overrides.create ?? jest.fn(),
        findMany: overrides.findMany ?? jest.fn(),
        findFirst: overrides.findFirstPost ?? jest.fn(),
        update: overrides.update ?? jest.fn(),
      },
    };
    return fn(tx);
  });
  return { run } as unknown as TenantPrismaService;
}

function buildQueue(): { queue: Queue; add: jest.Mock } {
  const add = jest.fn().mockResolvedValue(undefined);
  return { queue: { add } as unknown as Queue, add };
}

describe('PostsService', () => {
  it('resolves a board slug to its id within the tenant', async () => {
    const findFirstBoard = jest.fn().mockResolvedValue({ id: BOARD_ID });
    const { queue } = buildQueue();
    const service = new PostsService(buildTenantPrisma({ findFirstBoard }), queue);

    const result = await service.resolveBoardId('roadmap');

    expect(findFirstBoard).toHaveBeenCalledWith({
      where: { slug: 'roadmap' },
      select: { id: true },
    });
    expect(result).toBe(BOARD_ID);
  });

  it('throws 404 NOT_FOUND when the board slug does not resolve within the tenant', async () => {
    const findFirstBoard = jest.fn().mockResolvedValue(null);
    const { queue } = buildQueue();
    const service = new PostsService(buildTenantPrisma({ findFirstBoard }), queue);

    await expect(service.resolveBoardId('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('creates a post scoped to the given org and board, with orgId set explicitly on the insert', async () => {
    const create = jest.fn().mockResolvedValue(buildPostRow());
    const { queue } = buildQueue();
    const service = new PostsService(buildTenantPrisma({ create }), queue);
    const dto: CreatePostDto = { title: 'Add dark mode', body: 'Please add a dark theme' };

    const result = await service.create(ORG_ID, BOARD_ID, AUTHOR_ID, dto);

    // orgId must be passed explicitly: TenantPrismaService.run only sets the app.org_id
    // session variable for RLS visibility, it does not populate insert columns (TDD §3.3).
    expect(create).toHaveBeenCalledWith({
      data: {
        orgId: ORG_ID,
        boardId: BOARD_ID,
        authorId: AUTHOR_ID,
        title: 'Add dark mode',
        body: 'Please add a dark theme',
      },
    });
    expect(result).toEqual({
      id: POST_ID,
      boardId: BOARD_ID,
      orgId: ORG_ID,
      authorId: AUTHOR_ID,
      title: 'Add dark mode',
      body: 'Please add a dark theme',
      status: 'OPEN',
      voteCount: 0,
      aiCategory: null,
      aiPriority: null,
      createdAt: CREATED_AT.toISOString(),
    });
  });

  it('enqueues an ai-classify job with ids only, after the insert', async () => {
    const create = jest.fn().mockResolvedValue(buildPostRow());
    const { queue, add } = buildQueue();
    const service = new PostsService(buildTenantPrisma({ create }), queue);
    const dto: CreatePostDto = { title: 'Add dark mode', body: 'Please add a dark theme' };

    await service.create(ORG_ID, BOARD_ID, AUTHOR_ID, dto);

    // Ids only — never title/body (TDD §3.10): a payload sitting in Redis must carry no
    // tenant content.
    expect(add).toHaveBeenCalledWith(
      'classify',
      { orgId: ORG_ID, postId: POST_ID },
      { attempts: 3, backoff: { type: 'exponential', delay: 2_000, jitter: 0.5 } },
    );
  });

  it('lists posts for a resolved board, most recent first', async () => {
    const findFirstBoard = jest.fn().mockResolvedValue({ id: BOARD_ID });
    const findMany = jest.fn().mockResolvedValue([buildPostRow()]);
    const { queue } = buildQueue();
    const service = new PostsService(buildTenantPrisma({ findFirstBoard, findMany }), queue);

    const result = await service.listForBoard('roadmap');

    expect(findMany).toHaveBeenCalledWith({
      where: { boardId: BOARD_ID },
      orderBy: { createdAt: 'desc' },
    });
    expect(result).toEqual([expect.objectContaining({ id: POST_ID, title: 'Add dark mode' })]);
  });

  it('returns a single post by id', async () => {
    const findFirstPost = jest.fn().mockResolvedValue(buildPostRow());
    const { queue } = buildQueue();
    const service = new PostsService(buildTenantPrisma({ findFirstPost }), queue);

    const result = await service.getById(POST_ID);

    expect(findFirstPost).toHaveBeenCalledWith({ where: { id: POST_ID } });
    expect(result).toEqual(expect.objectContaining({ id: POST_ID }));
  });

  it('throws 404 NOT_FOUND when the post id does not resolve within the tenant', async () => {
    const findFirstPost = jest.fn().mockResolvedValue(null);
    const { queue } = buildQueue();
    const service = new PostsService(buildTenantPrisma({ findFirstPost }), queue);

    await expect(service.getById('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('updates a post status', async () => {
    const findFirstPost = jest.fn().mockResolvedValue(buildPostRow());
    const update = jest.fn().mockResolvedValue(buildPostRow({ status: 'PLANNED' }));
    const { queue } = buildQueue();
    const service = new PostsService(buildTenantPrisma({ findFirstPost, update }), queue);
    const dto: UpdatePostStatusDto = { status: 'PLANNED' };

    const result = await service.updateStatus(POST_ID, dto);

    expect(update).toHaveBeenCalledWith({ where: { id: POST_ID }, data: { status: 'PLANNED' } });
    expect(result).toEqual(expect.objectContaining({ status: 'PLANNED' }));
  });

  it('throws 404 NOT_FOUND when updating the status of a post that does not resolve within the tenant', async () => {
    const findFirstPost = jest.fn().mockResolvedValue(null);
    const { queue } = buildQueue();
    const service = new PostsService(buildTenantPrisma({ findFirstPost }), queue);

    await expect(service.updateStatus('missing', { status: 'PLANNED' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
