import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { Suspense, type ReactElement, type ReactNode } from 'react';

import { NavigationProgress } from '../components/ui';
import { THEME_INIT_SCRIPT } from '../lib/theme';
import '../styles/globals.css';

export const metadata: Metadata = {
  title: 'FeedbackBoard',
  description: 'Multi-tenant feedback and feature-voting boards',
};

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}): Promise<ReactElement> {
  const messages = await getMessages();

  return (
    // `suppressHydrationWarning`: the init script adds `.dark` to <html> before React hydrates.
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <NextIntlClientProvider messages={messages}>
          {/* `useSearchParams` in the bar needs a boundary, or every page loses static rendering. */}
          <Suspense fallback={null}>
            <NavigationProgress />
          </Suspense>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
