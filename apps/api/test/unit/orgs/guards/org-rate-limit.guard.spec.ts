import { ExecutionContext, HttpException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { OrgRateLimitGuard } from '../../../../src/orgs/guards/org-rate-limit.guard';
import type { RateLimitStore } from '../../../../src/queue/rate-limit.store';
import type { AuthenticatedRequest } from '../../../../src/database/tenant-prisma.service';

function buildContext(request: Partial<AuthenticatedRequest>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => function digest(): void {},
    getClass: () => class {},
  } as unknown as ExecutionContext;
}

function buildReflector(options: { limit: number; ttlMs: number } | undefined): Reflector {
  return { getAllAndOverride: () => options } as unknown as Reflector;
}

function buildStore(count: number): { store: RateLimitStore; hit: jest.Mock } {
  const hit = jest.fn().mockResolvedValue(count);
  return { store: { hit } as unknown as RateLimitStore, hit };
}

const ORG_ID = '11111111-1111-4111-8111-111111111111';

describe('OrgRateLimitGuard', () => {
  it('allows the route through when it carries no @RateLimit metadata', async () => {
    const { store, hit } = buildStore(0);
    const guard = new OrgRateLimitGuard(buildReflector(undefined), store);

    await expect(guard.canActivate(buildContext({}))).resolves.toBe(true);
    expect(hit).not.toHaveBeenCalled();
  });

  it('fails closed when OrgGuard never set orgId', async () => {
    const { store } = buildStore(1);
    const guard = new OrgRateLimitGuard(buildReflector({ limit: 5, ttlMs: 3_600_000 }), store);

    await expect(guard.canActivate(buildContext({}))).rejects.toBeInstanceOf(HttpException);
  });

  it('keys the counter on orgId, not the caller', async () => {
    const { store, hit } = buildStore(1);
    const guard = new OrgRateLimitGuard(buildReflector({ limit: 5, ttlMs: 3_600_000 }), store);

    await guard.canActivate(buildContext({ orgId: ORG_ID }));

    expect(hit).toHaveBeenCalledWith(expect.stringContaining(ORG_ID), 3_600_000);
  });

  it('allows a request under the limit', async () => {
    const { store } = buildStore(5);
    const guard = new OrgRateLimitGuard(buildReflector({ limit: 5, ttlMs: 3_600_000 }), store);

    await expect(guard.canActivate(buildContext({ orgId: ORG_ID }))).resolves.toBe(true);
  });

  it('refuses a request over the limit with a RATE_LIMITED body and 429', async () => {
    const { store } = buildStore(6);
    const guard = new OrgRateLimitGuard(buildReflector({ limit: 5, ttlMs: 3_600_000 }), store);

    await expect(guard.canActivate(buildContext({ orgId: ORG_ID }))).rejects.toMatchObject({
      status: 429,
      response: { error: 'RATE_LIMITED' },
    });
  });
});
