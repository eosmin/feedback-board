'use client';

import { LogOut } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactElement } from 'react';
import { useState } from 'react';

import { createSupabaseBrowserClient } from '../../lib/supabase/client';
import { useNavigate } from '../../lib/use-navigate';

/**
 * Signs the caller out of Supabase Auth and returns to `/login`. Net-new — no sign-out affordance
 * existed anywhere before the dashboard shell (TDD.md §13 step 19.7 follow-up) added a topbar.
 */
export function SignOutButton(): ReactElement {
  const t = useTranslations('dashboard.shell');
  const navigate = useNavigate();
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function handleSignOut(): Promise<void> {
    setIsSigningOut(true);
    const supabase = createSupabaseBrowserClient();
    // The result is deliberately not inspected. `signOut()` removes the local session *before* it
    // returns a network or server error, so after it the browser is signed out whatever the
    // server said: staying on the page would only show a dashboard whose next request is a 401.
    try {
      await supabase.auth.signOut();
    } catch {
      // A thrown error leaves the same local state; go to `/login` regardless.
    }
    navigate.push('/login');
    navigate.refresh();
  }

  return (
    <button
      type="button"
      // The label is hidden below `sm`, where the header has no room for it next to the menu button.
      aria-label={t('signOut')}
      disabled={isSigningOut || navigate.isPending}
      onClick={() => void handleSignOut()}
      className="inline-flex h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-control px-2 text-body font-medium sm:px-3 md:h-auto md:py-2 text-text-muted transition-colors hover:bg-surface-sunken hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-50"
    >
      <LogOut className="h-4 w-4" aria-hidden="true" />
      <span className="hidden sm:inline">{t('signOut')}</span>
    </button>
  );
}
