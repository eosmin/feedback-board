import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import {
  buildAiTransportConfig,
  DatabaseModule,
  LoggerModule,
  QUEUES,
  AiModule,
  WebhookDeliveryService,
} from '@feedback-board/core';
import type { Redis } from 'ioredis';

import { ConfigModule } from './config/config.module';
import { validateEnv } from './config/env.schema';
import { RedisModule } from './queue/redis.module';
import { REDIS_CONNECTION } from './queue/redis.connection';
import { AiClassifyProcessor } from './processors/ai-classify.processor';
import { WebhookDeliveryProcessor } from './processors/webhook-delivery.processor';

// Same pattern as apps/api/src/app.module.ts: importing ConfigModule triggers its own
// module-load-time NestConfigModule.forRoot(...) call, which loads .env synchronously before
// this line runs. DatabaseModule.forTenant, LoggerModule.register and AiModule.register all take
// literal values (packages/core reads no process.env of its own, §2.2a), so this app validates
// its own environment once, eagerly, to supply them.
const env = validateEnv(process.env);

/**
 * The worker's root module. `DatabaseModule.forTenant` (not `.forRoot`) is what makes
 * `PrismaService` structurally absent from this container (TDD §3.10, §3.2) — injecting it
 * anywhere here is a startup-time DI error, not a runtime privilege escalation. There is no
 * HTTP adapter, no controllers, no guards: `apps/worker` boots with
 * `NestFactory.createApplicationContext` (main.ts), so none of that surface exists to wire up.
 *
 * `LoggerModule.register()` (TDD §2.6.16) is the same shared module `apps/api` registers —
 * `nestjs-pino` is platform-agnostic and works with `createApplicationContext` exactly as with
 * an HTTP adapter, so this process gets structured pino logging without declaring
 * `nestjs-pino`/`pino`/`pino-http`/`pino-pretty` as its own dependency.
 *
 * `RedisModule` (not a local `providers: [redisConnectionProvider]`) is what makes
 * `REDIS_CONNECTION` resolvable inside `BullModule.forRootAsync`'s own internal submodule — a
 * sibling provider in this module's own `providers` array is invisible to it (see
 * `queue/redis.module.ts`).
 *
 * `AiModule.register()` requires both model ids (`AiServiceOptions`, §3.8), but this process
 * only ever calls `classifyPost()` — the digest is an `apps/api`-only, on-demand HTTP route
 * (§3.8's second flow). `digestModel` is set to `AI_CLASSIFY_MODEL` as an unused placeholder
 * rather than adding an `AI_DIGEST_MODEL` var this process has no business reading (§16's
 * ownership table lists `AI_*` as "digest only" for `apps/api`, "classification" for
 * `apps/worker`) — `generateDigest()` is simply never invoked from here. `buildAiTransportConfig`
 * (`packages/core`) builds the `AI_CUSTOM_*` half of `AiServiceOptions` — `apps/api/src/boards/
 * boards.module.ts` needs the identical translation from its own env, so it is written once,
 * not copy-pasted per app (§7.1).
 *
 * `WebhookDeliveryService` is a plain provider, not a dynamic-module registration (TDD §3.10):
 * unlike `AiService`/`LoggerModule`, it holds no options and no shared resource, so both queues'
 * processors share one instance the same way `TenantRunner` is shared, with no `register()` call.
 * `registerQueue` now covers both queues: `webhooks` (this step) alongside `ai-classify`.
 */
@Module({
  imports: [
    ConfigModule,
    LoggerModule.register({ isProduction: env.NODE_ENV === 'production' }),
    DatabaseModule.forTenant({ databaseUrl: env.DATABASE_URL }),
    AiModule.register({
      classifyModel: env.AI_CLASSIFY_MODEL,
      digestModel: env.AI_CLASSIFY_MODEL,
      transport: buildAiTransportConfig(env),
    }),
    RedisModule,
    BullModule.forRootAsync({
      inject: [REDIS_CONNECTION],
      useFactory: (connection: Redis) => ({ connection }),
    }),
    BullModule.registerQueue({ name: QUEUES.AI_CLASSIFY }, { name: QUEUES.WEBHOOKS }),
  ],
  providers: [AiClassifyProcessor, WebhookDeliveryProcessor, WebhookDeliveryService],
})
export class WorkerModule {}
