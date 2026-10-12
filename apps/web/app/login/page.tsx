import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import type { ReactElement } from 'react';

import { MagicLinkForm } from '../../components/auth/magic-link-form';
import { Alert, Card, PageHeader, PreferencesBar } from '../../components/ui';
import { LOGIN_ERROR_CALLBACK } from '../../lib/login-error';
import { safeRedirectPath } from '../../lib/safe-redirect';
import { getOptionalUser } from '../../lib/supabase/require-user';

interface LoginPageProps {
  searchParams: Promise<{ next?: string; error?: string }>;
}

/**
 * `/login` (TDD §12). A Server Component now (the magic-link form itself stays a client island)
 * so it can check for an existing session before rendering: a signed-in visitor who followed a
 * `/login?next=...` deep link (e.g. a shared private board) should land there immediately rather
 * than see the sign-in form again. `next` is threaded through to `MagicLinkForm` so a visitor who
 * does need to sign in still returns to the deep link after `/auth/callback`.
 */
export default async function LoginPage({ searchParams }: LoginPageProps): Promise<ReactElement> {
  const { next, error } = await searchParams;
  const redirectTo = next === undefined ? undefined : safeRedirectPath(next, '/dashboard');

  const user = await getOptionalUser();
  if (user !== null) {
    redirect(redirectTo ?? '/dashboard');
  }

  const t = await getTranslations('login');

  return (
    <>
      <PreferencesBar />
      <main className="flex min-h-dvh items-center justify-center px-4 py-16">
        <Card className="flex w-full max-w-sm flex-col gap-4 p-6">
          <PageHeader title={t('title')} />
          {error === LOGIN_ERROR_CALLBACK && (
            <Alert
              title={t('callbackError.title')}
              description={t('callbackError.description')}
            />
          )}
          <MagicLinkForm redirectTo={redirectTo} />
        </Card>
      </main>
    </>
  );
}
