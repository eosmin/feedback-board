import type { OrgSummary } from '@feedback-board/shared';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import type { ReactElement } from 'react';

import { Badge, Card, EmptyState } from '../ui';

interface OrgListProps {
  orgs: OrgSummary[];
}

/**
 * Renders the caller's orgs (TDD §11, §12). Each entry links to its dashboard overview at
 * `/dashboard/[orgSlug]` (Step 19.2) — this component itself never fetches or mutates.
 */
export function OrgList({ orgs }: OrgListProps): ReactElement {
  const t = useTranslations('dashboard');

  if (orgs.length === 0) {
    return <EmptyState>{t('empty')}</EmptyState>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {orgs.map((org) => (
        <Card as="li" key={org.id}>
          <Link href={`/dashboard/${org.slug}`} className="flex items-center justify-between gap-2">
            <span className="font-medium">{org.name}</span>
            <Badge>{t(`planBadge.${org.plan}`)}</Badge>
          </Link>
        </Card>
      ))}
    </ul>
  );
}
