import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@feedback-board/core';
import type { Profile } from '@feedback-board/shared';

import { isRecordNotFound } from '../database/record-not-found';
import type { UpdateProfileDto } from './dto/update-profile.dto';

/**
 * `GET /me` and `PATCH /me` act on the caller's own `users` row, found by the JWT-derived
 * `userId` and nothing the client sends, so no `app.org_id` exists to set and the tenant role
 * has no write policy on `users`. They run on `PrismaService` (admin client): the sixth
 * enumerated admin-client caller (§3.2), touching only `users`, only the caller's row, and only
 * its `name`.
 */
@Injectable()
export class ProfileService {
  constructor(@Inject(PrismaService) private readonly admin: PrismaService) {}

  async get(userId: string): Promise<Profile> {
    const user = await this.admin.client.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true },
    });

    if (user === null) {
      throw new NotFoundException({ error: 'NOT_FOUND' });
    }

    return user;
  }

  async update(userId: string, dto: UpdateProfileDto): Promise<Profile> {
    try {
      return await this.admin.client.user.update({
        where: { id: userId },
        data: { name: dto.name.trim() },
        select: { id: true, email: true, name: true },
      });
    } catch (error) {
      // P2025: no row with that id, the same 404 as `get`.
      if (isRecordNotFound(error)) {
        throw new NotFoundException({ error: 'NOT_FOUND' });
      }
      throw error;
    }
  }
}
