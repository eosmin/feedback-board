import { ConflictException } from '@nestjs/common';
import type { PrismaService } from '@feedback-board/core';

import { OrgsService } from '../../../src/orgs/orgs.service';
import type { TenantPrismaService } from '../../../src/database/tenant-prisma.service';
import type { CreateOrgDto } from '../../../src/orgs/dto/create-org.dto';

const ORG_ID = '11111111-1111-4111-8111-111111111111';

function buildAdmin(): {
  admin: PrismaService;
  createOrg: jest.Mock;
  createMembership: jest.Mock;
  findMany: jest.Mock;
  findUniqueOrThrow: jest.Mock;
} {
  const createOrg = jest.fn().mockResolvedValue({
    id: ORG_ID,
    name: 'Acme',
    slug: 'acme',
    plan: 'FREE',
  });
  const createMembership = jest.fn().mockResolvedValue({});
  const findMany = jest.fn();
  const findUniqueOrThrow = jest.fn();

  const admin = {
    client: {
      $transaction: async (fn: (tx: unknown) => unknown) =>
        fn({
          org: { create: createOrg },
          membership: { create: createMembership },
        }),
      membership: { findMany },
      org: { findUniqueOrThrow },
    },
  } as unknown as PrismaService;

  return { admin, createOrg, createMembership, findMany, findUniqueOrThrow };
}

function buildTenantPrisma(boardsUsed: number, postsUsed: number): TenantPrismaService {
  const run = jest.fn(async (fn: (tx: unknown) => unknown) => {
    const tx = {
      board: { count: jest.fn().mockResolvedValue(boardsUsed) },
      post: { count: jest.fn().mockResolvedValue(postsUsed) },
    };
    return fn(tx);
  });
  return { run } as unknown as TenantPrismaService;
}

describe('OrgsService', () => {
  it('creates an org and bootstraps the creator as OWNER, atomically', async () => {
    const { admin, createOrg, createMembership } = buildAdmin();
    const service = new OrgsService(admin, buildTenantPrisma(0, 0));
    const dto: CreateOrgDto = { name: 'Acme', slug: 'acme' };

    const result = await service.create('user-1', dto);

    expect(createOrg).toHaveBeenCalledWith({ data: { name: 'Acme', slug: 'acme' } });
    expect(createMembership).toHaveBeenCalledWith({
      data: { userId: 'user-1', orgId: ORG_ID, role: 'OWNER' },
    });
    expect(result).toEqual({ id: ORG_ID, name: 'Acme', slug: 'acme', plan: 'FREE', role: 'OWNER' });
  });

  it('rejects a reserved org slug before touching the database', async () => {
    const { admin, createOrg } = buildAdmin();
    const service = new OrgsService(admin, buildTenantPrisma(0, 0));

    await expect(
      service.create('user-1', { name: 'Dashboard', slug: 'dashboard' }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(createOrg).not.toHaveBeenCalled();
  });

  it('lists the orgs a user is a member of with their own role', async () => {
    const { admin, findMany } = buildAdmin();
    findMany.mockResolvedValue([
      { role: 'MEMBER', org: { id: ORG_ID, name: 'Acme', slug: 'acme', plan: 'FREE' } },
    ]);
    const service = new OrgsService(admin, buildTenantPrisma(0, 0));

    const result = await service.listForUser('user-1');

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'user-1' } }));
    expect(result).toEqual([
      { id: ORG_ID, name: 'Acme', slug: 'acme', plan: 'FREE', role: 'MEMBER' },
    ]);
  });

  it('computes org detail usage against PLAN_LIMITS through TenantPrismaService', async () => {
    const { admin, findUniqueOrThrow } = buildAdmin();
    findUniqueOrThrow.mockResolvedValue({ id: ORG_ID, name: 'Acme', slug: 'acme', plan: 'FREE' });
    const service = new OrgsService(admin, buildTenantPrisma(1, 50));

    const result = await service.getDetail(ORG_ID, 'OWNER');

    expect(result).toEqual({
      id: ORG_ID,
      name: 'Acme',
      slug: 'acme',
      plan: 'FREE',
      role: 'OWNER',
      usage: {
        boards: { used: 1, cap: 1 },
        posts: { used: 50, cap: 50 },
        webhooks: { available: false },
      },
    });
  });

  it('reports unlimited caps (null) for a PRO org', async () => {
    const { admin, findUniqueOrThrow } = buildAdmin();
    findUniqueOrThrow.mockResolvedValue({ id: ORG_ID, name: 'Acme', slug: 'acme', plan: 'PRO' });
    const service = new OrgsService(admin, buildTenantPrisma(10, 500));

    const result = await service.getDetail(ORG_ID, 'OWNER');

    expect(result.usage.boards.cap).toBeNull();
    expect(result.usage.posts.cap).toBeNull();
    expect(result.usage.webhooks.available).toBe(true);
  });
});
