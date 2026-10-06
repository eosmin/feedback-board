-- Rollback for 20261006120000_revoke_data_api_access. Restores what Supabase grants by default
-- to `anon` and `authenticated`, which re-opens the Data API to every table in `public`: only run
-- it if that is genuinely what is wanted. Reverse order of migration.sql.

ALTER TABLE "_prisma_migrations" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "stripe_events"      DISABLE ROW LEVEL SECURITY;
ALTER TABLE "users"              DISABLE ROW LEVEL SECURITY;

GRANT ALL ON FUNCTION public.handle_new_auth_user() TO PUBLIC, anon, authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES    TO anon, authenticated;

GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES    IN SCHEMA public TO anon, authenticated;
