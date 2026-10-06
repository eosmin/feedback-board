-- Rollback for 20261006150000_rls_initplan_and_membership_index. Puts the tenant policies back to
-- the bare current_setting() form of 20260923193556_rls_policies and drops the index. Same
-- semantics either way; only the evaluation plan differs.

DROP INDEX IF EXISTS "memberships_org_id_idx";

ALTER POLICY tenant_isolation_subscriptions ON "subscriptions"
  USING      (org_id = nullif(current_setting('app.org_id', true), '')::uuid)
  WITH CHECK (org_id = nullif(current_setting('app.org_id', true), '')::uuid);

ALTER POLICY tenant_isolation_webhook_deliveries ON "webhook_deliveries"
  USING      (org_id = nullif(current_setting('app.org_id', true), '')::uuid)
  WITH CHECK (org_id = nullif(current_setting('app.org_id', true), '')::uuid);

ALTER POLICY tenant_isolation_webhooks ON "webhooks"
  USING      (org_id = nullif(current_setting('app.org_id', true), '')::uuid)
  WITH CHECK (org_id = nullif(current_setting('app.org_id', true), '')::uuid);

ALTER POLICY tenant_isolation_comments ON "comments"
  USING      (org_id = nullif(current_setting('app.org_id', true), '')::uuid)
  WITH CHECK (org_id = nullif(current_setting('app.org_id', true), '')::uuid);

ALTER POLICY tenant_isolation_votes ON "votes"
  USING      (org_id = nullif(current_setting('app.org_id', true), '')::uuid)
  WITH CHECK (org_id = nullif(current_setting('app.org_id', true), '')::uuid);

ALTER POLICY tenant_isolation_posts ON "posts"
  USING      (org_id = nullif(current_setting('app.org_id', true), '')::uuid)
  WITH CHECK (org_id = nullif(current_setting('app.org_id', true), '')::uuid);

ALTER POLICY tenant_isolation_boards ON "boards"
  USING      (org_id = nullif(current_setting('app.org_id', true), '')::uuid)
  WITH CHECK (org_id = nullif(current_setting('app.org_id', true), '')::uuid);

ALTER POLICY tenant_isolation_memberships ON "memberships"
  USING      (org_id = nullif(current_setting('app.org_id', true), '')::uuid)
  WITH CHECK (org_id = nullif(current_setting('app.org_id', true), '')::uuid);

ALTER POLICY tenant_isolation_orgs ON "orgs"
  USING      (id = nullif(current_setting('app.org_id', true), '')::uuid)
  WITH CHECK (id = nullif(current_setting('app.org_id', true), '')::uuid);
