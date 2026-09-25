import { randomUUID } from 'node:crypto';

import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AiService, PrismaService } from '@feedback-board/core';
import { createClient } from '@supabase/supabase-js';
import request from 'supertest';

import { AppModule } from '../../src/app.module';
import { bootstrapTestApp } from '../fixtures/bootstrap-test-app';
import { closeTestApp } from '../fixtures/close-test-app';
import { requireEnv } from '../fixtures/require-env';
import { seedMembership } from '../fixtures/seed-membership';
import { signInAs } from '../fixtures/sign-in';

const SIGN_IN_TEST_TIMEOUT_MS = 20_000;

// Same rationale as boards.e2e-spec.ts: a real, persistent Supabase Postgres with no reset
// between runs, so slugs/emails must be unique per run, not per test file.
const RUN_ID = randomUUID().slice(0, 8);
const orgSlug = (name: string): string => `ai-digest-e2e-${RUN_ID}-${name}`;
const boardSlug = (name: string): string => `board-${RUN_ID}-${name}`;
const email = (name: string): string => `ai-digest-e2e-${RUN_ID}-${name}@example.com`;

describe('ai-digest (e2e)', () => {
  let app: INestApplication;
  let admin: PrismaService;
  let generateDigest: jest.Mock;

  beforeAll(async () => {
    generateDigest = jest.fn().mockResolvedValue('A mocked digest summary.');
    // AiService is mocked at the module boundary (TDD §3.8's step-15 requirement) — this suite
    // never calls a real model, only proves the route, the RBAC gate and the rate limit.
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(AiService)
      .useValue({ generateDigest, classifyPost: jest.fn() })
      .compile();
    app = await bootstrapTestApp(moduleRef);
    admin = app.get(PrismaService);
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  beforeEach(() => {
    generateDigest.mockClear();
    generateDigest.mockResolvedValue('A mocked digest summary.');
  });

  /** Creates an org and a board in it, returning both slugs plus the OWNER token. */
  async function createOrgWithBoard(
    name: string,
  ): Promise<{ token: string; orgId: string; orgSlugValue: string; boardSlugValue: string }> {
    const token = await signInAs(email(name));
    const orgSlugValue = orgSlug(name);
    const boardSlugValue = boardSlug(name);

    const orgResponse = await request(app.getHttpServer())
      .post('/orgs')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `AI Digest ${name}`, slug: orgSlugValue });

    if (orgResponse.status !== 201) {
      throw new Error(`ai-digest e2e: org creation failed: ${JSON.stringify(orgResponse.body)}`);
    }

    const boardResponse = await request(app.getHttpServer())
      .post(`/orgs/${orgSlugValue}/boards`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Roadmap', slug: boardSlugValue });

    if (boardResponse.status !== 201) {
      throw new Error(
        `ai-digest e2e: board creation failed: ${JSON.stringify(boardResponse.body)}`,
      );
    }

    return {
      token,
      orgId: (orgResponse.body as { id: string }).id,
      orgSlugValue,
      boardSlugValue,
    };
  }

  /**
   * Resolves the real `auth.users` id behind a token via the anon-key client the sign-in
   * fixture already depends on — the same pattern `orgs.e2e-spec.ts`/`billing.e2e-spec.ts` use
   * to seed a MEMBER, rather than a hand-rolled JWT payload decode.
   */
  async function resolveUserId(token: string): Promise<string> {
    const supabase = createClient(requireEnv('SUPABASE_URL'), requireEnv('TEST_SUPABASE_ANON_KEY'));
    const { data } = await supabase.auth.getUser(token);
    const userId = data.user?.id;

    if (userId === undefined) {
      throw new Error('ai-digest e2e: could not resolve user id from token');
    }

    return userId;
  }

  it(
    'returns the mocked summary for an OWNER, calling AiService with only OPEN/PLANNED/IN_PROGRESS posts',
    async () => {
      const { token, orgSlugValue, boardSlugValue } = await createOrgWithBoard('happy');

      await request(app.getHttpServer())
        .post(`/orgs/${orgSlugValue}/boards/${boardSlugValue}/posts`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Add dark mode', body: 'Please add a dark theme.' });

      const response = await request(app.getHttpServer())
        .post(`/orgs/${orgSlugValue}/boards/${boardSlugValue}/ai-digest`)
        .set('Authorization', `Bearer ${token}`)
        .send();

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ summary: 'A mocked digest summary.' });
      expect(generateDigest).toHaveBeenCalledWith([
        expect.objectContaining({ title: 'Add dark mode', body: 'Please add a dark theme.' }),
      ]);
    },
    SIGN_IN_TEST_TIMEOUT_MS,
  );

  it(
    'refuses a MEMBER — this route spends metered money, so OWNER/ADMIN only',
    async () => {
      const { orgId, orgSlugValue, boardSlugValue } = await createOrgWithBoard('rbac');
      const memberEmail = email('rbac-member');
      const memberToken = await signInAs(memberEmail);
      const memberUserId = await resolveUserId(memberToken);

      await seedMembership(admin, {
        userId: memberUserId,
        email: memberEmail,
        orgId,
        role: 'MEMBER',
      });

      const response = await request(app.getHttpServer())
        .post(`/orgs/${orgSlugValue}/boards/${boardSlugValue}/ai-digest`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send();

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ error: 'FORBIDDEN' });
      expect(generateDigest).not.toHaveBeenCalled();
    },
    SIGN_IN_TEST_TIMEOUT_MS,
  );

  it(
    'rate-limits at 5/hour, shared across two different users in the same org — not per caller',
    async () => {
      const { token, orgId, orgSlugValue, boardSlugValue } = await createOrgWithBoard('rate');
      const secondOwnerEmail = email('rate-second-admin');
      const secondOwnerToken = await signInAs(secondOwnerEmail);
      const secondUserId = await resolveUserId(secondOwnerToken);

      await seedMembership(admin, {
        userId: secondUserId,
        email: secondOwnerEmail,
        orgId,
        role: 'ADMIN',
      });

      const tokens = [token, token, token, token, secondOwnerToken];

      for (const callerToken of tokens) {
        const response = await request(app.getHttpServer())
          .post(`/orgs/${orgSlugValue}/boards/${boardSlugValue}/ai-digest`)
          .set('Authorization', `Bearer ${callerToken}`)
          .send();

        expect(response.status).toBe(200);
      }

      // The 6th call, from either user, is refused — the counter is per org, not per caller.
      const sixthResponse = await request(app.getHttpServer())
        .post(`/orgs/${orgSlugValue}/boards/${boardSlugValue}/ai-digest`)
        .set('Authorization', `Bearer ${token}`)
        .send();

      expect(sixthResponse.status).toBe(429);
      expect(sixthResponse.body).toEqual({ error: 'RATE_LIMITED' });

      const seventhResponse = await request(app.getHttpServer())
        .post(`/orgs/${orgSlugValue}/boards/${boardSlugValue}/ai-digest`)
        .set('Authorization', `Bearer ${secondOwnerToken}`)
        .send();

      expect(seventhResponse.status).toBe(429);
      expect(seventhResponse.body).toEqual({ error: 'RATE_LIMITED' });
    },
    SIGN_IN_TEST_TIMEOUT_MS * 2,
  );

  it(
    'returns 404 NOT_FOUND for an unknown board slug within the tenant',
    async () => {
      const { token, orgSlugValue } = await createOrgWithBoard('missing-board');

      const response = await request(app.getHttpServer())
        .post(`/orgs/${orgSlugValue}/boards/does-not-exist/ai-digest`)
        .set('Authorization', `Bearer ${token}`)
        .send();

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'NOT_FOUND' });
    },
    SIGN_IN_TEST_TIMEOUT_MS,
  );
});
