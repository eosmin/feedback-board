import { Global, Module } from '@nestjs/common';

import { redisConnectionProvider } from './redis.connection';

/**
 * `@Global()` is required, not decoration: `BullModule.forRootAsync` (in `queue.module.ts`)
 * builds its own internal submodule to resolve its `inject` dependencies, and that submodule
 * cannot see a sibling provider declared directly in another module's `providers` array — only
 * providers reached via `imports` or marked global (verified against NestJS's own dependency
 * resolution: "Nest can't resolve dependencies of BULLMQ_CONFIG... make sure REDIS_CONNECTION
 * is available in the BullModule module").
 *
 * Without this module, `OrgsModule` (Step 8) and `QueueModule` (Step 10) would each construct
 * their own separate `ioredis` instance from an identically-named local provider — two
 * connections to the same Redis, contradicting `redis.connection.ts`'s own docstring that this
 * is "the one connection this process holds" (TDD §2.6.14). Both modules import this one
 * instead, so `RateLimitStore` and the BullMQ producer share the single real connection.
 */
@Module({
  providers: [redisConnectionProvider],
  exports: [redisConnectionProvider],
})
@Global()
export class RedisModule {}
