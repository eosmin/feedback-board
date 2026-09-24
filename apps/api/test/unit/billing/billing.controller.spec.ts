import { Reflector } from '@nestjs/core';
import { GUARDS_METADATA } from '@nestjs/common/constants';

import { BillingController } from '../../../src/billing/billing.controller';
import type { BillingService } from '../../../src/billing/billing.service';
import { OrgGuard } from '../../../src/orgs/guards/org.guard';
import { RolesGuard } from '../../../src/orgs/guards/roles.guard';
import { PlanGuard } from '../../../src/orgs/guards/plan.guard';
import { ROLES_KEY } from '../../../src/orgs/roles.decorator';
import type { AuthenticatedRequest } from '../../../src/database/tenant-prisma.service';

const ORG_ID = '11111111-1111-4111-8111-111111111111';

function buildService(): {
  service: BillingService;
  createCheckoutSession: jest.Mock;
  createPortalSession: jest.Mock;
} {
  const createCheckoutSession = jest.fn().mockResolvedValue({ url: 'https://checkout.test' });
  const createPortalSession = jest.fn().mockResolvedValue({ url: 'https://portal.test' });
  return {
    service: { createCheckoutSession, createPortalSession } as unknown as BillingService,
    createCheckoutSession,
    createPortalSession,
  };
}

describe('BillingController', () => {
  const request = { orgId: ORG_ID } as AuthenticatedRequest;

  it('opens a checkout session for the org OrgGuard resolved, not one from the path', async () => {
    const { service, createCheckoutSession } = buildService();
    const controller = new BillingController(service);

    await expect(controller.createCheckoutSession(request, 'acme')).resolves.toEqual({
      url: 'https://checkout.test',
    });
    expect(createCheckoutSession).toHaveBeenCalledWith(ORG_ID);
  });

  it('opens a portal session for the org OrgGuard resolved', async () => {
    const { service, createPortalSession } = buildService();
    const controller = new BillingController(service);

    await expect(controller.createPortalSession(request, 'acme')).resolves.toEqual({
      url: 'https://portal.test',
    });
    expect(createPortalSession).toHaveBeenCalledWith(ORG_ID);
  });

  it('runs OrgGuard, RolesGuard, PlanGuard in that order', () => {
    const guards: unknown = Reflect.getMetadata(GUARDS_METADATA, BillingController);

    expect(guards).toEqual([OrgGuard, RolesGuard, PlanGuard]);
  });

  it('restricts both routes to OWNER', () => {
    const reflector = new Reflector();
    const prototype = BillingController.prototype;

    expect(reflector.get(ROLES_KEY, prototype.createCheckoutSession)).toEqual(['OWNER']);
    expect(reflector.get(ROLES_KEY, prototype.createPortalSession)).toEqual(['OWNER']);
  });
});
