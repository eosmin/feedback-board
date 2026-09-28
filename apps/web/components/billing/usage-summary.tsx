import type { OrgDetail } from '@feedback-board/shared';
import { useTranslations } from 'next-intl';
import type { ReactElement } from 'react';

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
    <dl>
      <div>
        <dt>{t('boards')}</dt>
        <dd>
          {usage.boards.used} / {usage.boards.cap === null ? t('unlimited') : usage.boards.cap}
        </dd>
      </div>
      <div>
        <dt>{t('posts')}</dt>
        <dd>
          {usage.posts.used} / {usage.posts.cap === null ? t('unlimited') : usage.posts.cap}
        </dd>
      </div>
      <div>
        <dt>{t('webhooks')}</dt>
        <dd>{usage.webhooks.available ? t('available') : t('unavailable')}</dd>
      </div>
    </dl>
  );
}
