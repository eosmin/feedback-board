import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QUEUES } from '@feedback-board/core';
import type { Redis } from 'ioredis';

import { RedisModule } from './redis.module';
import { REDIS_CONNECTION } from './redis.connection';

/**
 * Producer side only (TDD §3.10) — `apps/api` never consumes a job, only enqueues one.
 * `BullModule.forRootAsync` shares the one `ioredis` connection this process already holds for
 * the rate limiter (§3.8, `redis.connection.ts`) rather than opening a second one: BullMQ's
 * `Queue` reuses whatever `connection` it is given (§2.6.14) instead of building its own from
 * host/port options, so the "never rely on backend auto-selection" rule in §2.6.14 is satisfied
 * by construction, not by convention.
 *
 * `RedisModule` (not a local `providers: [redisConnectionProvider]`) is what makes
 * `REDIS_CONNECTION` resolvable inside `forRootAsync`'s own internal submodule — a sibling
 * provider in this module's own `providers` array is invisible to it (see `redis.module.ts`).
 *
 * `registerQueue` for both queues (§3.10's table) even though this step only enqueues
 * `ai-classify` — `webhooks` is registered here too because both share this one producer
 * connection, and Step 14 (the webhook queue's first enqueue) must not re-register it.
 *
 * Queue and job names come from `QUEUES`/`JOBS` in `packages/core/src/constants/queues.ts`
 * (§2.6.15) — never a string literal (§7.1).
 */
@Module({
  imports: [
    RedisModule,
    BullModule.forRootAsync({
      inject: [REDIS_CONNECTION],
      useFactory: (connection: Redis) => ({ connection }),
    }),
    BullModule.registerQueue({ name: QUEUES.WEBHOOKS }, { name: QUEUES.AI_CLASSIFY }),
  ],
  exports: [BullModule],
})
export class QueueModule {}
