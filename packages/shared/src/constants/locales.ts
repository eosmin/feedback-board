export interface SupportedLocale {
  /** BCP-47 primary language subtag, matched against `Accept-Language` and the `NEXT_LOCALE`
   * cookie value. */
  code: string;
  /** Option label for the web app's language switcher, written in that locale's own language. */
  label: string;
  /** What the AI digest's system prompt is told to call this language. */
  aiLanguageName: string;
}

/**
 * The one list of locales this project ships — apps/web's language switcher, its browser-language
 * auto-detect, and the AI digest's output-language instruction all read from here instead of each
 * keeping its own copy. Adding a locale is one entry here plus a `apps/web/messages/<code>.json`
 * file.
 */
export const SUPPORTED_LOCALES: readonly SupportedLocale[] = [
  { code: 'en', label: 'English', aiLanguageName: 'English' },
  { code: 'es', label: 'Español', aiLanguageName: 'Spanish' },
];

export const DEFAULT_LOCALE = 'en';

export function isSupportedLocale(value: string | undefined): boolean {
  return value !== undefined && SUPPORTED_LOCALES.some((locale) => locale.code === value);
}
