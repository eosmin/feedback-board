import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { OrgDetail, OrgSummary, Role } from '@feedback-board/shared';

import { CreateOrgDto } from './dto/create-org.dto';
import { OrgsService } from './orgs.service';
import { OrgGuard } from './guards/org.guard';
import type { AuthenticatedRequest } from '../database/tenant-prisma.service';

/**
 * `JwtAuthGuard` is global and this controller carries no `@Public()`, so `request.userId` is
 * always set by the time a handler runs — the check below exists to narrow the optional field
 * on `AuthenticatedRequest`, not because the guard can realistically be skipped.
 */
function requireUserId(request: AuthenticatedRequest): string {
  if (request.userId === undefined) {
    throw new UnauthorizedException();
  }
  return request.userId;
}

/**
 * `POST /orgs` and `GET /orgs` carry no `OrgGuard` (TDD §11) — there is no `:orgSlug` yet. Only
 * `GET /orgs/:orgSlug` does, since it needs the membership lookup to resolve `role` and to
 * scope the usage counts.
 */
@ApiTags('orgs')
@ApiBearerAuth()
@Controller('orgs')
export class OrgsController {
  constructor(private readonly orgsService: OrgsService) {}

  @Post()
  async create(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateOrgDto,
  ): Promise<OrgSummary> {
    return this.orgsService.create(requireUserId(request), dto);
  }

  @Get()
  async list(@Req() request: AuthenticatedRequest): Promise<OrgSummary[]> {
    return this.orgsService.listForUser(requireUserId(request));
  }

  @UseGuards(OrgGuard)
  @Get(':orgSlug')
  async detail(
    @Req() request: AuthenticatedRequest,
    @Param('orgSlug') _orgSlug: string,
  ): Promise<OrgDetail> {
    // OrgGuard, which ran just above, always sets both orgId and role before returning true.
    return this.orgsService.getDetail(request.orgId as string, request.role as Role);
  }
}
