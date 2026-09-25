import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '@feedback-board/core';
import type { TestingModule } from '@nestjs/testing';

import { BullBoardModule } from '../../../src/queue/bull-board.module';
import { REDIS_CONNECTION } from '../../../src/queue/redis.connection';
import { closeTestingModule } from '../../fixtures/close-testing-module';

describe('BullBoardModule', () => {
  let moduleRef: TestingModule | undefined;

  afterEach(async () => {
    await closeTestingModule(moduleRef);
  });

  it('registers no route at all when disabled — a route does not exist rather than 403ing', () => {
    const registered = BullBoardModule.register({ enabled: false });

    expect(registered.imports ?? []).toHaveLength(0);
  });

  it('compiles with QueueModule and the async-registered gate wired when enabled', async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [
            (): Record<string, string> => ({
              SUPABASE_URL: 'http://127.0.0.1:54321',
              BULL_BOARD_ADMIN_EMAILS: 'admin@example.com',
            }),
          ],
        }),
        DatabaseModule.forRoot({
          databaseUrl: 'postgresql://app:pw@localhost:5432/postgres',
          adminDatabaseUrl: 'postgresql://owner:pw@localhost:5432/postgres',
        }),
        BullBoardModule.register({ enabled: true }),
      ],
    })
      // Same override every RedisModule-importing spec in this suite uses: DI wiring only, no
      // real Redis connection.
      .overrideProvider(REDIS_CONNECTION)
      .useValue({})
      .compile();

    // Compiling this tree at all is the assertion: BullBoardRootModule.forRootAsync's useFactory
    // runs during moduleRef construction only when register({ enabled: true }) actually pulled
    // it into the import graph, and it needs AuthModule's JWKS/JWT_ISSUER exports plus
    // ConfigService to resolve.
    expect(moduleRef).toBeDefined();
  });
});
