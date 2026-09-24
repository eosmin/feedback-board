import { Module } from '@nestjs/common';

import { PublicBoardsController } from './public-boards.controller';
import { PublicBoardsService } from './public-boards.service';

/**
 * Imports nothing: `PrismaService` and `TenantRunner` come from the global
 * `DatabaseModule.forRoot()` registered in `AppModule`, and these routes use none of the
 * `OrgsModule` guards.
 */
@Module({
  controllers: [PublicBoardsController],
  providers: [PublicBoardsService],
})
export class PublicModule {}
