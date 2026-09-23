import { INestApplication, ValidationPipe } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';

import { validationExceptionFactory } from '../../src/common/validation-exception.factory';

/**
 * Boots a compiled `TestingModule` into a running `INestApplication` with the same `rawBody`
 * option and global `ValidationPipe` `apps/api/src/main.ts` itself applies (TDD §7.5) — the only
 * difference from `main.ts`'s own `bootstrap()` is the parts that only matter to a real
 * listening process (`helmet`, CORS, Swagger, `PORT`), which no e2e suite needs.
 *
 * Previously duplicated verbatim across `health.e2e-spec.ts`, `boards.e2e-spec.ts`,
 * `posts.e2e-spec.ts` and `orgs.e2e-spec.ts` (§7.1) — the same drift `close-test-app.ts` already
 * prevents on the shutdown side of these same suites. `auth.e2e-spec.ts` is not a caller: it
 * validates no DTO and needs neither `rawBody` nor the `ValidationPipe`, so folding it into this
 * helper would be adding a parameter to special-case the one suite that does not need any of
 * this, not removing duplication.
 */
export async function bootstrapTestApp(moduleRef: TestingModule): Promise<INestApplication> {
  const app = moduleRef.createNestApplication({ rawBody: true });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: validationExceptionFactory,
    }),
  );
  await app.init();
  return app;
}
