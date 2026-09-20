-- Mirrors Supabase Auth's `auth.users` into `public.users` (TDD §2.6.5).
--
-- Privilege caveat (TDD §2.6.5): creating a trigger ON auth.users requires ownership of /
-- TRIGGER privilege on a table in the `auth` schema. `supabase start` hands the local migration
-- role superuser, so this statement applies cleanly there. A hosted Supabase project may reject
-- it for the same role. If `prisma migrate deploy` is rejected on the hosted project with a
-- permission error on `auth.users`, move ONLY this file's SQL into `supabase/migrations/` and
-- apply it with `supabase db push`, which runs as the elevated role Supabase provisions for
-- schema migrations. Document whichever path was actually taken in the README.
--
-- SECURITY DEFINER makes the function run with the privileges of the role that created it (the
-- migration/admin role, which owns `public.users`), so the trigger can insert into `public.users`
-- regardless of which role's session fired the `auth.users` insert (Supabase Auth's own service
-- role, not the API's tenant role).
CREATE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, name, avatar_url, created_at)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data ->> 'name',
    NEW.raw_user_meta_data ->> 'avatar_url',
    NEW.created_at
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_auth_user();