-- Closes the Supabase Data API (PostgREST/GraphQL) to everything in `public`.
--
-- This application never uses that API: the browser only talks to Supabase Auth, and the server
-- reaches Postgres through `feedbackboard_app` (RLS enforced) or the admin role. But Supabase
-- grants `anon` and `authenticated` full privileges on every new table in `public` by default,
-- and the `anon` key ships in the web bundle, so anyone holding it could read or write any table
-- that has no RLS — `users` (every account's email), `stripe_events` (the webhook's idempotency
-- ledger) and Prisma's `_prisma_migrations` (its history). The nine tenant tables were already
-- safe: FORCE ROW LEVEL SECURITY with no policy for those roles denies them.
--
-- Two independent layers, so that either one alone is enough:
--   1. take the privileges away, and stop new objects from receiving them;
--   2. enable RLS on the three tables that had none, with no policy at all. The app role never
--      reads or writes them through a tenant connection (the auth mirror, the Stripe webhook and
--      the membership lookup all use the admin client), so denying it is the least privilege.
--      No FORCE: the owner and the BYPASSRLS admin role keep working, and so does Prisma Migrate.

-- 1. Privileges. `GRANT USAGE ON SCHEMA` is left alone: it grants no access to any object.
REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES    FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated;

-- The auth-mirror trigger function is SECURITY DEFINER, so left executable it is reachable as
-- /rest/v1/rpc/handle_new_auth_user. Postgres only checks EXECUTE when a trigger is created, not
-- when it fires, so revoking it does not stop the mirror from running.
REVOKE ALL ON FUNCTION public.handle_new_auth_user() FROM PUBLIC, anon, authenticated;

-- 2. RLS on the tables that had none (see the header for why no policy and no FORCE).
ALTER TABLE "users"              ENABLE ROW LEVEL SECURITY;
ALTER TABLE "stripe_events"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;
