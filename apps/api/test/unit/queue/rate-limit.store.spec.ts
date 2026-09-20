import type { Redis } from 'ioredis';

import { RateLimitStore } from '../../../src/queue/rate-limit.store';

function buildRedis(): { redis: Redis; incr: jest.Mock; pexpire: jest.Mock } {
  const incr = jest.fn();
  const pexpire = jest.fn().mockResolvedValue(1);
  return { redis: { incr, pexpire } as unknown as Redis, incr, pexpire };
}

describe('RateLimitStore', () => {
  it('sets a TTL on the first hit', async () => {
    const { redis, incr, pexpire } = buildRedis();
    incr.mockResolvedValue(1);
    const store = new RateLimitStore(redis);

    const count = await store.hit('ratelimit:ai-digest:org-1', 3_600_000);

    expect(count).toBe(1);
    expect(incr).toHaveBeenCalledWith('ratelimit:ai-digest:org-1');
    expect(pexpire).toHaveBeenCalledWith('ratelimit:ai-digest:org-1', 3_600_000);
  });

  it('does not re-set the TTL on a later hit within the same window', async () => {
    const { redis, incr, pexpire } = buildRedis();
    incr.mockResolvedValue(2);
    const store = new RateLimitStore(redis);

    const count = await store.hit('ratelimit:ai-digest:org-1', 3_600_000);

    expect(count).toBe(2);
    expect(pexpire).not.toHaveBeenCalled();
  });
});
