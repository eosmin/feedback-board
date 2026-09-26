'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { magicLinkRequestSchema, type MagicLinkRequestInput } from '@feedback-board/shared';
import { CheckCircle2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactElement } from 'react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { createSupabaseBrowserClient } from '../../lib/supabase/client';

/**
 * The only sign-in surface in this project (TDD §3.4, §12): magic-link email, no password field
 * and no OAuth button. `signInWithOtp` runs against Supabase Auth directly from the browser — it
 * never goes through `apps/api`, which carries no auth endpoints of its own (TDD §2.6.5).
 */
export function MagicLinkForm(): ReactElement {
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
    const { error } = await supabase.auth.signInWithOtp({
      email: values.email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
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
        <CheckCircle2 className="size-8 text-brand-500" aria-hidden="true" />
        <p>{t('checkEmail', { email: sentTo })}</p>
      </div>
    );
  }

  return (
    <form onSubmit={(event) => void handleSubmit(onSubmit)(event)} noValidate>
      <label htmlFor="email">{t('emailLabel')}</label>
      <input
        id="email"
        type="email"
        autoComplete="email"
        aria-invalid={errors.email !== undefined}
        {...register('email')}
      />
      {errors.email !== undefined && <p role="alert">{t('emailInvalid')}</p>}
      {submitError !== null && <p role="alert">{submitError}</p>}
      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? t('sending') : t('submit')}
      </button>
    </form>
  );
}
