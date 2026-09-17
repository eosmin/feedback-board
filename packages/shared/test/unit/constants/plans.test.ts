import { describe, expect, it } from 'vitest';

import {
  PLAN_CAPABILITIES,
  PLAN_LIMITED_RESOURCES,
  PLAN_LIMITS,
  PLANS,
  type Plan,
} from '../../../src/constants/plans';

describe('PLAN_LIMITS', () => {
  it('exposes exactly two plans', () => {
    expect(PLANS).toEqual(['FREE', 'PRO']);
  });

  it('caps a FREE org at one board, fifty posts and no webhooks', () => {
    expect(PLAN_LIMITS.FREE).toEqual({ boards: 1, posts: 50, webhooks: false });
  });

  it('leaves a PRO org uncapped and webhook-capable', () => {
    expect(PLAN_LIMITS.PRO).toEqual({ boards: null, posts: null, webhooks: true });
  });

  it('holds an entry for every plan', () => {
    expect(Object.keys(PLAN_LIMITS).sort()).toEqual([...PLANS].sort());
  });

  it('names only countable caps as limited resources', () => {
    for (const resource of PLAN_LIMITED_RESOURCES) {
      for (const plan of PLANS) {
        const cap: number | null = PLAN_LIMITS[plan][resource];

        expect(cap === null || typeof cap === 'number').toBe(true);
      }
    }
  });

  it('names every boolean capability, and none of them as a countable cap', () => {
    for (const capability of PLAN_CAPABILITIES) {
      expect(typeof PLAN_LIMITS.FREE[capability]).toBe('boolean');
      expect((PLAN_LIMITED_RESOURCES as readonly string[]).includes(capability)).toBe(false);
    }
  });

  it('never returns undefined for a known plan', () => {
    const plan: Plan = 'FREE';

    expect(PLAN_LIMITS[plan].webhooks).toBe(false);
  });
});
