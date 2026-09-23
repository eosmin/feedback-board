import { randomUUID } from 'node:crypto';

import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../../src/app.module';
import { bootstrapTestApp } from '../fixtures/bootstrap-test-app';
import { closeTestApp } from '../fixtures/close-test-app';
import { signInAs } from '../fixtures/sign-in';

// signInAs polls the local Mailpit mailbox for up to 15s — see orgs.e2e-spec.ts's own note.
const SIGN_IN_TEST_TIMEOUT_MS = 20_000;

// Same rationale as orgs.e2e-spec.ts: a real, persistent Supabase Postgres with no reset
// between runs, so slugs must be unique per run, not per test file.
const RUN_ID = randomUUID().slice(0, 8);
const orgSlug = (name: string): string => `boards-e2e-${RUN_ID}-${name}`;
const boardSlug = (name: string): string => `board-${RUN_ID}-${name}`;
const email = (name: string): string => `boards-e2e-${RUN_ID}-${name}@example.com`;

describe('boards (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = await bootstrapTestApp(moduleRef);
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  /** Creates an org and returns its slug plus the OWNER token that created it. */
  async function createOrg(name: string): Promise<{ token: string; slug: string }> {
    const token = await signInAs(email(name));
    const slug = orgSlug(name);

    const response = await request(app.getHttpServer())
      .post('/orgs')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `Boards ${name}`, slug });

    if (response.status !== 201) {
      throw new Error(`boards e2e: org creation failed: ${JSON.stringify(response.body)}`);
    }

    return { token, slug };
  }

  it(
    'creates a board and lists it back',
    async () => {
      const { token, slug } = await createOrg('create');
      const slugValue = boardSlug('create');

      const createResponse = await request(app.getHttpServer())
        .post(`/orgs/${slug}/boards`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Roadmap', slug: slugValue });

      expect(createResponse.status).toBe(201);
      expect(createResponse.body).toMatchObject({
        name: 'Roadmap',
        slug: slugValue,
        isPublic: true,
      });

      const listResponse = await request(app.getHttpServer())
        .get(`/orgs/${slug}/boards`)
        .set('Authorization', `Bearer ${token}`);

      expect(listResponse.status).toBe(200);
      expect(listResponse.body).toContainEqual(expect.objectContaining({ slug: slugValue }));
    },
    SIGN_IN_TEST_TIMEOUT_MS,
  );

  it(
    'returns board detail with metadata and its post count',
    async () => {
      const { token, slug } = await createOrg('detail');
      const slugValue = boardSlug('detail');

      await request(app.getHttpServer())
        .post(`/orgs/${slug}/boards`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Detail Board', slug: slugValue });

      const response = await request(app.getHttpServer())
        .get(`/orgs/${slug}/boards/${slugValue}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        slug: slugValue,
        name: 'Detail Board',
        postCount: 0,
      });
    },
    SIGN_IN_TEST_TIMEOUT_MS,
  );

  it(
    // Now safe to un-skip (Step 11): PlanGuard.countExisting('boards') runs tx.board.count()
    // with no orgId filter by design (TDD §3.3), and until this step's RLS policy was live,
    // that count was global across every org in this shared, persistent database. With
    // DATABASE_URL pointed at feedbackboard_app and the boards RLS policy enforced, the count
    // now runs under app.org_id and only ever sees the caller's own org.
    'refuses a FREE org its 2nd board with the PLAN_LIMIT body',
    async () => {
      const { token, slug } = await createOrg('cap');

      const firstResponse = await request(app.getHttpServer())
        .post(`/orgs/${slug}/boards`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'First Board', slug: boardSlug('cap-first') });

      expect(firstResponse.status).toBe(201);

      const secondResponse = await request(app.getHttpServer())
        .post(`/orgs/${slug}/boards`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Second Board', slug: boardSlug('cap-second') });

      expect(secondResponse.status).toBe(403);
      expect(secondResponse.body).toEqual({
        error: 'PLAN_LIMIT',
        limit: 'boards',
        plan: 'FREE',
        cap: 1,
      });
    },
    SIGN_IN_TEST_TIMEOUT_MS,
  );

  it(
    'refuses a MEMBER creating a board — OWNER/ADMIN only',
    async () => {
      const { token: ownerToken, slug } = await createOrg('rbac');
      const memberToken = await signInAs(email('rbac-member'));

      // No product path creates a MEMBER (TDD §18) — a non-member's token simply fails the
      // membership lookup in OrgGuard, which is the same 403 FORBIDDEN a wrongly-roled MEMBER
      // would get from RolesGuard; the seeded-MEMBER-vs-OWNER-route case against a real
      // Membership row already lives in orgs.e2e-spec.ts.
      const response = await request(app.getHttpServer())
        .post(`/orgs/${slug}/boards`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ name: 'Unauthorized', slug: boardSlug('rbac-unauthorized') });

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ error: 'FORBIDDEN' });

      // Sanity check the same route works for the actual OWNER, so the 403 above proves RBAC
      // rather than a broken route.
      const ownerResponse = await request(app.getHttpServer())
        .post(`/orgs/${slug}/boards`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ name: 'Owner Board', slug: boardSlug('rbac-owner') });

      expect(ownerResponse.status).toBe(201);
    },
    SIGN_IN_TEST_TIMEOUT_MS,
  );
});
