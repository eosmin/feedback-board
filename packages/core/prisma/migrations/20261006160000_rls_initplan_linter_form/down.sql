-- Rollback for 20261006160000_rls_initplan_linter_form. Restores the form 20261006150000 left:
-- the whole expression as one InitPlan, without the inner sub-select. Same meaning and same plan;
-- only the advisor's text match differs.

ALTER POLICY tenant_isolation_subscriptions ON "subscriptions"
  USING      (org_id = (SELECT nullif(current_setting('app.org_id', true), '')::uuid))
  WITH CHECK (org_id = (SELECT nullif(current_setting('app.org_id', true), '')::uuid));

ALTER POLICY tenant_isolation_webhook_deliveries ON "webhook_deliveries"
  USING      (org_id = (SELECT nullif(current_setting('app.org_id', true), '')::uuid))
  WITH CHECK (org_id = (SELECT nullif(current_setting('app.org_id', true), '')::uuid));

ALTER POLICY tenant_isolation_webhooks ON "webhooks"
  USING      (org_id = (SELECT nullif(current_setting('app.org_id', true), '')::uuid))
  WITH CHECK (org_id = (SELECT nullif(current_setting('app.org_id', true), '')::uuid));

ALTER POLICY tenant_isolation_comments ON "comments"
  USING      (org_id = (SELECT nullif(current_setting('app.org_id', true), '')::uuid))
  WITH CHECK (org_id = (SELECT nullif(current_setting('app.org_id', true), '')::uuid));

ALTER POLICY tenant_isolation_votes ON "votes"
  USING      (org_id = (SELECT nullif(current_setting('app.org_id', true), '')::uuid))
  WITH CHECK (org_id = (SELECT nullif(current_setting('app.org_id', true), '')::uuid));

ALTER POLICY tenant_isolation_posts ON "posts"
  USING      (org_id = (SELECT nullif(current_setting('app.org_id', true), '')::uuid))
  WITH CHECK (org_id = (SELECT nullif(current_setting('app.org_id', true), '')::uuid));

ALTER POLICY tenant_isolation_boards ON "boards"
  USING      (org_id = (SELECT nullif(current_setting('app.org_id', true), '')::uuid))
  WITH CHECK (org_id = (SELECT nullif(current_setting('app.org_id', true), '')::uuid));

ALTER POLICY tenant_isolation_memberships ON "memberships"
  USING      (org_id = (SELECT nullif(current_setting('app.org_id', true), '')::uuid))
  WITH CHECK (org_id = (SELECT nullif(current_setting('app.org_id', true), '')::uuid));

ALTER POLICY tenant_isolation_orgs ON "orgs"
  USING      (id = (SELECT nullif(current_setting('app.org_id', true), '')::uuid))
  WITH CHECK (id = (SELECT nullif(current_setting('app.org_id', true), '')::uuid));
