import { randomUUID } from 'node:crypto';

import { Controller, Get, INestApplication, UseGuards, ValidationPipe } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { DatabaseModule, PrismaService } from '@feedback-board/core';
import { createClient } from '@supabase/supabase-js';
import { LoggerModule } from 'nestjs-pino';
import request from 'supertest';

import { AllExceptionsFilter } from '../../src/common/filters/all-exceptions.filter';
import { validationExceptionFactory } from '../../src/common/validation-exception.factory';
import { ConfigModule } from '../../src/config/config.module';
import { AuthModule } from '../../src/auth/auth.module';
import { OrgsModule } from '../../src/orgs/orgs.module';
import { OrgGuard } from '../../src/orgs/guards/org.guard';
import { RolesGuard } from '../../src/orgs/guards/roles.guard';
import { Roles } from '../../src/orgs/roles.decorator';
import { closeTestApp } from '../fixtures/close-test-app';
import { requireEnv } from '../fixtures/require-env';
import { signInAs } from '../fixtures/sign-in';
import { seedMembership } from '../fixtures/seed-membership';

// signInAs polls the local Mailpit mailbox for up to 15s (sign-in.ts); each sign-in call in
// this suite needs its own budget, well past Jest's 5000ms default.
const SIGN_IN_TEST_TIMEOUT_MS = 20_000;

// A short random suffix, not a literal per test: this suite runs against a real, persistent
// Supabase Postgres instance (no reset between runs), and org slugs are globally unique
// (@@unique on Org.slug). A fixed literal collides on a second run in the same afternoon —
// the suffix is what makes re-running this file safe rather than a one-shot fixture.
const RUN_ID = randomUUID().slice(0, 8);
const slug = (name: string): string => `orgs-e2e-${RUN_ID}-${name}`;
const email = (name: string): string => `orgs-e2e-${RUN_ID}-${name}@example.com`;

/**
 * A minimal OWNER-only route, local to this test file — mirroring auth.e2e-spec.ts's
 * TestProtectedController from Step 7. No product route in this module is OWNER-restricted yet
 * (boards/posts/webhooks land in later steps), but §8 step 8 requires proving the full
 * OrgGuard → RolesGuard chain against a real MEMBER refusal now, not once a coincidentally
 * OWNER-gated product route happens to exist.
 */
@Controller('__test-owner-only/:orgSlug')
class TestOwnerOnlyController {
  @UseGuards(OrgGuard, RolesGuard)
  @Roles('OWNER')
  @Get()
  get(): { status: 'ok' } {
    return { status: 'ok' };
  }
}

describe('orgs (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule,
        // Mirrors AppModule's redact list (TDD §16) — without it this suite's request logs
        // print the raw bearer token to the test runner's stdout.
        LoggerModule.forRoot({
          pinoHttp: {
            redact: [
              'req.headers.authorization',
              'req.headers.cookie',
              'req.headers["stripe-signature"]',
            ],
          },
        }),
        DatabaseModule.forRoot({
          databaseUrl: process.env.DATABASE_URL ?? '',
          adminDatabaseUrl: process.env.ADMIN_DATABASE_URL ?? '',
        }),
        AuthModule,
        OrgsModule,
      ],
      controllers: [TestOwnerOnlyController],
      // AllExceptionsFilter is what reduces PlanGuard/RolesGuard exceptions to their machine
      // codes (TDD §7.8); it lives on AppModule's APP_FILTER, which this module never imports.
      providers: [{ provide: APP_FILTER, useClass: AllExceptionsFilter }],
    }).compile();

    app = moduleRef.createNestApplication({ rawBody: true });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        exceptionFactory: validationExceptionFactory,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  it(
    'creates an org and bootstraps the creator as OWNER',
    async () => {
      const token = await signInAs(email('owner'));

      const response = await request(app.getHttpServer())
        .post('/orgs')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Acme Inc', slug: slug('acme') });

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        name: 'Acme Inc',
        slug: slug('acme'),
        plan: 'FREE',
        role: 'OWNER',
      });
    },
    SIGN_IN_TEST_TIMEOUT_MS,
  );

  it(
    'lists only the orgs the caller is a member of, with their own role',
    async () => {
      const token = await signInAs(email('lister'));

      await request(app.getHttpServer())
        .post('/orgs')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Lister Org', slug: slug('lister-org') });

      const response = await request(app.getHttpServer())
        .get('/orgs')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toContainEqual(
        expect.objectContaining({ slug: slug('lister-org'), role: 'OWNER' }),
      );
    },
    SIGN_IN_TEST_TIMEOUT_MS,
  );

  it(
    'rejects a reserved org slug',
    async () => {
      const token = await signInAs(email('reserved'));

      const response = await request(app.getHttpServer())
        .post('/orgs')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Dashboard', slug: 'dashboard' });

      expect(response.status).toBe(409);
      expect(response.body).toEqual({ error: 'CONFLICT' });
    },
    SIGN_IN_TEST_TIMEOUT_MS,
  );

  it(
    'returns org detail with usage vs the FREE plan caps',
    async () => {
      const token = await signInAs(email('detail'));

      await request(app.getHttpServer())
        .post('/orgs')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Detail Org', slug: slug('detail-org') });

      const response = await request(app.getHttpServer())
        .get(`/orgs/${slug('detail-org')}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        slug: slug('detail-org'),
        plan: 'FREE',
        role: 'OWNER',
        usage: {
          boards: { used: 0, cap: 1 },
          posts: { used: 0, cap: 50 },
          webhooks: { available: false },
        },
      });
    },
    SIGN_IN_TEST_TIMEOUT_MS,
  );

  it(
    'refuses a non-member of the org with 403',
    async () => {
      const ownerToken = await signInAs(email('owner2'));
      const strangerToken = await signInAs(email('stranger'));

      await request(app.getHttpServer())
        .post('/orgs')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ name: 'Private Org', slug: slug('private-org') });

      const response = await request(app.getHttpServer())
        .get(`/orgs/${slug('private-org')}`)
        .set('Authorization', `Bearer ${strangerToken}`);

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ error: 'FORBIDDEN' });
    },
    SIGN_IN_TEST_TIMEOUT_MS,
  );

  it(
    'refuses a MEMBER on an OWNER-only route — seeded via the admin client (TDD §18)',
    async () => {
      const ownerToken = await signInAs(email('owner3'));
      const memberToken = await signInAs(email('member'));

      const createResponse = await request(app.getHttpServer())
        .post('/orgs')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ name: 'RBAC Org', slug: slug('rbac-org') });

      const orgId = createResponse.body.id as string;

      // No product path creates a MEMBER (TDD §18) — resolve the member's real auth.users id
      // via the anon-key client the sign-in fixture already depends on, rather than fabricate
      // one public.users (mirrored by the auth trigger) never saw.
      const supabase = createClient(
        requireEnv('SUPABASE_URL'),
        requireEnv('TEST_SUPABASE_ANON_KEY'),
      );
      const { data } = await supabase.auth.getUser(memberToken);
      const memberUserId = data.user?.id;
      if (memberUserId === undefined) {
        throw new Error('orgs e2e: could not resolve member user id from token');
      }

      // Resolved from the same Nest container the app runs in, rather than constructed by hand
      // a second time: a second `new PrismaService(...)` opens a second pg connection pool that
      // Jest's teardown races against.
      const admin = app.get(PrismaService);

      await seedMembership(admin, {
        userId: memberUserId,
        email: email('member'),
        orgId,
        role: 'MEMBER',
      });

      const ownerResponse = await request(app.getHttpServer())
        .get(`/__test-owner-only/${slug('rbac-org')}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      const memberResponse = await request(app.getHttpServer())
        .get(`/__test-owner-only/${slug('rbac-org')}`)
        .set('Authorization', `Bearer ${memberToken}`);

      expect(ownerResponse.status).toBe(200);
      expect(ownerResponse.body).toEqual({ status: 'ok' });
      expect(memberResponse.status).toBe(403);
      expect(memberResponse.body).toEqual({ error: 'FORBIDDEN' });
    },
    SIGN_IN_TEST_TIMEOUT_MS,
  );
});
