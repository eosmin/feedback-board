-- Rollback for 20260921120000_rls_policies. Verified once against a scratch database
-- (TDD §2.6.4). Drops policies and RLS flags, then the grants — in the reverse order the
-- migration.sql applied them. Does not drop the feedbackboard_app role itself: role creation
-- is scripts/bootstrap-db.sh's job, not this migration's (§2.6.11 step a).

DROP POLICY IF EXISTS tenant_isolation_subscriptions ON "subscriptions";
ALTER TABLE "subscriptions" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "subscriptions" DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_webhook_deliveries ON "webhook_deliveries";
ALTER TABLE "webhook_deliveries" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "webhook_deliveries" DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_webhooks ON "webhooks";
ALTER TABLE "webhooks" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "webhooks" DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_comments ON "comments";
ALTER TABLE "comments" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "comments" DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_votes ON "votes";
ALTER TABLE "votes" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "votes" DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_posts ON "posts";
ALTER TABLE "posts" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "posts" DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_boards ON "boards";
ALTER TABLE "boards" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "boards" DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_memberships ON "memberships";
ALTER TABLE "memberships" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "memberships" DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_orgs ON "orgs";
ALTER TABLE "orgs" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "orgs" DISABLE ROW LEVEL SECURITY;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLES FROM feedbackboard_app;
REVOKE SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public FROM feedbackboard_app;
REVOKE USAGE ON SCHEMA public FROM feedbackboard_app;