import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { AiService, DatabaseModule } from '@feedback-board/core';
import type { TestingModule } from '@nestjs/testing';

import { BoardsModule } from '../../../src/boards/boards.module';
import { BoardsController } from '../../../src/boards/boards.controller';
import { REDIS_CONNECTION } from '../../../src/queue/redis.connection';
import { closeTestingModule } from '../../fixtures/close-testing-module';

describe('BoardsModule', () => {
  let moduleRef: TestingModule | undefined;

  afterEach(async () => {
    await closeTestingModule(moduleRef);
  });

  it('compiles, builds AiService from config, and resolves BoardsController', async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [
            (): Record<string, string> => ({
              AI_DIGEST_MODEL: 'anthropic/claude-sonnet-5',
            }),
          ],
        }),
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

    expect(moduleRef.get(AiService)).toBeInstanceOf(AiService);

    // BoardsController depends (transitively, via TenantPrismaService) on the REQUEST token,
    // which makes Nest treat it as request-scoped too — moduleRef.get() only works for
    // singletons, so a scoped provider needs resolve() instead (same note as orgs.module.spec.ts).
    await expect(moduleRef.resolve(BoardsController)).resolves.toBeInstanceOf(BoardsController);
  });
});
