'use client';

import { useTranslations } from 'next-intl';
import type { ReactElement } from 'react';

import { MagicLinkForm } from '../../components/auth/magic-link-form';

/**
 * `/login` is a Client Component (TDD §12): the magic-link form calls Supabase Auth directly
 * from the browser via `signInWithOtp`, so there is no server-side data fetch here to justify a
 * Server Component.
 */
export default function LoginPage(): ReactElement {
  const t = useTranslations('login');

  return (
    <main>
      <h1>{t('title')}</h1>
      <MagicLinkForm />
    </main>
  );
}
