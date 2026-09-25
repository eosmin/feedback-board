import {
  Body,
  Controller,
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
import type { Board, BoardDetail, BoardDigest } from '@feedback-board/shared';

import { OrgGuard } from '../orgs/guards/org.guard';
import { RolesGuard } from '../orgs/guards/roles.guard';
import { PlanGuard } from '../orgs/guards/plan.guard';
import { OrgRateLimitGuard } from '../orgs/guards/org-rate-limit.guard';
import { Roles } from '../orgs/roles.decorator';
import { LimitedByPlan } from '../orgs/plan.decorator';
import { RateLimit } from '../orgs/rate-limit.decorator';
import type { AuthenticatedRequest } from '../database/tenant-prisma.service';
import { BoardsService } from './boards.service';
import { CreateBoardDto } from './dto/create-board.dto';

/**
 * Every route here sits under `/orgs/:orgSlug/*`, so it carries the full guard chain in the
 * order TDD §11 requires: `OrgGuard` (resolves tenant + membership) → `RolesGuard` (role check)
 * → `PlanGuard` (plan cap/capability check). `OrgRateLimitGuard` is appended, not inserted
 * inside that chain: it reads `request.orgId`, which `OrgGuard` must have already set, and it
 * is a no-op on every route but `ai-digest`, which is the only handler carrying `@RateLimit`
 * (TDD §3.8). `@UseGuards` at the class level applies to every handler; `@Roles`/
 * `@LimitedByPlan`/`@RateLimit` are per-handler metadata the guards read.
 */
@ApiTags('boards')
@ApiBearerAuth()
@UseGuards(OrgGuard, RolesGuard, PlanGuard, OrgRateLimitGuard)
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

  /**
   * `@Roles('OWNER', 'ADMIN')`, not plain membership: a single click here spends real, metered
   * third-party money, so a MEMBER must not be able to trigger it (TDD §3.8, §11).
   * `@RateLimit({ limit: 5, ttlMs: 3_600_000 })` keys the counter on the org via
   * `OrgRateLimitGuard`/`RateLimitStore` — the unit is the org, not the caller, and the counter
   * lives in Redis so it holds across replicas (§3.8).
   */
  @Roles('OWNER', 'ADMIN')
  @RateLimit({ limit: 5, ttlMs: 3_600_000 })
  @Post(':boardSlug/ai-digest')
  @HttpCode(HttpStatus.OK)
  async generateDigest(
    @Param('orgSlug') _orgSlug: string,
    @Param('boardSlug') boardSlug: string,
  ): Promise<BoardDigest> {
    return this.boardsService.generateDigest(boardSlug);
  }
}
