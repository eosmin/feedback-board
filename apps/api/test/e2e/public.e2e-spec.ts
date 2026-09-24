import { randomUUID } from 'node:crypto';

import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '@feedback-board/core';
import request from 'supertest';

import { AppModule } from '../../src/app.module';
import { bootstrapTestApp } from '../fixtures/bootstrap-test-app';
import { closeTestApp } from '../fixtures/close-test-app';

// A real, persistent Supabase Postgres with no reset between runs, so every slug is unique per
// run. Board slugs are deliberately identical across orgs: the cross-tenant case depends on it.
const RUN_ID = randomUUID().slice(0, 8);
const orgSlug = (name: string): string => `public-e2e-${RUN_ID}-${name}`;
const PUBLIC_BOARD = 'roadmap';
const PRIVATE_BOARD = 'internal';
const B_ONLY_BOARD = `b-only-${RUN_ID}`;

/**
 * Every request here is anonymous: no `Authorization` header anywhere. Fixtures are seeded
 * through the admin client resolved from the app's own container, the same way
 * `rls.e2e-spec.ts` seeds — there is no product path an anonymous visitor could use to create
 * them, and signing in would only slow the suite without exercising anything under test.
 */
describe('public boards (e2e)', () => {
  let app: INestApplication;
  let admin: PrismaService;

  const orgA = { slug: orgSlug('a'), id: '' };
  const orgB = { slug: orgSlug('b'), id: '' };
  let publicPostId = '';

  async function seedOrg(slug: string): Promise<string> {
    const org = await admin.client.org.create({ data: { name: `Public ${slug}`, slug } });
    return org.id;
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = await bootstrapTestApp(moduleRef);
    admin = app.get(PrismaService);

    orgA.id = await seedOrg(orgA.slug);
    orgB.id = await seedOrg(orgB.slug);

    // User.id has no default: it normally mirrors auth.users via the trigger (§2.6.5).
    const author = await admin.client.user.create({
      data: { id: randomUUID(), email: `public-e2e-${RUN_ID}@example.com` },
    });

    const publicBoard = await admin.client.board.create({
      data: { orgId: orgA.id, name: 'Roadmap', slug: PUBLIC_BOARD, isPublic: true },
    });
    const privateBoard = await admin.client.board.create({
      data: { orgId: orgA.id, name: 'Internal', slug: PRIVATE_BOARD, isPublic: false },
    });
    await admin.client.board.create({
      data: { orgId: orgB.id, name: 'Org B Roadmap', slug: PUBLIC_BOARD, isPublic: true },
    });
    const bOnlyBoard = await admin.client.board.create({
      data: { orgId: orgB.id, name: 'Org B Only', slug: B_ONLY_BOARD, isPublic: true },
    });

    const publicPost = await admin.client.post.create({
      data: {
        orgId: orgA.id,
        boardId: publicBoard.id,
        authorId: author.id,
        title: 'Dark mode',
        body: 'Please add dark mode',
      },
    });
    publicPostId = publicPost.id;

    await admin.client.post.create({
      data: {
        orgId: orgA.id,
        boardId: privateBoard.id,
        authorId: author.id,
        title: 'Private roadmap item',
        body: 'Must never reach an anonymous visitor',
      },
    });
    await admin.client.post.create({
      data: {
        orgId: orgB.id,
        boardId: bOnlyBoard.id,
        authorId: author.id,
        title: 'Org B post',
        body: 'Belongs to org B only',
      },
    });
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  it('serves public board metadata without a token and without the org id', async () => {
    const response = await request(app.getHttpServer()).get(`/public/${orgA.slug}/${PUBLIC_BOARD}`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ name: 'Roadmap', slug: PUBLIC_BOARD, isPublic: true });
    expect(response.body).not.toHaveProperty('orgId');
  });

  it('serves the public post list without a token, and without author or org ids', async () => {
    const response = await request(app.getHttpServer()).get(
      `/public/${orgA.slug}/${PUBLIC_BOARD}/posts`,
    );

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0]).toMatchObject({ id: publicPostId, title: 'Dark mode' });
    expect(response.body[0]).not.toHaveProperty('authorId');
    expect(response.body[0]).not.toHaveProperty('orgId');
  });

  it('404s a board with isPublic: false, and its post list, with the bare NOT_FOUND code', async () => {
    const metadata = await request(app.getHttpServer()).get(
      `/public/${orgA.slug}/${PRIVATE_BOARD}`,
    );
    const posts = await request(app.getHttpServer()).get(
      `/public/${orgA.slug}/${PRIVATE_BOARD}/posts`,
    );

    expect(metadata.status).toBe(404);
    expect(metadata.body).toEqual({ error: 'NOT_FOUND' });
    expect(posts.status).toBe(404);
    expect(posts.body).toEqual({ error: 'NOT_FOUND' });
  });

  it('answers a private board, an unknown board and an unknown org identically, so none leaks existence', async () => {
    const server = app.getHttpServer();
    const privateBoard = await request(server).get(`/public/${orgA.slug}/${PRIVATE_BOARD}`);
    const unknownBoard = await request(server).get(`/public/${orgA.slug}/no-such-board-${RUN_ID}`);
    const unknownOrg = await request(server).get(`/public/no-such-org-${RUN_ID}/${PUBLIC_BOARD}`);

    for (const response of [privateBoard, unknownBoard, unknownOrg]) {
      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'NOT_FOUND' });
    }
  });

  it("cross-tenant: org A's slug never reaches a board that exists only in org B", async () => {
    const metadata = await request(app.getHttpServer()).get(`/public/${orgA.slug}/${B_ONLY_BOARD}`);
    const posts = await request(app.getHttpServer()).get(
      `/public/${orgA.slug}/${B_ONLY_BOARD}/posts`,
    );

    expect(metadata.status).toBe(404);
    expect(metadata.body).toEqual({ error: 'NOT_FOUND' });
    expect(posts.status).toBe(404);
  });

  it("cross-tenant: the same board slug in two orgs returns only the addressed org's board", async () => {
    const fromA = await request(app.getHttpServer()).get(`/public/${orgA.slug}/${PUBLIC_BOARD}`);
    const fromB = await request(app.getHttpServer()).get(`/public/${orgB.slug}/${PUBLIC_BOARD}`);

    expect(fromA.body).toMatchObject({ name: 'Roadmap' });
    expect(fromB.body).toMatchObject({ name: 'Org B Roadmap' });

    const postsFromB = await request(app.getHttpServer()).get(
      `/public/${orgB.slug}/${PUBLIC_BOARD}/posts`,
    );
    expect(postsFromB.status).toBe(200);
    expect(postsFromB.body).toEqual([]);
  });

  it('exposes no write path: POST to either public route is not routed', async () => {
    const server = app.getHttpServer();
    const onBoard = await request(server).post(`/public/${orgA.slug}/${PUBLIC_BOARD}`).send({});
    const onPosts = await request(server)
      .post(`/public/${orgA.slug}/${PUBLIC_BOARD}/posts`)
      .send({ title: 'Injected', body: 'Injected' });

    expect(onBoard.status).toBe(404);
    expect(onPosts.status).toBe(404);
  });
});
