import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiService, buildAiTransportConfig } from '@feedback-board/core';
import type { AiServiceOptions } from '@feedback-board/core';

import { OrgsModule } from '../orgs/orgs.module';
import type { Env } from '../config/env.schema';
import { BoardsController } from './boards.controller';
import { BoardsService } from './boards.service';

/**
 * `TenantPrismaService` is not re-provided here: `OrgsModule` already registers it and exports
 * the guard chain (`OrgGuard`, `RolesGuard`, `PlanGuard`, `OrgRateLimitGuard`) this controller
 * depends on (TDD §7.1) — importing `OrgsModule` reuses those singletons rather than
 * constructing a second set of guards bound to a second `TenantPrismaService` instance.
 *
 * `AiService` is provided with a `useFactory`/`inject: [ConfigService]`, not
 * `AiModule.register()` — the same shape `BillingModule` already uses for `STRIPE_CLIENT`
 * (TDD §7.1). `register()` takes a literal `AiServiceOptions` object at module-decoration time,
 * which would force this module to call `validateEnv(process.env)` at file-load time the way
 * `AppModule`/`WorkerModule` do for their own root-level registration — fine for a module that
 * IS the app root, but it would make `boards.module.spec.ts` depend on every var this app's
 * schema requires (Stripe keys, Supabase URL, ...) just to compile a boards-only test tree. A
 * `ConfigService`-injected factory needs only the five `AI_*` keys this module actually reads,
 * resolved through Nest's normal DI the same way `STRIPE_CLIENT`'s factory is.
 *
 * `buildAiTransportConfig` (`packages/core`) builds the `AI_CUSTOM_*` half of
 * `AiServiceOptions` — `apps/worker/src/worker.module.ts` needs the identical translation from
 * its own env, so it is written once in the package both apps depend on, not copy-pasted here
 * (§7.1). `classifyModel` is set to `AI_DIGEST_MODEL` as an unused placeholder (TDD §3.8's
 * second flow): this process only ever calls `generateDigest()`, the mirror image of
 * `apps/worker` never calling it.
 */
@Module({
  imports: [OrgsModule],
  controllers: [BoardsController],
  providers: [
    BoardsService,
    {
      provide: AiService,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>): AiService => {
        const digestModel = config.get('AI_DIGEST_MODEL', { infer: true });
        const options: AiServiceOptions = {
          classifyModel: digestModel,
          digestModel,
          transport: buildAiTransportConfig({
            AI_CUSTOM_BASE_URL: config.get('AI_CUSTOM_BASE_URL', { infer: true }),
            AI_CUSTOM_API_KEY: config.get('AI_CUSTOM_API_KEY', { infer: true }),
            AI_CUSTOM_PROVIDER_NAME: config.get('AI_CUSTOM_PROVIDER_NAME', { infer: true }),
            AI_CUSTOM_SUPPORTS_STRUCTURED_OUTPUTS: config.get(
              'AI_CUSTOM_SUPPORTS_STRUCTURED_OUTPUTS',
              { infer: true },
            ),
          }),
        };
        return new AiService(options);
      },
    },
  ],
})
export class BoardsModule {}
