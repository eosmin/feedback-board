import { ConfigService } from '@nestjs/config';
import { jwtVerify, type JWTVerifyGetKey } from 'jose';
import { ERROR_CODES } from '@feedback-board/shared';
import type { NextFunction, Request, Response } from 'express';

import type { Env } from '../config/env.schema';

export interface BullBoardGateDeps {
  readonly config: ConfigService<Env, true>;
  readonly jwks: JWTVerifyGetKey;
  readonly issuer: string;
}

/**
 * `/admin/queues` gate (TDD §3.10, decision D6): identity-based, not `@Roles` — a role in this
 * system is per-org, and this route sits outside `/orgs/:orgSlug/*`, so `OrgGuard` never runs
 * and `request.role` is never set. Checked in order:
 *
 * 1. `bull-board.module.ts` only builds this gate when `BULL_BOARD_ENABLED` is `true` — the
 *    route does not exist rather than existing-and-403ing.
 * 2. A valid Supabase JWT, verified with the same `jose`/JWKS resolver `JwtAuthGuard` uses.
 * 3. The token's `email` claim must appear in `BULL_BOARD_ADMIN_EMAILS` — an empty allowlist
 *    with the flag on means nobody gets in, not everybody.
 *
 * A factory returning a plain Express middleware function, not a `NestMiddleware` class bound
 * via `MiddlewareConsumer`: `@bull-board/nestjs`'s own root module registers itself
 * `global: true`, and Nest always runs a global module's middleware before a non-global one's,
 * regardless of import order — so a gate registered from our own module would lose the race
 * against the library's router and never run. Passing this function as
 * `BullBoardModuleOptions.middleware` uses the library's own documented extension point (its
 * README's basic-auth recipe does the same with `basicAuth(...)`), which `BullBoardRootModule`
 * applies together with its router in a single `consumer.apply(middleware, router)` call —
 * guaranteeing the gate runs first by construction. Because it runs as a raw Express function,
 * it writes the response directly instead of throwing an `HttpException` for
 * `AllExceptionsFilter` to shape.
 */
export function createBullBoardGate(
  deps: BullBoardGateDeps,
): (req: Request, res: Response, next: NextFunction) => Promise<void> {
  return async (req, res, next) => {
    const authorization = req.headers.authorization;

    if (typeof authorization !== 'string' || !authorization.startsWith('Bearer ')) {
      res.status(401).json({ error: ERROR_CODES.UNAUTHORIZED });
      return;
    }

    const token = authorization.slice('Bearer '.length);

    let email: string | undefined;
    try {
      const { payload } = await jwtVerify(token, deps.jwks, { issuer: deps.issuer });
      email = typeof payload.email === 'string' ? payload.email : undefined;
    } catch {
      res.status(401).json({ error: ERROR_CODES.UNAUTHORIZED });
      return;
    }

    const allowlist = deps.config
      .get('BULL_BOARD_ADMIN_EMAILS', { infer: true })
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);

    if (email === undefined || !allowlist.includes(email)) {
      res.status(403).json({ error: ERROR_CODES.FORBIDDEN });
      return;
    }

    next();
  };
}
