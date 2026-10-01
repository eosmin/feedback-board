import { useTranslations } from 'next-intl';
import Link from 'next/link';
import type { ReactElement } from 'react';

import { Alert } from '../ui';

interface PostLimitUpgradePromptProps {
  /** The org slug the "Upgrade to Pro" link routes to (TDD §3.9, §12). */
  orgSlug: string;
}

/**
 * Renders a `403 PLAN_LIMIT` response for the `posts` limit as an inline upgrade prompt — the
 * board detail page's own call site, distinct from `PlanLimitUpgradePrompt` (Step 19.2's
 * `boards` limit): each limit's copy and trigger differ, so each gets its own component rather
 * than a shared "any limit" abstraction (TDD §3.9, §13 step 19.3).
 */
export function PostLimitUpgradePrompt({ orgSlug }: PostLimitUpgradePromptProps): ReactElement {
  const t = useTranslations('dashboard.boardDetail.planLimit.posts');

  return (
    <Alert title={t('title')} description={t('description')}>
      <Link href={`/dashboard/${orgSlug}/billing`} className="font-medium text-brand-700 underline">
        {t('cta')}
      </Link>
    </Alert>
  );
}
