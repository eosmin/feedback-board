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

  it('builds an ioredis connection from REDIS_URL with maxRetriesPerRequest disabled — mandatory for a BullMQ Worker connection', () => {
    const config = buildConfig('redis://localhost:6379');

    const connection = redisConnectionProvider.useFactory(config);

    expect(MockedRedis).toHaveBeenCalledWith('redis://localhost:6379', {
      maxRetriesPerRequest: null,
    });
    expect(connection).toEqual({ mocked: true });
  });
});
