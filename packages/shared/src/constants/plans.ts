export const PLANS = ['FREE', 'PRO'] as const;

export type Plan = (typeof PLANS)[number];

/** The countable caps. `@LimitedByPlan(...)` takes exactly one of these. */
export const PLAN_LIMITED_RESOURCES = ['boards', 'posts'] as const;

export type PlanLimitedResource = (typeof PLAN_LIMITED_RESOURCES)[number];

/** The boolean capabilities. A `@RequiresPlan(...)` refusal reports one of these as its `limit`. */
export const PLAN_CAPABILITIES = ['webhooks'] as const;

export type PlanCapability = (typeof PLAN_CAPABILITIES)[number];

export interface PlanLimits {
  /** `null` means unlimited. */
  readonly boards: number | null;
  /** `null` means unlimited. */
  readonly posts: number | null;
  readonly webhooks: boolean;
}

/**
 * The single representation of every cap: the API enforces these numbers and the dashboard
 * renders them. Both counts are per org, not per board — a FREE org holding two boards still
 * gets 50 posts in total (TDD §3.9).
 */
export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  FREE: { boards: 1, posts: 50, webhooks: false },
  PRO: { boards: null, posts: null, webhooks: true },
};
