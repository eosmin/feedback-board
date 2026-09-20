import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '@feedback-board/core';
import type { AuthenticatedRequest } from '../../database/tenant-prisma.service';

/**
 * Resolves the org by its `:orgSlug` path param, looks up the caller's `Membership` row, and
 * attaches `request.orgId` + `request.role` (TDD §3.4). Runs on the **admin** client: this
 * lookup executes before any tenant is known, so there is no `app.org_id` yet for a
 * `TenantPrismaService` query to run under. `orgs` and `memberships` both carry RLS policies
 * (§3.3) — the admin role's `BYPASSRLS` (§2.6.11c) is what lets this query see them, not a gap
 * in the policy set (decision D4). Scoped by `request.userId`, taken from the verified JWT —
 * never from the path or body.
 *
 * Injects `PrismaService` via `@Inject` with a type-only import per decision D10: a same-package
 * class-typed constructor parameter would make `emitDecoratorMetadata` emit an untestable
 * circular-import guard that this app's 90% branch-coverage gate on `./src/orgs/guards/`
 * (§14.1) cannot exempt without a banned `istanbul ignore` comment. `PrismaService` lives in a
 * different package here, but the same emission happens for any class-typed parameter of a
 * class imported from outside the current file, so the same fix applies.
 */
@Injectable()
export class OrgGuard implements CanActivate {
  constructor(@Inject(PrismaService) private readonly admin: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const orgSlug = (request.params as Record<string, string | undefined>).orgSlug;
    const userId = request.userId;

    if (orgSlug === undefined || userId === undefined) {
      throw new ForbiddenException();
    }

    const org = await this.admin.client.org.findUnique({
      where: { slug: orgSlug },
      select: { id: true },
    });

    if (org === null) {
      throw new ForbiddenException();
    }

    const membership = await this.admin.client.membership.findUnique({
      where: { userId_orgId: { userId, orgId: org.id } },
      select: { role: true },
    });

    if (membership === null) {
      throw new ForbiddenException();
    }

    request.orgId = org.id;
    request.role = membership.role;

    return true;
  }
}
