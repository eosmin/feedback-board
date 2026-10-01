/**
 * A `next` redirect target only ever comes from a query param an attacker could craft, so it must
 * be a same-origin relative path — anything else (`//evil.com`, `https://evil.com`) is an open
 * redirect and gets dropped in favor of `fallback`.
 */
export function safeRedirectPath(next: string | undefined, fallback: string): string {
  if (
    next === undefined ||
    !next.startsWith('/') ||
    next.startsWith('//') ||
    next.includes('://') ||
    next.includes('\\')
  ) {
    return fallback;
  }

  return next;
}
