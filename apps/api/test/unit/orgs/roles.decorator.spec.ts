import { Reflector } from '@nestjs/core';

import { ROLES_KEY, Roles } from '../../../src/orgs/roles.decorator';

describe('Roles decorator', () => {
  it('sets the roles metadata key to the given roles', () => {
    class Controller {
      @Roles('OWNER', 'ADMIN')
      handler(): void {
        /* no-op */
      }
    }

    const reflector = new Reflector();
    const metadata = reflector.get<string[]>(ROLES_KEY, new Controller().handler);

    expect(metadata).toEqual(['OWNER', 'ADMIN']);
  });
});
