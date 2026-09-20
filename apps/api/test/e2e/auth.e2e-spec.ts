import { Controller, Get, INestApplication } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { DatabaseModule } from '@feedback-board/core';
import { LoggerModule } from 'nestjs-pino';
import request from 'supertest';

import { AllExceptionsFilter } from '../../src/common/filters/all-exceptions.filter';
import { ConfigModule } from '../../src/config/config.module';
import { AuthModule } from '../../src/auth/auth.module';
import { signInAs } from '../fixtures/sign-in';

/**
 * A minimal protected route, local to this test file. `AppModule` has no protected controller
 * yet at this step — every route it exposes is `@Public()` health check — so this proves the
 * real guard pipeline (real JWKS fetch, real Supabase-issued token) against something that
 * actually requires a token, without adding product code the step does not list.
 */
@Controller('__test-protected')
class TestProtectedController {
  @Get()
  get(): { status: 'ok' } {
    return { status: 'ok' };
  }
}

// signInAs polls the local Inbucket mailbox for up to 15s before giving up (sign-in.ts) — well
// past Jest's 5000ms default per-test timeout. 20s gives the poll loop room to finish before
// Jest gives up first and reports a timeout instead of the real result.
const SIGN_IN_TEST_TIMEOUT_MS = 20_000;

describe('auth (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule,
        // AllExceptionsFilter depends on nestjs-pino's Logger (TDD §7.9); AppModule registers
        // it via LoggerModule.forRootAsync, which this test module does not otherwise import.
        LoggerModule.forRoot(),
        DatabaseModule.forRoot({
          databaseUrl: process.env.DATABASE_URL ?? '',
          adminDatabaseUrl: process.env.ADMIN_DATABASE_URL ?? '',
        }),
        AuthModule,
      ],
      controllers: [TestProtectedController],
      // AllExceptionsFilter is what reduces JwtAuthGuard's UnauthorizedException to
      // { error: 'UNAUTHORIZED' } (TDD §7.8); it lives on AppModule's APP_FILTER, which this
      // module never imports, so it must be registered here too or every 401 in this file
      // would assert against Nest's own English-prose default body instead.
      providers: [{ provide: APP_FILTER, useClass: AllExceptionsFilter }],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it(
    'accepts a request bearing a real, JWKS-verifiable Supabase token',
    async () => {
      const token = await signInAs('auth-e2e@example.com');

      const response = await request(app.getHttpServer())
        .get('/__test-protected')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: 'ok' });
    },
    SIGN_IN_TEST_TIMEOUT_MS,
  );

  it('rejects a request with no Authorization header', async () => {
    const response = await request(app.getHttpServer()).get('/__test-protected');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: 'UNAUTHORIZED' });
  });

  it('rejects a malformed token', async () => {
    const response = await request(app.getHttpServer())
      .get('/__test-protected')
      .set('Authorization', 'Bearer not-a-real-token');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: 'UNAUTHORIZED' });
  });

  it('rejects an expired token', async () => {
    // A syntactically valid but expired JWT (exp in the past), signed with an arbitrary key —
    // jose rejects it at the signature-verification step before ever inspecting exp, which is
    // exactly the fail-closed behavior this guard needs: an untrusted signature is untrusted
    // regardless of which claim would have failed next.
    const expiredToken =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
      'eyJzdWIiOiJ1c2VyLTEiLCJleHAiOjF9.' +
      'invalid-signature';

    const response = await request(app.getHttpServer())
      .get('/__test-protected')
      .set('Authorization', `Bearer ${expiredToken}`);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: 'UNAUTHORIZED' });
  });
});
