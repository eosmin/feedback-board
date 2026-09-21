import { Module } from '@nestjs/common';

import { OrgsModule } from '../orgs/orgs.module';
import { BoardsController } from './boards.controller';
import { BoardsService } from './boards.service';

/**
 * `TenantPrismaService` is not re-provided here: `OrgsModule` already registers it and exports
 * the guard chain (`OrgGuard`, `RolesGuard`, `PlanGuard`) this controller depends on (TDD §7.1)
 * — importing `OrgsModule` reuses those singletons rather than constructing a second set of
 * guards bound to a second `TenantPrismaService` instance.
 */
@Module({
  imports: [OrgsModule],
  controllers: [BoardsController],
  providers: [BoardsService],
})
export class BoardsModule {}
