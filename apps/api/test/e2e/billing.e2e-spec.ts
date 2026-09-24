import { randomUUID } from 'node:crypto';

import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '@feedback-board/core';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import request from 'supertest';

import { AppModule } from '../../src/app.module';
import { STRIPE_CLIENT } from '../../src/billing/billing.service';
import { bootstrapTestApp } from '../fixtures/bootstrap-test-app';
import { closeTestApp } from '../fixtures/close-test-app';
import { requireEnv } from '../fixtures/require-env';
import { seedMembership } from '../fixtures/seed-membership';
import { signInAs } from '../fixtures/sign-in';

// signInAs polls the local Mailpit mailbox for up to 15s (sign-in.ts).
const SIGN_IN_TEST_TIMEOUT_MS = 20_000;

// A real, persistent Supabase Postgres with no reset between runs, so every slug, Stripe id and
// event id is unique per run.
const RUN_ID = randomUUID().slice(0, 8);
const orgSlug = (name: string): string => `billing-e2e-${RUN_ID}-${name}`;
const email = (name: string): string => `billing-e2e-${RUN_ID}-${name}@example.com`;
const customerId = (name: string): string => `cus_e2e_${RUN_ID}_${name}`;
const subscriptionId = (name: string): string => `sub_e2e_${RUN_ID}_${name}`;
const eventId = (name: string): string => `evt_e2e_${RUN_ID}_${name}`;

const PERIOD_END = 1_900_000_000;
const CHECKOUT_URL = 'https://checkout.stripe.com/c/pay/cs_test_e2e';
const PORTAL_URL = 'https://billing.stripe.com/p/session/test_e2e';

/**
 * Stripe's API is replaced by an in-memory double, so this suite needs no network and no Stripe
 * key. Signature verification is not replaced: `webhooks` is the real implementation, and every
 * event below is signed with the app's own `STRIPE_WEBHOOK_SECRET`, sent as raw bytes, and
 * verified against `req.rawBody` exactly as a Stripe delivery would be. The real Stripe round
 * trip is the manual `stripe listen` + `stripe trigger` check.
 */
const subscriptions = new Map<string, Stripe.Subscription>();
let customerCounter = 0;

const stripeDouble = {
  webhooks: Stripe.webhooks,
  customers: {
    create: jest.fn(async () => ({ id: customerId(`created-${(customerCounter += 1)}`) })),
  },
  checkout: { sessions: { create: jest.fn(async () => ({ url: CHECKOUT_URL })) } },
  billingPortal: { sessions: { create: jest.fn(async () => ({ url: PORTAL_URL })) } },
  subscriptions: {
    retrieve: jest.fn(async (id: string) => {
      const subscription = subscriptions.get(id);
      if (subscription === undefined) {
        throw new Error(`billing e2e: no subscription fixture for ${id}`);
      }
      return subscription;
    }),
  },
};

function putSubscription(name: string, customer: string, status: string): string {
  const id = subscriptionId(name);
  subscriptions.set(id, {
    id,
    object: 'subscription',
    status,
    customer,
    items: {
      data: [
        { id: `si_${id}`, price: { id: `price_e2e_${RUN_ID}` }, current_period_end: PERIOD_END },
      ],
    },
  } as unknown as Stripe.Subscription);
  return id;
}

function checkoutCompleted(id: string, subscription: string): Record<string, unknown> {
  return {
    id,
    object: 'event',
    type: 'checkout.session.completed',
    data: { object: { object: 'checkout.session', mode: 'subscription', subscription } },
  };
}

function subscriptionDeleted(id: string, subscription: string): Record<string, unknown> {
  return {
    id,
    object: 'event',
    type: 'customer.subscription.deleted',
    data: { object: { object: 'subscription', id: subscription } },
  };
}

describe('billing (e2e)', () => {
  let app: INestApplication;
  let admin: PrismaService;
  let webhookSecret: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(STRIPE_CLIENT)
      .useValue(stripeDouble)
      .compile();
    app = await bootstrapTestApp(moduleRef);
    admin = app.get(PrismaService);
    // Read after AppModule is compiled: its ConfigModule is what loads apps/api/.env.
    webhookSecret = requireEnv('STRIPE_WEBHOOK_SECRET');
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  function sendSigned(event: Record<string, unknown>): request.Test {
    const payload = JSON.stringify(event);
    const signature = Stripe.webhooks.generateTestHeaderString({ payload, secret: webhookSecret });
    return request(app.getHttpServer())
      .post('/webhooks/stripe')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', signature)
      .send(payload);
  }

  async function seedCustomerOrg(name: string): Promise<{ id: string; customer: string }> {
    const customer = customerId(name);
    const org = await admin.client.org.create({
      data: { name: `Billing ${name}`, slug: orgSlug(name), stripeCustomerId: customer },
    });
    return { id: org.id, customer };
  }

  async function claimedCount(id: string): Promise<number> {
    return admin.client.stripeEvent.count({ where: { id } });
  }

  describe('POST /webhooks/stripe', () => {
    it('refuses an unsigned or wrongly signed body with INVALID_SIGNATURE and claims nothing', async () => {
      const event = checkoutCompleted(eventId('forged'), subscriptionId('forged'));
      const payload = JSON.stringify(event);
      const forged = Stripe.webhooks.generateTestHeaderString({
        payload,
        secret: 'whsec_not_ours',
      });

      const wrongSecret = await request(app.getHttpServer())
        .post('/webhooks/stripe')
        .set('Content-Type', 'application/json')
        .set('stripe-signature', forged)
        .send(payload);
      const unsigned = await request(app.getHttpServer())
        .post('/webhooks/stripe')
        .set('Content-Type', 'application/json')
        .send(payload);

      for (const response of [wrongSecret, unsigned]) {
        expect(response.status).toBe(400);
        expect(response.body).toEqual({ error: 'INVALID_SIGNATURE' });
      }
      expect(await claimedCount(eventId('forged'))).toBe(0);
    });

    it('rejects a body altered after signing, because it verifies the raw bytes', async () => {
      const event = checkoutCompleted(eventId('tampered'), subscriptionId('tampered'));
      const signature = Stripe.webhooks.generateTestHeaderString({
        payload: JSON.stringify(event),
        secret: webhookSecret,
      });

      const response = await request(app.getHttpServer())
        .post('/webhooks/stripe')
        .set('Content-Type', 'application/json')
        .set('stripe-signature', signature)
        .send(JSON.stringify({ ...event, id: eventId('tampered-2') }));

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'INVALID_SIGNATURE' });
    });

    it('checkout.session.completed flips the org to PRO and records the subscription from its item', async () => {
      const org = await seedCustomerOrg('upgrade');
      const subscription = putSubscription('upgrade', org.customer, 'active');

      const response = await sendSigned(checkoutCompleted(eventId('upgrade'), subscription));

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ received: true });
      const updated = await admin.client.org.findUniqueOrThrow({ where: { id: org.id } });
      expect(updated.plan).toBe('PRO');
      const stored = await admin.client.subscription.findUniqueOrThrow({
        where: { orgId: org.id },
      });
      expect(stored).toMatchObject({
        stripeSubscriptionId: subscription,
        status: 'ACTIVE',
        currentPeriodEnd: new Date(PERIOD_END * 1000),
      });
      expect(await claimedCount(eventId('upgrade'))).toBe(1);
    });

    it('idempotency: a replayed event id is acknowledged but applies no second transition', async () => {
      const org = await seedCustomerOrg('replay');
      const subscription = putSubscription('replay', org.customer, 'active');
      const event = checkoutCompleted(eventId('replay'), subscription);

      const first = await sendSigned(event);
      expect(first.status).toBe(200);
      expect((await admin.client.org.findUniqueOrThrow({ where: { id: org.id } })).plan).toBe(
        'PRO',
      );

      // If the replay were processed it would now read this canceled state and downgrade.
      putSubscription('replay', org.customer, 'canceled');
      const replay = await sendSigned(event);

      expect(replay.status).toBe(200);
      expect((await admin.client.org.findUniqueOrThrow({ where: { id: org.id } })).plan).toBe(
        'PRO',
      );
      expect(
        (await admin.client.subscription.findUniqueOrThrow({ where: { orgId: org.id } })).status,
      ).toBe('ACTIVE');
      expect(await claimedCount(eventId('replay'))).toBe(1);
    });

    it('idempotency: two concurrent deliveries of one event id both answer 200 and claim once', async () => {
      const org = await seedCustomerOrg('concurrent');
      const subscription = putSubscription('concurrent', org.customer, 'active');
      const event = checkoutCompleted(eventId('concurrent'), subscription);

      const responses = await Promise.all([sendSigned(event), sendSigned(event)]);

      expect(responses.map((response) => response.status)).toEqual([200, 200]);
      expect(await claimedCount(eventId('concurrent'))).toBe(1);
      expect((await admin.client.org.findUniqueOrThrow({ where: { id: org.id } })).plan).toBe(
        'PRO',
      );
    });

    it('acknowledges an event for a customer no org owns without claiming it', async () => {
      const subscription = putSubscription('stranger', customerId('stranger'), 'active');

      const response = await sendSigned(checkoutCompleted(eventId('stranger'), subscription));

      expect(response.status).toBe(200);
      expect(await claimedCount(eventId('stranger'))).toBe(0);
    });

    it('acknowledges an event type it does not handle without claiming it', async () => {
      const response = await sendSigned({
        id: eventId('ignored'),
        object: 'event',
        type: 'customer.created',
        data: { object: { object: 'customer', id: customerId('ignored') } },
      });

      expect(response.status).toBe(200);
      expect(await claimedCount(eventId('ignored'))).toBe(0);
    });
  });

  describe('billing routes and the downgrade path', () => {
    let ownerToken: string;
    let memberToken: string;

    beforeAll(async () => {
      ownerToken = await signInAs(email('owner'));
      memberToken = await signInAs(email('member'));
    }, SIGN_IN_TEST_TIMEOUT_MS * 2);

    async function createOwnedOrg(name: string): Promise<string> {
      const response = await request(app.getHttpServer())
        .post('/orgs')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ name: `Billing ${name}`, slug: orgSlug(name) });
      if (response.status !== 201) {
        throw new Error(`billing e2e: org creation failed: ${JSON.stringify(response.body)}`);
      }
      return response.body.id as string;
    }

    it('lets the OWNER open Checkout, caching the customer, then the Portal', async () => {
      const orgId = await createOwnedOrg('owner-sessions');
      const server = app.getHttpServer();

      const checkout = await request(server)
        .post(`/orgs/${orgSlug('owner-sessions')}/billing/checkout-session`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(checkout.status).toBe(200);
      expect(checkout.body).toEqual({ url: CHECKOUT_URL });
      const org = await admin.client.org.findUniqueOrThrow({ where: { id: orgId } });
      expect(org.stripeCustomerId).not.toBeNull();

      const portal = await request(server)
        .post(`/orgs/${orgSlug('owner-sessions')}/billing/portal-session`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(portal.status).toBe(200);
      expect(portal.body).toEqual({ url: PORTAL_URL });
    });

    it('answers CONFLICT for a Portal request before any Checkout', async () => {
      await createOwnedOrg('no-customer');

      const response = await request(app.getHttpServer())
        .post(`/orgs/${orgSlug('no-customer')}/billing/portal-session`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(response.status).toBe(409);
      expect(response.body).toEqual({ error: 'CONFLICT' });
    });

    it('refuses a MEMBER on both routes', async () => {
      const orgId = await createOwnedOrg('member-refused');
      const supabase = createClient(
        requireEnv('SUPABASE_URL'),
        requireEnv('TEST_SUPABASE_ANON_KEY'),
      );
      const { data } = await supabase.auth.getUser(memberToken);
      const memberUserId = data.user?.id;
      if (memberUserId === undefined) {
        throw new Error('billing e2e: could not resolve member user id from token');
      }
      await seedMembership(admin, {
        userId: memberUserId,
        email: email('member'),
        orgId,
        role: 'MEMBER',
      });

      for (const route of ['checkout-session', 'portal-session']) {
        const response = await request(app.getHttpServer())
          .post(`/orgs/${orgSlug('member-refused')}/billing/${route}`)
          .set('Authorization', `Bearer ${memberToken}`);

        expect(response.status).toBe(403);
        expect(response.body).toEqual({ error: 'FORBIDDEN' });
      }
    });

    it("cross-tenant: an OWNER cannot open another org's Checkout", async () => {
      await seedCustomerOrg('foreign');

      const response = await request(app.getHttpServer())
        .post(`/orgs/${orgSlug('foreign')}/billing/checkout-session`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ error: 'FORBIDDEN' });
    });

    it(
      'customer.subscription.deleted drops the org to FREE, deactivates its webhooks, and a later post.created delivers nothing',
      async () => {
        const orgId = await createOwnedOrg('downgrade');
        const customer = customerId('downgrade');
        await admin.client.org.update({
          where: { id: orgId },
          data: { stripeCustomerId: customer, plan: 'PRO' },
        });
        // No product route creates a webhook yet, so the PRO org's endpoints are seeded directly.
        await admin.client.webhook.createMany({
          data: [1, 2].map((n) => ({
            orgId,
            targetUrl: `https://example.com/hooks/${RUN_ID}/${n}`,
            secret: randomUUID(),
            events: ['post.created'],
          })),
        });
        const subscription = putSubscription('downgrade', customer, 'canceled');

        const response = await sendSigned(subscriptionDeleted(eventId('downgrade'), subscription));

        expect(response.status).toBe(200);
        const org = await admin.client.org.findUniqueOrThrow({ where: { id: orgId } });
        expect(org.plan).toBe('FREE');
        expect(
          (await admin.client.subscription.findUniqueOrThrow({ where: { orgId } })).status,
        ).toBe('CANCELED');
        const webhooks = await admin.client.webhook.findMany({ where: { orgId } });
        expect(webhooks).toHaveLength(2);
        expect(webhooks.every((webhook) => !webhook.isActive)).toBe(true);

        const server = app.getHttpServer();
        const board = await request(server)
          .post(`/orgs/${orgSlug('downgrade')}/boards`)
          .set('Authorization', `Bearer ${ownerToken}`)
          .send({ name: 'Roadmap', slug: `board-${RUN_ID}` });
        expect(board.status).toBe(201);
        const post = await request(server)
          .post(`/orgs/${orgSlug('downgrade')}/boards/board-${RUN_ID}/posts`)
          .set('Authorization', `Bearer ${ownerToken}`)
          .send({ title: 'After the downgrade', body: 'No webhook may hear about this' });
        expect(post.status).toBe(201);

        expect(await admin.client.webhookDelivery.count({ where: { orgId } })).toBe(0);
      },
      SIGN_IN_TEST_TIMEOUT_MS,
    );
  });
});
