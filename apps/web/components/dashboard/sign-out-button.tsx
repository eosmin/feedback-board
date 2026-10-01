'use client';

import { LogOut } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import type { ReactElement } from 'react';
import { useState } from 'react';

import { createSupabaseBrowserClient } from '../../lib/supabase/client';

/**
 * Signs the caller out of Supabase Auth and returns to `/login`. Net-new — no sign-out affordance
 * existed anywhere before the dashboard shell (TDD.md §13 step 19.7 follow-up) added a topbar.
 */
export function SignOutButton(): ReactElement {
  const t = useTranslations('dashboard.shell');
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function handleSignOut(): Promise<void> {
    setIsSigningOut(true);
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <button
      type="button"
      disabled={isSigningOut}
      onClick={() => void handleSignOut()}
      className="inline-flex items-center gap-1.5 rounded-control px-3 py-2 text-body font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <LogOut className="h-4 w-4" aria-hidden="true" />
      {t('signOut')}
    </button>
  );
}
