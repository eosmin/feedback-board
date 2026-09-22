import { randomUUID } from 'node:crypto';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../../src/app.module';
import { validationExceptionFactory } from '../../src/common/validation-exception.factory';
import { closeTestApp } from '../fixtures/close-test-app';
import { signInAs } from '../fixtures/sign-in';

// signInAs polls the local Mailpit mailbox for up to 15s — see orgs.e2e-spec.ts's own note.
const SIGN_IN_TEST_TIMEOUT_MS = 20_000;

// Same rationale as boards.e2e-spec.ts: a real, persistent Supabase Postgres with no reset
// between runs, so slugs/emails must be unique per run, not per test file.
const RUN_ID = randomUUID().slice(0, 8);
const orgSlug = (name: string): string => `posts-e2e-${RUN_ID}-${name}`;
const boardSlug = (name: string): string => `board-${RUN_ID}-${name}`;
const email = (name: string): string => `posts-e2e-${RUN_ID}-${name}@example.com`;

/**
 * KNOWN GAP, closes in Step 11 — same underlying cause as `boards.e2e-spec.ts`'s own note, but
 * confirmed here to be a **guaranteed** collision, not merely a possible one, so every test in
 * this file is skipped, including the single happy-path test `boards.e2e-spec.ts` gets to keep
 * unskipped. Do not delete this note when un-skipping the tests below.
 *
 * `PlanGuard.countExisting('boards')` (apps/api/src/orgs/guards/plan.guard.ts) runs
 * `tx.board.count()` with **no** `where: { orgId }` clause, by design (TDD §3.3): the cap is
 * meant to be made tenant-safe by RLS alone. Until Step 11 repoints `DATABASE_URL` at the
 * `feedbackboard_app` role and the `boards` RLS policy is live, that count is global across
 * every org in this shared, persistent database.
 *
 * `apps/api`'s `test:e2e` script now runs `jest --config jest.e2e.config.ts` (this step), whose
 * own `testMatch` is scoped to `test/e2e/**` — that split is what makes a trailing
 * `pnpm --filter api test:e2e -- posts` behave as Jest's documented single-argument filter
 * (`jest posts`) instead of being OR-combined with a directory-wide `--testPathPatterns` flag,
 * which is what an earlier revision of this file's own note (and this file's own earlier
 * behaviour) described. That fixes filtering; it does **not** fix isolation: running
 * `pnpm --filter api test:e2e` with no argument at all — which is what `api.yml` (TDD §15) and
 * any full local run do — still executes every `*.e2e-spec.ts` under `test/e2e` in the same
 * Jest process, against the same database. `posts.e2e-spec.ts` and `boards.e2e-spec.ts` are
 * both matched by that unfiltered run, so the global board-count gap below is still live
 * whenever the whole suite runs together. Since `boards.e2e-spec.ts` (Step 9.1) already keeps
 * one board-creating test unskipped, this file creating a second one would be a guaranteed
 * double-booking of the same global slot in that shared run, not a rare race: whichever
 * suite's board-creating test runs second always sees the cap already exhausted.
 *
 * Re-enable these tests (delete `.skip`) as part of Step 11's own Done-when, once
 * `DATABASE_URL` points at `feedbackboard_app` and the RLS policies are live — they should pass
 * unmodified at that point, because `PlanGuard`'s queries do not change; only what they are
 * allowed to see does.
 */
describe('posts (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

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

  /** Creates an org, a board in it, and returns both slugs plus the OWNER token. */
  async function createOrgWithBoard(
    name: string,
  ): Promise<{ token: string; orgSlugValue: string; boardSlugValue: string }> {
    const token = await signInAs(email(name));
    const orgSlugValue = orgSlug(name);
    const boardSlugValue = boardSlug(name);

    const orgResponse = await request(app.getHttpServer())
      .post('/orgs')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `Posts ${name}`, slug: orgSlugValue });

    if (orgResponse.status !== 201) {
      throw new Error(`posts e2e: org creation failed: ${JSON.stringify(orgResponse.body)}`);
    }

    const boardResponse = await request(app.getHttpServer())
      .post(`/orgs/${orgSlugValue}/boards`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Roadmap', slug: boardSlugValue });

    if (boardResponse.status !== 201) {
      throw new Error(`posts e2e: board creation failed: ${JSON.stringify(boardResponse.body)}`);
    }

    return { token, orgSlugValue, boardSlugValue };
  }

  it.skip(
    'creates a post and lists it back with a null aiCategory/aiPriority',
    async () => {
      const { token, orgSlugValue, boardSlugValue } = await createOrgWithBoard('create');

      const createResponse = await request(app.getHttpServer())
        .post(`/orgs/${orgSlugValue}/boards/${boardSlugValue}/posts`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Add dark mode', body: 'Please add a dark theme' });

      expect(createResponse.status).toBe(201);
      expect(createResponse.body).toMatchObject({
        title: 'Add dark mode',
        body: 'Please add a dark theme',
        status: 'OPEN',
        voteCount: 0,
        aiCategory: null,
        aiPriority: null,
      });

      const listResponse = await request(app.getHttpServer())
        .get(`/orgs/${orgSlugValue}/boards/${boardSlugValue}/posts`)
        .set('Authorization', `Bearer ${token}`);

      expect(listResponse.status).toBe(200);
      expect(listResponse.body).toContainEqual(
        expect.objectContaining({ id: createResponse.body.id }),
      );
    },
    SIGN_IN_TEST_TIMEOUT_MS,
  );

  it.skip(
    'returns single post detail',
    async () => {
      const { token, orgSlugValue, boardSlugValue } = await createOrgWithBoard('detail');

      const createResponse = await request(app.getHttpServer())
        .post(`/orgs/${orgSlugValue}/boards/${boardSlugValue}/posts`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Detail post', body: 'Some body text' });

      const postId = createResponse.body.id as string;

      const response = await request(app.getHttpServer())
        .get(`/orgs/${orgSlugValue}/posts/${postId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ id: postId, title: 'Detail post' });
    },
    SIGN_IN_TEST_TIMEOUT_MS,
  );

  it.skip(
    'lets OWNER/ADMIN change a post status',
    async () => {
      const { token, orgSlugValue, boardSlugValue } = await createOrgWithBoard('status');

      const createResponse = await request(app.getHttpServer())
        .post(`/orgs/${orgSlugValue}/boards/${boardSlugValue}/posts`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Status post', body: 'Some body text' });

      const postId = createResponse.body.id as string;

      const response = await request(app.getHttpServer())
        .patch(`/orgs/${orgSlugValue}/posts/${postId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'PLANNED' });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ id: postId, status: 'PLANNED' });
    },
    SIGN_IN_TEST_TIMEOUT_MS,
  );

  it.skip('refuses a FREE org its 51st post with the PLAN_LIMIT body', async () => {
    const { token, orgSlugValue, boardSlugValue } = await createOrgWithBoard('cap');

    for (let index = 0; index < 50; index += 1) {
      const response = await request(app.getHttpServer())
        .post(`/orgs/${orgSlugValue}/boards/${boardSlugValue}/posts`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: `Post number ${index}`, body: 'Body text' });

      if (response.status !== 201) {
        throw new Error(
          `posts e2e: expected post ${index} to succeed, got ${response.status}: ${JSON.stringify(response.body)}`,
        );
      }
    }

    const fiftyFirstResponse = await request(app.getHttpServer())
      .post(`/orgs/${orgSlugValue}/boards/${boardSlugValue}/posts`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Post number 51', body: 'Body text' });

    expect(fiftyFirstResponse.status).toBe(403);
    expect(fiftyFirstResponse.body).toEqual({
      error: 'PLAN_LIMIT',
      limit: 'posts',
      plan: 'FREE',
      cap: 50,
    });
  }, 60_000);
});
