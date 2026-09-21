import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Board, BoardDetail } from '@feedback-board/shared';

import { OrgGuard } from '../orgs/guards/org.guard';
import { RolesGuard } from '../orgs/guards/roles.guard';
import { PlanGuard } from '../orgs/guards/plan.guard';
import { Roles } from '../orgs/roles.decorator';
import { LimitedByPlan } from '../orgs/plan.decorator';
import type { AuthenticatedRequest } from '../database/tenant-prisma.service';
import { BoardsService } from './boards.service';
import { CreateBoardDto } from './dto/create-board.dto';

/**
 * Every route here sits under `/orgs/:orgSlug/*`, so it carries the full guard chain in the
 * order TDD §11 requires: `OrgGuard` (resolves tenant + membership) → `RolesGuard` (role check)
 * → `PlanGuard` (plan cap/capability check). `@UseGuards` at the class level applies to every
 * handler; `@Roles`/`@LimitedByPlan` are per-handler metadata `RolesGuard`/`PlanGuard` read.
 */
@ApiTags('boards')
@ApiBearerAuth()
@UseGuards(OrgGuard, RolesGuard, PlanGuard)
@Controller('orgs/:orgSlug/boards')
export class BoardsController {
  constructor(private readonly boardsService: BoardsService) {}

  @Roles('OWNER', 'ADMIN')
  @LimitedByPlan('boards')
  @Post()
  async create(
    @Req() request: AuthenticatedRequest,
    @Param('orgSlug') _orgSlug: string,
    @Body() dto: CreateBoardDto,
  ): Promise<Board> {
    // OrgGuard, which ran just above, always sets orgId before returning true — the check
    // below narrows AuthenticatedRequest's optional field, the same pattern OrgsController
    // uses for userId (TDD §3.4).
    if (request.orgId === undefined) {
      throw new ForbiddenException();
    }
    return this.boardsService.create(request.orgId, dto);
  }

  @Get()
  async list(@Param('orgSlug') _orgSlug: string): Promise<Board[]> {
    return this.boardsService.list();
  }

  @Get(':boardSlug')
  async detail(
    @Param('orgSlug') _orgSlug: string,
    @Param('boardSlug') boardSlug: string,
  ): Promise<BoardDetail> {
    return this.boardsService.getDetail(boardSlug);
  }
}
