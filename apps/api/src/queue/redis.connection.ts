import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';

import type { Env } from '../config/env.schema';

export const REDIS_CONNECTION = Symbol('REDIS_CONNECTION');

/**
 * The one `ioredis` connection this process holds — shared by `RateLimitStore` (§3.8) and, from
 * step 10 on, the BullMQ producer (§2.6.14, §3.10). A single connection rather than one per
 * consumer: both uses are lightweight command traffic, not a blocking `BLPOP`-style consumer,
 * which is the case that would force a dedicated connection.
 */
export const redisConnectionProvider = {
  provide: REDIS_CONNECTION,
  inject: [ConfigService],
  useFactory: (config: ConfigService<Env, true>): Redis => {
    const url = config.get('REDIS_URL', { infer: true });
    // maxRetriesPerRequest: null is BullMQ's own documented requirement for any connection a
    // Queue/Worker shares (bullmq, §2.6.14) — set here too since this connection is reused by
    // the queue producer from step 10 on, not duplicated per consumer.
    return new Redis(url, { maxRetriesPerRequest: null });
  },
};
