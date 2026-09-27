import type { OrgSummary } from '@feedback-board/shared';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import type { ReactElement } from 'react';

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
    return <p>{t('empty')}</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {orgs.map((org) => (
        <li key={org.id} className="rounded-lg border border-brand-100 p-4">
          <Link href={`/dashboard/${org.slug}`} className="flex items-center justify-between gap-2">
            <span className="font-medium">{org.name}</span>
            <span className="inline-flex items-center rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-800">
              {t(`planBadge.${org.plan}`)}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
