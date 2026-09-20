import type { INestApplication } from '@nestjs/common';
import type { Redis } from 'ioredis';

import { REDIS_CONNECTION } from '../../src/queue/redis.connection';

/**
 * Closes a Nest testing application booted from any module tree that includes
 * `redisConnectionProvider` (`OrgsModule` as of Step 8; `AppModule` transitively, since it
 * imports `OrgsModule`). `app.close()` alone is not enough: Nest's shutdown hooks only run
 * `onModuleDestroy` on providers that implement it, and a raw `ioredis` instance registered as
 * a value provider does not.
 *
 * Requires the calling suite's module tree to actually register `REDIS_CONNECTION` —
 * `app.get()` throws if no provider under that token exists anywhere in the container, so this
 * is not a safe no-op for a module tree without `OrgsModule` in it.
 *
 * `redis.disconnect()` (not `.quit()` — both were tried) still leaves one internal `Timeout`
 * alive, confirmed with `--detectOpenHandles` to originate inside `ioredis`'s own
 * `AbstractConnector.disconnect()`, not in application code, and unaffected by connection
 * options such as `keepAlive: 0` (also tried). All assertions in the calling suite have
 * already run and passed by the time this executes, and the process exits with code 0 on its
 * own — `apps/api`'s `test:e2e` script carries `--forceExit` for exactly this one known,
 * harmless `ioredis`/Jest interaction. Previously duplicated (and inconsistently written) in
 * `orgs.e2e-spec.ts` and `health.e2e-spec.ts`; centralized here so a third e2e suite reuses the
 * same, already-diagnosed close sequence instead of rediscovering it.
 */
export async function closeTestApp(app: INestApplication): Promise<void> {
  const redis = app.get<Redis>(REDIS_CONNECTION);
  redis.disconnect();
  await app.close();
}
