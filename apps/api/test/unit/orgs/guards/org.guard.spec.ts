import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import type { PrismaService } from '@feedback-board/core';

import { OrgGuard } from '../../../../src/orgs/guards/org.guard';
import type { AuthenticatedRequest } from '../../../../src/database/tenant-prisma.service';

function buildContext(request: Partial<AuthenticatedRequest>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

function buildAdmin(
  org: { id: string } | null,
  membership: { role: string } | null,
): { admin: PrismaService; findOrg: jest.Mock; findMembership: jest.Mock } {
  const findOrg = jest.fn().mockResolvedValue(org);
  const findMembership = jest.fn().mockResolvedValue(membership);
  const admin = {
    client: {
      org: { findUnique: findOrg },
      membership: { findUnique: findMembership },
    },
  } as unknown as PrismaService;
  return { admin, findOrg, findMembership };
}

const ORG_ID = '11111111-1111-4111-8111-111111111111';

describe('OrgGuard', () => {
  it('rejects when orgSlug is missing from the route params', async () => {
    const { admin } = buildAdmin(null, null);
    const guard = new OrgGuard(admin);
    const context = buildContext({ params: {}, userId: 'user-1' } as never);

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects when userId is missing (JwtAuthGuard never ran)', async () => {
    const { admin } = buildAdmin(null, null);
    const guard = new OrgGuard(admin);
    const context = buildContext({ params: { orgSlug: 'acme' } } as never);

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects when the org slug resolves to no org', async () => {
    const { admin } = buildAdmin(null, null);
    const guard = new OrgGuard(admin);
    const context = buildContext({
      params: { orgSlug: 'ghost' },
      userId: 'user-1',
    } as never);

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects when the caller has no membership in the resolved org', async () => {
    const { admin } = buildAdmin({ id: ORG_ID }, null);
    const guard = new OrgGuard(admin);
    const context = buildContext({
      params: { orgSlug: 'acme' },
      userId: 'user-1',
    } as never);

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('attaches orgId and role on a valid membership', async () => {
    const { admin } = buildAdmin({ id: ORG_ID }, { role: 'OWNER' });
    const guard = new OrgGuard(admin);
    const request = {
      params: { orgSlug: 'acme' },
      userId: 'user-1',
    } as unknown as AuthenticatedRequest;
    const context = buildContext(request);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.orgId).toBe(ORG_ID);
    expect(request.role).toBe('OWNER');
  });
});
