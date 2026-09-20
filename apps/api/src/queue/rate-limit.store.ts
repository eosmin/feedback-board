import { Inject, Injectable } from '@nestjs/common';
import type { Redis } from 'ioredis';

import { REDIS_CONNECTION } from './redis.connection';

/**
 * `INCR` + `EXPIRE` counter on the shared `ioredis` connection (TDD §3.8). Written by hand
 * instead of installing `@nestjs/throttler` or either of its Redis storage adapters: all three
 * cap their `@nestjs/core`/`@nestjs/common` peers at `^11`, one major behind this project's
 * pinned Nest 12, and none has published a `^12` range (verified against the registry, §3.8).
 * The counter lives in Redis, not process memory, so the limit holds once `apps/api` scales
 * past one replica.
 */
@Injectable()
export class RateLimitStore {
  constructor(@Inject(REDIS_CONNECTION) private readonly redis: Redis) {}

  /**
   * Increments `key` and returns the post-increment count. Sets the key's TTL only on the
   * first hit (`count === 1`) so an existing window is never extended by a later request —
   * an `EXPIRE` on every call would turn a fixed 1-hour window into a rolling one.
   */
  async hit(key: string, ttlMs: number): Promise<number> {
    const count = await this.redis.incr(key);

    if (count === 1) {
      await this.redis.pexpire(key, ttlMs);
    }

    return count;
  }
}
