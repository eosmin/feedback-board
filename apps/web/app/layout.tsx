import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages, getTranslations } from 'next-intl/server';
import { Suspense, type ReactElement, type ReactNode } from 'react';

import { NavigationProgress, ToastProvider } from '../components/ui';
import { THEME_INIT_SCRIPT } from '../lib/theme';
import '../styles/globals.css';

// `--font-inter` is mapped to Tailwind's `font-sans` in globals.css. `next/font` self-hosts the
// file at build time, so there is no request to Google and no layout shift on swap.
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('common');
  return {
    title: { default: t('appName'), template: `%s · ${t('appName')}` },
    description: t('appDescription'),
  };
}

// Hex, matching `--color-surface` in each theme (globals.css): `theme-color` has no oklch support
// in every browser. Follows the OS, as the UI does until the user toggles.
export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fafafa' },
    { media: '(prefers-color-scheme: dark)', color: '#09090b' },
  ],
};

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}): Promise<ReactElement> {
  const [locale, messages] = await Promise.all([getLocale(), getMessages()]);

  return (
    // `suppressHydrationWarning`: the init script adds `.dark` to <html> before React hydrates.
    <html lang={locale} className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <NextIntlClientProvider messages={messages}>
          <ToastProvider>
            {/* `useSearchParams` in the bar needs a boundary, or every page loses static rendering. */}
            <Suspense fallback={null}>
              <NavigationProgress />
            </Suspense>
            {children}
          </ToastProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
