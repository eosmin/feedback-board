import { useTranslations } from 'next-intl';
import type { ReactElement } from 'react';

import { Card, Skeleton } from '../../../../components/ui';

const BOARD_PLACEHOLDERS = 3;

/**
 * The overview before its data lands: the "Boards" title (static, so the real text), a skeleton
 * for the plan badge (data), the usage block and create button row, and a few board rows at the
 * height of the real cards. The `<main>` box comes from the global `main` rule, like the page.
 */
export default function OrgLoading(): ReactElement {
  const t = useTranslations('dashboard.orgOverview');
  const tCommon = useTranslations('common');

  return (
    <main aria-busy="true">
      <span role="status" className="sr-only">
        {tCommon('loading')}
      </span>
      {/* Same box as `PageHeader` with a badge: keep the two in step. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-display text-text">{t('boardsTitle')}</h1>
          <Skeleton className="h-5 w-24 rounded-full" />
        </div>
      </div>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Skeleton className="h-10 w-56" />
          <Skeleton className="h-10 w-40" />
        </div>
        <ul className="flex flex-col gap-2">
          {Array.from({ length: BOARD_PLACEHOLDERS }, (_, index) => (
            <Card as="li" key={index}>
              <Skeleton className="h-6 w-full" />
            </Card>
          ))}
        </ul>
      </div>
    </main>
  );
}
