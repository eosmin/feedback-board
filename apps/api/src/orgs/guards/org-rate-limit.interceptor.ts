import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { HttpAdapterHost, Reflector } from '@nestjs/core';
import { Observable, catchError, concatMap, defer } from 'rxjs';

import { RATE_LIMIT_KEY, type RateLimitOptions } from '../rate-limit.decorator';
import { RateLimitStore } from '../../queue/rate-limit.store';
import { buildRateLimitKey } from './org-rate-limit.guard';
import type { AuthenticatedRequest } from '../../database/tenant-prisma.service';

/**
 * Sets `X-RateLimit-Limit`/`X-RateLimit-Remaining` from a fresh `RateLimitStore.peek()` taken
 * after the handler settles, not from the pre-handler count `OrgRateLimitGuard` saw. A handler
 * that calls `RateLimitStore.release()` on a no-op attempt (e.g. `BoardsService.generateDigest`
 * refunding an empty digest, TDD §3.8) changes the counter after the guard already ran, so a
 * header set by the guard would report a stale, understated remaining count on every such
 * request — `finalize` runs on both the success and error paths so the refund is reflected even
 * when the handler throws.
 */
@Injectable()
export class OrgRateLimitHeaderInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly store: RateLimitStore,
    private readonly httpAdapterHost: HttpAdapterHost,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const options = this.reflector.getAllAndOverride<RateLimitOptions | undefined>(RATE_LIMIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (options === undefined) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const orgId = request.orgId;

    if (orgId === undefined) {
      return next.handle();
    }

    const route = options.route ?? context.getHandler().name;
    const key = buildRateLimitKey(route, orgId);
    const response = context.switchToHttp().getResponse<unknown>();
    const { httpAdapter } = this.httpAdapterHost;

    const setHeaders = async (): Promise<void> => {
      const count = await this.store.peek(key);
      const remaining = Math.max(0, options.limit - count);
      httpAdapter.setHeader(response, 'X-RateLimit-Limit', String(options.limit));
      httpAdapter.setHeader(response, 'X-RateLimit-Remaining', String(remaining));
    };

    return next.handle().pipe(
      concatMap(async (data) => {
        await setHeaders();
        return data;
      }),
      catchError((error) =>
        defer(async () => {
          await setHeaders();
          throw error;
        }),
      ),
    );
  }
}
