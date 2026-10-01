import { redirect } from 'next/navigation';
import { cache } from 'react';

import { createSupabaseServerClient } from './server';

/**
 * Guards every authenticated Server Component (TDD §12: `/dashboard` and its descendants).
 * Uses `getUser()`, not `getSession()` — `getSession()` reads the cookie without contacting the
 * auth server, so a revoked or tampered token would still "pass"; `getUser()` verifies it against
 * Supabase Auth on every call, the same trust boundary `JwtAuthGuard` enforces on the API side
 * (TDD §2.6.6, §3.4). There is no middleware in this project (§2.6.13), so each authenticated
 * page performs this check itself.
 *
 * `currentPath`, when given, is carried as `/login?next=<currentPath>` so a deep link (e.g. a
 * shared private board) survives the sign-in round trip instead of always landing on the bare
 * `/dashboard` root — see `/login`'s own redirect and `/auth/callback`.
 */
export async function requireUser(currentPath?: string): Promise<{
  id: string;
  email: string | undefined;
}> {
  const user = await getOptionalUser();

  if (user === null) {
    redirect(currentPath === undefined ? '/login' : `/login?next=${encodeURIComponent(currentPath)}`);
  }

  return user;
}

/**
 * Non-redirecting counterpart used by `/login` to skip the form when already signed in.
 * Wrapped in React's `cache()` so the dashboard layout and the page it wraps — which both call
 * `requireUser()` on the same request — share one Supabase `getUser()` round trip instead of
 * each making its own.
 */
export const getOptionalUser = cache(async (): Promise<{ id: string; email: string | undefined } | null> => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || user === null) {
    return null;
  }

  return { id: user.id, email: user.email };
});
