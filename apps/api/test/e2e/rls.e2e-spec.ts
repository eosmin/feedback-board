import { randomUUID } from 'node:crypto';

import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import { AppPrismaClient, PrismaService, TenantRunner } from '@feedback-board/core';
import type { Prisma } from '@feedback-board/core';

import { buildTestModuleMetadata } from '../fixtures/build-test-module-metadata';
import { closeTestingModule } from '../fixtures/close-testing-module';

/**
 * The flagship test of the whole project (TDD §17, §13 step 11): a green RLS suite on a
 * superuser connection proves nothing, so every case here either asserts against the
 * unprivileged `feedbackboard_app` role directly, or asserts the role/table metadata that
 * distinguishes a real RLS-enforcing connection from a superuser one that happened to filter
 * correctly by coincidence.
 *
 * Resolves `PrismaService`/`AppPrismaClient`/`TenantRunner` from a compiled `TestingModule`
 * built from `buildTestModuleMetadata()` (the same base `auth.e2e-spec.ts`/`orgs.e2e-spec.ts`
 * use), rather than constructing the classes directly: `ConfigModule`'s `envFilePath` load of
 * `apps/api/.env` is what puts `ADMIN_DATABASE_URL`/`DATABASE_URL` into `process.env` in the
 * first place, and it only runs as a side effect of that module being part of a compiled Nest
 * container (TDD §7.1 — one way to load env, not a second hand-rolled one here).
 */
describe('row-level security (e2e)', () => {
  let moduleRef: TestingModule;
  let admin: PrismaService;
  let appClient: AppPrismaClient;
  let runner: TenantRunner;

  const RUN_ID = randomUUID().slice(0, 8);

  beforeAll(async () => {
    const base = buildTestModuleMetadata();
    moduleRef = await Test.createTestingModule({
      imports: base.imports,
      providers: base.providers,
    }).compile();

    admin = moduleRef.get(PrismaService);
    appClient = moduleRef.get(AppPrismaClient);
    runner = moduleRef.get(TenantRunner);
  });

  afterAll(async () => {
    await closeTestingModule(moduleRef);
  });

  /** Creates a bare org + membership pair through the admin client, returning both ids. */
  async function createOrgWithMember(label: string): Promise<{ orgId: string; userId: string }> {
    const org = await admin.client.org.create({
      data: { name: `RLS ${label}`, slug: `rls-e2e-${RUN_ID}-${label}` },
    });
    // User.id carries no @default(uuid()) — it is normally populated by the auth-mirror
    // trigger from a real auth.users row (§2.6.5), so a direct create here must supply it
    // explicitly, exactly like seed-membership.ts's buildAdminClient path already does.
    const user = await admin.client.user.create({
      data: { id: randomUUID(), email: `rls-e2e-${RUN_ID}-${label}@example.com` },
    });
    await admin.client.membership.create({
      data: { userId: user.id, orgId: org.id, role: 'OWNER' },
    });
    return { orgId: org.id, userId: user.id };
  }

  it('rolbypassrls is false for feedbackboard_app and true for the admin role — without this, a green suite may only prove the connection was superuser', async () => {
    const rows = await admin.client.$queryRaw<{ rolname: string; rolbypassrls: boolean }[]>`
      SELECT rolname, rolbypassrls FROM pg_roles
      WHERE rolname = 'feedbackboard_app' OR rolname = current_user
    `;

    const appRole = rows.find((row) => row.rolname === 'feedbackboard_app');
    const adminRole = rows.find((row) => row.rolname !== 'feedbackboard_app');

    expect(appRole?.rolbypassrls).toBe(false);
    expect(adminRole?.rolbypassrls).toBe(true);
  });

  it('relrowsecurity and relforcerowsecurity are true for all nine protected tables', async () => {
    const rows = await admin.client.$queryRaw<
      { relname: string; relrowsecurity: boolean; relforcerowsecurity: boolean }[]
    >`
      SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname IN ('orgs', 'memberships', 'boards', 'posts', 'votes', 'comments',
                          'webhooks', 'webhook_deliveries', 'subscriptions')
    `;

    const protectedTables = [
      'orgs',
      'memberships',
      'boards',
      'posts',
      'votes',
      'comments',
      'webhooks',
      'webhook_deliveries',
      'subscriptions',
    ];

    expect(rows).toHaveLength(protectedTables.length);
    for (const table of protectedTables) {
      const row = rows.find((candidate) => candidate.relname === table);
      expect(row?.relrowsecurity).toBe(true);
      expect(row?.relforcerowsecurity).toBe(true);
    }
  });

  it('a query issued with no app.org_id set returns zero rows, not an error', async () => {
    await createOrgWithMember('no-session-var');

    const rows = await appClient.client.$transaction(async (tx: Prisma.TransactionClient) => {
      // Deliberately never calling set_config here — this is the "forgot to scope" case
      // nullif(..., '') exists to fail closed on (TDD §3.3).
      return tx.org.findMany();
    });

    expect(rows).toEqual([]);
  });

  it('with app.org_id set to org A, the app role sees only org A — the case the old exemption on orgs/memberships could not have passed', async () => {
    const orgA = await createOrgWithMember('org-a');
    const orgB = await createOrgWithMember('org-b');

    const { orgs, memberships } = await runner.runAs(orgA.orgId, async (tx) => ({
      orgs: await tx.org.findMany(),
      memberships: await tx.membership.findMany(),
    }));

    expect(orgs).toHaveLength(1);
    expect(orgs[0]?.id).toBe(orgA.orgId);
    expect(orgs.some((org) => org.id === orgB.orgId)).toBe(false);

    expect(memberships.every((membership) => membership.orgId === orgA.orgId)).toBe(true);
    expect(memberships.some((membership) => membership.userId === orgB.userId)).toBe(false);
  });

  it("a cross-tenant read fails even when a service method's WHERE clause is deliberately weakened", async () => {
    const orgA = await createOrgWithMember('weak-where-a');
    const orgB = await createOrgWithMember('weak-where-b');

    const board = await admin.client.board.create({
      data: { orgId: orgB.orgId, name: 'Org B Board', slug: 'org-b-board' },
    });

    // Simulates a service method that forgot to filter by orgId in its WHERE clause — the
    // exact bug RLS exists to catch even when application code fails to prevent it (TDD §3.2).
    const rows = await runner.runAs(orgA.orgId, async (tx) =>
      tx.board.findMany({ where: { id: board.id } }),
    );

    expect(rows).toEqual([]);
  });

  it('the admin client can write subscriptions with no app.org_id set — the direct test of §2.6.11c', async () => {
    const org = await createOrgWithMember('admin-write');

    const subscription = await admin.client.subscription.create({
      data: {
        orgId: org.orgId,
        stripeSubscriptionId: `sub_rls_e2e_${RUN_ID}`,
        stripePriceId: `price_rls_e2e_${RUN_ID}`,
        status: 'ACTIVE',
        currentPeriodEnd: new Date(),
      },
    });

    expect(subscription.orgId).toBe(org.orgId);

    const readBack = await admin.client.subscription.findUnique({
      where: { id: subscription.id },
    });
    expect(readBack?.id).toBe(subscription.id);
  });

  it("a cross-tenant read of another org's webhooks and subscription returns zero rows, even with a deliberately weakened WHERE clause — the Milestone 7 tables the boards-only case above did not cover", async () => {
    const orgA = await createOrgWithMember('webhooks-cross-a');
    const orgB = await createOrgWithMember('webhooks-cross-b');

    const webhook = await admin.client.webhook.create({
      data: {
        orgId: orgB.orgId,
        targetUrl: `https://example.com/rls-e2e/${RUN_ID}`,
        secret: randomUUID(),
        events: ['post.created'],
      },
    });
    const subscription = await admin.client.subscription.create({
      data: {
        orgId: orgB.orgId,
        stripeSubscriptionId: `sub_rls_cross_${RUN_ID}`,
        stripePriceId: `price_rls_cross_${RUN_ID}`,
        status: 'ACTIVE',
        currentPeriodEnd: new Date(),
      },
    });

    const { webhooks, subscriptions } = await runner.runAs(orgA.orgId, async (tx) => ({
      // WHERE clauses deliberately keyed on the target row's own id, not orgId — the same
      // "forgot to scope" shape the boards case above exercises, now for the two tables this
      // milestone introduced (TDD §3.7, §3.6; §5.6's per-step cross-tenant denial rule).
      webhooks: await tx.webhook.findMany({ where: { id: webhook.id } }),
      subscriptions: await tx.subscription.findMany({ where: { id: subscription.id } }),
    }));

    expect(webhooks).toEqual([]);
    expect(subscriptions).toEqual([]);
  });
});
