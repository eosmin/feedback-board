import { SetMetadata } from '@nestjs/common';
import type { Plan, PlanLimitedResource } from '@feedback-board/shared';

export const REQUIRES_PLAN_KEY = 'requiresPlan';
export const LIMITED_BY_PLAN_KEY = 'limitedByPlan';

/**
 * Flat capability gate read by `PlanGuard` (TDD §3.9). `@RequiresPlan('PRO')` on webhook
 * creation is the only route this decorates at this step — reads/deletes stay un-gated (§11).
 */
export const RequiresPlan = (plan: Plan): MethodDecorator => SetMetadata(REQUIRES_PLAN_KEY, plan);

/**
 * Counted cap read by `PlanGuard` (TDD §3.9). The resource name is one of
 * `PLAN_LIMITED_RESOURCES` (`'boards' | 'posts'`) — the guard counts existing rows for the org
 * through `TenantPrismaService` and compares against `PLAN_LIMITS[org.plan][resource]`.
 */
export const LimitedByPlan = (resource: PlanLimitedResource): MethodDecorator =>
  SetMetadata(LIMITED_BY_PLAN_KEY, resource);
