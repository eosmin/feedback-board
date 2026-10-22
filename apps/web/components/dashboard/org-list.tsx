import type { OrgSummary } from '@feedback-board/shared';
import { useTranslations } from 'next-intl';
import type { ReactElement } from 'react';

import { Badge, Card, Link } from '../ui';

/** Shared with `app/dashboard/(picker)/loading.tsx` so the skeleton grid cannot drift from the real one. */
export const ORG_GRID_CLASSNAME = 'grid gap-3 sm:grid-cols-2 lg:grid-cols-3';

interface OrgListProps {
  orgs: OrgSummary[];
}

/**
 * Renders the caller's orgs as a grid of cards (TDD §11, §12). Each card links to its dashboard
 * overview at `/dashboard/[orgSlug]` (Step 19.2) — this component itself never fetches or mutates,
 * and the empty state is the caller's concern. The link's `::after` stretches over the whole card
 * so the padding is clickable too, not just the text.
 */
export function OrgList({ orgs }: OrgListProps): ReactElement {
  const t = useTranslations('dashboard');

  return (
    <ul className={ORG_GRID_CLASSNAME}>
      {orgs.map((org) => (
        <Card
          as="li"
          key={org.id}
          className="relative transition-colors hover:border-border-strong hover:bg-surface has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-focus"
        >
          <Link
            href={`/dashboard/${org.slug}`}
            className="flex flex-col gap-3 focus-visible:outline-none after:absolute after:inset-0 after:content-['']"
          >
            <span className="truncate font-medium text-text">{org.name}</span>
            <span className="flex flex-wrap items-center gap-2">
              <Badge>{t(`planBadge.${org.plan}`)}</Badge>
              <Badge tone="neutral">{t(`roles.${org.role}`)}</Badge>
            </span>
          </Link>
        </Card>
      ))}
    </ul>
  );
}
