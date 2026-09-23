import { Test } from '@nestjs/testing';
import { DatabaseModule } from '@feedback-board/core';
import type { TestingModule } from '@nestjs/testing';

import { PostsModule } from '../../../src/posts/posts.module';
import { PostsController } from '../../../src/posts/posts.controller';
import { REDIS_CONNECTION } from '../../../src/queue/redis.connection';
import { closeTestingModule } from '../../fixtures/close-testing-module';

describe('PostsModule', () => {
  let moduleRef: TestingModule | undefined;

  afterEach(async () => {
    await closeTestingModule(moduleRef);
  });

  it('compiles and resolves PostsController', async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        DatabaseModule.forRoot({
          databaseUrl: 'postgresql://app:pw@localhost:5432/postgres',
          adminDatabaseUrl: 'postgresql://owner:pw@localhost:5432/postgres',
        }),
        PostsModule,
      ],
    })
      // Same override as boards.module.spec.ts (Step 9.1): this test only cares that DI wiring
      // resolves, not that a real Redis connection opens — QueueModule's BullModule.forRootAsync
      // needs REDIS_CONNECTION to be resolvable, and swapping it for a stub keeps this test from
      // requiring a live Redis instance.
      .overrideProvider(REDIS_CONNECTION)
      .useValue({})
      .compile();

    // PostsController depends (transitively, via TenantPrismaService) on the REQUEST token,
    // which makes Nest treat it as request-scoped too — moduleRef.get() only works for
    // singletons, so a scoped provider needs resolve() instead (same note as boards.module.spec.ts).
    await expect(moduleRef.resolve(PostsController)).resolves.toBeInstanceOf(PostsController);
  });
});
