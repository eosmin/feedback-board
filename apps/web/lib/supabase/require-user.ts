import { redirect } from 'next/navigation';

import { createSupabaseServerClient } from './server';

/**
 * Guards every authenticated Server Component (TDD §12: `/dashboard` and its descendants).
 * Uses `getUser()`, not `getSession()` — `getSession()` reads the cookie without contacting the
 * auth server, so a revoked or tampered token would still "pass"; `getUser()` verifies it against
 * Supabase Auth on every call, the same trust boundary `JwtAuthGuard` enforces on the API side
 * (TDD §2.6.6, §3.4). There is no middleware in this project (§2.6.13), so each authenticated
 * page performs this check itself.
 */
export async function requireUser(): Promise<{ id: string; email: string | undefined }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || user === null) {
    redirect('/login');
  }

  return { id: user.id, email: user.email };
}
