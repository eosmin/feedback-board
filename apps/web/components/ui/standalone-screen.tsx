import type { ReactElement, ReactNode } from 'react';

import { PreferencesBar } from './preferences-bar';

/**
 * Frame for the screens that render outside any layout with a header (global not-found and
 * error): centred on the viewport, with theme and language still reachable. The org-level
 * boundaries render the bare state components instead, inside the dashboard shell.
 */
export function StandaloneScreen({ children }: { children: ReactNode }): ReactElement {
  return (
    <>
      <PreferencesBar />
      <main className="flex min-h-dvh items-center justify-center px-4 py-16">{children}</main>
    </>
  );
}
