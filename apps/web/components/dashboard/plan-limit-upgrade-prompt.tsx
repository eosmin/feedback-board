import { useTranslations } from 'next-intl';
import Link from 'next/link';
import type { ReactElement } from 'react';

interface PlanLimitUpgradePromptProps {
  /** The org slug the "Upgrade to Pro" link routes to (TDD §3.9, §12). */
  orgSlug: string;
}

/**
 * Renders a `403 PLAN_LIMIT` response as an inline upgrade prompt linking to the billing page —
 * never a generic error toast (TDD §3.9, §13 step 19.2). Scoped to the `boards` limit here since
 * this is the only `@LimitedByPlan` gate the org overview page triggers; other limits (posts,
 * webhooks) get their own call sites in later steps rather than a shared "any limit" component,
 * since each one's copy and target route differ (TDD §12).
 */
export function PlanLimitUpgradePrompt({ orgSlug }: PlanLimitUpgradePromptProps): ReactElement {
  const t = useTranslations('dashboard.orgOverview.planLimit.boards');

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
