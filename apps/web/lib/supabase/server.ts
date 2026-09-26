import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

/**
 * Server Component / Route Handler client. Uses the 0.12 `getAll`/`setAll` cookie contract, not
 * the deprecated 0.7-era `get`/`set`/`remove` triple (TDD §2.6.6) — the old shape does not throw,
 * it degrades silently in production, so the only real enforcement is never writing it.
 *
 * `setAll` is wrapped in try/catch: it throws when called from a Server Component (Next.js only
 * permits cookie writes from a Server Action or Route Handler), which is fine as long as a
 * middleware or the caller itself refreshes the session — this project has no middleware
 * (TDD §2.6.13 bans one for i18n, and there is no auth-refresh middleware either), so every
 * caller that needs to persist a session is itself a Route Handler or Server Action.
 */
export async function createSupabaseServerClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component render — no-op, see the function comment above.
          }
        },
      },
    },
  );
}
