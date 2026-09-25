import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import request from 'supertest';
import type { Redis } from 'ioredis';

import { signInAs } from '../fixtures/sign-in';

const SIGN_IN_TEST_TIMEOUT_MS = 20_000;

/**
 * `AppModule` reads `BULL_BOARD_ENABLED` once, eagerly, at module-load time — proving both the
 * "flag off" and "flag on" shapes needs a fresh module registry per state:
 * `jest.resetModules()` plus a dynamic `import()` of `AppModule` after mutating `process.env`.
 *
 * Everything that must share identity with the freshly imported `AppModule` — `Test`, the
 * `REDIS_CONNECTION` symbol — is imported dynamically here, after `resetModules()`, never
 * statically at the top of the file: a static import resolves against the *old* module
 * registry, so its classes/symbols are distinct from the ones the freshly re-evaluated
 * `AppModule` tree registers, and Nest's DI matches by identity, not by name.
 *
 * This suite keeps its own boot/close sequence instead of `test/fixtures/bootstrap-test-app.ts`/
 * `close-test-app.ts`: the former deliberately skips mounting Swagger (no other suite asserts on
 * `/docs`, this one does — TDD §11, §13 step 15), and the latter imports `REDIS_CONNECTION`
 * statically, which is wrong for the one suite in this directory that resets modules.
 *
 * The `.js` suffix on relative dynamic imports is required by `"module": "nodenext"`
 * (tsconfig.base.json) and resolvable under Jest via `jest.config.ts`'s `moduleNameMapper`
 * strip-`.js` rule (the same fix `apps/worker/jest.config.ts` documents).
 */
async function bootAppWithBullBoard(
  enabled: boolean,
): Promise<{ app: INestApplication; closeApp: () => Promise<void> }> {
  jest.resetModules();
  process.env.BULL_BOARD_ENABLED = String(enabled);

  const { Test } = await import('@nestjs/testing');
  const { AppModule } = (await import('../../src/app.module.js')) as {
    AppModule: new () => object;
  };
  const { REDIS_CONNECTION } = await import('../../src/queue/redis.connection.js');

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication({ rawBody: true });

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder().setTitle('FeedbackBoard API').setVersion('0.0.0').addBearerAuth().build(),
  );
  SwaggerModule.setup('docs', app, document);

  await app.init();

  const closeApp = async (): Promise<void> => {
    const redis = app.get<Redis>(REDIS_CONNECTION);
    redis.disconnect();
    await app.close();
  };

  return { app, closeApp };
}

describe('bull board (e2e)', () => {
  const originalFlag = process.env.BULL_BOARD_ENABLED;
  const originalAllowlist = process.env.BULL_BOARD_ADMIN_EMAILS;

  afterEach(() => {
    if (originalFlag === undefined) {
      delete process.env.BULL_BOARD_ENABLED;
    } else {
      process.env.BULL_BOARD_ENABLED = originalFlag;
    }
    if (originalAllowlist === undefined) {
      delete process.env.BULL_BOARD_ADMIN_EMAILS;
    } else {
      process.env.BULL_BOARD_ADMIN_EMAILS = originalAllowlist;
    }
  });

  it('answers 404 for /admin/queues when BULL_BOARD_ENABLED is not exactly "true"', async () => {
    const { app, closeApp } = await bootAppWithBullBoard(false);

    try {
      const response = await request(app.getHttpServer()).get('/admin/queues');
      expect(response.status).toBe(404);
    } finally {
      await closeApp();
    }
  });

  it(
    'answers 401/403/200 for /admin/queues once BULL_BOARD_ENABLED is "true", per allowlisted email',
    async () => {
      const allowedEmail = 'bull-board-e2e-allowed@example.com';
      process.env.BULL_BOARD_ADMIN_EMAILS = allowedEmail;
      const { app, closeApp } = await bootAppWithBullBoard(true);

      try {
        const unauthenticated = await request(app.getHttpServer()).get('/admin/queues');
        expect(unauthenticated.status).toBe(401);

        const strangerToken = await signInAs('bull-board-e2e-stranger@example.com');
        const forbidden = await request(app.getHttpServer())
          .get('/admin/queues')
          .set('Authorization', `Bearer ${strangerToken}`);
        expect(forbidden.status).toBe(403);

        const allowedToken = await signInAs(allowedEmail);
        const allowed = await request(app.getHttpServer())
          .get('/admin/queues')
          .set('Authorization', `Bearer ${allowedToken}`);
        expect(allowed.status).toBe(200);
      } finally {
        await closeApp();
      }
    },
    SIGN_IN_TEST_TIMEOUT_MS * 2,
  );

  it('answers /docs without a token — mounted outside the guard pipeline, not one of the four @Public() routes', async () => {
    const { app, closeApp } = await bootAppWithBullBoard(false);

    try {
      const response = await request(app.getHttpServer()).get('/docs');
      expect(response.status).toBe(200);
    } finally {
      await closeApp();
    }
  });
});
