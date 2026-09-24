import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '@feedback-board/core';
import type { Logger, PrismaService } from '@feedback-board/core';
import Stripe from 'stripe';

import {
  BillingService,
  mapStripeStatus,
  planForStatus,
  subscriptionIdOf,
} from '../../../src/billing/billing.service';
import type { BillingOptions } from '../../../src/billing/billing.service';
import type { TenantPrismaService } from '../../../src/database/tenant-prisma.service';

const ORG_ID = '11111111-1111-4111-8111-111111111111';
const CUSTOMER_ID = 'cus_test_1';
const SUBSCRIPTION_ID = 'sub_test_1';
const PRICE_ID = 'price_test_pro';
const PERIOD_END = 1_900_000_000;
const WEBHOOK_SECRET = 'whsec_unit_test';

const OPTIONS: BillingOptions = {
  proPriceId: PRICE_ID,
  webOrigin: 'http://localhost:3000',
  webhookSecret: WEBHOOK_SECRET,
};

function buildSubscription(status: string, items = [{ id: 'si_1' }]): Stripe.Subscription {
  return {
    id: SUBSCRIPTION_ID,
    status,
    customer: CUSTOMER_ID,
    items: {
      data: items.map((item) => ({
        ...item,
        price: { id: PRICE_ID },
        current_period_end: PERIOD_END,
      })),
    },
  } as unknown as Stripe.Subscription;
}

function buildEvent(type: string, object: Record<string, unknown>, id = 'evt_1'): Stripe.Event {
  return { id, type, data: { object } } as unknown as Stripe.Event;
}

function uniqueViolation(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('duplicate', {
    code: 'P2002',
    clientVersion: '7.10.0',
  });
}

interface Harness {
  service: BillingService;
  stripe: {
    customers: { create: jest.Mock };
    checkout: { sessions: { create: jest.Mock } };
    billingPortal: { sessions: { create: jest.Mock } };
    subscriptions: { retrieve: jest.Mock };
  };
  tenantTx: { org: { findUniqueOrThrow: jest.Mock; update: jest.Mock } };
  adminOrgFindUnique: jest.Mock;
  transaction: jest.Mock;
  tx: {
    stripeEvent: { create: jest.Mock };
    subscription: { upsert: jest.Mock };
    org: { update: jest.Mock };
    webhook: { updateMany: jest.Mock };
  };
  logger: { warn: jest.Mock; log: jest.Mock };
}

function buildHarness(options: {
  stripeCustomerId?: string | null;
  subscription?: Stripe.Subscription;
  adminOrg?: { id: string } | null;
  transactionError?: unknown;
}): Harness {
  const stripe = {
    customers: { create: jest.fn().mockResolvedValue({ id: CUSTOMER_ID }) },
    checkout: {
      sessions: {
        create: jest.fn().mockResolvedValue({ url: 'https://checkout.stripe.com/c/pay/cs_1' }),
      },
    },
    billingPortal: {
      sessions: {
        create: jest.fn().mockResolvedValue({ url: 'https://billing.stripe.com/p/session/bps_1' }),
      },
    },
    subscriptions: {
      retrieve: jest.fn().mockResolvedValue(options.subscription ?? buildSubscription('active')),
    },
    webhooks: Stripe.webhooks,
  };

  const tenantTx = {
    org: {
      findUniqueOrThrow: jest.fn().mockResolvedValue({
        slug: 'acme',
        stripeCustomerId: options.stripeCustomerId === undefined ? null : options.stripeCustomerId,
      }),
      update: jest.fn().mockResolvedValue({}),
    },
  };
  const tenantPrisma = {
    run: jest.fn(async (fn: (client: unknown) => unknown) => fn(tenantTx)),
  } as unknown as TenantPrismaService;

  const tx = {
    stripeEvent: { create: jest.fn().mockResolvedValue({}) },
    subscription: { upsert: jest.fn().mockResolvedValue({}) },
    org: { update: jest.fn().mockResolvedValue({}) },
    webhook: { updateMany: jest.fn().mockResolvedValue({ count: 2 }) },
  };
  const transaction = jest.fn(async (fn: (client: unknown) => unknown) => {
    if (options.transactionError !== undefined) {
      throw options.transactionError;
    }
    return fn(tx);
  });
  const adminOrgFindUnique = jest
    .fn()
    .mockResolvedValue(options.adminOrg === undefined ? { id: ORG_ID } : options.adminOrg);
  const admin = {
    client: { org: { findUnique: adminOrgFindUnique }, $transaction: transaction },
  } as unknown as PrismaService;

  const logger = { warn: jest.fn(), log: jest.fn() };

  return {
    service: new BillingService(
      stripe as unknown as Stripe,
      OPTIONS,
      tenantPrisma,
      admin,
      logger as unknown as Logger,
    ),
    stripe,
    tenantTx,
    adminOrgFindUnique,
    transaction,
    tx,
    logger,
  };
}

describe('mapStripeStatus', () => {
  it.each([
    ['incomplete', 'INCOMPLETE'],
    ['incomplete_expired', 'CANCELED'],
    ['trialing', 'TRIALING'],
    ['active', 'ACTIVE'],
    ['past_due', 'PAST_DUE'],
    ['canceled', 'CANCELED'],
    ['unpaid', 'UNPAID'],
    ['paused', 'UNPAID'],
  ])('maps %s to %s', (stripeStatus, expected) => {
    expect(mapStripeStatus(stripeStatus)).toBe(expected);
  });

  it('throws on a status it does not recognise instead of persisting it', () => {
    expect(() => mapStripeStatus('ended')).toThrow('Unrecognised Stripe subscription status');
  });
});

describe('planForStatus', () => {
  it.each(['ACTIVE', 'TRIALING', 'PAST_DUE'] as const)('keeps %s on PRO', (status) => {
    expect(planForStatus(status)).toBe('PRO');
  });

  it.each(['INCOMPLETE', 'CANCELED', 'UNPAID'] as const)('drops %s to FREE', (status) => {
    expect(planForStatus(status)).toBe('FREE');
  });
});

describe('subscriptionIdOf', () => {
  it('reads a subscription checkout session, as an id or an expanded object', () => {
    const asId = buildEvent('checkout.session.completed', {
      mode: 'subscription',
      subscription: SUBSCRIPTION_ID,
    });
    const expanded = buildEvent('checkout.session.completed', {
      mode: 'subscription',
      subscription: { id: SUBSCRIPTION_ID },
    });

    expect(subscriptionIdOf(asId)).toBe(SUBSCRIPTION_ID);
    expect(subscriptionIdOf(expanded)).toBe(SUBSCRIPTION_ID);
  });

  it('ignores a payment-mode checkout session, which is what an un-overridden stripe trigger sends', () => {
    const event = buildEvent('checkout.session.completed', { mode: 'payment', subscription: null });

    expect(subscriptionIdOf(event)).toBeNull();
  });

  it('ignores a subscription-mode session that carries no subscription', () => {
    const event = buildEvent('checkout.session.completed', {
      mode: 'subscription',
      subscription: null,
    });

    expect(subscriptionIdOf(event)).toBeNull();
  });

  it.each(['customer.subscription.updated', 'customer.subscription.deleted'])(
    'reads %s from the event object itself',
    (type) => {
      expect(subscriptionIdOf(buildEvent(type, { id: SUBSCRIPTION_ID }))).toBe(SUBSCRIPTION_ID);
    },
  );

  it('reads invoice.payment_failed through parent.subscription_details', () => {
    const event = buildEvent('invoice.payment_failed', {
      parent: { subscription_details: { subscription: SUBSCRIPTION_ID } },
    });

    expect(subscriptionIdOf(event)).toBe(SUBSCRIPTION_ID);
  });

  it('ignores an invoice with no subscription parent', () => {
    expect(subscriptionIdOf(buildEvent('invoice.payment_failed', { parent: null }))).toBeNull();
    expect(
      subscriptionIdOf(
        buildEvent('invoice.payment_failed', { parent: { subscription_details: null } }),
      ),
    ).toBeNull();
  });

  it('ignores every event type it does not handle', () => {
    expect(subscriptionIdOf(buildEvent('customer.created', { id: CUSTOMER_ID }))).toBeNull();
  });
});

describe('BillingService', () => {
  describe('createCheckoutSession', () => {
    it('creates and caches a customer on first use, then opens a subscription checkout', async () => {
      const { service, stripe, tenantTx } = buildHarness({ stripeCustomerId: null });

      const result = await service.createCheckoutSession(ORG_ID);

      expect(stripe.customers.create).toHaveBeenCalledWith(
        { metadata: { orgId: ORG_ID } },
        { idempotencyKey: `org-customer-${ORG_ID}` },
      );
      expect(tenantTx.org.update).toHaveBeenCalledWith({
        where: { id: ORG_ID },
        data: { stripeCustomerId: CUSTOMER_ID },
      });
      expect(stripe.checkout.sessions.create).toHaveBeenCalledWith({
        mode: 'subscription',
        customer: CUSTOMER_ID,
        client_reference_id: ORG_ID,
        line_items: [{ price: PRICE_ID, quantity: 1 }],
        success_url: 'http://localhost:3000/dashboard/acme/billing?success=1',
        cancel_url: 'http://localhost:3000/dashboard/acme/billing',
      });
      expect(result).toEqual({ url: 'https://checkout.stripe.com/c/pay/cs_1' });
    });

    it('reuses the cached customer instead of creating a second one', async () => {
      const { service, stripe } = buildHarness({ stripeCustomerId: 'cus_existing' });

      await service.createCheckoutSession(ORG_ID);

      expect(stripe.customers.create).not.toHaveBeenCalled();
      expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({ customer: 'cus_existing' }),
      );
    });

    it('refuses a session Stripe returned without a URL rather than answering with null', async () => {
      const { service, stripe } = buildHarness({ stripeCustomerId: 'cus_existing' });
      stripe.checkout.sessions.create.mockResolvedValueOnce({ url: null });

      await expect(service.createCheckoutSession(ORG_ID)).rejects.toThrow();
    });
  });

  describe('createPortalSession', () => {
    it('opens a portal session for the cached customer, returning to the billing page', async () => {
      const { service, stripe } = buildHarness({ stripeCustomerId: CUSTOMER_ID });

      const result = await service.createPortalSession(ORG_ID);

      expect(stripe.billingPortal.sessions.create).toHaveBeenCalledWith({
        customer: CUSTOMER_ID,
        return_url: 'http://localhost:3000/dashboard/acme/billing',
      });
      expect(result).toEqual({ url: 'https://billing.stripe.com/p/session/bps_1' });
    });

    it('answers CONFLICT for an org that never checked out', async () => {
      const { service, stripe } = buildHarness({ stripeCustomerId: null });

      await expect(service.createPortalSession(ORG_ID)).rejects.toBeInstanceOf(ConflictException);
      await expect(service.createPortalSession(ORG_ID)).rejects.toMatchObject({
        response: { error: 'CONFLICT' },
      });
      expect(stripe.billingPortal.sessions.create).not.toHaveBeenCalled();
    });
  });

  describe('verifyWebhookEvent', () => {
    const payload = JSON.stringify({ id: 'evt_signed', object: 'event', type: 'customer.created' });

    it('returns the event when the signature over the raw body verifies', () => {
      const { service } = buildHarness({});
      const signature = Stripe.webhooks.generateTestHeaderString({
        payload,
        secret: WEBHOOK_SECRET,
      });

      expect(service.verifyWebhookEvent(Buffer.from(payload), signature).id).toBe('evt_signed');
    });

    it('rejects a signature made with another secret', () => {
      const { service } = buildHarness({});
      const signature = Stripe.webhooks.generateTestHeaderString({
        payload,
        secret: 'whsec_someone_else',
      });

      expect(() => service.verifyWebhookEvent(Buffer.from(payload), signature)).toThrow(
        BadRequestException,
      );
    });

    it('rejects a missing signature header or a missing raw body with INVALID_SIGNATURE', () => {
      const { service } = buildHarness({});

      for (const call of [
        (): unknown => service.verifyWebhookEvent(Buffer.from(payload), undefined),
        (): unknown => service.verifyWebhookEvent(undefined, 't=1,v1=abc'),
      ]) {
        try {
          call();
          throw new Error('expected a rejection');
        } catch (error) {
          expect(error).toBeInstanceOf(BadRequestException);
          expect((error as BadRequestException).getResponse()).toEqual({
            error: 'INVALID_SIGNATURE',
          });
        }
      }
    });
  });

  describe('handleWebhookEvent', () => {
    const completed = buildEvent('checkout.session.completed', {
      mode: 'subscription',
      subscription: SUBSCRIPTION_ID,
    });

    it('claims the event, upserts the subscription from the item, and flips the org to PRO', async () => {
      const { service, stripe, adminOrgFindUnique, tx } = buildHarness({});

      await service.handleWebhookEvent(completed);

      expect(stripe.subscriptions.retrieve).toHaveBeenCalledWith(SUBSCRIPTION_ID);
      expect(adminOrgFindUnique).toHaveBeenCalledWith({
        where: { stripeCustomerId: CUSTOMER_ID },
        select: { id: true },
      });
      expect(tx.stripeEvent.create).toHaveBeenCalledWith({
        data: { id: 'evt_1', type: 'checkout.session.completed' },
      });
      const snapshot = {
        stripeSubscriptionId: SUBSCRIPTION_ID,
        stripePriceId: PRICE_ID,
        status: 'ACTIVE',
        currentPeriodEnd: new Date(PERIOD_END * 1000),
      };
      expect(tx.subscription.upsert).toHaveBeenCalledWith({
        where: { orgId: ORG_ID },
        create: { orgId: ORG_ID, ...snapshot },
        update: snapshot,
      });
      expect(tx.org.update).toHaveBeenCalledWith({
        where: { id: ORG_ID },
        data: { plan: 'PRO' },
      });
      expect(tx.webhook.updateMany).not.toHaveBeenCalled();
    });

    it('claims the event before acting on it, inside the same transaction', async () => {
      const { service, tx } = buildHarness({});

      await service.handleWebhookEvent(completed);

      const claimOrder = tx.stripeEvent.create.mock.invocationCallOrder[0] ?? Infinity;
      const actOrder = tx.subscription.upsert.mock.invocationCallOrder[0] ?? -Infinity;
      expect(claimOrder).toBeLessThan(actOrder);
    });

    it('downgrades to FREE and deactivates the org webhooks in the same transaction', async () => {
      const { service, tx } = buildHarness({ subscription: buildSubscription('canceled') });

      await service.handleWebhookEvent(
        buildEvent('customer.subscription.deleted', { id: SUBSCRIPTION_ID }),
      );

      expect(tx.org.update).toHaveBeenCalledWith({
        where: { id: ORG_ID },
        data: { plan: 'FREE' },
      });
      expect(tx.webhook.updateMany).toHaveBeenCalledWith({
        where: { orgId: ORG_ID, isActive: true },
        data: { isActive: false },
      });
    });

    it('keeps PRO on a failed payment while the subscription is only past due', async () => {
      const { service, tx } = buildHarness({ subscription: buildSubscription('past_due') });

      await service.handleWebhookEvent(
        buildEvent('invoice.payment_failed', {
          parent: { subscription_details: { subscription: SUBSCRIPTION_ID } },
        }),
      );

      expect(tx.subscription.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ update: expect.objectContaining({ status: 'PAST_DUE' }) }),
      );
      expect(tx.org.update).toHaveBeenCalledWith({ where: { id: ORG_ID }, data: { plan: 'PRO' } });
      expect(tx.webhook.updateMany).not.toHaveBeenCalled();
    });

    it('treats a replayed event id as already processed and returns without throwing', async () => {
      const { service, logger } = buildHarness({ transactionError: uniqueViolation() });

      await expect(service.handleWebhookEvent(completed)).resolves.toBeUndefined();
      expect(logger.log).toHaveBeenCalledWith(
        { eventId: 'evt_1' },
        'Stripe event already processed',
      );
    });

    it('rethrows any other database failure so Stripe retries the delivery', async () => {
      const failure = new Error('connection reset');
      const { service } = buildHarness({ transactionError: failure });

      await expect(service.handleWebhookEvent(completed)).rejects.toBe(failure);
    });

    it('does nothing for an event type it does not handle', async () => {
      const { service, stripe, transaction } = buildHarness({});

      await service.handleWebhookEvent(buildEvent('customer.created', { id: CUSTOMER_ID }));

      expect(stripe.subscriptions.retrieve).not.toHaveBeenCalled();
      expect(transaction).not.toHaveBeenCalled();
    });

    it('logs and skips an event for a customer no org owns, claiming nothing', async () => {
      const { service, transaction, logger } = buildHarness({ adminOrg: null });

      await service.handleWebhookEvent(completed);

      expect(transaction).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        { eventId: 'evt_1', customerId: CUSTOMER_ID },
        'Stripe event for an unknown customer',
      );
    });

    it('resolves the org from an expanded customer object as well as from an id', async () => {
      const expanded = {
        ...buildSubscription('active'),
        customer: { id: CUSTOMER_ID },
      } as unknown as Stripe.Subscription;
      const { service, adminOrgFindUnique } = buildHarness({ subscription: expanded });

      await service.handleWebhookEvent(completed);

      expect(adminOrgFindUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { stripeCustomerId: CUSTOMER_ID } }),
      );
    });

    it('fails before claiming the event when Stripe reports a status it does not map', async () => {
      const { service, transaction } = buildHarness({ subscription: buildSubscription('ended') });

      await expect(service.handleWebhookEvent(completed)).rejects.toThrow(
        'Unrecognised Stripe subscription status',
      );
      expect(transaction).not.toHaveBeenCalled();
    });

    it('fails before claiming the event when the subscription has no items', async () => {
      const { service, transaction } = buildHarness({
        subscription: buildSubscription('active', []),
      });

      await expect(service.handleWebhookEvent(completed)).rejects.toThrow('has no items');
      expect(transaction).not.toHaveBeenCalled();
    });
  });
});
