'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Browser client for Client Components. `createBrowserClient` singletons by default
 * (`isSingleton: true`), so calling this more than once across the app reuses the same instance
 * rather than opening a second connection.
 */
export function createSupabaseBrowserClient(): SupabaseClient {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
  );
}
