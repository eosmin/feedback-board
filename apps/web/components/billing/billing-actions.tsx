'use client';

import { billingSessionSchema, type Plan } from '@feedback-board/shared';
import { useTranslations } from 'next-intl';
import type { ReactElement } from 'react';
import { useState } from 'react';

import { apiFetch } from '../../lib/api-client';
import { Button } from '../ui';

interface BillingActionsProps {
  orgSlug: string;
  plan: Plan;
}

/**
 * Checkout/Portal buttons (TDD §3.6, §13 step 19.4): both routes return a Stripe-hosted URL the
 * browser redirects to full-page — there is nothing to render on success, Stripe owns that page,
 * and the org only flips plan once its webhook lands (§3.6 step 4), not on this redirect. FREE
 * shows "Upgrade to Pro" (Checkout); PRO shows "Manage billing" (Portal) — never both, since a
 * PRO org has nothing to check out and a FREE org has no subscription to manage.
 */
export function BillingActions({ orgSlug, plan }: BillingActionsProps): ReactElement {
  const t = useTranslations('dashboard.billing.actions');
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startSession(kind: 'checkout' | 'portal'): Promise<void> {
    setError(null);
    setIsRedirecting(true);

    try {
      const session = await apiFetch(
        `/orgs/${orgSlug}/billing/${kind}-session`,
        billingSessionSchema,
        { method: 'POST' },
      );
      window.location.href = session.url;
    } catch {
      setIsRedirecting(false);
      setError(t('error'));
    }
  }

  return (
    <div>
      {plan === 'FREE' ? (
        <Button disabled={isRedirecting} onClick={() => void startSession('checkout')}>
          {isRedirecting ? t('redirecting') : t('upgrade')}
        </Button>
      ) : (
        <Button disabled={isRedirecting} onClick={() => void startSession('portal')}>
          {isRedirecting ? t('redirecting') : t('managePortal')}
        </Button>
      )}
      {error !== null && (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
