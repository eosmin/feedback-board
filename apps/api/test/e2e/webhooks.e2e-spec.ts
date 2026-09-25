import { randomUUID, createHmac } from 'node:crypto';
import { createServer } from 'node:http';
import type { IncomingHttpHeaders, IncomingMessage, ServerResponse } from 'node:http';

import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import {
  AppPrismaClient,
  PrismaService,
  TenantRunner,
  WebhookDeliveryService,
  QUEUES,
  JOBS,
  deliverWebhookJobSchema,
} from '@feedback-board/core';
import { Worker } from 'bullmq';
import type { Job, Queue } from 'bullmq';
import IORedis from 'ioredis';
import request from 'supertest';

import { AppModule } from '../../src/app.module';
import { bootstrapTestApp } from '../fixtures/bootstrap-test-app';
import { closeTestApp } from '../fixtures/close-test-app';
import { requireEnv } from '../fixtures/require-env';
import { signInAs } from '../fixtures/sign-in';

const SIGN_IN_TEST_TIMEOUT_MS = 20_000;
const JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 2_000, jitter: 0.5 },
  removeOnFail: false,
} as const;

// A real, persistent Supabase Postgres with no reset between runs, so every slug/email is
// unique per run, not per test file (same rationale as boards.e2e-spec.ts/posts.e2e-spec.ts).
const RUN_ID = randomUUID().slice(0, 8);
const orgSlug = (name: string): string => `webhooks-e2e-${RUN_ID}-${name}`;
const boardSlug = (name: string): string => `board-${RUN_ID}-${name}`;
const email = (name: string): string => `webhooks-e2e-${RUN_ID}-${name}@example.com`;

interface CapturedRequest {
  readonly headers: IncomingHttpHeaders;
  readonly body: string;
}

interface CaptureServer {
  readonly url: string;
  readonly requests: CapturedRequest[];
  close: () => Promise<void>;
}

/**
 * A local HTTP listener that captures every delivery it receives and answers with whatever
 * `respond()` returns for that attempt — a real network endpoint, not a mocked `fetch`, so the
 * signature verification below exercises the exact bytes `WebhookDeliveryService` sent (TDD §13
 * step 14).
 */
function startCaptureServer(respond: () => number): Promise<CaptureServer> {
  const requests: CapturedRequest[] = [];

  return new Promise((resolve, reject) => {
    const server = createServer((req: IncomingMessage, res: ServerResponse) => {
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', () => {
        requests.push({ headers: req.headers, body: Buffer.concat(chunks).toString('utf8') });
        res.writeHead(respond());
        res.end();
      });
    });

    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (address === null || typeof address === 'string') {
        reject(new Error('webhooks e2e: capture server did not bind to a TCP port'));
        return;
      }
      resolve({
        url: `http://127.0.0.1:${address.port}/hook`,
        requests,
        close: () => new Promise<void>((res) => server.close(() => res())),
      });
    });
  });
}

async function waitFor<T>(check: () => Promise<T | undefined>, timeoutMs: number): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const result = await check();
    if (result !== undefined) {
      return result;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error('webhooks e2e: condition not met within the deadline');
}

/**
 * The outcome of one delivery attempt, decided *inside* the tenant transaction but acted on
 * *outside* it — see the note on `buildTestWorker()` for why the split matters.
 */
interface DeliveryOutcome {
  readonly shouldRetry: boolean;
  readonly webhookId?: string;
  readonly responseStatus?: number | null;
}

describe('webhooks (e2e)', () => {
  let app: INestApplication;
  let admin: PrismaService;
  let runner: TenantRunner;
  let deliveryService: WebhookDeliveryService;
  let currentWorker: Worker | undefined;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = await bootstrapTestApp(moduleRef);
    admin = app.get(PrismaService);
    runner = new TenantRunner(app.get(AppPrismaClient));
    deliveryService = new WebhookDeliveryService();
  });

  afterEach(async () => {
    await currentWorker?.close();
    currentWorker = undefined;
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  /**
   * Mirrors `apps/worker`'s `WebhookDeliveryProcessor` line for line, built directly from the
   * same `packages/core` primitives the real processor injects (TDD §3.10) — constructed here
   * instead of imported from `apps/worker`, which `apps/api` must never depend on (§17). One
   * worker per test (opened via `currentWorker`, closed in `afterEach`) so the durability test
   * can kill and recreate it without any other test's job leaking into it.
   *
   * The BullMQ-retry throw happens AFTER `runner.runAs(...)` returns, never inside the
   * callback passed to it: `runAs` wraps the callback in `db.$transaction`, and Prisma rolls
   * back the whole transaction — including the `WebhookDelivery` row the callback just
   * inserted — the instant the callback throws. Throwing inside it would silently erase every
   * failed-attempt row the delivery log (TDD §3.7) exists to show, which is exactly the bug
   * this mirrors the fix for in the real processor.
   */
  function buildTestWorker(): Worker {
    return new Worker(
      QUEUES.WEBHOOKS,
      async (job: Job): Promise<void> => {
        const parsed = deliverWebhookJobSchema.parse(job.data);
        const { orgId, webhookId, event, postId } = parsed;

        const outcome = await runner.runAs<DeliveryOutcome>(orgId, async (tx) => {
          const webhook = await tx.webhook.findFirst({
            where: { id: webhookId, isActive: true, events: { has: event } },
            select: { id: true, targetUrl: true, secret: true },
          });
          if (webhook === null) {
            return { shouldRetry: false };
          }

          const post = await tx.post.findFirst({
            where: { id: postId },
            select: { id: true, title: true, body: true, status: true, voteCount: true },
          });
          if (post === null) {
            return { shouldRetry: false };
          }

          const result = await deliveryService.deliver(
            webhook.targetUrl,
            webhook.secret,
            event,
            post,
          );

          // Last statement in the callback on every path, so it always commits.
          await tx.webhookDelivery.create({
            data: {
              webhookId: webhook.id,
              orgId,
              event,
              payload: post,
              responseStatus: result.responseStatus,
              attempt: job.attemptsMade + 1,
            },
          });

          return {
            shouldRetry: result.responseStatus === null || result.responseStatus >= 400,
            webhookId: webhook.id,
            responseStatus: result.responseStatus,
          };
        });

        if (outcome.shouldRetry) {
          throw new Error(
            `deliver: webhook ${outcome.webhookId ?? webhookId} responded ${String(outcome.responseStatus)}`,
          );
        }
      },
      { connection: new IORedis(requireEnv('REDIS_URL'), { maxRetriesPerRequest: null }) },
    );
  }

  async function createProOrgWithWebhook(
    name: string,
    targetUrl: string,
    events: readonly string[] = ['post.created'],
  ): Promise<{
    token: string;
    orgId: string;
    orgSlugValue: string;
    boardSlugValue: string;
    webhookId: string;
    secret: string;
  }> {
    const token = await signInAs(email(name));
    const orgSlugValue = orgSlug(name);
    const boardSlugValue = boardSlug(name);

    const orgResponse = await request(app.getHttpServer())
      .post('/orgs')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `Webhooks ${name}`, slug: orgSlugValue });
    if (orgResponse.status !== 201) {
      throw new Error(`webhooks e2e: org creation failed: ${JSON.stringify(orgResponse.body)}`);
    }
    const orgId = orgResponse.body.id as string;

    // No product route flips an org to PRO outside the Stripe flow (Step 13) — the admin
    // client sets it directly, the same way billing.e2e-spec.ts seeds a customer org.
    await admin.client.org.update({ where: { id: orgId }, data: { plan: 'PRO' } });

    const boardResponse = await request(app.getHttpServer())
      .post(`/orgs/${orgSlugValue}/boards`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Roadmap', slug: boardSlugValue });
    if (boardResponse.status !== 201) {
      throw new Error(`webhooks e2e: board creation failed: ${JSON.stringify(boardResponse.body)}`);
    }

    const webhookResponse = await request(app.getHttpServer())
      .post(`/orgs/${orgSlugValue}/webhooks`)
      .set('Authorization', `Bearer ${token}`)
      .send({ targetUrl, events });
    if (webhookResponse.status !== 201) {
      throw new Error(
        `webhooks e2e: webhook creation failed: ${JSON.stringify(webhookResponse.body)}`,
      );
    }

    return {
      token,
      orgId,
      orgSlugValue,
      boardSlugValue,
      webhookId: webhookResponse.body.id as string,
      secret: webhookResponse.body.secret as string,
    };
  }

  it(
    'delivers a signed post.created event and records the successful attempt in the delivery log',
    async () => {
      const capture = await startCaptureServer(() => 200);
      const { token, orgSlugValue, boardSlugValue, webhookId, secret } =
        await createProOrgWithWebhook('deliver', capture.url);
      currentWorker = buildTestWorker();

      const postResponse = await request(app.getHttpServer())
        .post(`/orgs/${orgSlugValue}/boards/${boardSlugValue}/posts`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Add dark mode', body: 'Please add a dark theme' });
      expect(postResponse.status).toBe(201);

      await waitFor(async () => (capture.requests.length > 0 ? true : undefined), 10_000);

      const received = capture.requests[0];
      if (received === undefined) {
        throw new Error('webhooks e2e: capture server received no request');
      }
      const signatureHeader = received.headers['x-feedbackboard-signature'];
      const expectedSignature = `sha256=${createHmac('sha256', secret).update(received.body).digest('hex')}`;
      expect(signatureHeader).toBe(expectedSignature);
      expect(received.headers['x-feedbackboard-event']).toBe('post.created');

      const deliveries = await admin.client.webhookDelivery.findMany({ where: { webhookId } });
      expect(deliveries).toHaveLength(1);
      expect(deliveries[0]).toMatchObject({ responseStatus: 200, attempt: 1 });

      await capture.close();
    },
    SIGN_IN_TEST_TIMEOUT_MS + 10_000,
  );

  it('retries a failing delivery and produces exactly three WebhookDelivery rows', async () => {
    const capture = await startCaptureServer(() => 500);
    const { token, orgSlugValue, boardSlugValue, webhookId } = await createProOrgWithWebhook(
      'retry',
      capture.url,
    );
    currentWorker = buildTestWorker();

    const postResponse = await request(app.getHttpServer())
      .post(`/orgs/${orgSlugValue}/boards/${boardSlugValue}/posts`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Retry me', body: 'This endpoint always fails' });
    expect(postResponse.status).toBe(201);

    const deliveries = await waitFor(async () => {
      const rows = await admin.client.webhookDelivery.findMany({ where: { webhookId } });
      return rows.length >= 3 ? rows : undefined;
    }, 30_000);

    expect(deliveries).toHaveLength(3);
    expect(deliveries.map((row) => row.attempt).sort()).toEqual([1, 2, 3]);
    expect(deliveries.every((row) => row.responseStatus === 500)).toBe(true);
    expect(capture.requests).toHaveLength(3);

    await capture.close();
  }, 60_000);

  it('when one endpoint fails and another succeeds, the healthy endpoint receives the event exactly once — the regression the per-webhook job shape exists to prevent', async () => {
    const failing = await startCaptureServer(() => 500);
    const healthy = await startCaptureServer(() => 200);

    const token = await signInAs(email('two-endpoints'));
    const orgSlugValue = orgSlug('two-endpoints');
    const boardSlugValue = boardSlug('two-endpoints');

    const orgResponse = await request(app.getHttpServer())
      .post('/orgs')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Webhooks two-endpoints', slug: orgSlugValue });
    if (orgResponse.status !== 201) {
      throw new Error(`webhooks e2e: org creation failed: ${JSON.stringify(orgResponse.body)}`);
    }
    const orgId = orgResponse.body.id as string;
    await admin.client.org.update({ where: { id: orgId }, data: { plan: 'PRO' } });

    const boardResponse = await request(app.getHttpServer())
      .post(`/orgs/${orgSlugValue}/boards`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Roadmap', slug: boardSlugValue });
    if (boardResponse.status !== 201) {
      throw new Error(`webhooks e2e: board creation failed: ${JSON.stringify(boardResponse.body)}`);
    }

    const failingWebhook = await request(app.getHttpServer())
      .post(`/orgs/${orgSlugValue}/webhooks`)
      .set('Authorization', `Bearer ${token}`)
      .send({ targetUrl: failing.url, events: ['post.created'] });
    const healthyWebhook = await request(app.getHttpServer())
      .post(`/orgs/${orgSlugValue}/webhooks`)
      .set('Authorization', `Bearer ${token}`)
      .send({ targetUrl: healthy.url, events: ['post.created'] });
    expect(failingWebhook.status).toBe(201);
    expect(healthyWebhook.status).toBe(201);
    const failingWebhookId = failingWebhook.body.id as string;

    currentWorker = buildTestWorker();

    const postResponse = await request(app.getHttpServer())
      .post(`/orgs/${orgSlugValue}/boards/${boardSlugValue}/posts`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Two endpoints', body: 'One fails, one succeeds' });
    expect(postResponse.status).toBe(201);

    // Wait for the failing webhook's full three-attempt retry history — the healthy sibling
    // must not receive a fourth delivery just because this one keeps retrying.
    await waitFor(async () => {
      const rows = await admin.client.webhookDelivery.findMany({
        where: { webhookId: failingWebhookId },
      });
      return rows.length >= 3 ? rows : undefined;
    }, 30_000);

    expect(healthy.requests).toHaveLength(1);

    await failing.close();
    await healthy.close();
  }, 60_000);

  it(
    'a job whose webhook was deleted completes without delivering and without writing a row',
    async () => {
      const capture = await startCaptureServer(() => 200);
      const { token, orgId, orgSlugValue, boardSlugValue, webhookId } =
        await createProOrgWithWebhook('deleted', capture.url);
      currentWorker = buildTestWorker();

      const deleteResponse = await request(app.getHttpServer())
        .delete(`/orgs/${orgSlugValue}/webhooks/${webhookId}`)
        .set('Authorization', `Bearer ${token}`);
      expect(deleteResponse.status).toBe(204);

      const postResponse = await request(app.getHttpServer())
        .post(`/orgs/${orgSlugValue}/boards/${boardSlugValue}/posts`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'No webhook left', body: 'Deleted before this fired' });
      const postId = postResponse.body.id as string;

      // The API never enqueues for an already-deleted webhook — PostsService's own query
      // excludes it. This proves the other half of TDD §3.7 step 3: a webhook that disappears
      // *between* enqueue and processing must also complete cleanly. Enqueued by hand, because
      // that race is not reliably reproducible from outside the worker.
      const queue = app.get<Queue>(getQueueToken(QUEUES.WEBHOOKS));
      await queue.add(
        JOBS.DELIVER,
        deliverWebhookJobSchema.parse({ orgId, webhookId, event: 'post.created', postId }),
        JOB_OPTIONS,
      );

      // No polling target to wait on (the point is that nothing happens) — a fixed pause after
      // the job is enqueued is long enough for a single successful "no-op" job to complete.
      await new Promise((resolve) => setTimeout(resolve, 3_000));

      expect(capture.requests).toHaveLength(0);
      const deliveries = await admin.client.webhookDelivery.findMany({ where: { webhookId } });
      expect(deliveries).toHaveLength(0);

      await capture.close();
    },
    SIGN_IN_TEST_TIMEOUT_MS + 10_000,
  );

  it(
    'a FREE org is refused webhook creation with PLAN_LIMIT but still sees an empty list',
    async () => {
      const token = await signInAs(email('free-gate'));
      const orgSlugValue = orgSlug('free-gate');

      const orgResponse = await request(app.getHttpServer())
        .post('/orgs')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Webhooks free-gate', slug: orgSlugValue });
      expect(orgResponse.status).toBe(201);

      const createResponse = await request(app.getHttpServer())
        .post(`/orgs/${orgSlugValue}/webhooks`)
        .set('Authorization', `Bearer ${token}`)
        .send({ targetUrl: 'https://example.com/hook', events: ['post.created'] });
      expect(createResponse.status).toBe(403);
      expect(createResponse.body).toEqual({
        error: 'PLAN_LIMIT',
        limit: 'webhooks',
        plan: 'FREE',
        cap: false,
      });

      const listResponse = await request(app.getHttpServer())
        .get(`/orgs/${orgSlugValue}/webhooks`)
        .set('Authorization', `Bearer ${token}`);
      expect(listResponse.status).toBe(200);
      expect(listResponse.body).toEqual([]);
    },
    SIGN_IN_TEST_TIMEOUT_MS,
  );

  it(
    'a downgraded org keeps seeing its deactivated webhook via list/deliveries, while POST still refuses',
    async () => {
      const capture = await startCaptureServer(() => 200);
      const { token, orgId, orgSlugValue, webhookId } = await createProOrgWithWebhook(
        'downgrade',
        capture.url,
      );

      // Mirrors BillingService's own downgrade transition (Step 13) rather than driving a real
      // Stripe event through this suite — that path is already covered end-to-end in
      // billing.e2e-spec.ts; this test only needs the resulting state.
      await admin.client.$transaction([
        admin.client.org.update({ where: { id: orgId }, data: { plan: 'FREE' } }),
        admin.client.webhook.updateMany({ where: { orgId }, data: { isActive: false } }),
      ]);

      const listResponse = await request(app.getHttpServer())
        .get(`/orgs/${orgSlugValue}/webhooks`)
        .set('Authorization', `Bearer ${token}`);
      expect(listResponse.status).toBe(200);
      expect(listResponse.body).toEqual([
        expect.objectContaining({ id: webhookId, isActive: false }),
      ]);

      const deliveriesResponse = await request(app.getHttpServer())
        .get(`/orgs/${orgSlugValue}/webhooks/${webhookId}/deliveries`)
        .set('Authorization', `Bearer ${token}`);
      expect(deliveriesResponse.status).toBe(200);

      const createResponse = await request(app.getHttpServer())
        .post(`/orgs/${orgSlugValue}/webhooks`)
        .set('Authorization', `Bearer ${token}`)
        .send({ targetUrl: capture.url, events: ['post.created'] });
      expect(createResponse.status).toBe(403);
      expect(createResponse.body).toMatchObject({ error: 'PLAN_LIMIT' });

      await capture.close();
    },
    SIGN_IN_TEST_TIMEOUT_MS + 5_000,
  );

  it(
    'a delivery survives a worker restart between a failed attempt and its successful retry',
    async () => {
      let shouldFail = true;
      const capture = await startCaptureServer(() => (shouldFail ? 500 : 200));
      const { token, orgSlugValue, boardSlugValue, webhookId } = await createProOrgWithWebhook(
        'durability',
        capture.url,
      );

      const firstWorker = buildTestWorker();
      currentWorker = firstWorker;

      const postResponse = await request(app.getHttpServer())
        .post(`/orgs/${orgSlugValue}/boards/${boardSlugValue}/posts`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Durability', body: 'Kill the worker mid-retry' });
      expect(postResponse.status).toBe(201);

      // Wait for the first (failing) attempt's row, then kill the worker — the job is still in
      // Redis, waiting for its backoff to elapse (TDD §3.7).
      await waitFor(async () => {
        const rows = await admin.client.webhookDelivery.findMany({ where: { webhookId } });
        return rows.length >= 1 ? rows : undefined;
      }, 10_000);

      await firstWorker.close();
      currentWorker = undefined;

      shouldFail = false;

      const secondWorker = buildTestWorker();
      currentWorker = secondWorker;

      const successfulDeliveries = await waitFor(async () => {
        const rows = await admin.client.webhookDelivery.findMany({
          where: { webhookId, responseStatus: 200 },
        });
        return rows.length >= 1 ? rows : undefined;
      }, 15_000);

      expect(successfulDeliveries.length).toBeGreaterThan(0);

      await capture.close();
    },
    SIGN_IN_TEST_TIMEOUT_MS + 30_000,
  );
});
