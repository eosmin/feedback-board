import { Global, Module } from '@nestjs/common';

import { redisConnectionProvider } from './redis.connection';

/**
 * `@Global()` is required, not decoration: `BullModule.forRootAsync` (in `worker.module.ts`)
 * builds its own internal submodule to resolve its `inject` dependencies, and that submodule
 * cannot see a sibling provider declared directly in another module's `providers` array — only
 * providers reached via `imports` or marked global (same root cause as
 * `apps/api/src/queue/redis.module.ts`, TDD §2.6.14). Without this, `WorkerModule`'s own
 * `providers: [redisConnectionProvider, ...]` is invisible to `forRootAsync`'s injector,
 * confirmed by NestJS's own error: "Nest can't resolve dependencies of BULLMQ_CONFIG... make
 * sure REDIS_CONNECTION is available in the BullModule module".
 *
 * A separate class from `apps/api`'s `RedisModule` — not shared code — because the two
 * processes want opposite `maxRetriesPerRequest` settings on their connections (§2.6.14) and
 * `apps/worker` must never import from `apps/api` (§3.10, §17).
 */
@Module({
  providers: [redisConnectionProvider],
  exports: [redisConnectionProvider],
})
@Global()
export class RedisModule {}
