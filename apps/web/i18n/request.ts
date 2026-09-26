import { getRequestConfig } from 'next-intl/server';

/**
 * No `[locale]` segment and no next-intl middleware (TDD §2.6.13): this project's root dynamic
 * segment already belongs to `/[orgSlug]`, so the locale is a static value rather than something
 * resolved from the URL. Shipping a second locale later means adding a file and widening the
 * `Locale` union in `global.d.ts` — no route change anywhere.
 */
export default getRequestConfig(async () => {
  const locale = 'en';
  return { locale, messages: (await import(`../messages/${locale}.json`)).default };
});
