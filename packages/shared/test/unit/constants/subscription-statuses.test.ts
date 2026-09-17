import { describe, expect, it } from 'vitest';

import {
  SUBSCRIPTION_STATUSES,
  type SubscriptionStatus,
} from '../../../src/constants/subscription-statuses';

describe('SUBSCRIPTION_STATUSES', () => {
  it('covers the six states of the lifecycle', () => {
    expect(SUBSCRIPTION_STATUSES).toEqual([
      'INCOMPLETE',
      'TRIALING',
      'ACTIVE',
      'PAST_DUE',
      'CANCELED',
      'UNPAID',
    ]);
  });

  it('holds no duplicates', () => {
    expect(new Set(SUBSCRIPTION_STATUSES).size).toBe(SUBSCRIPTION_STATUSES.length);
  });

  it('is uppercase, so a raw Stripe status can never be mistaken for one', () => {
    for (const status of SUBSCRIPTION_STATUSES) {
      expect(status).toMatch(/^[A-Z][A-Z_]*$/);
    }
  });

  it('infers its member type from the tuple', () => {
    const status: SubscriptionStatus = 'ACTIVE';

    expect(SUBSCRIPTION_STATUSES).toContain(status);
  });
});
