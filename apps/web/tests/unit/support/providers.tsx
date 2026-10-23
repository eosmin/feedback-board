import { NextIntlClientProvider } from 'next-intl';
import type { ReactElement, ReactNode } from 'react';

import { ToastProvider } from '../../../components/ui';
import messages from '../../../messages/en.json';

/** What every board component needs around it: the English catalog and the toast region. */
export function Providers({ children }: { children: ReactNode }): ReactElement {
  return (
    <NextIntlClientProvider locale="en" messages={messages}>
      <ToastProvider>{children}</ToastProvider>
    </NextIntlClientProvider>
  );
}
