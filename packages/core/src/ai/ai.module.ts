import { DynamicModule, Module } from '@nestjs/common';

import { AiService } from './ai.service';
import type { AiServiceOptions } from './ai.service';

/**
 * A single dynamic registration rather than a `forRoot`/`forTenant` split like
 * `DatabaseModule` — both `apps/api` (digest) and `apps/worker` (classification) construct
 * `AiService` with their own env-derived options and need nothing else from this module (TDD
 * §3.8, §3.10). Not `global: true`: unlike the database connections, `AiService` holds no shared
 * resource (no client object, no connection pool — TDD §2.6.8a) that would be wasteful to
 * construct twice, so each importing module gets its own instance, which is also easier to test.
 */
@Module({})
export class AiModule {
  static register(options: AiServiceOptions): DynamicModule {
    return {
      module: AiModule,
      providers: [{ provide: AiService, useValue: new AiService(options) }],
      exports: [AiService],
    };
  }
}
