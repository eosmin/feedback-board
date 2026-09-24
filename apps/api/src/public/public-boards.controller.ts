import { Controller, Get, Inject, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { PublicBoard, PublicPost } from '@feedback-board/shared';

import { Public } from '../auth/public.decorator';
import { PublicBoardsService } from './public-boards.service';
import type { PublicBoardsService as PublicBoardsReader } from './public-boards.service';

/**
 * Read-only by design: there is no vote, comment or create route under `/public/*` (TDD §11).
 * `@Public()` sits on each handler rather than on the class, so a route added here later is
 * authenticated unless someone opts it out on purpose. No `OrgGuard` chain: there is no
 * member and no tenant session, and the `isPublic` check lives in the service.
 *
 * Two spellings exist only to keep `emitDecoratorMetadata` from emitting branches no test can
 * reach, which would sink the 85% branch gate on `./src/public/` (§14.1):
 * - the service is injected by token with a type-only import (decision D10);
 * - handlers return `globalThis.Promise<T>`, which emits `design:returntype` as a plain
 *   `Object`. A bare `Promise<T>` emits a `typeof Promise !== "undefined"` guard under
 *   `isolatedModules`. The type is identical; Nest routing never reads the return metadata.
 */
@ApiTags('public')
@Controller('public/:orgSlug/:boardSlug')
export class PublicBoardsController {
  constructor(@Inject(PublicBoardsService) private readonly publicBoards: PublicBoardsReader) {}

  @Public()
  @Get()
  async getBoard(
    @Param('orgSlug') orgSlug: string,
    @Param('boardSlug') boardSlug: string,
  ): globalThis.Promise<PublicBoard> {
    return this.publicBoards.getBoard(orgSlug, boardSlug);
  }

  @Public()
  @Get('posts')
  async listPosts(
    @Param('orgSlug') orgSlug: string,
    @Param('boardSlug') boardSlug: string,
  ): globalThis.Promise<PublicPost[]> {
    return this.publicBoards.listPosts(orgSlug, boardSlug);
  }
}
