import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Webhook, WebhookCreated, WebhookDelivery } from '@feedback-board/shared';

import { OrgGuard } from '../orgs/guards/org.guard';
import { RolesGuard } from '../orgs/guards/roles.guard';
import { PlanGuard } from '../orgs/guards/plan.guard';
import { Roles } from '../orgs/roles.decorator';
import { RequiresPlan } from '../orgs/plan.decorator';
import type { AuthenticatedRequest } from '../database/tenant-prisma.service';
import { WebhooksService } from './webhooks.service';
import { CreateWebhookDto } from './dto/create-webhook.dto';

/**
 * Every route here is OWNER/ADMIN (TDD §11) — `@RequiresPlan('PRO')` sits on `create()` alone.
 * Reads and `delete()` carry no plan decorator on purpose: gating them would contradict §3.7
 * step 6 (a downgraded org keeps its rows, deactivated, and the dashboard renders them from the
 * un-gated list) and make the un-gated `DELETE` unusable (the list is the only place an admin
 * learns a webhook's id).
 */
@ApiTags('webhooks')
@ApiBearerAuth()
@UseGuards(OrgGuard, RolesGuard, PlanGuard)
@Controller('orgs/:orgSlug/webhooks')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Roles('OWNER', 'ADMIN')
  @RequiresPlan('PRO')
  @Post()
  async create(
    @Req() request: AuthenticatedRequest,
    @Param('orgSlug') _orgSlug: string,
    @Body() dto: CreateWebhookDto,
  ): Promise<WebhookCreated> {
    if (request.orgId === undefined) {
      throw new ForbiddenException();
    }
    return this.webhooksService.create(request.orgId, dto);
  }

  @Roles('OWNER', 'ADMIN')
  @Get()
  async list(@Param('orgSlug') _orgSlug: string): Promise<Webhook[]> {
    return this.webhooksService.list();
  }

  @Roles('OWNER', 'ADMIN')
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('orgSlug') _orgSlug: string, @Param('id') id: string): Promise<void> {
    await this.webhooksService.delete(id);
  }

  @Roles('OWNER', 'ADMIN')
  @Get(':id/deliveries')
  async listDeliveries(
    @Param('orgSlug') _orgSlug: string,
    @Param('id') id: string,
  ): Promise<WebhookDelivery[]> {
    return this.webhooksService.listDeliveries(id);
  }
}
