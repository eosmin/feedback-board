import { Reflector } from '@nestjs/core';

import { RATE_LIMIT_KEY, RateLimit } from '../../../src/orgs/rate-limit.decorator';
import type { RateLimitOptions } from '../../../src/orgs/rate-limit.decorator';

describe('RateLimit decorator', () => {
  it('sets the rateLimit metadata key to the given options', () => {
    class Controller {
      @RateLimit({ limit: 5, ttlMs: 3_600_000 })
      handler(): void {
        /* no-op */
      }
    }

    const reflector = new Reflector();
    const metadata = reflector.get<RateLimitOptions>(RATE_LIMIT_KEY, new Controller().handler);

    expect(metadata).toEqual({ limit: 5, ttlMs: 3_600_000 });
  });
});
