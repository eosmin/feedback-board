import { ForbiddenException, Inject, Injectable, Scope } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { isUuid, TenantRunner, type Prisma } from '@feedback-board/core';
import type { Request } from 'express';

/**
 * Populated by `OrgGuard` after the membership check (TDD §3.4) — attached here rather than
 * imported from a shared location because it is the request-scoping contract of this one
 * request-scoped service, not a public type other modules construct.
 */
export interface AuthenticatedRequest extends Request {
  userId?: string;
  userEmail?: string;
  orgId?: string;
  role?: string;
}

/**
 * Request-scoped wrapper over `packages/core`'s `TenantRunner` (TDD §3.2, §3.3). Holds no SQL
 * of its own — the `set_config` transaction lives once in `TenantRunner` — and supplies only
 * the request's `orgId`. Stays in `apps/api` because it needs `@Inject(REQUEST)`, which exists
 * only in an HTTP process; `apps/worker` calls `TenantRunner.runAs` directly with the `orgId`
 * carried in a job payload instead (§3.2).
 */
@Injectable({ scope: Scope.REQUEST })
export class TenantPrismaService {
  constructor(
    @Inject(REQUEST) private readonly request: AuthenticatedRequest,
    private readonly runner: TenantRunner,
  ) {}

  async run<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    const orgId = this.request.orgId;

    // Fail closed rather than delegating solely to TenantRunner's own check: a missing or
    // malformed orgId here means OrgGuard never ran (or ran against the wrong route), which is
    // an authorization failure, not an internal error (§3.3).
    if (orgId === undefined || !isUuid(orgId)) {
      throw new ForbiddenException();
    }

    return this.runner.runAs(orgId, fn);
  }
}
