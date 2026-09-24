import { Test } from '@nestjs/testing';
import { DatabaseModule } from '@feedback-board/core';
import type { TestingModule } from '@nestjs/testing';

import { PublicModule } from '../../../src/public/public.module';
import { PublicBoardsController } from '../../../src/public/public-boards.controller';
import { closeTestingModule } from '../../fixtures/close-testing-module';

describe('PublicModule', () => {
  let moduleRef: TestingModule | undefined;

  afterEach(async () => {
    await closeTestingModule(moduleRef);
  });

  it('compiles with only the global DatabaseModule and resolves PublicBoardsController', async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        DatabaseModule.forRoot({
          databaseUrl: 'postgresql://app:pw@localhost:5432/postgres',
          adminDatabaseUrl: 'postgresql://owner:pw@localhost:5432/postgres',
        }),
        PublicModule,
      ],
    }).compile();

    // A singleton, unlike BoardsController: nothing here injects the request-scoped
    // TenantPrismaService, so get() works where the other module specs need resolve().
    expect(moduleRef.get(PublicBoardsController)).toBeInstanceOf(PublicBoardsController);
  });
});
