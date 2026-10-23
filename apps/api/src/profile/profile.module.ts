import { Module } from '@nestjs/common';

import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';

/** `PrismaService` comes from the global `DatabaseModule.forRoot()`, as in `OrgsModule`. */
@Module({
  controllers: [ProfileController],
  providers: [ProfileService],
})
export class ProfileModule {}
