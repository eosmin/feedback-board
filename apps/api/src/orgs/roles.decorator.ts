import { SetMetadata } from '@nestjs/common';
import type { Role } from '@feedback-board/shared';

export const ROLES_KEY = 'roles';

/**
 * Enforced by `RolesGuard` against `request.role`, set by `OrgGuard` (TDD §3.4). A role is
 * always per org — this decorator is meaningless on any route outside `/orgs/:orgSlug/*`.
 */
export const Roles = (...roles: readonly Role[]): MethodDecorator => SetMetadata(ROLES_KEY, roles);
