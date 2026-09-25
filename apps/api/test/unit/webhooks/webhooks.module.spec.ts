import { Test } from '@nestjs/testing';
import { DatabaseModule } from '@feedback-board/core';
import type { TestingModule } from '@nestjs/testing';

import { WebhooksModule } from '../../../src/webhooks/webhooks.module';
import { WebhooksController } from '../../../src/webhooks/webhooks.controller';
import { REDIS_CONNECTION } from '../../../src/queue/redis.connection';
import { closeTestingModule } from '../../fixtures/close-testing-module';

describe('WebhooksModule', () => {
  let moduleRef: TestingModule | undefined;

  afterEach(async () => {
    await closeTestingModule(moduleRef);
  });

  it('compiles and resolves WebhooksController', async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        DatabaseModule.forRoot({
          databaseUrl: 'postgresql://app:pw@localhost:5432/postgres',
          adminDatabaseUrl: 'postgresql://owner:pw@localhost:5432/postgres',
        }),
        WebhooksModule,
      ],
    })
      // Same override as boards.module.spec.ts/posts.module.spec.ts: this test only cares that
      // DI wiring resolves via OrgsModule's RedisModule import, not that a real Redis connection
      // opens.
      .overrideProvider(REDIS_CONNECTION)
      .useValue({})
      .compile();

    // WebhooksController depends (transitively, via TenantPrismaService) on the REQUEST token,
    // which makes Nest treat it as request-scoped too — moduleRef.get() only works for
    // singletons, so a scoped provider needs resolve() instead.
    await expect(moduleRef.resolve(WebhooksController)).resolves.toBeInstanceOf(WebhooksController);
  });
});
