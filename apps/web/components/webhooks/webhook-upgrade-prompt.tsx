import { useTranslations } from 'next-intl';
import Link from 'next/link';
import type { ReactElement } from 'react';

import { Alert } from '../ui';

interface WebhookUpgradePromptProps {
  orgSlug: string;
}

/**
 * Shown instead of `CreateWebhookForm` when `usage.webhooks.available` is false (TDD §3.9, §11,
 * §13 step 19.5) — the FREE-plan counterpart of `PlanLimitUpgradePrompt`, split out because its
 * copy and the limit it names differ (webhooks are plan-gated by availability, not a count).
 */
export function WebhookUpgradePrompt({ orgSlug }: WebhookUpgradePromptProps): ReactElement {
  const t = useTranslations('dashboard.webhooks.upgradePrompt');

  return (
    <Alert title={t('title')} description={t('description')}>
      <Link href={`/dashboard/${orgSlug}/billing`} className="font-medium text-accent-text underline">
        {t('cta')}
      </Link>
    </Alert>
  );
}
