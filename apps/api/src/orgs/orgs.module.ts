import { Module } from '@nestjs/common';

import { TenantPrismaService } from '../database/tenant-prisma.service';
import { redisConnectionProvider } from '../queue/redis.connection';
import { RateLimitStore } from '../queue/rate-limit.store';
import { OrgGuard } from './guards/org.guard';
import { RolesGuard } from './guards/roles.guard';
import { PlanGuard } from './guards/plan.guard';
import { OrgRateLimitGuard } from './guards/org-rate-limit.guard';
import { OrgsController } from './orgs.controller';
import { OrgsService } from './orgs.service';

/**
 * `PrismaService`/`TenantRunner` are not re-provided here: `DatabaseModule.forRoot()` registers
 * them as `global: true` in `AppModule` (TDD §3.10, packages/core), so `OrgGuard` and
 * `PlanGuard` resolve the same singleton instances by type without this module importing
 * `DatabaseModule` again — doing so would construct a second connection pool.
 *
 * Guards and `TenantPrismaService` are exported so `BoardsModule`/`PostsModule` (Step 9) can
 * reuse the same instances rather than duplicating guard classes or a second tenant-scoped
 * client across modules (TDD §7.1) — `BoardsService` injects `TenantPrismaService` directly,
 * the same way `OrgsService` and `PlanGuard` already do here.
 */
@Module({
  controllers: [OrgsController],
  providers: [
    OrgsService,
    TenantPrismaService,
    redisConnectionProvider,
    RateLimitStore,
    OrgGuard,
    RolesGuard,
    PlanGuard,
    OrgRateLimitGuard,
  ],
  exports: [TenantPrismaService, OrgGuard, RolesGuard, PlanGuard, OrgRateLimitGuard],
})
export class OrgsModule {}
