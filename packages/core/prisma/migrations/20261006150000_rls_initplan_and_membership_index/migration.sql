-- Two RLS performance fixes flagged by Supabase's performance advisor, both measured first.
--
-- 1. `auth_rls_initplan`: every tenant policy called `current_setting('app.org_id', true)` bare.
--    That function is STABLE, so Postgres may re-evaluate it for each row it filters. Wrapping the
--    call in `(SELECT ...)` makes it an InitPlan, evaluated once per statement. The meaning is
--    identical. Measured on 300k rows across 50 orgs: with an index on org_id the planner already
--    used the value as an index key and the two forms tie; with no usable index the wrapped form
--    ran in ~20 ms against ~104 ms for the bare one.
--    ALTER POLICY rather than DROP + CREATE, so there is no instant with a table unprotected.
--
-- 2. `unindexed_foreign_keys` on memberships.org_id. The policy above filters memberships by
--    org_id on every tenant query, and the only index there is the unique (user_id, org_id),
--    which cannot serve a filter on its second column. It was the one tenant table with no
--    org_id index; the other seven already have one.

ALTER POLICY tenant_isolation_orgs ON "orgs"
  USING      (id = (SELECT nullif(current_setting('app.org_id', true), '')::uuid))
  WITH CHECK (id = (SELECT nullif(current_setting('app.org_id', true), '')::uuid));

ALTER POLICY tenant_isolation_memberships ON "memberships"
  USING      (org_id = (SELECT nullif(current_setting('app.org_id', true), '')::uuid))
  WITH CHECK (org_id = (SELECT nullif(current_setting('app.org_id', true), '')::uuid));

ALTER POLICY tenant_isolation_boards ON "boards"
  USING      (org_id = (SELECT nullif(current_setting('app.org_id', true), '')::uuid))
  WITH CHECK (org_id = (SELECT nullif(current_setting('app.org_id', true), '')::uuid));

ALTER POLICY tenant_isolation_posts ON "posts"
  USING      (org_id = (SELECT nullif(current_setting('app.org_id', true), '')::uuid))
  WITH CHECK (org_id = (SELECT nullif(current_setting('app.org_id', true), '')::uuid));

ALTER POLICY tenant_isolation_votes ON "votes"
  USING      (org_id = (SELECT nullif(current_setting('app.org_id', true), '')::uuid))
  WITH CHECK (org_id = (SELECT nullif(current_setting('app.org_id', true), '')::uuid));

ALTER POLICY tenant_isolation_comments ON "comments"
  USING      (org_id = (SELECT nullif(current_setting('app.org_id', true), '')::uuid))
  WITH CHECK (org_id = (SELECT nullif(current_setting('app.org_id', true), '')::uuid));

ALTER POLICY tenant_isolation_webhooks ON "webhooks"
  USING      (org_id = (SELECT nullif(current_setting('app.org_id', true), '')::uuid))
  WITH CHECK (org_id = (SELECT nullif(current_setting('app.org_id', true), '')::uuid));

ALTER POLICY tenant_isolation_webhook_deliveries ON "webhook_deliveries"
  USING      (org_id = (SELECT nullif(current_setting('app.org_id', true), '')::uuid))
  WITH CHECK (org_id = (SELECT nullif(current_setting('app.org_id', true), '')::uuid));

ALTER POLICY tenant_isolation_subscriptions ON "subscriptions"
  USING      (org_id = (SELECT nullif(current_setting('app.org_id', true), '')::uuid))
  WITH CHECK (org_id = (SELECT nullif(current_setting('app.org_id', true), '')::uuid));

CREATE INDEX "memberships_org_id_idx" ON "memberships" ("org_id");
