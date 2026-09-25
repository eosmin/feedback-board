import { Module } from '@nestjs/common';

import { TenantPrismaService } from '../database/tenant-prisma.service';
import { RedisModule } from '../queue/redis.module';
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
 * `RedisModule` (not a local `redisConnectionProvider` in `providers`) supplies
 * `REDIS_CONNECTION` — the same `@Global()` module `QueueModule` (Step 10) imports, so
 * `RateLimitStore` here and the BullMQ producer there share the one real `ioredis` connection
 * this process holds (TDD §2.6.14), instead of each module constructing its own.
 *
 * Guards, `TenantPrismaService` and `RateLimitStore` are exported so `BoardsModule`/
 * `PostsModule` (Step 9) can reuse the same instances rather than duplicating guard classes or
 * a second tenant-scoped client across modules (TDD §7.1) — `BoardsService` injects
 * `TenantPrismaService` directly, the same way `OrgsService` and `PlanGuard` already do here.
 * `RateLimitStore` specifically must be exported, not just `OrgRateLimitGuard`: Nest resolves a
 * constructor dependency from the *importing* module's own provider graph, not from whatever
 * module originally declared the class that needs it — `BoardsModule` (Step 15) imports
 * `OrgsModule` and uses `OrgRateLimitGuard` on its own controller, so `RateLimitStore` must be
 * visible there too, or that guard's own dependency fails to resolve with "Nest can't resolve
 * dependencies of OrgRateLimitGuard" the moment a second module puts it on a route.
 */
@Module({
  imports: [RedisModule],
  controllers: [OrgsController],
  providers: [
    OrgsService,
    TenantPrismaService,
    RateLimitStore,
    OrgGuard,
    RolesGuard,
    PlanGuard,
    OrgRateLimitGuard,
  ],
  exports: [
    TenantPrismaService,
    RateLimitStore,
    OrgGuard,
    RolesGuard,
    PlanGuard,
    OrgRateLimitGuard,
  ],
})
export class OrgsModule {}
