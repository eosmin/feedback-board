import { Module } from '@nestjs/common';

import { OrgsModule } from '../orgs/orgs.module';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';
import { VotesService } from './votes.service';
import { CommentsService } from './comments.service';

/**
 * `TenantPrismaService` is not re-provided here: `OrgsModule` already registers it and exports
 * the guard chain (`OrgGuard`, `RolesGuard`, `PlanGuard`) this controller depends on (TDD §7.1)
 * — importing `OrgsModule` reuses those singletons rather than constructing a second set of
 * guards bound to a second `TenantPrismaService` instance, the same pattern `BoardsModule` uses.
 * `VotesService`/`CommentsService` are providers-only, like `PostsService`: neither has a route
 * of its own, only handlers on `PostsController`.
 */
@Module({
  imports: [OrgsModule],
  controllers: [PostsController],
  providers: [PostsService, VotesService, CommentsService],
})
export class PostsModule {}
