import { ForbiddenException } from '@nestjs/common';
import type { TenantRunner } from '@feedback-board/core';

import { TenantPrismaService } from '../../../src/database/tenant-prisma.service';
import type { AuthenticatedRequest } from '../../../src/database/tenant-prisma.service';

const VALID_ORG_ID = '11111111-1111-4111-8111-111111111111';

function buildRunner(): { runner: TenantRunner; runAs: jest.Mock } {
  const runAs = jest.fn().mockResolvedValue('result');
  return { runner: { runAs } as unknown as TenantRunner, runAs };
}

describe('TenantPrismaService', () => {
  it('delegates to TenantRunner.runAs with the request-scoped orgId', async () => {
    const { runner, runAs } = buildRunner();
    const request = { orgId: VALID_ORG_ID } as AuthenticatedRequest;
    const service = new TenantPrismaService(request, runner);
    const fn = jest.fn();

    const result = await service.run(fn);

    expect(result).toBe('result');
    expect(runAs).toHaveBeenCalledWith(VALID_ORG_ID, fn);
  });

  it('fails closed when the request carries no orgId — OrgGuard never ran', async () => {
    const { runner, runAs } = buildRunner();
    const request = {} as AuthenticatedRequest;
    const service = new TenantPrismaService(request, runner);

    await expect(service.run(jest.fn())).rejects.toBeInstanceOf(ForbiddenException);
    expect(runAs).not.toHaveBeenCalled();
  });

  it('fails closed when the request orgId is not a uuid', async () => {
    const { runner, runAs } = buildRunner();
    const request = { orgId: 'not-a-uuid' } as AuthenticatedRequest;
    const service = new TenantPrismaService(request, runner);

    await expect(service.run(jest.fn())).rejects.toBeInstanceOf(ForbiddenException);
    expect(runAs).not.toHaveBeenCalled();
  });
});
