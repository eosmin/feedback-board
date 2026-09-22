import { ForbiddenException, UnauthorizedException } from '@nestjs/common';

import { PostsController } from '../../../src/posts/posts.controller';
import type { PostsService } from '../../../src/posts/posts.service';
import type { AuthenticatedRequest } from '../../../src/database/tenant-prisma.service';
import type { CreatePostDto } from '../../../src/posts/dto/create-post.dto';
import type { UpdatePostStatusDto } from '../../../src/posts/dto/update-post-status.dto';

const ORG_ID = '11111111-1111-4111-8111-111111111111';
const USER_ID = '44444444-4444-4444-8444-444444444444';
const BOARD_ID = '22222222-2222-4222-8222-222222222222';
const POST_ID = '33333333-3333-4333-8333-333333333333';

function buildService(): {
  service: PostsService;
  resolveBoardId: jest.Mock;
  create: jest.Mock;
  listForBoard: jest.Mock;
  getById: jest.Mock;
  updateStatus: jest.Mock;
} {
  const resolveBoardId = jest.fn().mockResolvedValue(BOARD_ID);
  const create = jest.fn().mockResolvedValue({ id: POST_ID });
  const listForBoard = jest.fn().mockResolvedValue([]);
  const getById = jest.fn().mockResolvedValue({ id: POST_ID });
  const updateStatus = jest.fn().mockResolvedValue({ id: POST_ID, status: 'PLANNED' });
  return {
    service: {
      resolveBoardId,
      create,
      listForBoard,
      getById,
      updateStatus,
    } as unknown as PostsService,
    resolveBoardId,
    create,
    listForBoard,
    getById,
    updateStatus,
  };
}

describe('PostsController', () => {
  it('creates a post with the orgId/userId OrgGuard attached to the request', async () => {
    const { service, resolveBoardId, create } = buildService();
    const controller = new PostsController(service);
    const request = { orgId: ORG_ID, userId: USER_ID } as AuthenticatedRequest;
    const dto: CreatePostDto = { title: 'Add dark mode', body: 'Please add a dark theme' };

    await controller.create(request, 'acme', 'roadmap', dto);

    expect(resolveBoardId).toHaveBeenCalledWith('roadmap');
    expect(create).toHaveBeenCalledWith(ORG_ID, BOARD_ID, USER_ID, dto);
  });

  it('rejects create when orgId is missing from the request', async () => {
    const { service } = buildService();
    const controller = new PostsController(service);
    const request = { userId: USER_ID } as AuthenticatedRequest;

    await expect(
      controller.create(request, 'acme', 'roadmap', { title: 'Add dark mode', body: 'x' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects create when userId is missing from the request', async () => {
    const { service } = buildService();
    const controller = new PostsController(service);
    const request = { orgId: ORG_ID } as AuthenticatedRequest;

    await expect(
      controller.create(request, 'acme', 'roadmap', { title: 'Add dark mode', body: 'x' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('lists posts for a board via the service', async () => {
    const { service, listForBoard } = buildService();
    const controller = new PostsController(service);

    await controller.listForBoard('acme', 'roadmap');

    expect(listForBoard).toHaveBeenCalledWith('roadmap');
  });

  it('returns post detail via the service', async () => {
    const { service, getById } = buildService();
    const controller = new PostsController(service);

    await controller.detail('acme', POST_ID);

    expect(getById).toHaveBeenCalledWith(POST_ID);
  });

  it('updates post status via the service', async () => {
    const { service, updateStatus } = buildService();
    const controller = new PostsController(service);
    const dto: UpdatePostStatusDto = { status: 'PLANNED' };

    await controller.updateStatus('acme', POST_ID, dto);

    expect(updateStatus).toHaveBeenCalledWith(POST_ID, dto);
  });
});
