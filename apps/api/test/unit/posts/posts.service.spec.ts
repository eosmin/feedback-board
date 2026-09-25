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
const WEBHOOK_ID_1 = '55555555-5555-4555-8555-555555555555';
const WEBHOOK_ID_2 = '66666666-6666-4666-8666-666666666666';
const CREATED_AT = new Date('2026-01-01T00:00:00.000Z');

// Mirrors PostsService's own JOB_OPTIONS constant (TDD §2.6.14, §3.7 step 4) — kept in one
// place here too so a future change to the retry/removeOnFail shape only needs updating once
// per file instead of in every enqueue assertion below.
const JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 2_000, jitter: 0.5 },
  removeOnFail: false,
} as const;

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
  findManyWebhook?: jest.Mock;
}): TenantPrismaService {
  const findManyWebhook = overrides.findManyWebhook ?? jest.fn().mockResolvedValue([]);
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
      webhook: {
        findMany: findManyWebhook,
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
    const { queue: aiQueue } = buildQueue();
    const { queue: webhooksQueue } = buildQueue();
    const service = new PostsService(buildTenantPrisma({ findFirstBoard }), aiQueue, webhooksQueue);

    const result = await service.resolveBoardId('roadmap');

    expect(findFirstBoard).toHaveBeenCalledWith({
      where: { slug: 'roadmap' },
      select: { id: true },
    });
    expect(result).toBe(BOARD_ID);
  });

  it('throws 404 NOT_FOUND when the board slug does not resolve within the tenant', async () => {
    const findFirstBoard = jest.fn().mockResolvedValue(null);
    const { queue: aiQueue } = buildQueue();
    const { queue: webhooksQueue } = buildQueue();
    const service = new PostsService(buildTenantPrisma({ findFirstBoard }), aiQueue, webhooksQueue);

    await expect(service.resolveBoardId('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('creates a post scoped to the given org and board, with orgId set explicitly on the insert', async () => {
    const create = jest.fn().mockResolvedValue(buildPostRow());
    const { queue: aiQueue } = buildQueue();
    const { queue: webhooksQueue } = buildQueue();
    const service = new PostsService(buildTenantPrisma({ create }), aiQueue, webhooksQueue);
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
    const { queue: aiQueue, add } = buildQueue();
    const { queue: webhooksQueue } = buildQueue();
    const service = new PostsService(buildTenantPrisma({ create }), aiQueue, webhooksQueue);
    const dto: CreatePostDto = { title: 'Add dark mode', body: 'Please add a dark theme' };

    await service.create(ORG_ID, BOARD_ID, AUTHOR_ID, dto);

    // Ids only — never title/body (TDD §3.10): a payload sitting in Redis must carry no
    // tenant content.
    expect(add).toHaveBeenCalledWith('classify', { orgId: ORG_ID, postId: POST_ID }, JOB_OPTIONS);
  });

  it('enqueues one deliver job per subscribed active webhook on post.created, after the insert', async () => {
    const create = jest.fn().mockResolvedValue(buildPostRow());
    const findManyWebhook = jest
      .fn()
      .mockResolvedValue([{ id: WEBHOOK_ID_1 }, { id: WEBHOOK_ID_2 }]);
    const { queue: aiQueue } = buildQueue();
    const { queue: webhooksQueue, add } = buildQueue();
    const service = new PostsService(
      buildTenantPrisma({ create, findManyWebhook }),
      aiQueue,
      webhooksQueue,
    );
    const dto: CreatePostDto = { title: 'Add dark mode', body: 'Please add a dark theme' };

    await service.create(ORG_ID, BOARD_ID, AUTHOR_ID, dto);

    expect(findManyWebhook).toHaveBeenCalledWith({
      where: { isActive: true, events: { has: 'post.created' } },
      select: { id: true },
    });
    // One job per webhook, never one job that fans out internally (TDD §3.7) — N calls to add().
    expect(add).toHaveBeenCalledTimes(2);
    expect(add).toHaveBeenCalledWith(
      'deliver',
      { orgId: ORG_ID, webhookId: WEBHOOK_ID_1, event: 'post.created', postId: POST_ID },
      JOB_OPTIONS,
    );
    expect(add).toHaveBeenCalledWith(
      'deliver',
      { orgId: ORG_ID, webhookId: WEBHOOK_ID_2, event: 'post.created', postId: POST_ID },
      JOB_OPTIONS,
    );
  });

  it('lists posts for a resolved board, most recent first', async () => {
    const findFirstBoard = jest.fn().mockResolvedValue({ id: BOARD_ID });
    const findMany = jest.fn().mockResolvedValue([buildPostRow()]);
    const { queue: aiQueue } = buildQueue();
    const { queue: webhooksQueue } = buildQueue();
    const service = new PostsService(
      buildTenantPrisma({ findFirstBoard, findMany }),
      aiQueue,
      webhooksQueue,
    );

    const result = await service.listForBoard('roadmap');

    expect(findMany).toHaveBeenCalledWith({
      where: { boardId: BOARD_ID },
      orderBy: { createdAt: 'desc' },
    });
    expect(result).toEqual([expect.objectContaining({ id: POST_ID, title: 'Add dark mode' })]);
  });

  it('returns a single post by id', async () => {
    const findFirstPost = jest.fn().mockResolvedValue(buildPostRow());
    const { queue: aiQueue } = buildQueue();
    const { queue: webhooksQueue } = buildQueue();
    const service = new PostsService(buildTenantPrisma({ findFirstPost }), aiQueue, webhooksQueue);

    const result = await service.getById(POST_ID);

    expect(findFirstPost).toHaveBeenCalledWith({ where: { id: POST_ID } });
    expect(result).toEqual(expect.objectContaining({ id: POST_ID }));
  });

  it('throws 404 NOT_FOUND when the post id does not resolve within the tenant', async () => {
    const findFirstPost = jest.fn().mockResolvedValue(null);
    const { queue: aiQueue } = buildQueue();
    const { queue: webhooksQueue } = buildQueue();
    const service = new PostsService(buildTenantPrisma({ findFirstPost }), aiQueue, webhooksQueue);

    await expect(service.getById('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('updates a post status', async () => {
    const findFirstPost = jest.fn().mockResolvedValue(buildPostRow());
    const update = jest.fn().mockResolvedValue(buildPostRow({ status: 'PLANNED' }));
    const { queue: aiQueue } = buildQueue();
    const { queue: webhooksQueue } = buildQueue();
    const service = new PostsService(
      buildTenantPrisma({ findFirstPost, update }),
      aiQueue,
      webhooksQueue,
    );
    const dto: UpdatePostStatusDto = { status: 'PLANNED' };

    const result = await service.updateStatus(POST_ID, dto);

    expect(update).toHaveBeenCalledWith({ where: { id: POST_ID }, data: { status: 'PLANNED' } });
    expect(result).toEqual(expect.objectContaining({ status: 'PLANNED' }));
  });

  it('enqueues one deliver job per subscribed active webhook on status change', async () => {
    const findFirstPost = jest.fn().mockResolvedValue(buildPostRow());
    const update = jest.fn().mockResolvedValue(buildPostRow({ status: 'PLANNED' }));
    const findManyWebhook = jest.fn().mockResolvedValue([{ id: WEBHOOK_ID_1 }]);
    const { queue: aiQueue } = buildQueue();
    const { queue: webhooksQueue, add } = buildQueue();
    const service = new PostsService(
      buildTenantPrisma({ findFirstPost, update, findManyWebhook }),
      aiQueue,
      webhooksQueue,
    );

    await service.updateStatus(POST_ID, { status: 'PLANNED' });

    expect(findManyWebhook).toHaveBeenCalledWith({
      where: { isActive: true, events: { has: 'post.status_changed' } },
      select: { id: true },
    });
    expect(add).toHaveBeenCalledWith(
      'deliver',
      { orgId: ORG_ID, webhookId: WEBHOOK_ID_1, event: 'post.status_changed', postId: POST_ID },
      JOB_OPTIONS,
    );
  });

  it('throws 404 NOT_FOUND when updating the status of a post that does not resolve within the tenant', async () => {
    const findFirstPost = jest.fn().mockResolvedValue(null);
    const { queue: aiQueue } = buildQueue();
    const { queue: webhooksQueue } = buildQueue();
    const service = new PostsService(buildTenantPrisma({ findFirstPost }), aiQueue, webhooksQueue);

    await expect(service.updateStatus('missing', { status: 'PLANNED' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
