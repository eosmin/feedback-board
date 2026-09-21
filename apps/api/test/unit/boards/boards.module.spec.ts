import { Test } from '@nestjs/testing';
import { DatabaseModule } from '@feedback-board/core';

import { BoardsModule } from '../../../src/boards/boards.module';
import { BoardsController } from '../../../src/boards/boards.controller';
import { REDIS_CONNECTION } from '../../../src/queue/redis.connection';

describe('BoardsModule', () => {
  it('compiles and resolves BoardsController', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        DatabaseModule.forRoot({
          databaseUrl: 'postgresql://app:pw@localhost:5432/postgres',
          adminDatabaseUrl: 'postgresql://owner:pw@localhost:5432/postgres',
        }),
        BoardsModule,
      ],
    })
      // Same override as orgs.module.spec.ts (Step 8): this test only cares that DI wiring
      // resolves, not that a real Redis connection opens.
      .overrideProvider(REDIS_CONNECTION)
      .useValue({})
      .compile();

    // BoardsController depends (transitively, via TenantPrismaService) on the REQUEST token,
    // which makes Nest treat it as request-scoped too — moduleRef.get() only works for
    // singletons, so a scoped provider needs resolve() instead (same note as orgs.module.spec.ts).
    await expect(moduleRef.resolve(BoardsController)).resolves.toBeInstanceOf(BoardsController);
  });
});
