import type { OrgDetail } from '@feedback-board/shared';
import { CreditCard, KanbanSquare, Webhook } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import type { ReactElement } from 'react';

import { Badge } from '../ui';

interface DashboardSidebarProps {
  orgSlug: string;
  org: OrgDetail;
}

/**
 * The dashboard's nav (TDD.md §13 step 19.7 follow-up — a real layout shell instead of each page
 * owning its own root markup). Billing is OWNER-only and webhooks is OWNER/ADMIN-only in the API
 * route table (TDD §11); the same links a MEMBER would 404 on if they typed the URL are hidden
 * here, since a role check that only exists as `notFound()` inside the page reads as a broken
 * link, not a boundary.
 */
export async function DashboardSidebar({ orgSlug, org }: DashboardSidebarProps): Promise<ReactElement> {
  const t = await getTranslations('dashboard');
  const canBill = org.role === 'OWNER';
  const canManageWebhooks = org.role === 'OWNER' || org.role === 'ADMIN';

  return (
    <nav
      aria-label={t('shell.nav.boards')}
      className="flex w-full shrink-0 flex-col gap-1 border-b border-border bg-surface-raised p-4 md:sticky md:top-0 md:h-dvh md:w-56 md:self-start md:overflow-y-auto md:border-b-0 md:border-r"
    >
      <div className="mb-3 flex min-w-0 items-center justify-between gap-2 px-2">
        <span className="min-w-0 truncate text-title text-text">{org.name}</span>
        <span className="shrink-0">
          <Badge>{t(`planBadge.${org.plan}`)}</Badge>
        </span>
      </div>

      <Link
        href={`/dashboard/${orgSlug}`}
        className="flex items-center gap-2 rounded-control px-2 py-1.5 text-body text-text-muted transition-colors hover:bg-surface-sunken hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
      >
        <KanbanSquare className="h-4 w-4 text-text-subtle" aria-hidden="true" />
        {t('shell.nav.boards')}
      </Link>

      {canBill && (
        <Link
          href={`/dashboard/${orgSlug}/billing`}
          className="flex items-center gap-2 rounded-control px-2 py-1.5 text-body text-text-muted transition-colors hover:bg-surface-sunken hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          <CreditCard className="h-4 w-4 text-text-subtle" aria-hidden="true" />
          {t('shell.nav.billing')}
        </Link>
      )}

      {canManageWebhooks && (
        <Link
          href={`/dashboard/${orgSlug}/webhooks`}
          className="flex items-center gap-2 rounded-control px-2 py-1.5 text-body text-text-muted transition-colors hover:bg-surface-sunken hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          <Webhook className="h-4 w-4 text-text-subtle" aria-hidden="true" />
          {t('shell.nav.webhooks')}
        </Link>
      )}

      <Link
        href="/dashboard"
        className="mt-auto rounded-control px-2 py-1.5 text-body text-text-muted transition-colors hover:bg-surface-sunken hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
      >
        {t('shell.backToOrgs')}
      </Link>
    </nav>
  );
}
