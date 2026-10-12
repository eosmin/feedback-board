'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { magicLinkRequestSchema, type MagicLinkRequestInput } from '@feedback-board/shared';
import { MailCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactElement } from 'react';
import { useEffect, useId, useState } from 'react';
import { useForm } from 'react-hook-form';

import { createSupabaseBrowserClient } from '../../lib/supabase/client';
import { Alert, Button, Input } from '../ui';

/** Seconds before "Resend" re-enables; keeps a double-click from burning Supabase's per-address email rate limit. */
const RESEND_COOLDOWN_SECONDS = 30;

export interface MagicLinkFormProps {
  /** Carried through `emailRedirectTo` so `/auth/callback` lands back on the originating page. */
  redirectTo?: string | undefined;
  /** `/auth/callback` bounced the visitor here; the notice goes away once they request a new link. */
  callbackFailed?: boolean;
}

/**
 * The only sign-in surface in this project (TDD §3.4, §12): magic-link email, no password field
 * and no OAuth button. `signInWithOtp` runs against Supabase Auth directly from the browser — it
 * never goes through `apps/api`, which carries no auth endpoints of its own (TDD §2.6.5).
 */
export function MagicLinkForm({
  redirectTo,
  callbackFailed = false,
}: MagicLinkFormProps): ReactElement {
  const t = useTranslations('login');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [showCallbackError, setShowCallbackError] = useState(callbackFailed);
  const errorId = useId();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<MagicLinkRequestInput>({
    resolver: zodResolver(magicLinkRequestSchema),
  });

  useEffect(() => {
    if (cooldown <= 0) {
      return;
    }
    const timer = setTimeout(() => setCooldown((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function sendLink(email: string): Promise<boolean> {
    setSubmitError(null);
    const supabase = createSupabaseBrowserClient();
    const callbackUrl = new URL('/auth/callback', window.location.origin);
    if (redirectTo !== undefined) {
      callbackUrl.searchParams.set('next', redirectTo);
    }

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: callbackUrl.toString() },
    });

    if (error) {
      setSubmitError(t('error'));
      return false;
    }

    setCooldown(RESEND_COOLDOWN_SECONDS);
    return true;
  }

  async function onSubmit(values: MagicLinkRequestInput): Promise<void> {
    setShowCallbackError(false);
    if (await sendLink(values.email)) {
      setSentTo(values.email);
    }
  }

  async function onResend(email: string): Promise<void> {
    setResending(true);
    try {
      await sendLink(email);
    } catch {
      setSubmitError(t('error'));
    } finally {
      setResending(false);
    }
  }

  function onChangeEmail(): void {
    setSentTo(null);
    setSubmitError(null);
    // useForm lives in this component, so the old address survives the input unmounting.
    reset({ email: '' });
    setCooldown(0);
  }

  if (sentTo !== null) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col items-center gap-2 text-center" role="status">
          <MailCheck className="size-8 text-accent-text" aria-hidden="true" />
          <p className="text-body font-medium text-text">{t('checkEmailTitle')}</p>
          <p className="text-body text-text-muted">{t('checkEmail', { email: sentTo })}</p>
        </div>
        <p role="alert" className="min-h-5 text-sm text-danger">
          {submitError}
        </p>
        <div className="flex flex-col gap-2">
          <Button
            type="button"
            variant="secondary"
            pending={resending}
            disabled={cooldown > 0}
            onClick={() => void onResend(sentTo)}
          >
            {cooldown > 0 ? t('resendIn', { seconds: String(cooldown) }) : t('resend')}
          </Button>
          <Button type="button" variant="secondary" onClick={onChangeEmail}>
            {t('changeEmail')}
          </Button>
        </div>
      </div>
    );
  }

  const fieldError = errors.email !== undefined ? t('emailInvalid') : submitError;

  return (
    <form
      onSubmit={(event) => void handleSubmit(onSubmit)(event)}
      noValidate
      className="flex flex-col gap-3"
    >
      {showCallbackError && (
        <Alert
          variant="danger"
          title={t('callbackError.title')}
          description={t('callbackError.description')}
        />
      )}
      <label htmlFor="email" className="text-sm font-medium text-text">
        {t('emailLabel')}
      </label>
      <Input
        id="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        autoCapitalize="none"
        spellCheck={false}
        autoFocus
        placeholder={t('emailPlaceholder')}
        aria-invalid={errors.email !== undefined}
        aria-describedby={errorId}
        {...register('email')}
      />
      {/* Always mounted so an error appearing does not push the button down. */}
      <p id={errorId} role="alert" className="min-h-5 text-sm text-danger">
        {fieldError}
      </p>
      <Button type="submit" pending={isSubmitting}>
        {isSubmitting ? t('sending') : t('submit')}
      </Button>
    </form>
  );
}
