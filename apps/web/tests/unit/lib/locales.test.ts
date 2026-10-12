import { afterEach, describe, expect, it, vi } from 'vitest';

import { getClientLocale, setLocaleCookie, subscribeLocale } from '../../../lib/locales';

function stubBrowserLanguages(languages: string[]): void {
  vi.spyOn(navigator, 'languages', 'get').mockReturnValue(languages);
}

afterEach(() => {
  vi.restoreAllMocks();
  document.cookie = 'NEXT_LOCALE=; path=/; max-age=0';
});

describe('getClientLocale', () => {
  it('prefers the NEXT_LOCALE cookie over the browser languages', () => {
    stubBrowserLanguages(['en-US']);
    document.cookie = 'NEXT_LOCALE=es; path=/';

    expect(getClientLocale()).toBe('es');
  });

  it('falls back to the first supported browser language, by base tag', () => {
    stubBrowserLanguages(['fr-FR', 'es-MX', 'en']);

    expect(getClientLocale()).toBe('es');
  });

  it('falls back to the default when nothing matches', () => {
    stubBrowserLanguages(['fr-FR']);

    expect(getClientLocale()).toBe('en');
  });
});

describe('setLocaleCookie', () => {
  it('writes the cookie and notifies subscribers', () => {
    const onChange = vi.fn();
    const unsubscribe = subscribeLocale(onChange);

    setLocaleCookie('es');
    unsubscribe();
    setLocaleCookie('en');

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(document.cookie).toContain('NEXT_LOCALE=en');
  });
});
