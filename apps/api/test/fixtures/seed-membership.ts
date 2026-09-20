import { PrismaService } from '@feedback-board/core';

/**
 * There is no product path to create a MEMBER — Membership rows are seeded directly through
 * the admin client (TDD §18, decision-adjacent: the invitation flow is out of scope). Used by
 * the RBAC e2e suites so a MEMBER-refused-on-an-OWNER-route case never collapses to a
 * single-role happy path.
 *
 * Constructs `PrismaService` directly rather than through Nest's DI container: this fixture
 * runs inside test setup, not inside a booted `AppModule`, so there is no injector to resolve
 * `ADMIN_DATABASE_URL` from — the constructor takes the connection string as a plain argument.
 */
export async function seedMembership(
  admin: PrismaService,
  params: { userId: string; email: string; orgId: string; role: 'OWNER' | 'ADMIN' | 'MEMBER' },
): Promise<void> {
  await admin.client.user.upsert({
    where: { id: params.userId },
    create: { id: params.userId, email: params.email },
    update: {},
  });

  await admin.client.membership.upsert({
    where: { userId_orgId: { userId: params.userId, orgId: params.orgId } },
    create: { userId: params.userId, orgId: params.orgId, role: params.role },
    update: { role: params.role },
  });
}

export function buildAdminClient(adminDatabaseUrl: string): PrismaService {
  return new PrismaService(adminDatabaseUrl);
}
