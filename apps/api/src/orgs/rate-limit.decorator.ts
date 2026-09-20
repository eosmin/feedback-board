import { SetMetadata } from '@nestjs/common';

export const RATE_LIMIT_KEY = 'rateLimit';

export interface RateLimitOptions {
  readonly limit: number;
  readonly ttlMs: number;
}

/**
 * Read by `OrgRateLimitGuard` via `Reflector` (TDD §3.8). The AI digest route uses
 * `{ limit: 5, ttlMs: 3_600_000 }` — the unit is the org, not the caller or the IP.
 */
export const RateLimit = (options: RateLimitOptions): MethodDecorator =>
  SetMetadata(RATE_LIMIT_KEY, options);
