import { useTranslations } from 'next-intl';
import Link from 'next/link';
import type { ReactElement } from 'react';

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
    <div role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-4">
      <h3 className="font-medium">{t('title')}</h3>
      <p className="mt-1 text-sm">{t('description')}</p>
      <Link
        href={`/dashboard/${orgSlug}/billing`}
        className="mt-2 inline-block font-medium text-brand-700 underline"
      >
        {t('cta')}
      </Link>
    </div>
  );
}
