import { Reflector } from '@nestjs/core';

import {
  LIMITED_BY_PLAN_KEY,
  LimitedByPlan,
  REQUIRES_PLAN_KEY,
  RequiresPlan,
} from '../../../src/orgs/plan.decorator';

describe('RequiresPlan decorator', () => {
  it('sets the requiresPlan metadata key to the given plan', () => {
    class Controller {
      @RequiresPlan('PRO')
      handler(): void {
        /* no-op */
      }
    }

    const reflector = new Reflector();
    const metadata = reflector.get<string>(REQUIRES_PLAN_KEY, new Controller().handler);

    expect(metadata).toBe('PRO');
  });
});

describe('LimitedByPlan decorator', () => {
  it('sets the limitedByPlan metadata key to the given resource', () => {
    class Controller {
      @LimitedByPlan('boards')
      handler(): void {
        /* no-op */
      }
    }

    const reflector = new Reflector();
    const metadata = reflector.get<string>(LIMITED_BY_PLAN_KEY, new Controller().handler);

    expect(metadata).toBe('boards');
  });
});
