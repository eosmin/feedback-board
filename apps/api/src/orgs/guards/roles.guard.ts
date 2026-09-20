import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '@feedback-board/shared';

import { ROLES_KEY } from '../roles.decorator';
import type { AuthenticatedRequest } from '../../database/tenant-prisma.service';

/**
 * Checks `request.role` (set by `OrgGuard`, which must run first) against `@Roles(...)`
 * metadata (TDD §3.4). A route with no `@Roles` decorator is open to any member — this guard
 * only restricts, it never widens access on its own.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (requiredRoles === undefined || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const role = request.role;

    if (role === undefined || !requiredRoles.includes(role as Role)) {
      throw new ForbiddenException();
    }

    return true;
  }
}
