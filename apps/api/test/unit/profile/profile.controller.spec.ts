import { UnauthorizedException } from '@nestjs/common';

import { ProfileController } from '../../../src/profile/profile.controller';
import type { ProfileService } from '../../../src/profile/profile.service';
import type { AuthenticatedRequest } from '../../../src/database/tenant-prisma.service';

function buildService(): { service: ProfileService; get: jest.Mock; update: jest.Mock } {
  const get = jest.fn().mockResolvedValue({ id: 'user-1' });
  const update = jest.fn().mockResolvedValue({ id: 'user-1' });
  return { service: { get, update } as unknown as ProfileService, get, update };
}

describe('ProfileController', () => {
  it('reads the profile of the authenticated caller', async () => {
    const { service, get } = buildService();

    await new ProfileController(service).get({ userId: 'user-1' } as AuthenticatedRequest);

    expect(get).toHaveBeenCalledWith('user-1');
  });

  it('updates the profile of the authenticated caller, never of an id from the body', async () => {
    const { service, update } = buildService();

    await new ProfileController(service).update({ userId: 'user-1' } as AuthenticatedRequest, {
      name: 'Ada',
    });

    expect(update).toHaveBeenCalledWith('user-1', { name: 'Ada' });
  });

  it('rejects both routes when userId is missing from the request', async () => {
    const { service } = buildService();
    const controller = new ProfileController(service);
    const request = {} as AuthenticatedRequest;

    await expect(controller.get(request)).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(controller.update(request, { name: 'Ada' })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
