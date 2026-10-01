import { getRequestConfig } from 'next-intl/server';
import { cookies, headers } from 'next/headers';

import { AVAILABLE_LOCALES, DEFAULT_LOCALE, LOCALE_COOKIE_NAME, isSupportedLocale } from '../lib/locales';

/**
 * No `[locale]` segment and no next-intl middleware (TDD §2.6.13): this project's root dynamic
 * segment already belongs to `/[orgSlug]`, so the locale is resolved from a `NEXT_LOCALE` cookie
 * rather than the URL. Once the `LocaleSwitcher` has set that cookie it always wins. Before that —
 * a visitor's very first request — this falls back to the browser's own `Accept-Language` header
 * instead of jumping straight to `DEFAULT_LOCALE`, so someone whose system/browser language is one
 * of `AVAILABLE_LOCALES` (`lib/locales.ts`) sees it translated without having to use the switcher
 * first; anyone else still lands on `DEFAULT_LOCALE` (English).
 */
export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(LOCALE_COOKIE_NAME)?.value;
  const resolved = isSupportedLocale(cookieLocale) ? cookieLocale : await resolveFromBrowser();
  // Cast to the `Locale` union declared in global.d.ts, which must list every code in
  // `AVAILABLE_LOCALES` (lib/locales.ts) — `isSupportedLocale` just checked it's one of them.
  const locale = (resolved ?? DEFAULT_LOCALE) as 'en' | 'es';

  return { locale, messages: (await import(`../messages/${locale}.json`)).default };
});

/**
 * Parses `Accept-Language` by its quality-weighted preference order (e.g.
 * `es-MX,es;q=0.9,en;q=0.8`) and returns the first tag whose base language (`es-MX` → `es`)
 * matches a supported locale — not just the first tag in the header, which may be a region
 * variant of a language with no match while a lower-priority entry does have one.
 */
async function resolveFromBrowser(): Promise<string | undefined> {
  const headerStore = await headers();
  const acceptLanguage = headerStore.get('accept-language');
  if (acceptLanguage === null) {
    return undefined;
  }

  const tags = acceptLanguage
    .split(',')
    .map((entry) => {
      const [tag, qValue] = entry.trim().split(';q=');
      return { tag: tag?.split('-')[0]?.toLowerCase(), quality: qValue === undefined ? 1 : Number(qValue) };
    })
    .filter((entry): entry is { tag: string; quality: number } => entry.tag !== undefined)
    .sort((a, b) => b.quality - a.quality);

  return tags.find((entry) => AVAILABLE_LOCALES.some((locale) => locale.code === entry.tag))?.tag;
}
