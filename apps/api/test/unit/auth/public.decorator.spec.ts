import { Reflector } from '@nestjs/core';

import { IS_PUBLIC_KEY, Public } from '../../../src/auth/public.decorator';

describe('Public decorator', () => {
  it('sets the isPublic metadata key to true on a method', () => {
    class Controller {
      @Public()
      handler(): void {
        /* no-op */
      }
    }

    const reflector = new Reflector();
    const metadata = reflector.get<boolean>(IS_PUBLIC_KEY, new Controller().handler);

    expect(metadata).toBe(true);
  });
});
