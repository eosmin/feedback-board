import { UnauthorizedException } from '@nestjs/common';

import { OrgsController } from '../../../src/orgs/orgs.controller';
import type { OrgsService } from '../../../src/orgs/orgs.service';
import type { AuthenticatedRequest } from '../../../src/database/tenant-prisma.service';

function buildService(): {
  service: OrgsService;
  create: jest.Mock;
  listForUser: jest.Mock;
  getDetail: jest.Mock;
} {
  const create = jest.fn().mockResolvedValue({ id: 'org-1' });
  const listForUser = jest.fn().mockResolvedValue([]);
  const getDetail = jest.fn().mockResolvedValue({ id: 'org-1' });
  return {
    service: { create, listForUser, getDetail } as unknown as OrgsService,
    create,
    listForUser,
    getDetail,
  };
}

describe('OrgsController', () => {
  it('creates an org for the authenticated caller', async () => {
    const { service, create } = buildService();
    const controller = new OrgsController(service);
    const request = { userId: 'user-1' } as AuthenticatedRequest;

    await controller.create(request, { name: 'Acme', slug: 'acme' });

    expect(create).toHaveBeenCalledWith('user-1', { name: 'Acme', slug: 'acme' });
  });

  it('rejects create when userId is missing from the request', async () => {
    const { service } = buildService();
    const controller = new OrgsController(service);
    const request = {} as AuthenticatedRequest;

    await expect(controller.create(request, { name: 'Acme', slug: 'acme' })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('lists orgs for the authenticated caller', async () => {
    const { service, listForUser } = buildService();
    const controller = new OrgsController(service);
    const request = { userId: 'user-1' } as AuthenticatedRequest;

    await controller.list(request);

    expect(listForUser).toHaveBeenCalledWith('user-1');
  });

  it('returns org detail using orgId/role attached by OrgGuard', async () => {
    const { service, getDetail } = buildService();
    const controller = new OrgsController(service);
    const request = { orgId: 'org-1', role: 'OWNER' } as AuthenticatedRequest;

    await controller.detail(request, 'acme');

    expect(getDetail).toHaveBeenCalledWith('org-1', 'OWNER');
  });
});
