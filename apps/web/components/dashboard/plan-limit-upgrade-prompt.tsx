import { useTranslations } from 'next-intl';
import Link from 'next/link';
import type { ReactElement } from 'react';

import { Alert } from '../ui';

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
    <Alert title={t('title')} description={t('description')}>
      <Link href={`/dashboard/${orgSlug}/billing`} className="font-medium text-brand-700 underline">
        {t('cta')}
      </Link>
    </Alert>
  );
}
