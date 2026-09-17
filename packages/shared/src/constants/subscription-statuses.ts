/**
 * The Stripe subscription lifecycle as this project models it. Stripe's own status strings are
 * lowercase and a wider set; they are mapped onto these in one place, which throws on an
 * unrecognised value rather than persisting it (TDD §3.6 step 5).
 */
export const SUBSCRIPTION_STATUSES = [
  'INCOMPLETE',
  'TRIALING',
  'ACTIVE',
  'PAST_DUE',
  'CANCELED',
  'UNPAID',
] as const;

export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];
