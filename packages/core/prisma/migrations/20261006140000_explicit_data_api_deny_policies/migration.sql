-- Writes down, as policies, the denial that 20261006120000_revoke_data_api_access already enforces.
--
-- `users`, `stripe_events` and `_prisma_migrations` have RLS enabled and no policy, which Postgres
-- reads as "deny everyone who is not exempt". That is exactly the intent, but it is expressed as an
-- absence, so a reader (and Supabase's `rls_enabled_no_policy` advisor) cannot tell it from a table
-- someone forgot to finish. An explicit deny for the two Data API roles states it.
--
-- Functionally redundant: those roles already hold no privilege on these tables, and the policy
-- grants nothing to anyone. The tenant app role still has no policy here on purpose — it never
-- reads or writes these tables — and the owner and the BYPASSRLS admin role are unaffected.

CREATE POLICY deny_data_api ON "users"
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

CREATE POLICY deny_data_api ON "stripe_events"
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

CREATE POLICY deny_data_api ON "_prisma_migrations"
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
