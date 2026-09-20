import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PLAN_LIMITS, type Plan, type PlanLimitedResource } from '@feedback-board/shared';

import { LIMITED_BY_PLAN_KEY, REQUIRES_PLAN_KEY } from '../plan.decorator';
import { TenantPrismaService } from '../../database/tenant-prisma.service';
import type { AuthenticatedRequest } from '../../database/tenant-prisma.service';

/** The stable, machine-readable refusal body every `PlanGuard` rejection returns (TDD §3.9). */
export interface PlanLimitBody {
  readonly error: 'PLAN_LIMIT';
  readonly limit: string;
  readonly plan: Plan;
  readonly cap: number | boolean;
}

/**
 * Enforces `@RequiresPlan` (flat capability) and `@LimitedByPlan` (counted cap) against
 * `Org.plan` (TDD §3.9) — never against the `Subscription` row, so a billing outage cannot
 * accidentally downgrade a live tenant. Counting queries run through `TenantPrismaService`
 * (injected here, which makes this guard request-scoped too — accepted per §3.9, so it must
 * hold no mutable state between requests, and it holds none).
 */
@Injectable()
export class PlanGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tenantPrisma: TenantPrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const plan = await this.resolvePlan(request);

    const requiredPlan = this.reflector.getAllAndOverride<Plan | undefined>(REQUIRES_PLAN_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (requiredPlan !== undefined && plan !== requiredPlan) {
      throw new ForbiddenException(this.buildBody('webhooks', plan, false));
    }

    const limitedResource = this.reflector.getAllAndOverride<PlanLimitedResource | undefined>(
      LIMITED_BY_PLAN_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (limitedResource !== undefined) {
      const cap = PLAN_LIMITS[plan][limitedResource];

      if (cap !== null) {
        const used = await this.countExisting(limitedResource);

        if (used >= cap) {
          throw new ForbiddenException(this.buildBody(limitedResource, plan, cap));
        }
      }
    }

    return true;
  }

  private async resolvePlan(request: AuthenticatedRequest): Promise<Plan> {
    const orgId = request.orgId;

    if (orgId === undefined) {
      throw new ForbiddenException();
    }

    const org = await this.tenantPrisma.run((tx) =>
      tx.org.findUniqueOrThrow({ where: { id: orgId }, select: { plan: true } }),
    );

    return org.plan;
  }

  private async countExisting(resource: PlanLimitedResource): Promise<number> {
    if (resource === 'boards') {
      return this.tenantPrisma.run((tx) => tx.board.count());
    }

    // 'posts' is counted per org, not per board (§3.9) — TenantPrismaService's runAs already
    // scopes every query to the request's orgId via RLS, so a plain count() here is org-wide.
    return this.tenantPrisma.run((tx) => tx.post.count());
  }

  private buildBody(limit: string, plan: Plan, cap: number | boolean): PlanLimitBody {
    return { error: 'PLAN_LIMIT', limit, plan, cap };
  }
}
