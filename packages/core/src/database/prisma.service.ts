import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';

import { createPrismaClient } from './create-prisma-client';
import type { PrismaClient } from '../generated/prisma/client';

export const ADMIN_DATABASE_URL = Symbol('ADMIN_DATABASE_URL');

/**
 * The admin client — `ADMIN_DATABASE_URL`, the migration/owner role, which must carry
 * `BYPASSRLS` (TDD §2.6.11c). It has exactly five callers, all outside any tenant context
 * (TDD §3.2): the Stripe webhook, the auth-mirror trigger's supporting queries, `OrgGuard`'s
 * membership lookup, the `POST /orgs` / `GET /orgs` collection routes, and the public board
 * resolver's `orgSlug → orgId` lookup. Every other module is barred from importing this class
 * by the root `no-restricted-imports` ESLint rule (TDD §3.2).
 *
 * `packages/core` reads no `process.env` of its own (TDD §2.2a) — the connection string
 * arrives as a constructor argument supplied by the app that boots it, from that app's own
 * validated env.
 */
@Injectable()
export class PrismaService implements OnModuleDestroy {
  readonly client: PrismaClient;

  constructor(@Inject(ADMIN_DATABASE_URL) connectionString: string) {
    this.client = createPrismaClient(connectionString);
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.$disconnect();
  }
}
