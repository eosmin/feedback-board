-- Rollback for 20260919200000_auth_user_trigger. Verified once against a scratch database
-- (TDD §2.6.4). Drops the trigger before the function it depends on.

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_auth_user();