export type { SupportedLocale as LocaleOption } from '@feedback-board/shared';
/**
 * `SUPPORTED_LOCALES` (`@feedback-board/shared`) is the one place this project lists its locales
 * — apps/web, apps/api and `packages/core`'s AI digest all read it instead of each keeping its
 * own copy. Adding one is an entry there plus a `messages/<code>.json` file here (and widening
 * the `Locale` union in `global.d.ts`) — no route change, since this project deliberately has no
 * `[locale]` segment (TDD.md §2.6.13).
 */
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, isSupportedLocale } from '@feedback-board/shared';

export { SUPPORTED_LOCALES as AVAILABLE_LOCALES, DEFAULT_LOCALE, isSupportedLocale };

export const LOCALE_COOKIE_NAME = 'NEXT_LOCALE';

const LOCALE_CHANGE_EVENT = 'localechange';

/**
 * Plain module-level function rather than inline in `LocaleSwitcher` — the `document.cookie`
 * write there tripped `react-hooks/immutability` (mutating a value captured from outside the
 * component). Living here, it isn't inside a component/hook body, so the rule doesn't apply.
 * The event lets `global-error.tsx`, which has no server round trip to re-resolve the locale,
 * re-render in the new language.
 */
export function setLocaleCookie(code: string): void {
  document.cookie = `${LOCALE_COOKIE_NAME}=${code}; path=/; max-age=31536000; samesite=lax`;
  window.dispatchEvent(new Event(LOCALE_CHANGE_EVENT));
}

/** For `useSyncExternalStore`: re-reads `getClientLocale` after a `setLocaleCookie`. */
export function subscribeLocale(onChange: () => void): () => void {
  window.addEventListener(LOCALE_CHANGE_EVENT, onChange);
  return () => window.removeEventListener(LOCALE_CHANGE_EVENT, onChange);
}

/**
 * Browser-side mirror of `i18n/request.ts` (cookie first, then the browser's language list), for
 * the one screen that renders without the server's locale resolution: `global-error.tsx`.
 */
export function getClientLocale(): string {
  const cookie = document.cookie
    .split('; ')
    .find((entry) => entry.startsWith(`${LOCALE_COOKIE_NAME}=`))
    ?.slice(LOCALE_COOKIE_NAME.length + 1);
  if (cookie !== undefined && isSupportedLocale(cookie)) return cookie;

  const fromBrowser = navigator.languages
    .map((tag) => tag.split('-')[0]?.toLowerCase() ?? '')
    .find(isSupportedLocale);
  return fromBrowser ?? DEFAULT_LOCALE;
}
