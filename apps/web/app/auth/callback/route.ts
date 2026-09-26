import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { createSupabaseServerClient } from '../../../lib/supabase/server';

/**
 * Supabase's magic-link email redirects here with a `?code=` query param (TDD §3.4, §12). The
 * server client's `setAll` persists the exchanged session as cookies on this response before the
 * redirect — a Route Handler, unlike a Server Component, is allowed to write cookies at all
 * (TDD §2.6.6).
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const code = request.nextUrl.searchParams.get('code');

  if (code === null) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.redirect(new URL('/dashboard', request.url));
}
