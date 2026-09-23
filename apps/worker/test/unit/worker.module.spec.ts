// worker.module.ts calls validateEnv(process.env) at import time (the same pattern
// apps/api/src/app.module.ts uses), so process.env must already be valid before the module is
// imported — set it first, then import dynamically inside the test.
const REQUIRED_ENV = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://app:pw@localhost:5432/postgres',
  AI_GATEWAY_API_KEY: 'gw_x',
  AI_CLASSIFY_MODEL: 'anthropic/claude-haiku-4.5',
  REDIS_URL: 'redis://localhost:6379',
};

describe('WorkerModule', () => {
  const originalEnv = { ...process.env };
  let moduleRef: import('@nestjs/testing').TestingModule | undefined;

  beforeAll(() => {
    Object.assign(process.env, REQUIRED_ENV);
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  afterEach(async () => {
    const { closeTestingModule } = await import('../fixtures/close-testing-module.js');
    await closeTestingModule(moduleRef);
  });

  it('compiles with DatabaseModule.forTenant, AiModule, LoggerModule and the ai-classify queue registered', async () => {
    const { Test } = await import('@nestjs/testing');
    const { getQueueToken } = await import('@nestjs/bullmq');
    const { AiService, AppPrismaClient, Logger, QUEUES } = await import('@feedback-board/core');
    const { WorkerModule } = await import('../../src/worker.module.js');
    const { REDIS_CONNECTION } = await import('../../src/queue/redis.connection.js');
    const { AiClassifyProcessor } = await import('../../src/processors/ai-classify.processor.js');

    moduleRef = await Test.createTestingModule({ imports: [WorkerModule] })
      .overrideProvider(REDIS_CONNECTION)
      .useValue({})
      // Never constructs a real AppPrismaClient (a real Prisma engine + connection) in a
      // DI-wiring unit test — same technique as apps/api's *.module.spec.ts files use for
      // REDIS_CONNECTION, applied here to the provider DatabaseModule.forTenant registers.
      .overrideProvider(AppPrismaClient)
      .useValue({ client: {}, onModuleDestroy: jest.fn() })
      .compile();

    expect(moduleRef.get(AiService)).toBeDefined();
    expect(moduleRef.get(Logger)).toBeInstanceOf(Logger);
    expect(moduleRef.get(AiClassifyProcessor)).toBeInstanceOf(AiClassifyProcessor);
    expect(moduleRef.get(getQueueToken(QUEUES.AI_CLASSIFY))).toBeDefined();
  });
});
