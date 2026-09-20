import { Inject, Injectable } from '@nestjs/common';

import { APP_PRISMA_CLIENT } from './app-prisma.client';
import { isUuid } from './is-uuid';
import type { AppPrismaClient } from './app-prisma.client';
import type { Prisma } from '../generated/prisma/client';

/**
 * The single implementation of the `set_config` transaction (TDD §3.2, §3.3). Not
 * request-scoped: `apps/api`'s `TenantPrismaService` wraps it with the request's `orgId`, and
 * `apps/worker`'s processors call it directly with the `orgId` carried in a validated job
 * payload — there is no request in a background job, and faking one would hide which `orgId` a
 * job actually ran under (§3.2).
 *
 * Injects `AppPrismaClient` via `@Inject(APP_PRISMA_CLIENT)` with a type-only import, rather
 * than typing the constructor parameter with the class directly. A same-package class-typed
 * parameter makes `emitDecoratorMetadata` emit a `typeof X !== "undefined" ? X : Object` guard
 * against circular imports — safe at runtime, but an untestable branch (there is no test that
 * legitimately makes `AppPrismaClient` undefined at module-evaluation time) that this package's
 * 85% branch-coverage gate (§14.1) cannot exempt without an `istanbul ignore` comment, which is
 * itself banned. `@Inject` plus a type-only import sidesteps the guard entirely: TypeScript
 * erases the import, so the emitted metadata falls back to `Object`.
 */
@Injectable()
export class TenantRunner {
  constructor(@Inject(APP_PRISMA_CLIENT) private readonly db: AppPrismaClient) {}

  async runAs<T>(orgId: string, fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    if (!isUuid(orgId)) {
      throw new Error('TenantRunner.runAs: orgId is not a uuid');
    }

    return this.db.client.$transaction(async (tx) => {
      // set_config(..., is_local => true) is the parameterizable form of a transaction-scoped
      // SET LOCAL — SET LOCAL itself cannot take bind parameters in Postgres (§3.3). $queryRaw,
      // not $executeRaw: set_config is a SELECT, not a row-count-reporting statement.
      await tx.$queryRaw`SELECT set_config('app.org_id', ${orgId}, true)`;
      return fn(tx);
    });
  }
}
