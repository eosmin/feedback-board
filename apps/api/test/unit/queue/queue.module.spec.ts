import { Test } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { QUEUES } from '@feedback-board/core';
import type { TestingModule } from '@nestjs/testing';
import type { Queue } from 'bullmq';

import { QueueModule } from '../../../src/queue/queue.module';
import { REDIS_CONNECTION } from '../../../src/queue/redis.connection';
import { closeTestingModule } from '../../fixtures/close-testing-module';

describe('QueueModule', () => {
  let moduleRef: TestingModule | undefined;

  afterEach(async () => {
    await closeTestingModule(moduleRef);
  });

  it('registers both queues against the shared connection', async () => {
    moduleRef = await Test.createTestingModule({
      imports: [QueueModule],
    })
      // Never opens a real Redis connection in a unit test — same pattern as
      // orgs.module.spec.ts/posts.module.spec.ts for the same token.
      .overrideProvider(REDIS_CONNECTION)
      .useValue({})
      .compile();

    const webhooksQueue = moduleRef.get<Queue>(getQueueToken(QUEUES.WEBHOOKS));
    const aiClassifyQueue = moduleRef.get<Queue>(getQueueToken(QUEUES.AI_CLASSIFY));

    expect(webhooksQueue).toBeDefined();
    expect(aiClassifyQueue).toBeDefined();
  });
});
