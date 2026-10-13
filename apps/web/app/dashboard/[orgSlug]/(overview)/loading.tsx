import { useTranslations } from 'next-intl';
import type { ReactElement } from 'react';

import { Card, Skeleton } from '../../../../components/ui';

const BOARD_PLACEHOLDERS = 3;

/**
 * The org overview before its data lands: the title and plan badge (data), the "Boards" heading
 * (static, so the real text), the create button and a few board rows. The `<main>` box comes from
 * the global `main` rule, like the real page.
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
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-5 w-24 rounded-full" />
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-medium text-text">{t('boardsTitle')}</h2>
        <div className="flex flex-col gap-3">
          <div className="flex justify-end">
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
      </div>
    </main>
  );
}
