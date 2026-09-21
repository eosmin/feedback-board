import { ForbiddenException } from '@nestjs/common';

import { BoardsController } from '../../../src/boards/boards.controller';
import type { BoardsService } from '../../../src/boards/boards.service';
import type { AuthenticatedRequest } from '../../../src/database/tenant-prisma.service';
import type { CreateBoardDto } from '../../../src/boards/dto/create-board.dto';

const ORG_ID = '11111111-1111-4111-8111-111111111111';

function buildService(): {
  service: BoardsService;
  create: jest.Mock;
  list: jest.Mock;
  getDetail: jest.Mock;
} {
  const create = jest.fn().mockResolvedValue({ id: 'board-1' });
  const list = jest.fn().mockResolvedValue([]);
  const getDetail = jest.fn().mockResolvedValue({ id: 'board-1' });
  return {
    service: { create, list, getDetail } as unknown as BoardsService,
    create,
    list,
    getDetail,
  };
}

describe('BoardsController', () => {
  it('creates a board with the orgId OrgGuard attached to the request', async () => {
    const { service, create } = buildService();
    const controller = new BoardsController(service);
    const request = { orgId: ORG_ID } as AuthenticatedRequest;
    const dto: CreateBoardDto = { name: 'Roadmap', slug: 'roadmap' };

    await controller.create(request, 'acme', dto);

    expect(create).toHaveBeenCalledWith(ORG_ID, dto);
  });

  it('rejects create when orgId is missing from the request', async () => {
    const { service } = buildService();
    const controller = new BoardsController(service);
    const request = {} as AuthenticatedRequest;

    await expect(
      controller.create(request, 'acme', { name: 'Roadmap', slug: 'roadmap' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('lists boards via the service', async () => {
    const { service, list } = buildService();
    const controller = new BoardsController(service);

    await controller.list('acme');

    expect(list).toHaveBeenCalledWith();
  });

  it('returns board detail via the service', async () => {
    const { service, getDetail } = buildService();
    const controller = new BoardsController(service);

    await controller.detail('acme', 'roadmap');

    expect(getDetail).toHaveBeenCalledWith('roadmap');
  });
});
