import { NotFoundException } from '@nestjs/common';
import type { PrismaService, TenantRunner } from '@feedback-board/core';

import { PublicBoardsService } from '../../../src/public/public-boards.service';

const ORG_ID = '11111111-1111-4111-8111-111111111111';
const BOARD_ID = '22222222-2222-4222-8222-222222222222';
const POST_ID = '33333333-3333-4333-8333-333333333333';
const CREATED_AT = new Date('2026-01-01T00:00:00.000Z');

const BOARD_ROW = {
  id: BOARD_ID,
  name: 'Roadmap',
  slug: 'roadmap',
  isPublic: true,
  createdAt: CREATED_AT,
};

const POST_ROW = {
  id: POST_ID,
  boardId: BOARD_ID,
  title: 'Dark mode',
  body: 'Please add dark mode',
  status: 'OPEN',
  voteCount: 3,
  aiCategory: 'FEATURE_REQUEST',
  aiPriority: null,
  createdAt: CREATED_AT,
};

interface Harness {
  service: PublicBoardsService;
  orgFindUnique: jest.Mock;
  runAs: jest.Mock;
  boardFindFirst: jest.Mock;
  postFindMany: jest.Mock;
}

function buildHarness(options: {
  org?: { id: string } | null;
  board?: typeof BOARD_ROW | null;
  posts?: (typeof POST_ROW)[];
}): Harness {
  const orgFindUnique = jest
    .fn()
    .mockResolvedValue(options.org === undefined ? { id: ORG_ID } : options.org);
  const boardFindFirst = jest
    .fn()
    .mockResolvedValue(options.board === undefined ? BOARD_ROW : options.board);
  const postFindMany = jest.fn().mockResolvedValue(options.posts ?? [POST_ROW]);
  const tx = { board: { findFirst: boardFindFirst }, post: { findMany: postFindMany } };
  const runAs = jest.fn(async (_orgId: string, fn: (client: unknown) => unknown) => fn(tx));

  const admin = { client: { org: { findUnique: orgFindUnique } } } as unknown as PrismaService;
  const runner = { runAs } as unknown as TenantRunner;

  return {
    service: new PublicBoardsService(admin, runner),
    orgFindUnique,
    runAs,
    boardFindFirst,
    postFindMany,
  };
}

describe('PublicBoardsService', () => {
  describe('getBoard', () => {
    it('resolves only the org id on the admin client, then reads the board under runAs', async () => {
      const { service, orgFindUnique, runAs } = buildHarness({});

      const result = await service.getBoard('acme', 'roadmap');

      expect(orgFindUnique).toHaveBeenCalledWith({
        where: { slug: 'acme' },
        select: { id: true },
      });
      expect(runAs).toHaveBeenCalledWith(ORG_ID, expect.any(Function));
      expect(result).toEqual({
        id: BOARD_ID,
        name: 'Roadmap',
        slug: 'roadmap',
        isPublic: true,
        createdAt: CREATED_AT.toISOString(),
      });
      expect(result).not.toHaveProperty('orgId');
    });

    it('filters on isPublic inside the query itself', async () => {
      const { service, boardFindFirst } = buildHarness({});

      await service.getBoard('acme', 'roadmap');

      expect(boardFindFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { slug: 'roadmap', isPublic: true } }),
      );
    });

    it('404s with the NOT_FOUND code for an unknown org and never opens a tenant transaction', async () => {
      const { service, runAs } = buildHarness({ org: null });

      const error = await service.getBoard('ghost', 'roadmap').catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(NotFoundException);
      expect((error as NotFoundException).getResponse()).toEqual({ error: 'NOT_FOUND' });
      expect(runAs).not.toHaveBeenCalled();
    });

    it('404s with the same body for a private or missing board', async () => {
      const { service } = buildHarness({ board: null });

      const error = await service.getBoard('acme', 'internal').catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(NotFoundException);
      expect((error as NotFoundException).getResponse()).toEqual({ error: 'NOT_FOUND' });
    });
  });

  describe('listPosts', () => {
    it('lists the posts of the public board under runAs, without author or org ids', async () => {
      const { service, runAs, postFindMany } = buildHarness({});

      const result = await service.listPosts('acme', 'roadmap');

      expect(runAs).toHaveBeenCalledWith(ORG_ID, expect.any(Function));
      expect(postFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { boardId: BOARD_ID }, orderBy: { createdAt: 'desc' } }),
      );
      expect(result).toEqual([{ ...POST_ROW, createdAt: CREATED_AT.toISOString() }]);
      expect(result[0]).not.toHaveProperty('authorId');
      expect(result[0]).not.toHaveProperty('orgId');
    });

    it('selects an explicit allow-list that excludes authorId and orgId', async () => {
      const { service, postFindMany } = buildHarness({});

      await service.listPosts('acme', 'roadmap');

      const [args] = postFindMany.mock.calls[0] as [{ select: Record<string, boolean> }];
      expect(args.select).not.toHaveProperty('authorId');
      expect(args.select).not.toHaveProperty('orgId');
    });

    it('404s for a private board and never queries its posts', async () => {
      const { service, postFindMany } = buildHarness({ board: null });

      await expect(service.listPosts('acme', 'internal')).rejects.toBeInstanceOf(NotFoundException);
      expect(postFindMany).not.toHaveBeenCalled();
    });

    it('404s for an unknown org', async () => {
      const { service, runAs } = buildHarness({ org: null });

      await expect(service.listPosts('ghost', 'roadmap')).rejects.toBeInstanceOf(NotFoundException);
      expect(runAs).not.toHaveBeenCalled();
    });
  });
});
