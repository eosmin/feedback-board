import { describe, expect, it } from 'vitest';

import { billingSessionSchema, subscriptionSchema } from '../../../src/schemas/billing';

const UUID = '3f1a7c2e-9b4d-4f8a-9c1e-7d5b2a6e0f43';
const PERIOD_END = '2026-10-07T10:15:00.000Z';

describe('billingSessionSchema', () => {
  it('accepts a Stripe-hosted url', () => {
    const result = billingSessionSchema.safeParse({
      url: 'https://checkout.stripe.com/c/pay/cs_1',
    });

    expect(result.success).toBe(true);
  });

  it('rejects a non-url', () => {
    expect(billingSessionSchema.safeParse({ url: '/dashboard/acme/billing' }).success).toBe(false);
  });
});

describe('subscriptionSchema', () => {
  const subscription = {
    id: UUID,
    orgId: UUID,
    stripeSubscriptionId: 'sub_1',
    stripePriceId: 'price_1',
    status: 'ACTIVE',
    currentPeriodEnd: PERIOD_END,
  };

  it('accepts an active subscription', () => {
    expect(subscriptionSchema.safeParse(subscription).success).toBe(true);
  });

  it('rejects a status Stripe sends but this project does not model', () => {
    expect(subscriptionSchema.safeParse({ ...subscription, status: 'paused' }).success).toBe(false);
  });

  it('rejects a lowercase Stripe status, which must be mapped before it is stored', () => {
    expect(subscriptionSchema.safeParse({ ...subscription, status: 'active' }).success).toBe(false);
  });

  it('rejects a missing period end', () => {
    const { currentPeriodEnd: _end, ...withoutEnd } = subscription;

    expect(subscriptionSchema.safeParse(withoutEnd).success).toBe(false);
  });
});
