import type { ReactElement, ReactNode } from 'react';

import { LocaleSwitcher, ThemeToggle } from '../ui';
import { SignOutButton } from './sign-out-button';

interface DashboardHeaderProps {
  /** The left slot: the org switcher inside an org, the app name on the org picker. */
  children: ReactNode;
}

/**
 * The account bar shared by the org picker and the org layout, so theme, language and sign out
 * are reachable from every authenticated page and can't drift apart between the two.
 */
export function DashboardHeader({ children }: DashboardHeaderProps): ReactElement {
  return (
    <header className="flex items-center justify-between gap-2 border-b border-border bg-surface-raised px-4 py-2">
      <div className="min-w-0">{children}</div>
      <div className="flex items-center gap-1">
        <ThemeToggle />
        <LocaleSwitcher />
        <SignOutButton />
      </div>
    </header>
  );
}
