export type { SupportedLocale as LocaleOption } from '@feedback-board/shared';
/**
 * `SUPPORTED_LOCALES` (`@feedback-board/shared`) is the one place this project lists its locales
 * — apps/web, apps/api and `packages/core`'s AI digest all read it instead of each keeping its
 * own copy. Adding one is an entry there plus a `messages/<code>.json` file here (and widening
 * the `Locale` union in `global.d.ts`) — no route change, since this project deliberately has no
 * `[locale]` segment (TDD.md §2.6.13).
 */
export { SUPPORTED_LOCALES as AVAILABLE_LOCALES, DEFAULT_LOCALE, isSupportedLocale } from '@feedback-board/shared';

export const LOCALE_COOKIE_NAME = 'NEXT_LOCALE';

/**
 * Plain module-level function rather than inline in `LocaleSwitcher` — the `document.cookie`
 * write there tripped `react-hooks/immutability` (mutating a value captured from outside the
 * component). Living here, it isn't inside a component/hook body, so the rule doesn't apply.
 */
export function setLocaleCookie(code: string): void {
  document.cookie = `${LOCALE_COOKIE_NAME}=${code}; path=/; max-age=31536000; samesite=lax`;
}
