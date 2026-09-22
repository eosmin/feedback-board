import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Post as PostModel } from '@feedback-board/shared';

import { OrgGuard } from '../orgs/guards/org.guard';
import { RolesGuard } from '../orgs/guards/roles.guard';
import { PlanGuard } from '../orgs/guards/plan.guard';
import { Roles } from '../orgs/roles.decorator';
import { LimitedByPlan } from '../orgs/plan.decorator';
import type { AuthenticatedRequest } from '../database/tenant-prisma.service';
import { PostsService } from './posts.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostStatusDto } from './dto/update-post-status.dto';

/**
 * Two path shapes share this controller (TDD §11): creation and the board-scoped list nest
 * under `/orgs/:orgSlug/boards/:boardSlug/posts`, while single-post read/update sit directly
 * under `/orgs/:orgSlug/posts/:postId` — a post's own id is already globally addressable within
 * the org, and requiring the board slug on every route would be redundant. Both shapes carry the
 * full guard chain (`OrgGuard` → `RolesGuard` → `PlanGuard`) per TDD §11's two cross-cutting rules.
 */
function requireOrgId(request: AuthenticatedRequest): string {
  if (request.orgId === undefined) {
    throw new ForbiddenException();
  }
  return request.orgId;
}

function requireUserId(request: AuthenticatedRequest): string {
  if (request.userId === undefined) {
    throw new UnauthorizedException();
  }
  return request.userId;
}

@ApiTags('posts')
@ApiBearerAuth()
@UseGuards(OrgGuard, RolesGuard, PlanGuard)
@Controller('orgs/:orgSlug')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @LimitedByPlan('posts')
  @Post('boards/:boardSlug/posts')
  async create(
    @Req() request: AuthenticatedRequest,
    @Param('orgSlug') _orgSlug: string,
    @Param('boardSlug') boardSlug: string,
    @Body() dto: CreatePostDto,
  ): Promise<PostModel> {
    const orgId = requireOrgId(request);
    const userId = requireUserId(request);
    const board = await this.postsService.resolveBoardId(boardSlug);
    return this.postsService.create(orgId, board, userId, dto);
  }

  @Get('boards/:boardSlug/posts')
  async listForBoard(
    @Param('orgSlug') _orgSlug: string,
    @Param('boardSlug') boardSlug: string,
  ): Promise<PostModel[]> {
    return this.postsService.listForBoard(boardSlug);
  }

  @Get('posts/:postId')
  async detail(
    @Param('orgSlug') _orgSlug: string,
    @Param('postId') postId: string,
  ): Promise<PostModel> {
    return this.postsService.getById(postId);
  }

  @Roles('OWNER', 'ADMIN')
  @Patch('posts/:postId')
  async updateStatus(
    @Param('orgSlug') _orgSlug: string,
    @Param('postId') postId: string,
    @Body() dto: UpdatePostStatusDto,
  ): Promise<PostModel> {
    return this.postsService.updateStatus(postId, dto);
  }
}
