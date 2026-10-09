'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { magicLinkRequestSchema, type MagicLinkRequestInput } from '@feedback-board/shared';
import { CheckCircle2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactElement } from 'react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { createSupabaseBrowserClient } from '../../lib/supabase/client';
import { Button, Input } from '../ui';

export interface MagicLinkFormProps {
  /** Carried through `emailRedirectTo` so `/auth/callback` lands back on the originating page. */
  redirectTo?: string | undefined;
}

/**
 * The only sign-in surface in this project (TDD §3.4, §12): magic-link email, no password field
 * and no OAuth button. `signInWithOtp` runs against Supabase Auth directly from the browser — it
 * never goes through `apps/api`, which carries no auth endpoints of its own (TDD §2.6.5).
 */
export function MagicLinkForm({ redirectTo }: MagicLinkFormProps): ReactElement {
  const t = useTranslations('login');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<MagicLinkRequestInput>({
    resolver: zodResolver(magicLinkRequestSchema),
  });

  async function onSubmit(values: MagicLinkRequestInput): Promise<void> {
    setSubmitError(null);
    const supabase = createSupabaseBrowserClient();
    const callbackUrl = new URL('/auth/callback', window.location.origin);
    if (redirectTo !== undefined) {
      callbackUrl.searchParams.set('next', redirectTo);
    }

    const { error } = await supabase.auth.signInWithOtp({
      email: values.email,
      options: { emailRedirectTo: callbackUrl.toString() },
    });

    if (error) {
      setSubmitError(t('error'));
      return;
    }

    setSentTo(values.email);
  }

  if (sentTo !== null) {
    return (
      <div className="flex flex-col items-center gap-2 text-center" role="status">
        <CheckCircle2 className="size-8 text-accent-text" aria-hidden="true" />
        <p>{t('checkEmail', { email: sentTo })}</p>
      </div>
    );
  }

  return (
    <form
      onSubmit={(event) => void handleSubmit(onSubmit)(event)}
      noValidate
      className="flex flex-col gap-3"
    >
      <label htmlFor="email" className="text-sm font-medium text-text">
        {t('emailLabel')}
      </label>
      <Input
        id="email"
        type="email"
        autoComplete="email"
        aria-invalid={errors.email !== undefined}
        {...register('email')}
      />
      {errors.email !== undefined && (
        <p role="alert" className="text-sm text-danger">
          {t('emailInvalid')}
        </p>
      )}
      {submitError !== null && (
        <p role="alert" className="text-sm text-danger">
          {submitError}
        </p>
      )}
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? t('sending') : t('submit')}
      </Button>
    </form>
  );
}
