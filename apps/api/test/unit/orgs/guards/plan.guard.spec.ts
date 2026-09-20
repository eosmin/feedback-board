import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { PlanGuard } from '../../../../src/orgs/guards/plan.guard';
import type { TenantPrismaService } from '../../../../src/database/tenant-prisma.service';
import type { AuthenticatedRequest } from '../../../../src/database/tenant-prisma.service';

const ORG_ID = '11111111-1111-4111-8111-111111111111';

function buildContext(): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ orgId: ORG_ID }) as AuthenticatedRequest }),
    getHandler: () => (): void => {},
    getClass: () => class {},
  } as unknown as ExecutionContext;
}

function buildReflector(
  requiresPlan: string | undefined,
  limitedByPlan: string | undefined,
): Reflector {
  return {
    getAllAndOverride: (key: string) => {
      if (key === 'requiresPlan') return requiresPlan;
      if (key === 'limitedByPlan') return limitedByPlan;
      return undefined;
    },
  } as unknown as Reflector;
}

function buildTenantPrisma(plan: string, count: number): TenantPrismaService {
  const run = jest.fn(async (fn: (tx: unknown) => unknown) => {
    const tx = {
      org: { findUniqueOrThrow: jest.fn().mockResolvedValue({ plan }) },
      board: { count: jest.fn().mockResolvedValue(count) },
      post: { count: jest.fn().mockResolvedValue(count) },
    };
    return fn(tx);
  });
  return { run } as unknown as TenantPrismaService;
}

describe('PlanGuard', () => {
  it('allows a PRO org through @RequiresPlan(PRO)', async () => {
    const guard = new PlanGuard(buildReflector('PRO', undefined), buildTenantPrisma('PRO', 0));

    await expect(guard.canActivate(buildContext())).resolves.toBe(true);
  });

  it('refuses a FREE org on @RequiresPlan(PRO) with the PLAN_LIMIT body', async () => {
    const guard = new PlanGuard(buildReflector('PRO', undefined), buildTenantPrisma('FREE', 0));

    await expect(guard.canActivate(buildContext())).rejects.toMatchObject({
      response: { error: 'PLAN_LIMIT', limit: 'webhooks', plan: 'FREE', cap: false },
    });
  });

  it('allows a FREE org under its boards cap', async () => {
    const guard = new PlanGuard(buildReflector(undefined, 'boards'), buildTenantPrisma('FREE', 0));

    await expect(guard.canActivate(buildContext())).resolves.toBe(true);
  });

  it('refuses a FREE org at its boards cap with the PLAN_LIMIT body', async () => {
    const guard = new PlanGuard(buildReflector(undefined, 'boards'), buildTenantPrisma('FREE', 1));

    await expect(guard.canActivate(buildContext())).rejects.toMatchObject({
      response: { error: 'PLAN_LIMIT', limit: 'boards', plan: 'FREE', cap: 1 },
    });
  });

  it('refuses a FREE org at its 50-post cap with the PLAN_LIMIT body', async () => {
    const guard = new PlanGuard(buildReflector(undefined, 'posts'), buildTenantPrisma('FREE', 50));

    await expect(guard.canActivate(buildContext())).rejects.toMatchObject({
      response: { error: 'PLAN_LIMIT', limit: 'posts', plan: 'FREE', cap: 50 },
    });
  });

  it('never counts for a PRO org, whose cap is null (unlimited)', async () => {
    const guard = new PlanGuard(buildReflector(undefined, 'boards'), buildTenantPrisma('PRO', 999));

    await expect(guard.canActivate(buildContext())).resolves.toBe(true);
  });
});
