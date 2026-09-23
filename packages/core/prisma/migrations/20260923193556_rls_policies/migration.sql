-- Grants, ENABLE + FORCE ROW LEVEL SECURITY, and per-table policies for all nine tenant-owned
-- tables (TDD §2.6.11 step b, §3.3). The `feedbackboard_app` role itself is created earlier by
-- `scripts/bootstrap-db.sh` (§2.6.11 step a), not by this migration — this migration assumes it
-- already exists and fails loudly (undefined_object) if bootstrap has not run first.

-- Grants. ALTER DEFAULT PRIVILEGES so future tables are covered without another migration.
GRANT USAGE ON SCHEMA public TO feedbackboard_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO feedbackboard_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO feedbackboard_app;

-- orgs — the one shape variation: the tenant column IS the primary key, so the policy
-- compares `id`, not `org_id` (§3.3).
ALTER TABLE "orgs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "orgs" FORCE  ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_orgs ON "orgs"
  USING      (id = nullif(current_setting('app.org_id', true), '')::uuid)
  WITH CHECK (id = nullif(current_setting('app.org_id', true), '')::uuid);

-- memberships — policied per §3.3's correction: OrgGuard's own lookup runs on the admin client
-- (BYPASSRLS), so a policy here costs that lookup nothing while closing the cross-tenant
-- membership read an unpolicied table would otherwise allow the app role.
ALTER TABLE "memberships" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "memberships" FORCE  ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_memberships ON "memberships"
  USING      (org_id = nullif(current_setting('app.org_id', true), '')::uuid)
  WITH CHECK (org_id = nullif(current_setting('app.org_id', true), '')::uuid);

-- boards
ALTER TABLE "boards" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "boards" FORCE  ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_boards ON "boards"
  USING      (org_id = nullif(current_setting('app.org_id', true), '')::uuid)
  WITH CHECK (org_id = nullif(current_setting('app.org_id', true), '')::uuid);

-- posts
ALTER TABLE "posts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "posts" FORCE  ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_posts ON "posts"
  USING      (org_id = nullif(current_setting('app.org_id', true), '')::uuid)
  WITH CHECK (org_id = nullif(current_setting('app.org_id', true), '')::uuid);

-- votes
ALTER TABLE "votes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "votes" FORCE  ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_votes ON "votes"
  USING      (org_id = nullif(current_setting('app.org_id', true), '')::uuid)
  WITH CHECK (org_id = nullif(current_setting('app.org_id', true), '')::uuid);

-- comments
ALTER TABLE "comments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "comments" FORCE  ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_comments ON "comments"
  USING      (org_id = nullif(current_setting('app.org_id', true), '')::uuid)
  WITH CHECK (org_id = nullif(current_setting('app.org_id', true), '')::uuid);

-- webhooks
ALTER TABLE "webhooks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "webhooks" FORCE  ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_webhooks ON "webhooks"
  USING      (org_id = nullif(current_setting('app.org_id', true), '')::uuid)
  WITH CHECK (org_id = nullif(current_setting('app.org_id', true), '')::uuid);

-- webhook_deliveries
ALTER TABLE "webhook_deliveries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "webhook_deliveries" FORCE  ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_webhook_deliveries ON "webhook_deliveries"
  USING      (org_id = nullif(current_setting('app.org_id', true), '')::uuid)
  WITH CHECK (org_id = nullif(current_setting('app.org_id', true), '')::uuid);

-- subscriptions
ALTER TABLE "subscriptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "subscriptions" FORCE  ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_subscriptions ON "subscriptions"
  USING      (org_id = nullif(current_setting('app.org_id', true), '')::uuid)
  WITH CHECK (org_id = nullif(current_setting('app.org_id', true), '')::uuid);

-- "users" and "stripe_events" deliberately carry NO policy (§3.3): a user belongs to many orgs
-- (not tenant-owned — it holds only an id, email, display name and avatar), and stripe_events
-- is a global idempotency ledger written by a webhook that has no tenant.