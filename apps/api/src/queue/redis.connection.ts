import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';

import type { Env } from '../config/env.schema';

export const REDIS_CONNECTION = Symbol('REDIS_CONNECTION');

/**
 * The one `ioredis` connection this process holds — shared by `RateLimitStore` (§3.8) and, from
 * step 10 on, the BullMQ producer (§2.6.14, §3.10). A single connection rather than one per
 * consumer: both uses are lightweight command traffic, not a blocking `BLPOP`-style consumer,
 * which is the case that would force a dedicated connection.
 *
 * `maxRetriesPerRequest` is left at `ioredis`'s own finite default here — deliberately the
 * opposite of the worker's connection (`apps/worker/src/queue/redis.connection.ts`, which sets
 * it to `null`). Enqueueing happens inside an HTTP request: if Redis is unreachable, the right
 * behaviour is to fail fast and return an error, not to retry forever and hang the response
 * (TDD §2.6.14). `null` here would silently turn a Redis outage into a hung request.
 */
export const redisConnectionProvider = {
  provide: REDIS_CONNECTION,
  inject: [ConfigService],
  useFactory: (config: ConfigService<Env, true>): Redis => {
    const url = config.get('REDIS_URL', { infer: true });
    return new Redis(url);
  },
};
