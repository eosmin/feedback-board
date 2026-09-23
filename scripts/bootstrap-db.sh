#!/usr/bin/env bash
# Creates the unprivileged `feedbackboard_app` Postgres role and asserts the connected admin
# role holds BYPASSRLS (TDD §2.6.11 steps a and c). A script, never a migration: CREATE ROLE
# needs a password, and a password inside a committed migration.sql would be a secret in git.
# It also cannot use psql's `:'var'` interpolation, because Prisma Migrate sends SQL over the
# driver, not through the psql client — that interpolation only exists inside a psql session.
#
# Run against DIRECT_URL — the migration/owner role — before `prisma migrate deploy`, in CI and
# in the deploy pipeline alike, because the grants migration (§2.6.11 step b) references the
# role this script creates. Idempotent, so both can run it on every job without special-casing
# the first run.
set -euo pipefail
: "${DIRECT_URL:?set DIRECT_URL}"
: "${APP_DB_PASSWORD:?set APP_DB_PASSWORD}" # never hardcode, never commit

# Create the role if it does not exist. No password here: this statement is a DO block, and
# PL/pgSQL cannot interpolate a psql client variable — the password is set separately below.
psql "$DIRECT_URL" -v ON_ERROR_STOP=1 <<'SQL'
  DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'feedbackboard_app') THEN
      CREATE ROLE feedbackboard_app LOGIN NOBYPASSRLS;
    END IF;
  END $$;
SQL

# Set (or rotate) the password. `\set pw` + a backtick-quoted shell command is psql's own
# meta-command, run by a shell psql spawns itself — NOT a `-v` command-line flag. Two reasons
# to prefer this form: (1) a `-v pw=...` value stays visible in `ps aux` for the life of the
# process, which is exactly the leak this whole indirection exists to avoid; (2) psql never
# errors on an unbound `:'name'` reference — it silently leaves the literal text in place — so
# if a `-v` value ever fails to cross from one psql invocation's argv into another's `-c`
# string (shell quoting, psql build, however it happens), the failure surfaces as a Postgres
# syntax error naming `:` with no hint that a substitution was the real, missing step. Setting
# the variable with `\set` inside the SAME input stream the ALTER ROLE statement is read from
# removes that cross-process gap: the heredoc delimiter is single-quoted (`'SQL'`) so bash never
# touches $APP_DB_PASSWORD or the backticks, and psql's own backtick-shell subprocess resolves
# it from the environment this script already exported it into.
psql "$DIRECT_URL" -v ON_ERROR_STOP=1 <<'SQL'
  \set pw `printf '%s' "$APP_DB_PASSWORD"`
  ALTER ROLE feedbackboard_app PASSWORD :'pw';
SQL

# Assert the admin/migration role can actually bypass RLS. FORCE ROW LEVEL SECURITY (applied by
# the grants migration) removes the table owner's exemption, so without BYPASSRLS the Stripe
# webhook's writes to the RLS-protected `subscriptions` table would be silently filtered
# (§2.6.11c). Fail here, loudly, in a script whose output is read — rather than inside a webhook
# that returns 200 and does nothing.
psql "$DIRECT_URL" -v ON_ERROR_STOP=1 <<'SQL'
  DO $$ BEGIN
    IF NOT (SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user) THEN
      RAISE EXCEPTION
        'Role % lacks BYPASSRLS. With FORCE ROW LEVEL SECURITY the admin client cannot write '
        'subscriptions. Grant it (ALTER ROLE % BYPASSRLS) or route that write through '
        'TenantRunner.runAs — see TDD 2.6.11c.', current_user, current_user;
    END IF;
  END $$;
SQL

echo "bootstrap-db.sh: feedbackboard_app role ready, admin role BYPASSRLS confirmed."