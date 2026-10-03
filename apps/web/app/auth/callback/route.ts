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
  const next = safeRedirectPath(
    request.nextUrl.searchParams.get('next') ?? undefined,
    '/dashboard',
  );
  const redirectTo = (path: string): NextResponse =>
    NextResponse.redirect(new URL(path, origin(request)));

  if (code === null) {
    return redirectTo('/login');
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return redirectTo('/login');
  }

  return redirectTo(next);
}

/**
 * The standalone server (Docker) binds with `HOSTNAME=0.0.0.0` and Next builds `request.url` from
 * that bind address, so a redirect off `request.url` would send the browser to `http://0.0.0.0:3000`
 * — a different origin than the one the session cookie was set for. The `Host` header is what the
 * browser actually used; `x-forwarded-proto` keeps https when a TLS-terminating proxy sits in front.
 */
function origin(request: NextRequest): string {
  const host = request.headers.get('host') ?? request.nextUrl.host;
  const proto =
    request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() ??
    request.nextUrl.protocol.replace(':', '');
  return `${proto}://${host}`;
}
