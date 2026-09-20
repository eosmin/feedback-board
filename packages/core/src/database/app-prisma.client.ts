import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';

import { createPrismaClient } from './create-prisma-client';
import type { PrismaClient } from '../generated/prisma/client';

export const DATABASE_URL = Symbol('DATABASE_URL');
export const APP_PRISMA_CLIENT = Symbol('APP_PRISMA_CLIENT');

/**
 * The tenant client — `DATABASE_URL`, the unprivileged `feedbackboard_app` role, RLS
 * **enforced**. Every tenant-facing query goes through this connection, wrapped by
 * `TenantRunner.runAs` (TDD §3.2, §3.3).
 *
 * A distinct class from `PrismaService`, not one client with a flag (TDD §2.6.4) — the two
 * inject by type, so the worker's `DatabaseModule.forTenant()` can register this one alone and
 * make `PrismaService` structurally absent from that container (TDD §3.10).
 *
 * `APP_PRISMA_CLIENT` exists alongside the class itself so `TenantRunner` (a same-package
 * consumer) can depend on it via `@Inject(APP_PRISMA_CLIENT)` + a type-only import rather than
 * a same-file class reference — see the note on `TenantRunner` for why that distinction matters
 * for `emitDecoratorMetadata`.
 */
@Injectable()
export class AppPrismaClient implements OnModuleDestroy {
  readonly client: PrismaClient;

  constructor(@Inject(DATABASE_URL) connectionString: string) {
    this.client = createPrismaClient(connectionString);
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.$disconnect();
  }
}
