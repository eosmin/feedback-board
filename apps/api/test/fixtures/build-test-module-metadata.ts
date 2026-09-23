import { APP_FILTER } from '@nestjs/core';
import type { ModuleMetadata } from '@nestjs/common';
import { DatabaseModule, LoggerModule } from '@feedback-board/core';

import { AllExceptionsFilter } from '../../src/common/filters/all-exceptions.filter';
import { ConfigModule } from '../../src/config/config.module';

/**
 * The `imports`/`providers` base every hand-assembled `Test.createTestingModule` tree in this
 * suite needs — `ConfigModule`, `LoggerModule.register()` (TDD §2.6.16), `DatabaseModule.forRoot()`
 * and the `AllExceptionsFilter` that reduces every guard's thrown exception to its machine code
 * (§7.8). Suites that import the full `AppModule` (`boards.e2e-spec.ts`, `posts.e2e-spec.ts`)
 * get all of this for free and never call this function; suites that assemble a minimal module
 * tree around one test-only controller (`auth.e2e-spec.ts`, `orgs.e2e-spec.ts`) previously
 * duplicated this exact block — the same drift `close-test-app.ts` and `require-env.ts` already
 * prevent elsewhere in this directory (§7.1).
 *
 * Returns metadata, not a compiled module: callers still add their own `controllers` and merge
 * their own `imports` (`AuthModule`, `OrgsModule`, ...) before calling `Test.createTestingModule`
 * themselves — a partial `ModuleMetadata` composes with `Array.prototype.push`/spread the same
 * way NestJS's own testing module builder expects, without this fixture reaching into `.compile()`
 * on the caller's behalf.
 */
export function buildTestModuleMetadata(): Required<Pick<ModuleMetadata, 'imports' | 'providers'>> {
  return {
    imports: [
      ConfigModule,
      // register() — not a hand-built pinoHttp.redact array — keeps the redact list defined
      // exactly once, in packages/core (§2.6.16). Without it, request logs in this suite would
      // print the raw Authorization header, i.e. a real bearer token, straight to stdout.
      LoggerModule.register({ isProduction: false }),
      DatabaseModule.forRoot({
        databaseUrl: process.env.DATABASE_URL ?? '',
        adminDatabaseUrl: process.env.ADMIN_DATABASE_URL ?? '',
      }),
    ],
    providers: [{ provide: APP_FILTER, useClass: AllExceptionsFilter }],
  };
}
