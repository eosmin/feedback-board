import type { Redis } from 'ioredis';

import { RateLimitStore } from '../../../src/queue/rate-limit.store';

function buildRedis(): {
  redis: Redis;
  incr: jest.Mock;
  pexpire: jest.Mock;
  evalMock: jest.Mock;
} {
  const incr = jest.fn();
  const pexpire = jest.fn().mockResolvedValue(1);
  const evalMock = jest.fn().mockResolvedValue(undefined);
  return { redis: { incr, pexpire, eval: evalMock } as unknown as Redis, incr, pexpire, evalMock };
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

  describe('release', () => {
    it('runs the decrement-and-clamp as a single atomic Lua script, keyed on the counter', async () => {
      const { redis, evalMock } = buildRedis();
      const store = new RateLimitStore(redis);

      await store.release('ratelimit:ai-digest:org-1');

      expect(evalMock).toHaveBeenCalledTimes(1);
      expect(evalMock).toHaveBeenCalledWith(expect.stringContaining('DECR'), 1, 'ratelimit:ai-digest:org-1');
      expect(evalMock.mock.calls[0]?.[0]).toContain('KEEPTTL');
    });
  });
});
