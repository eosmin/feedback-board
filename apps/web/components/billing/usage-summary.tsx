import type { OrgDetail } from '@feedback-board/shared';
import { useTranslations } from 'next-intl';
import type { ReactElement } from 'react';

import { Card } from '../ui';

interface UsageSummaryProps {
  /** `org.usage` from `GET /orgs/:orgSlug` — never counted client-side (TDD §3.9, §11). */
  usage: OrgDetail['usage'];
}

/**
 * Renders current caps vs usage read straight from the API response (TDD §13 step 19.4). A
 * `null` cap means unlimited, mirroring `PLAN_LIMITS` (`packages/shared/src/constants/plans.ts`)
 * — rendered as the `unlimited` copy rather than a literal `null`.
 */
export function UsageSummary({ usage }: UsageSummaryProps): ReactElement {
  const t = useTranslations('dashboard.billing.usage');

  return (
    <Card as="dl" className="grid grid-cols-3 gap-4">
      <div>
        <dt className="text-xs font-medium uppercase text-text-muted">{t('boards')}</dt>
        <dd className="mt-1 text-sm text-text">
          {usage.boards.used} / {usage.boards.cap === null ? t('unlimited') : usage.boards.cap}
        </dd>
      </div>
      <div>
        <dt className="text-xs font-medium uppercase text-text-muted">{t('posts')}</dt>
        <dd className="mt-1 text-sm text-text">
          {usage.posts.used} / {usage.posts.cap === null ? t('unlimited') : usage.posts.cap}
        </dd>
      </div>
      <div>
        <dt className="text-xs font-medium uppercase text-text-muted">{t('webhooks')}</dt>
        <dd className="mt-1 text-sm text-text">
          {usage.webhooks.available ? t('available') : t('unavailable')}
        </dd>
      </div>
    </Card>
  );
}
