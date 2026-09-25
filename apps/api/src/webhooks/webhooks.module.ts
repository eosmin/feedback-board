import { Module } from '@nestjs/common';

import { OrgsModule } from '../orgs/orgs.module';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';

/**
 * `TenantPrismaService` is not re-provided here: `OrgsModule` already registers it and exports
 * the guard chain (`OrgGuard`, `RolesGuard`, `PlanGuard`) this controller depends on (TDD §7.1)
 * — the same pattern `BoardsModule`/`PostsModule` use. This module needs no `QueueModule`: it
 * never enqueues anything itself — `PostsService` does, at `post.created`/`post.status_changed`
 * (TDD §3.7).
 */
@Module({
  imports: [OrgsModule],
  controllers: [WebhooksController],
  providers: [WebhooksService],
})
export class WebhooksModule {}
