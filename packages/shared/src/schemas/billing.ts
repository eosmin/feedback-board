import { z } from 'zod';

import { SUBSCRIPTION_STATUSES } from '../constants/subscription-statuses';

/**
 * Both billing routes answer with a Stripe-hosted URL the browser redirects to; neither takes a
 * body, since the org comes from the path and the customer from the org (TDD §3.6).
 */
export const billingSessionSchema = z.object({
  url: z.url(),
});

export type BillingSession = z.infer<typeof billingSessionSchema>;

export const subscriptionSchema = z.object({
  id: z.uuid(),
  orgId: z.uuid(),
  stripeSubscriptionId: z.string(),
  stripePriceId: z.string(),
  status: z.enum(SUBSCRIPTION_STATUSES),
  // Read from the subscription ITEM, not the subscription object, where it no longer
  // exists (TDD §2.6.7).
  currentPeriodEnd: z.iso.datetime(),
});

export type Subscription = z.infer<typeof subscriptionSchema>;
