import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { safeRedirectPath } from '../../../lib/safe-redirect';
import { createSupabaseServerClient } from '../../../lib/supabase/server';

/**
 * Supabase's magic-link email redirects here with a `?code=` query param (TDD §3.4, §12). The
 * server client's `setAll` persists the exchanged session as cookies on this response before the
 * redirect — a Route Handler, unlike a Server Component, is allowed to write cookies at all
 * (TDD §2.6.6). `next`, when `MagicLinkForm` embedded one in `emailRedirectTo`, sends the visitor
 * back to the deep link (e.g. a shared private board) instead of always landing on `/dashboard`.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const code = request.nextUrl.searchParams.get('code');
  const next = safeRedirectPath(request.nextUrl.searchParams.get('next') ?? undefined, '/dashboard');

  if (code === null) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.redirect(new URL(next, request.url));
}
