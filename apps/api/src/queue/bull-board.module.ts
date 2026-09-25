import { DynamicModule, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BullBoardModule as BullBoardNestModule } from '@bull-board/nestjs';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { QUEUES } from '@feedback-board/core';
import type { JWTVerifyGetKey } from 'jose';

import { AuthModule } from '../auth/auth.module';
import { JWKS, JWT_ISSUER } from '../auth/jwks.provider';
import type { Env } from '../config/env.schema';
import { QueueModule } from './queue.module';
import { createBullBoardGate } from './bull-board.middleware';

const ROUTE = 'admin/queues';

/**
 * Mounts Bull Board at `/admin/queues`, gated by `createBullBoardGate` (TDD §3.10, decision D6)
 * — only when `BULL_BOARD_ENABLED` is exactly `true`. `register()` returns an empty
 * `DynamicModule` otherwise: the route does not exist at all rather than existing and refusing
 * every request.
 *
 * `forRootAsync` (not `forRoot`, and not a custom `NestModule`/`configure()` class) resolves
 * `ConfigService`/`JWKS`/`JWT_ISSUER` through Nest DI and passes the gate as
 * `BullBoardModuleOptions.middleware` — the library's documented extension point, which its own
 * root module applies together with its router in one call. See `bull-board.middleware.ts` for
 * why that matters (a separately-registered middleware loses to the library's own `global: true`
 * root module regardless of import order).
 *
 * `QueueModule` supplies both queues to `forFeature` so this observes the same `Queue` instances
 * the producer side already holds.
 */
@Module({})
export class BullBoardModule {
  static register(options: { enabled: boolean }): DynamicModule {
    if (!options.enabled) {
      return { module: BullBoardModule };
    }

    return {
      module: BullBoardModule,
      imports: [
        QueueModule,
        BullBoardNestModule.forRootAsync({
          imports: [AuthModule],
          inject: [ConfigService, JWKS, JWT_ISSUER],
          useFactory: (
            config: ConfigService<Env, true>,
            jwks: JWTVerifyGetKey,
            issuer: string,
          ) => ({
            route: `/${ROUTE}`,
            adapter: ExpressAdapter,
            middleware: createBullBoardGate({ config, jwks, issuer }),
          }),
        }),
        BullBoardNestModule.forFeature(
          { name: QUEUES.WEBHOOKS, adapter: BullMQAdapter },
          { name: QUEUES.AI_CLASSIFY, adapter: BullMQAdapter },
        ),
      ],
    };
  }
}
