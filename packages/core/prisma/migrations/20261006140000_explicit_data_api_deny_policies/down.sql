-- Rollback for 20261006140000_explicit_data_api_deny_policies. Drops the three explicit deny
-- policies; the tables keep RLS enabled with no policy, which still denies the Data API roles.

DROP POLICY IF EXISTS deny_data_api ON "_prisma_migrations";
DROP POLICY IF EXISTS deny_data_api ON "stripe_events";
DROP POLICY IF EXISTS deny_data_api ON "users";
