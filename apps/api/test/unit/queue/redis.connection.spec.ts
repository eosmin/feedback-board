import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';

import { redisConnectionProvider } from '../../../src/queue/redis.connection';
import type { Env } from '../../../src/config/env.schema';

jest.mock('ioredis', () => ({
  Redis: jest.fn().mockImplementation(() => ({ mocked: true })),
}));

const MockedRedis = Redis as unknown as jest.Mock;

function buildConfig(redisUrl: string): ConfigService<Env, true> {
  return { get: () => redisUrl } as unknown as ConfigService<Env, true>;
}

describe('redisConnectionProvider', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("builds an ioredis connection from REDIS_URL with ioredis's finite default retry behaviour", () => {
    const config = buildConfig('redis://localhost:6379');

    const connection = redisConnectionProvider.useFactory(config);

    // No maxRetriesPerRequest override: the producer connection must fail fast on a Redis
    // outage rather than hang the HTTP request that is enqueueing a job (TDD §2.6.14) — the
    // opposite of apps/worker's connection, which sets it to null.
    expect(MockedRedis).toHaveBeenCalledWith('redis://localhost:6379');
    expect(connection).toEqual({ mocked: true });
  });
});
