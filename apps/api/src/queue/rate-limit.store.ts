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

  /**
   * Undoes one `hit()` — used when the attempt it counted turned out to be a no-op (TDD §3.8,
   * e.g. the AI digest finding no posts to summarize) and should not cost part of the window's
   * budget. `KEEPTTL` so releasing never resets the window's expiry back to a fresh hour; clamped
   * at 0 rather than left negative. The decrement-then-clamp runs as a single Lua script so a
   * concurrent `hit()` landing between the two steps can never be overwritten back to 0 — a plain
   * `DECR` followed by a separate `SET` would race against it non-atomically.
   */
  async release(key: string): Promise<void> {
    await this.redis.eval(
      `local v = redis.call('DECR', KEYS[1])
       if tonumber(v) < 0 then
         redis.call('SET', KEYS[1], 0, 'KEEPTTL')
       end`,
      1,
      key,
    );
  }

  /**
   * Reads the current count without incrementing it — unlike `hit()`, querying the remaining
   * budget (e.g. `GET .../ai-digest/quota`) must never itself count as an attempt. `null` (the
   * key has never been hit, or its window already expired) reads as 0, the same starting point
   * `hit()`'s first call produces.
   */
  async peek(key: string): Promise<number> {
    const value = await this.redis.get(key);
    return value === null ? 0 : Number(value);
  }
}
