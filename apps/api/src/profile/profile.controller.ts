import { Body, Controller, Get, Patch, Req, UnauthorizedException } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Profile } from '@feedback-board/shared';

import type { AuthenticatedRequest } from '../database/tenant-prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ProfileService } from './profile.service';

/**
 * `JwtAuthGuard` is global and this controller carries no `@Public()`, so `request.userId` is
 * always set by the time a handler runs — the check narrows the optional field.
 */
function requireUserId(request: AuthenticatedRequest): string {
  if (request.userId === undefined) {
    throw new UnauthorizedException();
  }
  return request.userId;
}

/** `/me` carries no `OrgGuard`: a person's profile does not belong to any one org. */
@ApiTags('profile')
@ApiBearerAuth()
@Controller('me')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get()
  async get(@Req() request: AuthenticatedRequest): Promise<Profile> {
    return this.profileService.get(requireUserId(request));
  }

  @Patch()
  async update(
    @Req() request: AuthenticatedRequest,
    @Body() dto: UpdateProfileDto,
  ): Promise<Profile> {
    return this.profileService.update(requireUserId(request), dto);
  }
}
