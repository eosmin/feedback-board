import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { RATE_LIMIT_KEY, type RateLimitOptions } from '../rate-limit.decorator';
import { RateLimitStore } from '../../queue/rate-limit.store';
import type { AuthenticatedRequest } from '../../database/tenant-prisma.service';

/**
 * Shared with `BoardsService.generateDigest()`, which calls `RateLimitStore.release()` on this
 * same key when it turns out there was nothing to summarize — a no-op attempt (TDD §3.8) should
 * not cost part of the org's hourly budget, but the guard that counted it runs before the
 * handler can know that.
 */
export function buildRateLimitKey(route: string, orgId: string): string {
  return `ratelimit:${route}:${orgId}`;
}

/**
 * Enforces `@RateLimit({ limit, ttlMs })` keyed on `req.orgId` (TDD §3.8) — set by `OrgGuard`,
 * which must run first in the `@UseGuards(...)` list. A route with no `@RateLimit` metadata is
 * unrestricted; a route that has it but never ran `OrgGuard` fails closed rather than silently
 * skipping the limit, because `orgId` being absent here means the guard order was violated.
 *
 * `X-RateLimit-Limit`/`X-RateLimit-Remaining` are set by `OrgRateLimitHeaderInterceptor`, not
 * here — that interceptor reads the counter again after the handler settles, so a handler that
 * refunds the attempt (e.g. `BoardsService.generateDigest` on an empty digest, TDD §3.8) is
 * reflected in the response instead of the stale pre-handler count this guard saw.
 */
@Injectable()
export class OrgRateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly store: RateLimitStore,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const options = this.reflector.getAllAndOverride<RateLimitOptions | undefined>(RATE_LIMIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (options === undefined) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const orgId = request.orgId;

    if (orgId === undefined) {
      throw new HttpException(
        'rate limit misconfigured: OrgGuard did not run',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const route = options.route ?? context.getHandler().name;
    const key = buildRateLimitKey(route, orgId);
    const count = await this.store.hit(key, options.ttlMs);

    if (count > options.limit) {
      throw new HttpException({ error: 'RATE_LIMITED' }, HttpStatus.TOO_MANY_REQUESTS);
    }

    return true;
  }
}
