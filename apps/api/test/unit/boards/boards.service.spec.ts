import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@feedback-board/core';

import { BoardsService } from '../../../src/boards/boards.service';
import type { TenantPrismaService } from '../../../src/database/tenant-prisma.service';
import type { CreateBoardDto } from '../../../src/boards/dto/create-board.dto';

const BOARD_ID = '22222222-2222-4222-8222-222222222222';
const ORG_ID = '11111111-1111-4111-8111-111111111111';
const CREATED_AT = new Date('2026-01-01T00:00:00.000Z');

function buildTenantPrisma(overrides: {
  create?: jest.Mock;
  findMany?: jest.Mock;
  findFirst?: jest.Mock;
  count?: jest.Mock;
}): TenantPrismaService {
  const run = jest.fn(async (fn: (tx: unknown) => unknown) => {
    const tx = {
      board: {
        create: overrides.create ?? jest.fn(),
        findMany: overrides.findMany ?? jest.fn(),
        findFirst: overrides.findFirst ?? jest.fn(),
      },
      post: {
        count: overrides.count ?? jest.fn(),
      },
    };
    return fn(tx);
  });
  return { run } as unknown as TenantPrismaService;
}

describe('BoardsService', () => {
  it('creates a board scoped to the given org, with orgId set explicitly on the insert', async () => {
    const create = jest.fn().mockResolvedValue({
      id: BOARD_ID,
      orgId: ORG_ID,
      name: 'Roadmap',
      slug: 'roadmap',
      isPublic: true,
      createdAt: CREATED_AT,
    });
    const service = new BoardsService(buildTenantPrisma({ create }));
    const dto: CreateBoardDto = { name: 'Roadmap', slug: 'roadmap' };

    const result = await service.create(ORG_ID, dto);

    // orgId must be passed explicitly: TenantPrismaService.run only sets the app.org_id
    // session variable for RLS visibility, it does not populate insert columns (TDD §3.3).
    expect(create).toHaveBeenCalledWith({
      data: { orgId: ORG_ID, name: 'Roadmap', slug: 'roadmap', isPublic: true },
    });
    expect(result).toEqual({
      id: BOARD_ID,
      orgId: ORG_ID,
      name: 'Roadmap',
      slug: 'roadmap',
      isPublic: true,
      createdAt: CREATED_AT.toISOString(),
    });
  });

  it('defaults isPublic to true when the DTO omits it', async () => {
    const create = jest.fn().mockResolvedValue({
      id: BOARD_ID,
      orgId: ORG_ID,
      name: 'Roadmap',
      slug: 'roadmap',
      isPublic: true,
      createdAt: CREATED_AT,
    });
    const service = new BoardsService(buildTenantPrisma({ create }));

    await service.create(ORG_ID, { name: 'Roadmap', slug: 'roadmap' });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ isPublic: true }) }),
    );
  });

  it('translates a unique-constraint violation on (orgId, slug) into 409 CONFLICT', async () => {
    const create = jest.fn().mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('slug taken', {
        code: 'P2002',
        clientVersion: '7.0.0',
      }),
    );
    const service = new BoardsService(buildTenantPrisma({ create }));

    await expect(
      service.create(ORG_ID, { name: 'Roadmap', slug: 'roadmap' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rethrows an unrelated database error unchanged', async () => {
    const create = jest.fn().mockRejectedValue(new Error('connection reset'));
    const service = new BoardsService(buildTenantPrisma({ create }));

    await expect(service.create(ORG_ID, { name: 'Roadmap', slug: 'roadmap' })).rejects.toThrow(
      'connection reset',
    );
  });

  it('lists boards for the request tenant', async () => {
    const findMany = jest.fn().mockResolvedValue([
      {
        id: BOARD_ID,
        orgId: ORG_ID,
        name: 'Roadmap',
        slug: 'roadmap',
        isPublic: true,
        createdAt: CREATED_AT,
      },
    ]);
    const service = new BoardsService(buildTenantPrisma({ findMany }));

    const result = await service.list();

    expect(findMany).toHaveBeenCalledWith({ orderBy: { createdAt: 'asc' } });
    expect(result).toEqual([
      {
        id: BOARD_ID,
        orgId: ORG_ID,
        name: 'Roadmap',
        slug: 'roadmap',
        isPublic: true,
        createdAt: CREATED_AT.toISOString(),
      },
    ]);
  });

  it('returns board detail with its post count', async () => {
    const findFirst = jest.fn().mockResolvedValue({
      id: BOARD_ID,
      orgId: ORG_ID,
      name: 'Roadmap',
      slug: 'roadmap',
      isPublic: true,
      createdAt: CREATED_AT,
    });
    const count = jest.fn().mockResolvedValue(3);
    const service = new BoardsService(buildTenantPrisma({ findFirst, count }));

    const result = await service.getDetail('roadmap');

    expect(findFirst).toHaveBeenCalledWith({ where: { slug: 'roadmap' } });
    expect(count).toHaveBeenCalledWith({ where: { boardId: BOARD_ID } });
    expect(result).toEqual({
      id: BOARD_ID,
      orgId: ORG_ID,
      name: 'Roadmap',
      slug: 'roadmap',
      isPublic: true,
      createdAt: CREATED_AT.toISOString(),
      postCount: 3,
    });
  });

  it('throws 404 NOT_FOUND when the board slug does not resolve within the tenant', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const service = new BoardsService(buildTenantPrisma({ findFirst }));

    await expect(service.getDetail('missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});
