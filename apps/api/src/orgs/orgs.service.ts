import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '@feedback-board/core';
import {
  PLAN_LIMITS,
  orgSlugSchema,
  type OrgDetail,
  type OrgSummary,
  type Role,
} from '@feedback-board/shared';

import { TenantPrismaService } from '../database/tenant-prisma.service';
import type { CreateOrgDto } from './dto/create-org.dto';

/**
 * `POST /orgs` and `GET /orgs` are the declared collection-route exception (TDD §11): no org
 * exists yet (create) or many do (list), so `OrgGuard` cannot run and there is no single
 * `app.org_id` to set. Both run on `PrismaService` (admin client), filtered by the JWT-derived
 * `userId`, touching only `orgs` and `memberships` — the second and third of the five
 * enumerated admin-client callers (§3.2).
 */
@Injectable()
export class OrgsService {
  constructor(
    @Inject(PrismaService) private readonly admin: PrismaService,
    private readonly tenantPrisma: TenantPrismaService,
  ) {}

  /** Creates the org and bootstraps a `Membership` with role `OWNER` for the creator, atomically. */
  async create(userId: string, dto: CreateOrgDto): Promise<OrgSummary> {
    const slugResult = orgSlugSchema.safeParse(dto.slug);

    if (!slugResult.success) {
      throw new ConflictException({ error: 'CONFLICT' });
    }

    const org = await this.admin.client.$transaction(async (tx) => {
      const created = await tx.org.create({
        data: { name: dto.name, slug: dto.slug },
      });

      await tx.membership.create({
        data: { userId, orgId: created.id, role: 'OWNER' },
      });

      return created;
    });

    return { id: org.id, name: org.name, slug: org.slug, plan: org.plan, role: 'OWNER' };
  }

  /** The orgs `userId` is a member of, each carrying that member's own role (TDD §11). */
  async listForUser(userId: string): Promise<OrgSummary[]> {
    const memberships = await this.admin.client.membership.findMany({
      where: { userId },
      select: { role: true, org: { select: { id: true, name: true, slug: true, plan: true } } },
    });

    return memberships.map((membership) => ({
      id: membership.org.id,
      name: membership.org.name,
      slug: membership.org.slug,
      plan: membership.org.plan,
      role: membership.role,
    }));
  }

  /**
   * `GET /orgs/:orgSlug` — resolved by `OrgGuard` before this runs, so `orgId`/`role` are
   * already on the request. Usage counts run through `TenantPrismaService`, the same client
   * `PlanGuard` uses, so this response and the guard's enforcement can never disagree (§11).
   */
  async getDetail(orgId: string, role: Role): Promise<OrgDetail> {
    const org = await this.admin.client.org.findUniqueOrThrow({
      where: { id: orgId },
      select: { id: true, name: true, slug: true, plan: true },
    });

    const limits = PLAN_LIMITS[org.plan];

    const [boardsUsed, postsUsed] = await Promise.all([
      this.tenantPrisma.run((tx) => tx.board.count()),
      this.tenantPrisma.run((tx) => tx.post.count()),
    ]);

    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      plan: org.plan,
      role,
      usage: {
        boards: { used: boardsUsed, cap: limits.boards },
        posts: { used: postsUsed, cap: limits.posts },
        webhooks: { available: limits.webhooks },
      },
    };
  }
}
