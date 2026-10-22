'use client';

import { NextIntlClientProvider, type AbstractIntlMessages } from 'next-intl';
import { useSyncExternalStore, type ReactElement } from 'react';

import { RouteError, StandaloneScreen } from '../components/ui';
import { inter } from '../lib/fonts';
import { DEFAULT_LOCALE, getClientLocale, subscribeLocale } from '../lib/locales';
import { THEME_INIT_SCRIPT } from '../lib/theme';
import en from '../messages/en.json';
import es from '../messages/es.json';
import '../styles/globals.css';

// Only `common` is needed here (`routeError`, theme and language labels): this file replaces the
// root layout, so it ships its own catalogs instead of the server-resolved ones.
const CATALOGS: Record<'en' | 'es', AbstractIntlMessages> = {
  en: { common: en.common },
  es: { common: es.common },
};
const APP_NAMES: Record<'en' | 'es', string> = { en: en.common.appName, es: es.common.appName };

/**
 * The last-resort boundary, shown only when the root layout itself throws. It replaces that
 * layout, so it owns `<html>`, the stylesheet, the theme script and the intl provider. The locale
 * is resolved in the browser because nothing server-side is left to resolve it.
 */
export default function GlobalError({ retry }: { retry: () => void }): ReactElement {
  const locale = useSyncExternalStore(subscribeLocale, getClientLocale, () => DEFAULT_LOCALE) as
    'en' | 'es'; // `getClientLocale` only returns codes from `AVAILABLE_LOCALES`

  return (
    <html lang={locale} className={inter.variable} suppressHydrationWarning>
      <head>
        <title>{APP_NAMES[locale]}</title>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <NextIntlClientProvider locale={locale} messages={CATALOGS[locale]}>
          <StandaloneScreen>
            <RouteError retry={retry} />
          </StandaloneScreen>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
