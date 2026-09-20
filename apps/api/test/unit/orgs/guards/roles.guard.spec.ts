import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { RolesGuard } from '../../../../src/orgs/guards/roles.guard';
import type { AuthenticatedRequest } from '../../../../src/database/tenant-prisma.service';

function buildContext(request: Partial<AuthenticatedRequest>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => (): void => {},
    getClass: () => class {},
  } as unknown as ExecutionContext;
}

function buildReflector(roles: string[] | undefined): Reflector {
  return { getAllAndOverride: () => roles } as unknown as Reflector;
}

describe('RolesGuard', () => {
  it('allows any member through when the route has no @Roles metadata', () => {
    const guard = new RolesGuard(buildReflector(undefined));
    const context = buildContext({ role: 'MEMBER' });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('allows a caller whose role is in the required list', () => {
    const guard = new RolesGuard(buildReflector(['OWNER', 'ADMIN']));
    const context = buildContext({ role: 'ADMIN' });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('refuses a MEMBER on an OWNER/ADMIN-only route', () => {
    const guard = new RolesGuard(buildReflector(['OWNER', 'ADMIN']));
    const context = buildContext({ role: 'MEMBER' });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('refuses when OrgGuard never ran and request.role is undefined', () => {
    const guard = new RolesGuard(buildReflector(['OWNER']));
    const context = buildContext({});

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
