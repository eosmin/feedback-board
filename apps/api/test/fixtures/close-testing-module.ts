import type { TestingModule } from '@nestjs/testing';

/**
 * Closes a `TestingModule` compiled from a tree that includes `RedisModule` (`OrgsModule` and
 * `QueueModule` as of Step 10, and anything importing either transitively). `Test.createTestingModule`
 * does not close itself, and BullMQ's `Queue`/`QueueEvents` instances hold internal timers even
 * when the injected `REDIS_CONNECTION` is a stub object rather than a real `ioredis` client —
 * `@nestjs/bullmq`'s own test suite closes the module for the same reason. Skipping this is what
 * leaves Jest force-exiting with "A worker process has failed to exit gracefully".
 *
 * `moduleRef?.close()` (optional call) rather than a required argument: every caller declares
 * `moduleRef` before the module is compiled inside the `it()` block, so it is `undefined` if a
 * test fails before `.compile()` runs, and `afterEach` still executes.
 *
 * Previously duplicated verbatim across `queue.module.spec.ts`, `orgs.module.spec.ts`,
 * `posts.module.spec.ts` and `boards.module.spec.ts`; a fifth module spec repeating the same
 * `afterEach` block is exactly the drift `close-test-app.ts` already prevents on the e2e side —
 * this is the same fix for the unit-test side (TDD §7.1).
 */
export async function closeTestingModule(moduleRef: TestingModule | undefined): Promise<void> {
  await moduleRef?.close();
}
