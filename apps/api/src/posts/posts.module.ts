import { Module } from '@nestjs/common';

import { OrgsModule } from '../orgs/orgs.module';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';
import { VotesService } from './votes.service';

/**
 * `TenantPrismaService` is not re-provided here: `OrgsModule` already registers it and exports
 * the guard chain (`OrgGuard`, `RolesGuard`, `PlanGuard`) this controller depends on (TDD §7.1)
 * — importing `OrgsModule` reuses those singletons rather than constructing a second set of
 * guards bound to a second `TenantPrismaService` instance, the same pattern `BoardsModule` uses.
 * `VotesService` is providers-only, like `PostsService`: it has no route of its own, only the
 * `POST .../posts/:postId/votes` handler on `PostsController`.
 */
@Module({
  imports: [OrgsModule],
  controllers: [PostsController],
  providers: [PostsService, VotesService],
})
export class PostsModule {}
