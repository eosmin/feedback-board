import {
  Controller,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { BillingSession } from '@feedback-board/shared';

import { OrgGuard } from '../orgs/guards/org.guard';
import { RolesGuard } from '../orgs/guards/roles.guard';
import { PlanGuard } from '../orgs/guards/plan.guard';
import { Roles } from '../orgs/roles.decorator';
import type { AuthenticatedRequest } from '../database/tenant-prisma.service';
import { BillingService } from './billing.service';
import type { BillingService as Billing } from './billing.service';

/**
 * OWNER-only (TDD §11). The full chain runs in the §11 order even though neither route carries
 * a plan decorator: a FREE org is exactly the one that needs Checkout. `orgId` comes from
 * `OrgGuard`, never from the path or body. Handlers return `globalThis.Promise<T>` so
 * `emitDecoratorMetadata` emits no untestable branch under the `./src/billing/` gate — the same
 * spelling `PublicBoardsController` documents.
 */
@ApiTags('billing')
@ApiBearerAuth()
@UseGuards(OrgGuard, RolesGuard, PlanGuard)
@Controller('orgs/:orgSlug/billing')
export class BillingController {
  constructor(@Inject(BillingService) private readonly billing: Billing) {}

  @Roles('OWNER')
  @Post('checkout-session')
  @HttpCode(HttpStatus.OK)
  async createCheckoutSession(
    @Req() request: AuthenticatedRequest,
    @Param('orgSlug') _orgSlug: string,
  ): globalThis.Promise<BillingSession> {
    return this.billing.createCheckoutSession(request.orgId as string);
  }

  @Roles('OWNER')
  @Post('portal-session')
  @HttpCode(HttpStatus.OK)
  async createPortalSession(
    @Req() request: AuthenticatedRequest,
    @Param('orgSlug') _orgSlug: string,
  ): globalThis.Promise<BillingSession> {
    return this.billing.createPortalSession(request.orgId as string);
  }
}
