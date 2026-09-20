import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../generated/prisma/client';

/**
 * The one place a `PrismaClient` is constructed (TDD §2.6.4). `PrismaService` and
 * `AppPrismaClient` are two distinct classes built from this single factory — never one client
 * with a flag, and never two copies of the same construction logic.
 */
export function createPrismaClient(connectionString: string): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}
