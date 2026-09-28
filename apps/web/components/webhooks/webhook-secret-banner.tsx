'use client';

import { useTranslations } from 'next-intl';
import type { ReactElement } from 'react';

interface WebhookSecretBannerProps {
  secret: string;
  onDismiss: () => void;
}

/**
 * The signing secret is returned once, in the `POST` response, and never again (TDD §3.5) —
 * this banner is the only place it is ever rendered, and it disappears on dismiss without being
 * re-fetchable.
 */
export function WebhookSecretBanner({ secret, onDismiss }: WebhookSecretBannerProps): ReactElement {
  const t = useTranslations('dashboard.webhooks.secretBanner');

  return (
    <div role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-4">
      <h3 className="font-medium">{t('title')}</h3>
      <p className="mt-1 text-sm">{t('description')}</p>
      <code className="mt-2 block break-all rounded bg-white px-2 py-1 text-sm">{secret}</code>
      <button type="button" onClick={onDismiss} className="mt-2 font-medium text-brand-700 underline">
        {t('dismiss')}
      </button>
    </div>
  );
}
