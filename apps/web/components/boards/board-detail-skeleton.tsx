import { useTranslations } from 'next-intl';
import type { ReactElement } from 'react';

import { Card, Skeleton } from '../ui';

const POST_PLACEHOLDERS = 3;

/**
 * The board page before its data lands, drawn at the real page's proportions: title and the two
 * header actions (share and new feedback, which every role gets), the AI summary panel and a few
 * posts. The panel is OWNER/ADMIN only and the role is not known yet, so a MEMBER sees it vanish
 * once the page loads; the product's main audience is the admin, which is the case worth stable.
 * Shared by the route's `loading.tsx` and by `BoardDetailView` while it fetches, so the two
 * hand-offs are the same picture. The `<main>` box (width, padding, gap) comes from the global
 * `main` rule, like the real page.
 */
export function BoardDetailSkeleton(): ReactElement {
  const t = useTranslations('common');

  return (
    <main aria-busy="true">
      <span role="status" className="sr-only">
        {t('loading')}
      </span>
      {/* Same box as `PageHeader`: keep the two in step. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Skeleton className="h-8 w-48" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-10 w-44" />
        </div>
      </div>
      <Card as="section">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="mt-2 h-10 w-52" />
        <Skeleton className="mt-1.5 h-4 w-56" />
      </Card>
      <ul className="flex flex-col gap-4">
        {Array.from({ length: POST_PLACEHOLDERS }, (_, index) => (
          <Card as="li" key={index}>
            <Skeleton className="h-24 w-full" />
          </Card>
        ))}
      </ul>
    </main>
  );
}
