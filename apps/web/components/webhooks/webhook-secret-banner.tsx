'use client';

import { useTranslations } from 'next-intl';
import type { ReactElement } from 'react';

import { Alert, Button } from '../ui';

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
    <Alert title={t('title')} description={t('description')}>
      <code className="mb-2 block break-all rounded bg-surface-raised px-2 py-1 text-body text-text">{secret}</code>
      <Button variant="secondary" onClick={onDismiss}>
        {t('dismiss')}
      </Button>
    </Alert>
  );
}
