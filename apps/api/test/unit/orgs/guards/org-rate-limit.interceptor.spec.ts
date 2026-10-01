import { CallHandler, ExecutionContext } from '@nestjs/common';
import { HttpAdapterHost, Reflector } from '@nestjs/core';
import { of, throwError } from 'rxjs';

import { OrgRateLimitHeaderInterceptor } from '../../../../src/orgs/guards/org-rate-limit.interceptor';
import type { RateLimitStore } from '../../../../src/queue/rate-limit.store';
import type { AuthenticatedRequest } from '../../../../src/database/tenant-prisma.service';

const FAKE_RESPONSE = Symbol('response');
const ORG_ID = '11111111-1111-4111-8111-111111111111';

function buildContext(request: Partial<AuthenticatedRequest>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request, getResponse: () => FAKE_RESPONSE }),
    getHandler: () => function digest(): void {},
    getClass: () => class {},
  } as unknown as ExecutionContext;
}

function buildReflector(options: { limit: number; ttlMs: number; route?: string } | undefined): Reflector {
  return { getAllAndOverride: () => options } as unknown as Reflector;
}

function buildStore(count: number): { store: RateLimitStore; peek: jest.Mock } {
  const peek = jest.fn().mockResolvedValue(count);
  return { store: { peek } as unknown as RateLimitStore, peek };
}

function buildAdapterHost(): { adapterHost: HttpAdapterHost; setHeader: jest.Mock } {
  const setHeader = jest.fn();
  return {
    adapterHost: { httpAdapter: { setHeader } } as unknown as HttpAdapterHost,
    setHeader,
  };
}

describe('OrgRateLimitHeaderInterceptor', () => {
  it('sets X-RateLimit-Limit/Remaining from a post-handler peek on success', async () => {
    const { store } = buildStore(2);
    const { adapterHost, setHeader } = buildAdapterHost();
    const interceptor = new OrgRateLimitHeaderInterceptor(
      buildReflector({ limit: 5, ttlMs: 3_600_000 }),
      store,
      adapterHost,
    );
    const next: CallHandler = { handle: () => of('ok') };

    await interceptor.intercept(buildContext({ orgId: ORG_ID }), next).toPromise();

    expect(setHeader).toHaveBeenCalledWith(FAKE_RESPONSE, 'X-RateLimit-Limit', '5');
    expect(setHeader).toHaveBeenCalledWith(FAKE_RESPONSE, 'X-RateLimit-Remaining', '3');
  });

  it('reflects a release() refund that happened inside the handler, not the pre-handler count', async () => {
    // Guard counted 5 (remaining would be 0), but the handler refunded one before throwing —
    // this is exactly the bug the interceptor exists to fix (TDD §3.8).
    const { store } = buildStore(4);
    const { adapterHost, setHeader } = buildAdapterHost();
    const interceptor = new OrgRateLimitHeaderInterceptor(
      buildReflector({ limit: 5, ttlMs: 3_600_000 }),
      store,
      adapterHost,
    );
    const next: CallHandler = { handle: () => throwError(() => new Error('DIGEST_NO_POSTS')) };

    await expect(interceptor.intercept(buildContext({ orgId: ORG_ID }), next).toPromise()).rejects.toThrow(
      'DIGEST_NO_POSTS',
    );

    expect(setHeader).toHaveBeenCalledWith(FAKE_RESPONSE, 'X-RateLimit-Remaining', '1');
  });

  it('passes through untouched when the route carries no @RateLimit metadata', async () => {
    const { store } = buildStore(0);
    const { adapterHost, setHeader } = buildAdapterHost();
    const interceptor = new OrgRateLimitHeaderInterceptor(buildReflector(undefined), store, adapterHost);
    const next: CallHandler = { handle: () => of('ok') };

    await interceptor.intercept(buildContext({}), next).toPromise();

    expect(setHeader).not.toHaveBeenCalled();
  });
});
