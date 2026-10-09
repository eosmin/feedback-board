import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import type { ReactElement, ReactNode } from 'react';

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
        <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
