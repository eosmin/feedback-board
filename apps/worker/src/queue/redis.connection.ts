import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';

import type { Env } from '../config/env.schema';

export const REDIS_CONNECTION = Symbol('REDIS_CONNECTION');

/**
 * The consumer-side connection (TDD §2.6.14). `maxRetriesPerRequest: null` is mandatory here,
 * not a tuning knob — BullMQ **throws** at Worker construction if a hand-built `ioredis`
 * instance handed to it omits this, and the opposite setting from the producer's
 * `apps/api/src/queue/redis.connection.ts` is deliberate: a worker has no caller waiting on it,
 * so it should retry indefinitely and resume when Redis returns, rather than fail fast the way
 * an HTTP request's producer connection should.
 */
export const redisConnectionProvider = {
  provide: REDIS_CONNECTION,
  inject: [ConfigService],
  useFactory: (config: ConfigService<Env, true>): Redis => {
    const url = config.get('REDIS_URL', { infer: true });
    return new Redis(url, { maxRetriesPerRequest: null });
  },
};
